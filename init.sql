-- init.sql
CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL,
    album_name TEXT NOT NULL,
    article_number TEXT NOT NULL,
    public_link TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_files_album_name ON files(album_name);
CREATE INDEX IF NOT EXISTS idx_files_article_number ON files(article_number);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);

-- Добавляем комментарий к таблице
COMMENT ON TABLE files IS 'Table for storing image file information';
