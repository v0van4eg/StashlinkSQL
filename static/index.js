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
        alert('Please drop a valid ZIP file.');
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
        dropArea.innerHTML = `<p>Selected: <strong>${file.name}</strong></p><p>Ready to upload</p>`;
        uploadBtn.disabled = false;
    } else {
        dropArea.innerHTML = `<p>Drag & drop your ZIP file here</p><p>or</p><button type="button" class="btn" id="browseBtn">Browse Files</button>`;
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
        alert('Please select a valid ZIP file.');
        return;
    }

    const formData = new FormData();
    formData.append('zipfile', file, file.name);

    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span>Uploading...</span>';

    try {
        const response = await fetch('/upload', { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

        // Воссоздаём имя альбома так же, как на сервере (упрощённо)
        let albumName = file.name.replace(/\.zip$/i, '');
        albumName = albumName.normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // remove accents
            .replace(/[^\w\s-]/g, '')         // remove unsafe chars
            .replace(/[-\s]+/g, '-')          // spaces/dashes → single dash
            .replace(/^-+|-+$/g, '')          // trim dashes
            .substring(0, 255) || 'unnamed';

        currentAlbumName = albumName;
        showFilesForAlbum(albumName);
        alert('Upload successful!');
    } catch (error) {
        console.error('Upload failed:', error);
        alert(`Upload failed: ${error.message}`);
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<span>Upload Archive</span>';
        zipFileInput.value = '';
        droppedFile = null;
        updateUI();
    }
});

// Load and display files for a specific album
async function showFilesForAlbum(albumName) {
    currentAlbumTitle.textContent = `Files in "${albumName}"`;
    try {
        const response = await fetch('/api/files');
        if (!response.ok) throw new Error('Failed to load file list');
        const allFiles = await response.json();

        // Фильтруем по имени альбома (item[1] = album_name)
        const albumFiles = allFiles.filter(item => item[1] === albumName);

        if (albumFiles.length === 0) {
            linkList.innerHTML = '<div class="empty-state">No files found in this album.</div>';
            return;
        }

        linkList.innerHTML = '';
        albumFiles.forEach(item => {
            const li = document.createElement('li');
            li.className = 'link-item';

            const link = document.createElement('a');
            // ВАЖНО: используем ПОЛНЫЙ путь item[0] — он включает album/article/file.jpg
            link.href = `/static/${item[0]}`; // ← НЕТ encodeURIComponent!
            link.target = '_blank';
            // Отображаем: article / filename
            link.textContent = `${item[2]} / ${Path.basename(item[0])}`;
            li.appendChild(link);

            linkList.appendChild(li);
        });
    } catch (error) {
        console.error('Error loading files:', error);
        linkList.innerHTML = `<div class="empty-state">Error loading files for "${albumName}".</div>`;
    }
}

// Initial state
linkList.innerHTML = '<div class="empty-state">Upload a ZIP archive to see files.</div>';
