// static/index.js
// --- Функция форматирования размера файла ---
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// --- Глобальные переменные ---
let droppedFile = null;
let currentAlbumName = null;
// DOM elements
let dropArea, zipFileInput, browseBtn, uploadBtn, uploadForm, linkList, currentAlbumTitle, progressContainer, progressBar, progressText;
let manageBtn, uploadCard, emptyCard, backToUploadBtn;
// Новые элементы для селекторов
let albumSelector, articleSelector;
// --- Конец глобальных переменных ---

// --- Вспомогательная функция ---
const Path = {
    basename: (path) => {
        const parts = path.split(/[\\/]/);
        return parts[parts.length - 1] || path;
    }
};

// --- Функция инициализации DOM элементов ---
function initializeElements() {
    dropArea = document.getElementById('dropArea');
    zipFileInput = document.getElementById('zipFile');
    browseBtn = document.getElementById('browseBtn');
    uploadBtn = document.getElementById('uploadBtn');
    uploadForm = document.getElementById('uploadForm');
    linkList = document.getElementById('linkList');
    currentAlbumTitle = document.getElementById('currentAlbumTitle');
    manageBtn = document.getElementById('manageBtn');
    uploadCard = document.getElementById('uploadCard');
    emptyCard = document.getElementById('emptyCard');
    backToUploadBtn = document.getElementById('backToUploadBtn');
    progressContainer = document.getElementById('progressContainer');
    progressBar = document.getElementById('progressBar');
    progressText = document.getElementById('progressText');

    // Новые элементы селекторов
    albumSelector = document.getElementById('albumSelector');
    articleSelector = document.getElementById('articleSelector');

    if (!dropArea || !zipFileInput || !browseBtn || !uploadBtn || !uploadForm || !linkList || !currentAlbumTitle ||
        !manageBtn || !backToUploadBtn || !uploadCard || !emptyCard || !progressContainer || !progressBar || !progressText ||
        !albumSelector || !articleSelector) {
        console.error('One or more required DOM elements not found!');
        return false;
    }
    return true;
}

// --- Функция обновления UI ---
function updateUI() {
    if (!zipFileInput || !dropArea || !uploadBtn || !manageBtn) {
        console.error('DOM elements not initialized for updateUI');
        return;
    }
    const file = droppedFile || (zipFileInput.files[0] || null);
    if (file) {
        const fileSize = formatFileSize(file.size);
        dropArea.innerHTML = `<p>Выбран файл: <strong>${file.name}</strong></p><p>Размер: ${fileSize}</p><p>Готов к загрузке</p>`;
        uploadBtn.disabled = false;
    } else {
        dropArea.innerHTML = `<p>Перетащите ZIP-архив сюда</p><p>или</p><button type="button" class="btn" id="browseBtn">Выбрать файл</button>`;
        uploadBtn.disabled = true;
    }
}

// --- Функция копирования в буфер обмена ---
function copyToClipboard(text, button) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            console.log('Скопировано через Clipboard API');
            updateButtonState(button);
        }).catch(err => {
            console.error('Ошибка Clipboard API:', err);
            fallbackCopyTextToClipboard(text, button);
        });
    } else {
        console.warn('Clipboard API недоступен, используется резервный метод.');
        fallbackCopyTextToClipboard(text, button);
    }
}

function fallbackCopyTextToClipboard(text, button) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.cssText = `
        position: fixed;
        top: -9999px;
        left: -9999px;
        width: 2em;
        height: 2em;
        z-index: 10000;
        opacity: 0;
        pointer-events: none;
    `;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            console.log('Скопировано через execCommand');
            updateButtonState(button);
        } else {
            console.error('execCommand copy не удался');
            alert('Не удалось скопировать текст. Пожалуйста, скопируйте вручную.');
        }
    } catch (err) {
        console.error('Exception при выполнении execCommand copy:', err);
        alert('Не удалось скопировать текст. Пожалуйста, скопируйте вручную.');
    }
    document.body.removeChild(textArea);
}

function updateButtonState(button) {
    const originalText = button.textContent;
    button.textContent = 'Скопировано!';
    button.classList.add('copied');
    setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('copied');
    }, 2000);
}

// --- Функции для работы с селекторами ---
async function loadAlbums() {
    try {
        const response = await fetch('/api/albums');
        if (!response.ok) throw new Error('Failed to load albums');
        const albums = await response.json();

        albumSelector.innerHTML = '<option value="">-- Выберите альбом --</option>';
        albums.forEach(album => {
            const option = document.createElement('option');
            option.value = album;
            option.textContent = album;
            albumSelector.appendChild(option);
        });

        return albums;
    } catch (error) {
        console.error('Error loading albums:', error);
        albumSelector.innerHTML = '<option value="">-- Ошибка загрузки --</option>';
        return [];
    }
}

async function loadArticles(albumName) {
    if (!albumName) {
        articleSelector.innerHTML = '<option value="">-- Сначала выберите альбом --</option>';
        articleSelector.disabled = true;
        return;
    }

    try {
        const response = await fetch(`/api/articles/${encodeURIComponent(albumName)}`);
        if (!response.ok) throw new Error('Failed to load articles');
        const articles = await response.json();

        articleSelector.innerHTML = '<option value="">-- Все артикулы --</option>';
        articles.forEach(article => {
            const option = document.createElement('option');
            option.value = article;
            option.textContent = article;
            articleSelector.appendChild(option);
        });

        articleSelector.disabled = false;
        return articles;
    } catch (error) {
        console.error('Error loading articles:', error);
        articleSelector.innerHTML = '<option value="">-- Ошибка загрузки --</option>';
        articleSelector.disabled = false;
        return [];
    }
}

function clearLinkList() {
    if (linkList) {
        linkList.innerHTML = '<div class="empty-state">Выберите альбом и артикул для просмотра ссылок</div>';
    }
    if (currentAlbumTitle) {
        currentAlbumTitle.textContent = 'Прямые ссылки на изображения';
    }
}

// --- Загрузка и отображение файлов для альбома ---
async function showFilesForAlbum(albumName, articleName = '') {
    if (!currentAlbumTitle || !linkList) {
         console.error('DOM elements for file list not initialized');
         return;
    }

    let title = `Изображения в "${albumName}"`;
    if (articleName) {
        title += ` (артикул: ${articleName})`;
    }
    currentAlbumTitle.textContent = title;

    try {
        const response = await fetch('/api/files');
        if (!response.ok) throw new Error('Failed to load file list');
        const allFiles = await response.json();

        // Фильтруем по имени альбома и артикулу (если указан)
        let albumFiles = allFiles.filter(item => item[1] === albumName);
        if (articleName) {
            albumFiles = albumFiles.filter(item => item[2] === articleName);
        }

        if (albumFiles.length === 0) {
            linkList.innerHTML = '<div class="empty-state">В выбранной категории нет файлов.</div>';
            return;
        }

        // Группировка файлов по артикулам (если не выбран конкретный артикул)
        const groupedFiles = {};
        albumFiles.forEach(item => {
            const article = item[2];
            if (!groupedFiles[article]) {
                groupedFiles[article] = [];
            }
            groupedFiles[article].push(item);
        });

        linkList.innerHTML = '';

        // Если выбран конкретный артикул, показываем файлы без группировки
        if (articleName) {
            const extractSuffix = (filename) => {
                const baseName = Path.basename(filename);
                const match = baseName.match(/_([0-9]+)(\.[^.]*)?$/);
                return match ? parseInt(match[1], 10) : 0;
            };

            albumFiles.sort((a, b) => {
                const suffixA = extractSuffix(a[0]);
                const suffixB = extractSuffix(b[0]);
                return suffixA - suffixB;
            });

            albumFiles.forEach(item => {
                createFileListItem(item, linkList);
            });
        } else {
            // Показываем с группировкой по артикулам
            const sortedArticles = Object.keys(groupedFiles).sort();
            sortedArticles.forEach(article => {
                const articleHeader = document.createElement('li');
                articleHeader.className = 'article-header';
                articleHeader.textContent = `Артикул: ${article}`;
                linkList.appendChild(articleHeader);

                const filesForArticle = groupedFiles[article];
                const extractSuffix = (filename) => {
                    const baseName = Path.basename(filename);
                    const match = baseName.match(/_([0-9]+)(\.[^.]*)?$/);
                    return match ? parseInt(match[1], 10) : 0;
                };

                filesForArticle.sort((a, b) => {
                    const suffixA = extractSuffix(a[0]);
                    const suffixB = extractSuffix(b[0]);
                    return suffixA - suffixB;
                });

                filesForArticle.forEach(item => {
                    createFileListItem(item, linkList);
                });
            });
        }
    } catch (error) {
        console.error('Error loading files:', error);
        linkList.innerHTML = `<div class="empty-state">Ошибка загрузки файлов.</div>`;
    }
}

function createFileListItem(item, parentElement) {
    const li = document.createElement('li');
    li.className = 'link-item';
    const fullFilePath = item[0];
    const absoluteUrl = item[3];

    let imageUrl = '/images/';
    try {
        const urlObj = new URL(absoluteUrl);
        imageUrl = urlObj.pathname;
    } catch (e) {
        console.error("Error parsing public_link:", absoluteUrl, e);
        imageUrl = `/images/${fullFilePath.replace(/\\/g, '/')}`;
    }

    const previewDiv = document.createElement('div');
    previewDiv.className = 'link-preview';

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = Path.basename(fullFilePath);
    img.onerror = function() {
        this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjRjFGNUY5Ii8+CjxwYXRoIGQ9Ik0zNi41IDI0LjVIMjMuNVYzNy41SDM2LjVWMjQuNVoiIGZpbGw9IiNEOEUxRTYiLz4KPHBhdGggZD0iTTI1IDI2SDM1VjI5SDI1VjI2WiIgZmlsbD0iI0Q4RTFFNiIvPgo8cGF0aCBkPSJNMjUgMzFIMzJWMzRIMjVWMzFaIiBmaWxsPSIjRDhFMUU2Ii8+Cjwvc3ZnPg==';
    };

    const urlDiv = document.createElement('div');
    urlDiv.className = 'link-url';
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.value = absoluteUrl;
    urlInput.readOnly = true;
    urlInput.className = 'link-url-input';
    urlInput.title = 'Прямая ссылка на изображение';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn-copy copy-btn';
    copyBtn.textContent = 'Копировать';
    copyBtn.addEventListener('click', () => copyToClipboard(absoluteUrl, copyBtn));

    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    fileInfo.textContent = fullFilePath;

    urlDiv.appendChild(urlInput);
    previewDiv.appendChild(img);
    previewDiv.appendChild(urlDiv);
    previewDiv.appendChild(copyBtn);
    li.appendChild(previewDiv);
    li.appendChild(fileInfo);
    parentElement.appendChild(li);
}

// --- Инициализация после загрузки DOM ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded and parsed");

    if (!initializeElements()) {
        console.error('Failed to initialize DOM elements. Cannot proceed.');
        return;
    }

    // --- Обработчики Drag and Drop ---
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('drag-over'), false);
    });

    dropArea.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (file && file.name.toLowerCase().endsWith('.zip')) {
            droppedFile = file;
            updateUI();
        } else {
            alert('Пожалуйста, выберите ZIP-архив.');
        }
    });

    dropArea.addEventListener('click', function(event) {
        if (event.target && event.target.id === 'browseBtn') {
            console.log("Click event on browseBtn (delegated)!");
            zipFileInput.click();
        }
    });

    zipFileInput.addEventListener('change', () => {
        droppedFile = null;
        updateUI();
    });

    // --- Обработчики для селекторов ---
    albumSelector.addEventListener('change', function() {
        const selectedAlbum = this.value;
        loadArticles(selectedAlbum);
        clearLinkList();

        if (selectedAlbum) {
            showFilesForAlbum(selectedAlbum);
        }
    });

    articleSelector.addEventListener('change', function() {
        const selectedAlbum = albumSelector.value;
        const selectedArticle = this.value;

        if (selectedAlbum) {
            showFilesForAlbum(selectedAlbum, selectedArticle);
        }
    });

    // --- Обработчик отправки формы ---
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!zipFileInput || !uploadBtn) {
             console.error('DOM elements for upload not initialized');
             return;
        }
        const file = droppedFile || zipFileInput.files[0];
        if (!file || !file.name.toLowerCase().endsWith('.zip')) {
            alert('Пожалуйста, выберите ZIP-архив.');
            return;
        }

        const formData = new FormData();
        formData.append('zipfile', file, file.name);

        progressContainer.style.display = 'block';
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<span>Загрузка...</span>';

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                progressBar.style.width = percentComplete + '%';
                progressText.textContent = Math.round(percentComplete) + '%';
            }
        });

        xhr.addEventListener('load', function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (!data.error) {
                        let albumName = data.album_name || file.name.replace(/\.zip$/i, '');
                        currentAlbumName = albumName;
                        showFilesForAlbum(albumName);
                        zipFileInput.value = '';
                        droppedFile = null;
                        updateUI();

                        // Обновляем список альбомов после успешной загрузки
                        loadAlbums();
                    } else {
                        console.error('Upload failed:', data.error);
                        alert(`Ошибка загрузки: ${data.error}`);
                    }
                } catch (error) {
                    console.error('JSON parse failed:', error);
                    alert('Ошибка: получен некорректный ответ от сервера.');
                }
            } else {
                console.error('Upload failed with status:', xhr.status);
                alert(`Ошибка загрузки: HTTP ${xhr.status}`);
            }
            progressContainer.style.display = 'none';
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<span>Загрузить архив</span>';
        });

        xhr.addEventListener('error', function() {
            console.error('Upload failed due to network error');
            alert('Ошибка сети при загрузке файла.');
            progressContainer.style.display = 'none';
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<span>Загрузить архив</span>';
        });

        xhr.open('POST', '/upload');
        xhr.send(formData);
    });

    // --- Обработчик для кнопки "Управление ссылками" ---
    if (manageBtn && uploadCard && emptyCard) {
        manageBtn.addEventListener('click', function() {
            console.log("Кнопка 'Управление ссылками' нажата");
            uploadCard.style.display = 'none';
            emptyCard.style.display = 'flex';

            // Очищаем правую карточку
            clearLinkList();

            // Загружаем список альбомов при переходе в режим управления
            loadAlbums();
        });
    } else {
        console.error('Элементы для переключения карточек не найдены');
    }

    // --- Обработчик для кнопки "Назад к загрузке" ---
    if (backToUploadBtn && uploadCard && emptyCard) {
        backToUploadBtn.addEventListener('click', function() {
            console.log("Кнопка 'Назад к загрузке' нажата");
            uploadCard.style.display = 'flex';
            emptyCard.style.display = 'none';
            clearLinkList();
            currentAlbumTitle.textContent = 'Прямые ссылки на изображения';
        });
    } else {
        console.error('Элементы для переключения карточек не найдены');
    }

    // Инициализируем UI
    updateUI();
    clearLinkList();
});
