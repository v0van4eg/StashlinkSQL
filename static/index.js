// static/index.js

// --- Функция форматирования размера файла ---
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
// --- Конец функции форматирования ---

// --- Глобальные переменные ---
let droppedFile = null;
let currentAlbumName = null;
// DOM elements (получаем их один раз после загрузки DOM)
let dropArea, zipFileInput, browseBtn, uploadBtn, uploadForm, linkList, currentAlbumTitle, progressContainer, progressBar, progressText;
// --- Конец глобальных переменных ---

// --- Вспомогательная функция ---
const Path = {
    basename: (path) => {
        const parts = path.split(/[\\/]/);
        return parts[parts.length - 1] || path;
    }
};
// --- Конец вспомогательной функции ---

// --- Функция инициализации DOM элементов ---
function initializeElements() {
    dropArea = document.getElementById('dropArea');
    zipFileInput = document.getElementById('zipFile');
    browseBtn = document.getElementById('browseBtn');
    uploadBtn = document.getElementById('uploadBtn');
    uploadForm = document.getElementById('uploadForm');
    linkList = document.getElementById('linkList');
    currentAlbumTitle = document.getElementById('currentAlbumTitle');
    // Элементы прогресс-бара
    progressContainer = document.getElementById('progressContainer');
    progressBar = document.getElementById('progressBar');
    progressText = document.getElementById('progressText');

    if (!dropArea || !zipFileInput || !browseBtn || !uploadBtn || !uploadForm || !linkList || !currentAlbumTitle || !progressContainer || !progressBar || !progressText) {
        console.error('One or more required DOM elements not found!');
        return false;
    }
    return true;
}
// --- Конец функции инициализации ---

// --- Функция обновления UI ---
function updateUI() {
    // Проверяем, инициализированы ли элементы
    if (!zipFileInput || !dropArea || !uploadBtn) {
        console.error('DOM elements not initialized for updateUI');
        return;
    }

    const file = droppedFile || (zipFileInput.files[0] || null);
    if (file) {
        const fileSize = formatFileSize(file.size);
        // Показываем имя файла и его размер перед "Готов к загрузке"
        dropArea.innerHTML = `<p>Выбран файл: <strong>${file.name}</strong></p><p>Размер: ${fileSize}</p><p>Готов к загрузке</p>`;
        uploadBtn.disabled = false;
    } else {
        dropArea.innerHTML = `<p>Перетащите ZIP-архив сюда</p><p>или</p><button type="button" class="btn" id="browseBtn">Выбрать файл</button>`;
        uploadBtn.disabled = true;
        // Обязательно повторно добавляем обработчик для новой кнопки "Выбрать файл"
        const newBrowseBtn = document.getElementById('browseBtn');
        if (newBrowseBtn) {
            newBrowseBtn.addEventListener('click', () => zipFileInput.click());
        }
    }
}
// --- Конец функции обновления UI ---

// --- Функция копирования в буфер обмена ---
function copyToClipboard(text, button) {
    // Попытка использовать современный API Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            console.log('Скопировано через Clipboard API');
            updateButtonState(button);
        }).catch(err => {
            console.error('Ошибка Clipboard API:', err);
            // Если Clipboard API не сработал, переходим к резервному методу
            fallbackCopyTextToClipboard(text, button);
        });
    } else {
        // Резервный метод для старых браузеров или небезопасных контекстов
        console.warn('Clipboard API недоступен, используется резервный метод.');
        fallbackCopyTextToClipboard(text, button);
    }
}

// Резервный метод копирования
function fallbackCopyTextToClipboard(text, button) {
    // Создаем временный textarea элемент
    const textArea = document.createElement("textarea");
    // Устанавливаем текст, который нужно скопировать
    textArea.value = text;
    // Делаем элемент небольшим и невидимым
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

    // Добавляем textarea в DOM
    document.body.appendChild(textArea);

    // Выделяем текст в textarea
    textArea.focus();
    textArea.select();

    try {
        // Выполняем команду "copy"
        const successful = document.execCommand('copy');
        if (successful) {
            console.log('Скопировано через execCommand');
            updateButtonState(button);
        } else {
            console.error('execCommand copy не удался');
            // Можно показать сообщение пользователю, что копирование не удалось
            alert('Не удалось скопировать текст. Пожалуйста, скопируйте вручную.');
        }
    } catch (err) {
        console.error('Exception при выполнении execCommand copy:', err);
        alert('Не удалось скопировать текст. Пожалуйста, скопируйте вручную.');
    }

    // Удаляем временный textarea из DOM
    document.body.removeChild(textArea);
}

// Вспомогательная функция для обновления состояния кнопки
function updateButtonState(button) {
    const originalText = button.textContent;
    button.textContent = 'Скопировано!';
    button.classList.add('copied');

    setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('copied');
    }, 2000);
}
// --- Конец функции копирования ---

// --- Загрузка и отображение файлов для альбома ---
async function showFilesForAlbum(albumName) {
    if (!currentAlbumTitle || !linkList) {
         console.error('DOM elements for file list not initialized');
         return;
    }
    currentAlbumTitle.textContent = `Изображения в "${albumName}"`;
    try {
        const response = await fetch('/api/files');
        if (!response.ok) throw new Error('Failed to load file list');
        const allFiles = await response.json();

        // Фильтруем по имени альбома
        // Структура каждого элемента в allFiles: [filename, album_name, article_number, public_link, created_at]
        const albumFiles = allFiles.filter(item => item[1] === albumName); // item[1] - album_name

        if (albumFiles.length === 0) {
            linkList.innerHTML = '<div class="empty-state">В этом альбоме нет файлов.</div>';
            return;
        }

        // Группировка файлов по артикулам
        const groupedFiles = {};
        albumFiles.forEach(item => {
            const article = item[2]; // item[2] - article_number
            if (!groupedFiles[article]) {
                groupedFiles[article] = [];
            }
            groupedFiles[article].push(item);
        });

        linkList.innerHTML = '';

        // Сортировка артикулов (например, лексикографически)
        const sortedArticles = Object.keys(groupedFiles).sort();

        sortedArticles.forEach(article => {
            // Добавляем заголовок артикула
            const articleHeader = document.createElement('li');
            articleHeader.className = 'article-header';
            articleHeader.textContent = `Артикул: ${article}`;
            linkList.appendChild(articleHeader);

            // Получаем файлы для текущего артикула
            const filesForArticle = groupedFiles[article];

            // Функция для извлечения суффикса из имени файла
            const extractSuffix = (filename) => {
                const baseName = Path.basename(filename);
                const match = baseName.match(/_([0-9]+)(\.[^.]*)?$/); // Ищем _число в конце перед расширением
                return match ? parseInt(match[1], 10) : 0; // Возвращаем число или 0, если не найдено
            };

            // Сортируем файлы внутри артикула по суффиксу
            filesForArticle.sort((a, b) => {
                const suffixA = extractSuffix(a[0]); // a[0] - filename
                const suffixB = extractSuffix(b[0]); // b[0] - filename
                return suffixA - suffixB;
            });

            // Создаем элементы для каждого файла в артикуле
            filesForArticle.forEach(item => {
                const li = document.createElement('li');
                li.className = 'link-item';

                const fullFilePath = item[0]; // filename из БД (например, album1/article1/file.jpg)
                const absoluteUrl = item[3]; // public_link из БД (например, http://tecnobook/images/album1/article1/file.jpg)

                // Извлекаем путь для изображения (src) из public_link
                let imageUrl = '/images/'; // Резервный вариант
                try {
                    const urlObj = new URL(absoluteUrl);
                    // pathname уже начинается с '/', например, '/images/album1/article1/file.jpg'
                    imageUrl = urlObj.pathname;
                } catch (e) {
                    // Если absoluteUrl не является корректным URL, используем резервный вариант
                    console.error("Error parsing public_link:", absoluteUrl, e);
                    // Путь будет /images/ + relative_file_path
                    imageUrl = `/images/${fullFilePath.replace(/\\/g, '/')}`;
                }

                // Создаем контейнер предварительного просмотра
                const previewDiv = document.createElement('div');
                previewDiv.className = 'link-preview';

                // Создаем изображение предварительного просмотра
                const img = document.createElement('img');
                img.src = imageUrl; // Используем путь, извлеченный из public_link
                img.alt = Path.basename(fullFilePath);
                img.onerror = function() {
                    // Плейсхолдер для файлов, которые не являются изображениями или не загружаются
                    this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjRjFGNUY5Ii8+CjxwYXRoIGQ9Ik0zNi41IDI0LjVIMjMuNVYzNy41SDM2LjVWMjQuNVoiIGZpbGw9IiNEOEUxRTYiLz4KPHBhdGggZD0iTTI1IDI2SDM1VjI5SDI1VjI2WiIgZmlsbD0iI0Q4RTFFNiIvPgo8cGF0aCBkPSJNMjUgMzFIMzJWMzRIMjVWMzFaIiBmaWxsPSIjRDhFMUU2Ii8+Cjwvc3ZnPg==';
                };

                // Создаем контейнер URL
                const urlDiv = document.createElement('div');
                urlDiv.className = 'link-url';

                const urlInput = document.createElement('input');
                urlInput.type = 'text';
                urlInput.value = absoluteUrl; // Используем absoluteUrl (public_link) из БД
                urlInput.readOnly = true;
                urlInput.className = 'link-url-input';
                urlInput.title = 'Прямая ссылка на изображение';

                // Создаем кнопку копирования
                const copyBtn = document.createElement('button');
                copyBtn.type = 'button';
                copyBtn.className = 'btn btn-copy copy-btn';
                copyBtn.textContent = 'Копировать';
                copyBtn.addEventListener('click', () => copyToClipboard(absoluteUrl, copyBtn)); // Копируем absoluteUrl из БД

                // Создаем информацию о файле
                const fileInfo = document.createElement('div');
                fileInfo.className = 'file-info';
                fileInfo.textContent = fullFilePath; // Отображаем имя файла

                // Собираем элементы
                urlDiv.appendChild(urlInput);
                previewDiv.appendChild(img);
                previewDiv.appendChild(urlDiv);
                previewDiv.appendChild(copyBtn);

                li.appendChild(previewDiv);
                li.appendChild(fileInfo);
                linkList.appendChild(li);
            });
        });

    } catch (error) {
        console.error('Error loading files:', error);
        linkList.innerHTML = `<div class="empty-state">Ошибка загрузки файлов для "${albumName}".</div>`;
    }
}
// --- Конец функции загрузки файлов ---

// --- Инициализация после загрузки DOM ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded and parsed");

    // Инициализируем элементы
    if (!initializeElements()) {
        console.error('Failed to initialize DOM elements. Cannot proceed.');
        return; // Прекращаем выполнение, если элементы не найдены
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

    // Обработка drop
    dropArea.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (file && file.name.toLowerCase().endsWith('.zip')) {
            droppedFile = file;
            updateUI(); // Обновляем UI после получения файла
        } else {
            alert('Пожалуйста, выберите ZIP-архив.');
        }
    });
    // --- Конец Drag and Drop ---

    // --- Обработчики для кнопки "Выбрать файл" и input ---
    browseBtn.addEventListener('click', () => zipFileInput.click());
    zipFileInput.addEventListener('change', () => {
        // Сбрасываем droppedFile, если файл выбран через input
        droppedFile = null;
        updateUI(); // Обновляем UI после выбора файла через input
    });
    // --- Конец обработчиков input ---

    // --- Обработчик отправки формы ---
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        // Проверяем, инициализированы ли элементы перед использованием
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

        // Показываем прогресс-бар
        progressContainer.style.display = 'block';
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<span>Загрузка...</span>';

        // Создаем объект XMLHttpRequest для отслеживания прогресса
        const xhr = new XMLHttpRequest();

        // Обработчик прогресса отправки
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                progressBar.style.width = percentComplete + '%';
                progressText.textContent = Math.round(percentComplete) + '%';
            }
        });

        // Обработчик завершения запроса
        xhr.addEventListener('load', function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (!data.error) {
                        let albumName = data.album_name || file.name.replace(/\.zip$/i, '');
                        currentAlbumName = albumName;
                        showFilesForAlbum(albumName);

                        // --- Сброс области загрузки в исходное состояние ---
                        zipFileInput.value = ''; // Очистить input
                        droppedFile = null;      // Сбросить переменную droppedFile
                        updateUI();              // Обновить UI до начального состояния
                        // --- Конец сброса ---
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
            // Скрываем прогресс-бар
            progressContainer.style.display = 'none';
            // Сброс состояния кнопки загрузки
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<span>Загрузить архив</span>';
        });

        // Обработчик ошибки запроса
        xhr.addEventListener('error', function() {
            console.error('Upload failed due to network error');
            alert('Ошибка сети при загрузке файла.');
            // Скрываем прогресс-бар
            progressContainer.style.display = 'none';
            // Сброс состояния кнопки загрузки
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<span>Загрузить архив</span>';
        });

        // Отправляем запрос
        xhr.open('POST', '/upload');
        xhr.send(formData);

    });
    // --- Конец обработчика отправки формы ---

    // Инициализируем UI (должно быть пустое состояние)
    updateUI();

    // Устанавливаем начальное сообщение в списке файлов
    linkList.innerHTML = '<div class="empty-state">Загрузите ZIP-архив, чтобы получить прямые ссылки на изображения</div>';
});
// --- Конец DOMContentLoaded ---
