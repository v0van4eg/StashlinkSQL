# app/main.py
import os
import zipfile
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename
import sqlite3
import logging


app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 * 1024
# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Исправленная версия функции нормализации ---
import re
import unicodedata

# --- Исправленная версия функции нормализации ---
def normalize_name(name: str) -> str:
    """
    Преобразует строку в безопасное имя папки:
    - Сохраняет кириллицу, латиницу, цифры
    - Удаляет только недопустимые символы файловой системы
    - Пробелы и табуляции заменяются на '_'
    - Обрезает до 255 символов
    """
    if not name:
        return "unnamed"

    # Удаляем путь (на всякий случай)
    name = os.path.basename(name)

    # Убираем расширение, если есть (не всегда нужно, но для папок — да)
    if '.' in name and not name.startswith('.'):
        name = name.rsplit('.', 1)[0]

    # Нормализуем Unicode (NFC — стандартная форма)
    name = unicodedata.normalize('NFC', name)

    # Удаляем только реально опасные символы для файловой системы
    # Разрешаем: буквы (все алфавиты), цифры, пробелы, подчёркивания, дефисы
    # Запрещаем: \ / : * ? " < > | и другие control/спецсимволы
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', name)

    # Заменяем пробелы и табуляции на подчёркивания
    name = re.sub(r'[\s]+', '_', name)

    # Убираем множественные подчёркивания
    name = re.sub(r'_+', '_', name)

    # Обрезаем подчёркивания по краям
    name = name.strip('_')

    # Обрезаем до 255 символов (максимум для большинства ФС)
    name = name[:255] if name else "unnamed"

    return name

# Initialize SQLite database
def init_db():
    conn = sqlite3.connect('files.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL, -- Хранит относительный путь к файлу в uploads: album/article/original_filename.ext
            album_name TEXT NOT NULL,
            article_number TEXT NOT NULL,
            published BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()


# Get unique album names
def get_albums():
    conn = sqlite3.connect('files.db')
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT album_name FROM files")
    albums = [row[0] for row in cursor.fetchall()]
    conn.close()
    return albums


# Get articles for an album
def get_articles(album_name):
    conn = sqlite3.connect('files.db')
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT article_number FROM files WHERE album_name=?", (album_name,))
    articles = [row[0] for row in cursor.fetchall()]
    conn.close()
    return articles


# Get published links for an album and article
def get_published_links(album_name, article_number, offset=0, limit=20):
    conn = sqlite3.connect('files.db')
    cursor = conn.cursor()
    cursor.execute("""
        SELECT filename, created_at FROM files 
        WHERE album_name=? AND article_number=? AND published=1
        ORDER BY created_at DESC LIMIT ? OFFSET ?
    """, (album_name, article_number, limit, offset))
    results = cursor.fetchall()
    conn.close()
    return results


# Publish a file
def publish_file(filename):
    conn = sqlite3.connect('files.db')
    cursor = conn.cursor()
    cursor.execute("UPDATE files SET published=1 WHERE filename=?", (filename,))
    conn.commit()
    conn.close()


# Unpublish a file
def unpublish_file(filename):
    conn = sqlite3.connect('files.db')
    cursor = conn.cursor()
    cursor.execute("UPDATE files SET published=0 WHERE filename=?", (filename,))
    conn.commit()
    conn.close()


# Get all published files
def get_all_published_files():
    conn = sqlite3.connect('files.db')
    cursor = conn.cursor()
    cursor.execute(
        "SELECT filename, album_name, article_number, created_at FROM files WHERE published=1 ORDER BY created_at DESC")
    results = cursor.fetchall()
    conn.close()
    return results

# Get all files (published and unpublished)
def get_all_files():
    conn = sqlite3.connect('files.db')
    cursor = conn.cursor()
    cursor.execute(
        "SELECT filename, album_name, article_number, created_at, published FROM files ORDER BY created_at DESC")
    results = cursor.fetchall()
    conn.close()
    return results


# Process uploaded ZIP file
# Process uploaded ZIP file
def process_zip(zip_path):
    try:
        with zipfile.ZipFile(zip_path, 'r', metadata_encoding='utf-8') as zip_ref:
            # Get album name from zip file name and normalize it
            album_name_raw = os.path.splitext(os.path.basename(zip_path))[0]
            # Используем нормализованное имя архива для создания каталога
            album_name = normalize_name(album_name_raw)

            # Determine the base path for this album within uploads
            album_path = os.path.join(app.config['UPLOAD_FOLDER'], album_name)
            os.makedirs(album_path, exist_ok=True)

            # Extract all files into the album directory
            zip_ref.extractall(album_path)

            # Walk through the extracted album directory to find article subdirectories
            for root, dirs, files in os.walk(album_path):
                # Calculate the relative path from the album directory to the current directory
                rel_path = os.path.relpath(root, album_path)
                if rel_path == '.': # Skip the album root directory itself
                     continue
                # The immediate parent directory under album is the article directory
                if os.path.dirname(rel_path) == '.' or rel_path.count(os.sep) == 0:
                    # Normalize the article folder name
                    article_folder_name_raw = os.path.basename(root)
                    article_folder_name = normalize_name(article_folder_name_raw)

                    # Rename the directory to the normalized name if it's different
                    original_article_path = root
                    normalized_article_path = os.path.join(os.path.dirname(root), article_folder_name)
                    if original_article_path != normalized_article_path:
                        os.rename(original_article_path, normalized_article_path)
                        # Update root to the new path for subsequent operations
                        root = normalized_article_path

                    if files: # Only process directories that contain files
                        # Process each file in the current (potentially renamed) article folder
                        for file_name in files:
                            file_path = os.path.join(root, file_name)

                            if os.path.isfile(file_path):
                                # Store the relative path from uploads directory in the database
                                # It will be like album_name/normalized_article_name/original_filename.ext
                                relative_file_path = os.path.relpath(file_path, app.config['UPLOAD_FOLDER'])

                                # Insert into database
                                conn = sqlite3.connect('files.db')
                                cursor = conn.cursor()
                                cursor.execute(
                                    "INSERT INTO files (filename, album_name, article_number) VALUES (?, ?, ?)",
                                    (relative_file_path, album_name, article_folder_name)
                                )
                                conn.commit()
                                conn.close()

            return True
    except Exception as e:
        logger.error(f"Error processing ZIP file: {e}")
        return False

# Routes
@app.route('/')
def index():
    return render_template('index.html')


@app.route('/publinks')
def publinks():
    return render_template('publinks.html')


@app.route('/upload', methods=['POST'])
def upload_zip():
    if 'zipfile' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['zipfile']

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)

        success = process_zip(file_path)

        if success:
            os.remove(file_path)  # Remove original zip after processing
            return jsonify({'message': 'Files uploaded successfully'})
        else:
            return jsonify({'error': 'Failed to process ZIP file'}), 500


@app.route('/api/published')
def api_published():
    files = get_all_published_files()
    return jsonify(files)


@app.route('/api/files')
def api_files():
    """API endpoint to get all files (published and unpublished)"""
    files = get_all_files()
    return jsonify(files)


@app.route('/api/albums')
def api_albums():
    albums = get_albums()
    return jsonify(albums)


@app.route('/api/articles/<album_name>')
def api_articles(album_name):
    articles = get_articles(album_name)
    return jsonify(articles)


@app.route('/api/links/<album_name>/<article_number>')
def api_links(album_name, article_number):
    offset = int(request.args.get('offset', 0))
    limit = int(request.args.get('limit', 20))
    links = get_published_links(album_name, article_number, offset, limit)
    return jsonify(links)


@app.route('/api/publish/<filename>', methods=['POST'])
def api_publish(filename):
    publish_file(filename)
    return jsonify({'message': 'File published'})


@app.route('/api/unpublish/<filename>', methods=['POST'])
def api_unpublish(filename):
    unpublish_file(filename)
    return jsonify({'message': 'File unpublished'})


@app.route('/static/<path:filename>')
def static_files(filename):
    # filename is now the full relative path like album_name/article_name/original_filename.ext
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


if __name__ == '__main__':
    init_db()  # Initialize database on startup
    app.run(host='0.0.0.0', port=5000, debug=True)
