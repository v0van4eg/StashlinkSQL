# app.py
import os
import zipfile
import json
import shutil
from pathlib import Path
from flask import Flask, request, jsonify, render_template, send_from_directory
import uuid
import sqlite3
from datetime import datetime
import logging
import re
import unicodedata

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 * 1024
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# --- Вспомогательные функции ---
def safe_folder_name(name: str) -> str:
    """Преобразует строку в безопасное имя папки"""
    if not name:
        return "unnamed"
    name = unicodedata.normalize('NFKD', name)
    name = re.sub(r'[^\w\s-]', '', name, flags=re.UNICODE)
    name = re.sub(r'[-\s]+', '-', name, flags=re.UNICODE).strip('-_')
    return name[:255] if name else "unnamed"


# Initialize SQLite database
def init_db():
    conn = sqlite3.connect('files.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            album_name TEXT NOT NULL,
            article_number TEXT NOT NULL,
            published BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()


def get_albums():
    conn = sqlite3.connect('files.db')
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT album_name FROM files")
    albums = [row[0] for row in cursor.fetchall()]
    conn.close()
    return albums


def get_articles(album_name):
    conn = sqlite3.connect('files.db')
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT article_number FROM files WHERE album_name=?", (album_name,))
    articles = [row[0] for row in cursor.fetchall()]
    conn.close()
    return articles


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


def publish_file(filename):
    conn = sqlite3.connect('files.db')
    cursor = conn.cursor()
    cursor.execute("UPDATE files SET published=1 WHERE filename=?", (filename,))
    conn.commit()
    conn.close()


def unpublish_file(filename):
    conn = sqlite3.connect('files.db')
    cursor = conn.cursor()
    cursor.execute("UPDATE files SET published=0 WHERE filename=?", (filename,))
    conn.commit()
    conn.close()


def get_all_published_files():
    conn = sqlite3.connect('files.db')
    cursor = conn.cursor()
    cursor.execute(
        "SELECT filename, album_name, article_number, created_at FROM files WHERE published=1 ORDER BY created_at DESC")
    results = cursor.fetchall()
    conn.close()
    return results


def get_all_files():
    conn = sqlite3.connect('files.db')
    cursor = conn.cursor()
    cursor.execute(
        "SELECT filename, album_name, article_number, created_at, published FROM files ORDER BY created_at DESC")
    results = cursor.fetchall()
    conn.close()
    return results


def process_zip(zip_path):
    try:
        with zipfile.ZipFile(zip_path, 'r', metadata_encoding='utf-8') as zip_ref:
            # Получаем имя архива без расширения (оно уже безопасное)
            zip_basename = os.path.basename(zip_path)
            album_name_raw = os.path.splitext(zip_basename)[0]
            album_name = safe_folder_name(album_name_raw)

            album_path = os.path.join(app.config['UPLOAD_FOLDER'], album_name)
            os.makedirs(album_path, exist_ok=True)

            zip_ref.extractall(album_path)

            for root, dirs, files in os.walk(album_path):
                rel_path = os.path.relpath(root, album_path)
                if rel_path == '.':
                    continue

                # Обрабатываем только непосредственные подпапки альбома (артикулы)
                if rel_path.count(os.sep) == 0:
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
                                relative_file_path = os.path.relpath(file_path, app.config['UPLOAD_FOLDER'])

                                conn = sqlite3.connect('files.db')
                                cursor = conn.cursor()
                                cursor.execute(
                                    "INSERT INTO files (filename, album_name, article_number) VALUES (?, ?, ?)",
                                    (relative_file_path, album_name, article_folder_norm)
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
        original_name = file.filename
        base_name = os.path.basename(original_name)
        name_without_ext, _ = os.path.splitext(base_name)
        safe_zip_name = safe_folder_name(name_without_ext) + '.zip'
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], safe_zip_name)
        file.save(file_path)

        success = process_zip(file_path)

        if success:
            os.remove(file_path)
            return jsonify({'message': 'Files uploaded successfully'})
        else:
            return jsonify({'error': 'Failed to process ZIP file'}), 500


@app.route('/api/published')
def api_published():
    files = get_all_published_files()
    return jsonify(files)


@app.route('/api/files')
def api_files():
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
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)