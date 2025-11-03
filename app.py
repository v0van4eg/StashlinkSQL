# app.py

import os
import zipfile
from flask import Flask, request, jsonify, render_template, send_from_directory
import sqlite3
import logging
import re
import unicodedata
from urllib.parse import quote

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'images'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 * 1024 # 16GB
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Логирование
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Конфигурация домена и базового URL
domain = "stachlink.mooo.com" # Используйте переменные окружения для продакшена
base_url = f"http://{domain}"  # Используем f-строку для подстановки значения переменной domain

# --- Вспомогательные функции ---
def safe_folder_name(name: str) -> str:
    """Преобразует строку в безопасное имя папки"""
    if not name:
        return "unnamed"
    name = unicodedata.normalize('NFKD', name)
    name = re.sub(r'[^\w\s-]', '', name, flags=re.UNICODE)
    name = re.sub(r'[-\s]+', '_', name, flags=re.UNICODE).strip('-_') # Заменяем пробелы на _
    return name[:255] if name else "unnamed"

# Инициализация SQLite базы данных
def init_db():
    conn = sqlite3.connect('files.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL, -- Относительный путь к файлу от images/, например: 'album1/article1/file.jpg'
            album_name TEXT NOT NULL,
            article_number TEXT NOT NULL, -- Добавлено для хранения имени артикула
            public_link TEXT NOT NULL, -- Прямая ссылка на файл, например: http://tecnobook/images/album1/article1/file.jpg
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

# Получение списка альбомов
def get_albums():
    conn = sqlite3.connect('files.db')
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT album_name FROM files")
    albums = [row[0] for row in cursor.fetchall()]
    conn.close()
    return albums

# Получение списка артикулов для указанного альбома
def get_articles(album_name):
    conn = sqlite3.connect('files.db')
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT article_number FROM files WHERE album_name=?", (album_name,))
    articles = [row[0] for row in cursor.fetchall()]
    conn.close()
    return articles

# Получение всех файлов из БД
def get_all_files():
    conn = sqlite3.connect('files.db')
    cursor = conn.cursor()
    # Добавлено поле article_number в SELECT
    cursor.execute(
        "SELECT filename, album_name, article_number, public_link, created_at FROM files ORDER BY created_at DESC"
    )
    results = cursor.fetchall()
    conn.close()
    return results

# Синхронизация БД с файловой системой
def sync_db_with_filesystem():
    """
    Синхронизирует базу данных с файловой системой.
    Удаляет из БД записи для файлов, которые больше не существуют в папке images.
    Возвращает списки удалённых и добавленных файлов (относительные пути).
    """
    conn = sqlite3.connect('files.db')
    cursor = conn.cursor()

    # 1. Получаем все записи из БД
    cursor.execute("SELECT filename FROM files")
    db_files = set(row[0] for row in cursor.fetchall())

    # 2. Получаем все файлы из папки images рекурсивно
    fs_files = set()
    allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.svg'}
    for root, dirs, files in os.walk(app.config['UPLOAD_FOLDER']):
        for file in files:
            _, ext = os.path.splitext(file.lower())
            if ext in allowed_extensions:
                # Относительный путь от UPLOAD_FOLDER
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, app.config['UPLOAD_FOLDER'])
                # Используем нормализованный путь (с / как разделитель для хранения в БД)
                fs_files.add(rel_path.replace(os.sep, '/'))

    # 3. Определяем, какие файлы нужно удалить из БД (есть в БД, нет в ФС)
    files_to_delete = db_files - fs_files

    # 4. Определяем, какие файлы нужно добавить в БД (есть в ФС, нет в БД)
    # Пока не реализуем добавление, так как добавление происходит через process_zip
    # files_to_add = fs_files - db_files

    # 5. Удаляем устаревшие записи из БД
    deleted_count = 0
    for rel_path in files_to_delete:
        cursor.execute("DELETE FROM files WHERE filename = ?", (rel_path,))
        deleted_count += cursor.rowcount

    conn.commit()
    conn.close()

    logger.info(f"Sync: Deleted {deleted_count} records from DB.")
    # Возвращаем только удалённые, так как добавление файлов из ФС вне процесса ZIP не предусмотрено
    return list(files_to_delete), []

# Обработка ZIP-архива
def process_zip(zip_path):
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            # Имя архива без расширения
            zip_basename = os.path.basename(zip_path)
            album_name_raw = os.path.splitext(zip_basename)[0]
            album_name = safe_folder_name(album_name_raw)

            album_path = os.path.join(app.config['UPLOAD_FOLDER'], album_name)
            os.makedirs(album_path, exist_ok=True)

            # Извлечение архива
            zip_ref.extractall(album_path)

            # Удаление старых записей для этого альбома из БД
            conn = sqlite3.connect('files.db')
            cursor = conn.cursor()
            cursor.execute("DELETE FROM files WHERE album_name = ?", (album_name,))
            conn.commit()
            conn.close()

            # Поддерживаемые графические расширения
            allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.svg'}

            # Проход по всем файлам в альбоме
            for root, dirs, files in os.walk(album_path):
                # Проверяем, что мы находимся в подкаталоге альбома (не в самом альбоме)
                rel_root = os.path.relpath(root, album_path)
                if rel_root == '.':
                    continue

                # Определяем артикул (подкаталог)
                if rel_root.count(os.sep) == 0: # Уровень подкаталога альбома
                    article_folder_raw = os.path.basename(root)
                    article_folder_norm = safe_folder_name(article_folder_raw)

                    # Переименовываем папку артикула, если нужно
                    original_article_path = root
                    normalized_article_path = os.path.join(os.path.dirname(root), article_folder_norm)
                    if original_article_path != normalized_article_path:
                        os.rename(original_article_path, normalized_article_path)
                        root = normalized_article_path

                    if files:
                        for file_name in files:
                            file_path = os.path.join(root, file_name)
                            if os.path.isfile(file_path):
                                # Проверяем расширение файла
                                _, ext = os.path.splitext(file_name.lower())
                                if ext not in allowed_extensions:
                                    logger.info(f"Skipping non-image file: {file_path}")
                                    continue # Пропускаем файл, если расширение не поддерживается

                                # Относительный путь от папки images
                                relative_file_path = os.path.relpath(file_path, app.config['UPLOAD_FOLDER']).replace(os.sep, '/')

                                # Имя файла
                                file_name = os.path.basename(relative_file_path)

                                # Формируем публичную ссылку
                                # Пример: http://tecnobook/images/album1/article1/file.jpg
                                # Используем '/' как разделитель, так как это часть URL
                                # Кодируем путь для корректной работы URL
                                encoded_path = quote(relative_file_path, safe='/')
                                public_link = f"{base_url}/images/{encoded_path}"

                                conn = sqlite3.connect('files.db')
                                cursor = conn.cursor()
                                # Добавлено поле article_number в INSERT
                                cursor.execute(
                                    "INSERT INTO files (filename, album_name, article_number, public_link) VALUES (?, ?, ?, ?)",
                                    (relative_file_path, album_name, article_folder_norm, public_link)
                                )
                                conn.commit()
                                conn.close()

            return True
    except Exception as e:
        logger.error(f"Error processing ZIP file: {e}")
        return False

# --- Routes ---
@app.route('/')
def index():
    return render_template('index.html', base_url=base_url)

# Эндпоинт синхронизации БД
@app.route('/api/sync', methods=['POST'])
def api_sync():
    try:
        deleted, added = sync_db_with_filesystem()
        return jsonify({
            'message': 'Synchronization completed successfully',
            'deleted': deleted,
            'added': added
        })
    except Exception as e:
        logger.error(f"Error in sync endpoint: {e}")
        return jsonify({'error': f'Synchronization failed: {str(e)}'}), 500

# Загрузка ZIP
@app.route('/upload', methods=['POST'])
def upload_zip():
    if 'zipfile' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['zipfile']

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:
        original_name = file.filename
        base_name = os.path.basename(original_name)
        name_without_ext, _ = os.path.splitext(base_name)
        safe_zip_name = safe_folder_name(name_without_ext) + '.zip'
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], safe_zip_name)
        file.save(file_path)

        success = process_zip(file_path)

        if success:
            os.remove(file_path)
            # Возвращаем имя альбома
            return jsonify({'message': 'Files uploaded successfully', 'album_name': safe_folder_name(name_without_ext)})
        else:
            return jsonify({'error': 'Failed to process ZIP file'}), 500

# API: список всех файлов
@app.route('/api/files')
def api_files():
    files = get_all_files()
    return jsonify(files)

# API: список альбомов
@app.route('/api/albums')
def api_albums():
    albums = get_albums()
    return jsonify(albums)

# API: список артикулов для альбома
@app.route('/api/articles/<album_name>')
def api_articles(album_name):
    articles = get_articles(album_name)
    return jsonify(articles)


# API: получение файлов для конкретного альбома (и опционально артикула)
@app.route('/api/files/<album_name>')
@app.route('/api/files/<album_name>/<article_name>')
def api_files_filtered(album_name, article_name=None):
    conn = sqlite3.connect('files.db')
    cursor = conn.cursor()

    if article_name:
        cursor.execute(
            "SELECT filename, album_name, article_number, public_link, created_at FROM files WHERE album_name=? AND article_number=? ORDER BY created_at DESC",
            (album_name, article_name)
        )
    else:
        cursor.execute(
            "SELECT filename, album_name, article_number, public_link, created_at FROM files WHERE album_name=? ORDER BY created_at DESC",
            (album_name,)
        )

    results = cursor.fetchall()
    conn.close()
    return jsonify(results)


# --- Main ---
if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)
