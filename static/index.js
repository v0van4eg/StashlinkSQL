// static/index.js

const Path = {
    basename: (path) => {
        const parts = path.split(/[\\/]/);
        return parts[parts.length - 1] || path;
    }
};

// DOM elements
const dropArea = document.getElementById('dropArea');
const zipFileInput = document.getElementById('zipFile');
const browseBtn = document.getElementById('browseBtn');
const uploadBtn = document.getElementById('uploadBtn');
const uploadForm = document.getElementById('uploadForm');
const linkList = document.getElementById('linkList');
const currentAlbumTitle = document.getElementById('currentAlbumTitle');

let droppedFile = null;
let currentAlbumName = null;

// Prevent default drag behaviors
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Highlight drop area
['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => dropArea.classList.add('drag-over'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => dropArea.classList.remove('drag-over'), false);
});

// Handle drop
dropArea.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith('.zip')) {
        droppedFile = file;
        updateUI();
    } else {
        alert('Пожалуйста, выберите ZIP-архив.');
    }
});

// File input and browse button
browseBtn.addEventListener('click', () => zipFileInput.click());
zipFileInput.addEventListener('change', () => {
    droppedFile = null;
    updateUI();
});

function updateUI() {
    const file = droppedFile || (zipFileInput.files[0] || null);
    if (file) {
        dropArea.innerHTML = `<p>Выбран файл: <strong>${file.name}</strong></p><p>Готов к загрузке</p>`;
        uploadBtn.disabled = false;
    } else {
        dropArea.innerHTML = `<p>Перетащите ZIP-архив сюда</p><p>или</p><button type="button" class="btn" id="browseBtn">Выбрать файл</button>`;
        uploadBtn.disabled = true;
        setTimeout(() => {
            const newBrowseBtn = document.getElementById('browseBtn');
            if (newBrowseBtn) {
                newBrowseBtn.addEventListener('click', () => zipFileInput.click());
            }
        }, 0);
    }
}

// Upload form submission
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = droppedFile || zipFileInput.files[0];
    if (!file || !file.name.toLowerCase().endsWith('.zip')) {
        alert('Пожалуйста, выберите ZIP-архив.');
        return;
    }

    const formData = new FormData();
    formData.append('zipfile', file, file.name);

    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span>Загрузка...</span>';

    try {
        const response = await fetch('/upload', { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

        let albumName = data.album_name || file.name.replace(/\.zip$/i, '');
        currentAlbumName = albumName;
        showFilesForAlbum(albumName); // Исправлен вызов
        // Удалено: alert('Архив успешно загружен!');

    } catch (error) {
        console.error('Upload failed:', error);
        alert(`Ошибка загрузки: ${error.message}`);
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<span>Загрузить архив</span>';
        zipFileInput.value = '';
        droppedFile = null;
        updateUI();
    }
});

// Copy URL to clipboard
function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = button.textContent;
        button.textContent = 'Скопировано!';
        button.classList.add('copied');

        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        const originalText = button.textContent;
        button.textContent = 'Скопировано!';
        button.classList.add('copied');

        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
        }, 2000);
    });
}

// Load and display files for a specific album
async function showFilesForAlbum(albumName) {
    currentAlbumTitle.textContent = `Изображения в "${albumName}"`;
    try {
        const response = await fetch('/api/files');
        if (!response.ok) throw new Error('Failed to load file list');
        const allFiles = await response.json();

        // Filter by album name
        // Structure of each item in allFiles: [filename, album_name, article_number, public_link, created_at]
        const albumFiles = allFiles.filter(item => item[1] === albumName); // item[1] - album_name

        if (albumFiles.length === 0) {
            linkList.innerHTML = '<div class="empty-state">В этом альбоме нет файлов.</div>';
            return;
        }

        linkList.innerHTML = '';
        albumFiles.forEach(item => {
            const li = document.createElement('li');
            li.className = 'link-item';

            const fullFilePath = item[0]; // filename from DB (e.g., album1/article1/file.jpg)
            const absoluteUrl = item[3]; // public_link from DB (e.g., http://tecnobook/images/album1/article1/file.jpg)

            // Извлекаем путь для изображения (src) из public_link
            let imageUrl = '/images/'; // Fallback
            try {
                const urlObj = new URL(absoluteUrl);
                // pathname уже начинается с '/', например, '/images/album1/article1/file.jpg'
                imageUrl = urlObj.pathname;
            } catch (e) {
                // Если absoluteUrl не является корректным URL, используем fallback
                console.error("Error parsing public_link:", absoluteUrl, e);
                // Путь будет /images/ + relative_file_path
                imageUrl = `/images/${fullFilePath.replace(/\\/g, '/')}`;
            }

            // Create preview container
            const previewDiv = document.createElement('div');
            previewDiv.className = 'link-preview';

            // Create image preview
            const img = document.createElement('img');
            img.src = imageUrl; // Используем путь, извлеченный из public_link
            img.alt = Path.basename(fullFilePath);
            img.onerror = function() {
                this.src = 'image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjRjFGNUY5Ii8+CjxwYXRoIGQ9Ik0zNi41IDI0LjVIMjMuNVYzNy41SDM2LjVWMjQuNVoiIGZpbGw9IiNEOEUxRTYiLz4KPHBhdGggZD0iTTI1IDI2SDM1VjI5SDI1VjI2WiIgZmlsbD0iI0Q4RTFFNiIvPgo8cGF0aCBkPSJNMjUgMzFIMzJWMzRIMjVWMzFaIiBmaWxsPSIjRDhFMUU2Ii8+Cjwvc3ZnPg=='; // Placeholder for non-image files
            };

            // Create URL container
            const urlDiv = document.createElement('div');
            urlDiv.className = 'link-url';

            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.value = absoluteUrl; // Используем absoluteUrl (public_link) из БД
            urlInput.readOnly = true;
            urlInput.className = 'link-url-input';
            urlInput.title = 'Прямая ссылка на изображение';

            // Create copy button
            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = 'btn btn-copy copy-btn';
            copyBtn.textContent = 'Копировать';
            copyBtn.addEventListener('click', () => copyToClipboard(absoluteUrl, copyBtn)); // Копируем absoluteUrl из БД

            // Create file info
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            fileInfo.textContent = fullFilePath; // Отображаем имя файла

            // Assemble the elements
            urlDiv.appendChild(urlInput);
            previewDiv.appendChild(img);
            previewDiv.appendChild(urlDiv);
            previewDiv.appendChild(copyBtn);

            li.appendChild(previewDiv);
            li.appendChild(fileInfo);
            linkList.appendChild(li);
        });
    } catch (error) {
        console.error('Error loading files:', error);
        linkList.innerHTML = `<div class="empty-state">Ошибка загрузки файлов для "${albumName}".</div>`;
    }
}

// --- Добавленный JavaScript для отображения информации о файле ---
const zipFileInput = document.getElementById('zipFile');
const browseBtn = document.getElementById('browseBtn');
const fileInfoContainer = document.getElementById('fileInfoContainer');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const fileSizeDisplay = document.getElementById('fileSizeDisplay');

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function handleFileSelection(file) {
    if (file) {
        fileNameDisplay.textContent = file.name;
        fileSizeDisplay.textContent = formatFileSize(file.size);
        fileInfoContainer.style.display = 'block';
    } else {
        fileInfoContainer.style.display = 'none';
    }
}

// Событие при выборе файла через input
zipFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleFileSelection(file);
});

// Событие при выборе файла через drag-and-drop (предполагаем, что droppedFile обновляется в index.js)
// window.droppedFile может быть не доступен сразу, поэтому используем глобальный объект или инициализируем позже
// Альтернатива - вызов из updateUI в index.js
window.updateFileInfoDisplay = function(file) {
     handleFileSelection(file);
}

// Обновляем информацию при клике по кнопке "Выбрать файл", чтобы очистить старую информацию
browseBtn.addEventListener('click', () => {
     // Информация очистится, когда файл будет выбран или сброшен в index.js
     // fileInfoContainer.style.display = 'none';
     // Для очистки при сбросе файла, добавим обработчик на сброс
     zipFileInput.value = ''; // Сбросим значение input
     // index.js обновит UI, и мы можем сбросить информацию там же или здесь
     // Лучше сбросить в updateUI, вызываем updateFileInfoDisplay с null
     // Но для этого нужно вмешательство в index.js
});

// --- Конец добавленного JavaScript ---

// Initial state
linkList.innerHTML = '<div class="empty-state">Загрузите ZIP-архив, чтобы получить прямые ссылки на изображения</div>';
