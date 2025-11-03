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
// Элементы для XLSX
let createXlsxBtn, xlsxModal, xlsxTemplateSelect, separatorSelect, generateXlsxBtn, cancelXlsxBtn;

// Конфигурация превью
const PREVIEW_CONFIG = {
    thumbnail: {
        width: 120,
        height: 120,
        quality: 60
    },
    preview: {
        width: 400,
        height: 400,
        quality: 80
    }
};

// --- Конец глобальных переменных ---

// --- Вспомогательная функция ---
const Path = {
    basename: (path) => {
        const parts = path.split(/[\\/]/);
        return parts[parts.length - 1] || path;
    }
};

// --- Система ленивой загрузки изображений ---
class LazyLoader {
    constructor() {
        this.observer = null;
        this.init();
    }

    init() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadImage(entry.target);
                        this.observer.unobserve(entry.target);
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.1
            });
        }
    }

    observe(element) {
        if (this.observer) {
            this.observer.observe(element);
        } else {
            // Fallback: загружаем сразу если IntersectionObserver не поддерживается
            this.loadImage(element);
        }
    }

    loadImage(img) {
        const src = img.getAttribute('data-src');
        if (src) {
            img.onload = () => {
                img.classList.add('loaded');
            };
            img.src = src;
            img.removeAttribute('data-src');
        }
    }
}

const lazyLoader = new LazyLoader();

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

    // Новые элементы для XLSX
    createXlsxBtn = document.getElementById('createXlsxBtn');
    xlsxModal = document.getElementById('xlsxModal');
    xlsxTemplateSelect = document.getElementById('xlsxTemplateSelect');
    separatorSelect = document.getElementById('separatorSelect');
    generateXlsxBtn = document.getElementById('generateXlsxBtn');
    cancelXlsxBtn = document.getElementById('cancelXlsxBtn');

    if (!dropArea || !zipFileInput || !browseBtn || !uploadBtn || !uploadForm || !linkList || !currentAlbumTitle ||
        !manageBtn || !backToUploadBtn || !uploadCard || !emptyCard || !progressContainer || !progressBar || !progressText ||
        !albumSelector || !articleSelector || !createXlsxBtn || !xlsxModal || !xlsxTemplateSelect || !separatorSelect ||
        !generateXlsxBtn || !cancelXlsxBtn) {
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

// --- Создание элемента списка файлов с превью ---
function createFileListItem(item, parentElement) {
    const li = document.createElement('li');
    li.className = 'link-item';

    const fileData = typeof item === 'object' ? item : {
        filename: item[0],
        album_name: item[1],
        article_number: item[2],
        public_link: item[3],
        created_at: item[4],
        thumbnail_url: `/thumbnails/small/${item[0]}`,
        preview_url: `/thumbnails/medium/${item[0]}`,
        file_size: 0
    };

    const previewDiv = document.createElement('div');
    previewDiv.className = 'link-preview';

    const img = document.createElement('img');
    img.className = 'lazy-image';
    img.width = PREVIEW_CONFIG.thumbnail.width;
    img.height = PREVIEW_CONFIG.thumbnail.height;

    // Заглушка пока изображение не загружено
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjRjFGNUY5Ii8+CjxwYXRoIGQ9Ik0zNi41IDI0LjVIMjMuNVYzNy41SDM2LjVWMjQuNVoiIGZpbGw9IiNEOEUxRTYiLz4KPHBhdGggZD0iTTI1IDI2SDM1VjI5SDI1VjI2WiIgZmlsbD0iI0Q4RTFFNiIvPgo8cGF0aCBkPSJNMjUgMzFIMzJWMzRIMjVWMzFaIiBmaWxsPSIjRDhFMUU2Ii8+Cjwvc3ZnPg==';
    img.setAttribute('data-src', fileData.thumbnail_url);
    img.alt = Path.basename(fileData.filename);

    // Добавляем обработчик для показа полноразмерного превью
    img.addEventListener('click', () => showPreviewModal(fileData));

    img.onerror = function() {
        this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjRjFGNUY5Ii8+CjxwYXRoIGQ9Ik0zNi41IDI0LjVIMjMuNVYzNy41SDM2LjVWMjQuNVoiIGZpbGw9IiNEOEUxRTYiLz4KPHBhdGggZD0iTTI1IDI2SDM1VjI5SDI1VjI2WiIgZmlsbD0iI0Q4RTFFNiIvPgo8cGF0aCBkPSJNMjUgMzFIMzJWMzRIMjVWMzFaIiBmaWxsPSIjRDhFMUU2Ii8+Cjwvc3ZnPg==';
    };

    const urlDiv = document.createElement('div');
    urlDiv.className = 'link-url';
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.value = fileData.public_link;
    urlInput.readOnly = true;
    urlInput.className = 'link-url-input';
    urlInput.title = 'Прямая ссылка на изображение';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn-copy copy-btn';
    copyBtn.textContent = 'Копировать';
    copyBtn.addEventListener('click', () => copyToClipboard(fileData.public_link, copyBtn));

    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    fileInfo.textContent = `${Path.basename(fileData.filename)} • ${formatFileSize(fileData.file_size || 0)}`;

    urlDiv.appendChild(urlInput);
    previewDiv.appendChild(img);
    previewDiv.appendChild(urlDiv);
    previewDiv.appendChild(copyBtn);
    li.appendChild(previewDiv);
    li.appendChild(fileInfo);
    parentElement.appendChild(li);

    // Начинаем ленивую загрузку
    lazyLoader.observe(img);
}

// --- Модальное окно для просмотра полноразмерного изображения ---
function showPreviewModal(fileData) {
    // Создаем модальное окно если его нет
    let modal = document.getElementById('previewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'previewModal';
        modal.className = 'preview-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <button class="modal-close">&times;</button>
                <img class="modal-image" src="" alt="">
                <div class="modal-info">
                    <div class="modal-filename"></div>
                    <div class="modal-actions">
                        <button class="btn btn-copy-full">Копировать ссылку</button>
                        <a class="btn btn-view-original" target="_blank">Открыть оригинал</a>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Обработчики для модального окна
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Закрытие по ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                modal.style.display = 'none';
            }
        });
    }

    // Заполняем модальное окно данными
    const modalImage = modal.querySelector('.modal-image');
    const modalFilename = modal.querySelector('.modal-filename');
    const copyFullBtn = modal.querySelector('.btn-copy-full');
    const viewOriginalBtn = modal.querySelector('.btn-view-original');

    // Показываем среднее превью в модальном окне
    modalImage.src = fileData.preview_url;
    modalFilename.textContent = Path.basename(fileData.filename);
    viewOriginalBtn.href = fileData.public_link;

    copyFullBtn.onclick = () => copyToClipboard(fileData.public_link, copyFullBtn);

    modal.style.display = 'flex';
}

// --- Загрузка и отображение файлов для альбома с превью ---
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
        // Используем новый эндпоинт с превью
        const url = articleName
            ? `/api/thumbnails/${encodeURIComponent(albumName)}/${encodeURIComponent(articleName)}`
            : `/api/thumbnails/${encodeURIComponent(albumName)}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load file list');
        const files = await response.json();

        if (files.length === 0) {
            linkList.innerHTML = '<div class="empty-state">В выбранной категории нет файлов.</div>';
            return;
        }

        // Группировка файлов по артикулам
        const groupedFiles = {};
        files.forEach(item => {
            const article = item.article_number;
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

            files.sort((a, b) => {
                const suffixA = extractSuffix(a.filename);
                const suffixB = extractSuffix(b.filename);
                return suffixA - suffixB;
            });

            files.forEach(item => {
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
                    const suffixA = extractSuffix(a.filename);
                    const suffixB = extractSuffix(b.filename);
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

// --- Функции для работы с XLSX ---
function initXlsxModal() {
    if (!createXlsxBtn || !xlsxModal) return;

    createXlsxBtn.addEventListener('click', showXlsxModal);
    cancelXlsxBtn.addEventListener('click', hideXlsxModal);

    xlsxTemplateSelect.addEventListener('change', function() {
        const separatorGroup = document.getElementById('separatorGroup');
        if (this.value === 'in_cell') {
            separatorGroup.style.display = 'block';
        } else {
            separatorGroup.style.display = 'none';
        }
    });

    generateXlsxBtn.addEventListener('click', generateXlsxFile);

    // Закрытие модального окна при клике вне его
    xlsxModal.addEventListener('click', function(e) {
        if (e.target === xlsxModal) {
            hideXlsxModal();
        }
    });

    // Закрытие по ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && xlsxModal.style.display === 'flex') {
            hideXlsxModal();
        }
    });
}

function showXlsxModal() {
    const selectedAlbum = albumSelector.value;
    if (!selectedAlbum) {
        alert('Сначала выберите альбом');
        return;
    }

    xlsxModal.style.display = 'flex';
    // Сброс выбора
    xlsxTemplateSelect.value = 'in_row';
    separatorSelect.value = 'comma';
    document.getElementById('separatorGroup').style.display = 'none';
}

function hideXlsxModal() {
    xlsxModal.style.display = 'none';
}

async function generateXlsxFile() {
    const selectedAlbum = albumSelector.value;
    const selectedArticle = articleSelector.value || null;
    const exportType = xlsxTemplateSelect.value;
    const separatorType = separatorSelect.value;

    if (!selectedAlbum || !exportType) {
        alert('Заполните все обязательные поля');
        return;
    }

    // Определяем разделитель
    let separator = ', ';
    if (separatorType === 'newline') {
        separator = '\n';
    }

    const generateBtn = generateXlsxBtn;
    const originalText = generateBtn.innerHTML;

    try {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span>Создание...</span>';

        const response = await fetch('/api/export-xlsx', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                album_name: selectedAlbum,
                article_name: selectedArticle,
                export_type: exportType,
                separator: separator
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Ошибка при создании файла');
        }

        // Скачиваем файл
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;

        // Генерируем имя файла
        let filename = `links_${selectedAlbum}`;
        if (selectedArticle) {
            filename += `_${selectedArticle}`;
        }
        filename += '.xlsx';

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        hideXlsxModal();

    } catch (error) {
        console.error('Error generating XLSX:', error);
        alert(`Ошибка при создании файла: ${error.message}`);
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = originalText;
    }
}

function updateCreateXlsxButtonState() {
    if (createXlsxBtn) {
        createXlsxBtn.disabled = !albumSelector.value;
    }
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
        updateCreateXlsxButtonState();

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
    initXlsxModal();
    updateCreateXlsxButtonState();
});
