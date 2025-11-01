// Handle drag and drop
const dropArea = document.getElementById('dropArea');
const zipFileInput = document.getElementById('zipFile');
const uploadForm = document.getElementById('uploadForm');
const submitButton = uploadForm.querySelector('button[type="submit"]');
let droppedFile = null; // Store the dropped file separately

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
});

function highlight() {
    dropArea.style.backgroundColor = '#f0f0f0';
    dropArea.style.borderColor = '#007BFF'; // Change border color on drag over
}

function unhighlight() {
    dropArea.style.backgroundColor = '';
    dropArea.style.borderColor = '#ccc'; // Reset border color
}

dropArea.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length) {
        // Optional: Check file type
        const file = files[0];
        if (file.type !== 'application/zip' && !file.name.toLowerCase().endsWith('.zip')) {
            alert('Please drop a valid ZIP file.');
            return;
        }
        // Store the dropped file
        droppedFile = file;
        // Update display
        dropArea.innerHTML = `Selected file: ${file.name}`;
    }
}

// Click handler for file input
dropArea.addEventListener('click', (e) => {
    // Prevent clicking the button from triggering the file input click if clicked directly
    if (e.target !== submitButton) {
        zipFileInput.click();
    }
});

zipFileInput.addEventListener('change', function() {
    // When file is selected via click, reset the dropped file
    droppedFile = null;
    updateFileNameDisplay();
});

function updateFileNameDisplay() {
    if (zipFileInput.files.length > 0 && !droppedFile) {
        dropArea.innerHTML = `Selected file: ${zipFileInput.files[0].name}`;
    } else if (droppedFile) {
        // If a file was dropped, display its name
        dropArea.innerHTML = `Selected file: ${droppedFile.name}`;
    } else {
        dropArea.innerHTML = 'Drag & Drop ZIP file here or click to browse';
    }
}

// Upload form submission
uploadForm.addEventListener('submit', function(e) {
    e.preventDefault();

    let fileToUpload = null;
    if (droppedFile) {
        fileToUpload = droppedFile;
    } else if (zipFileInput.files[0]) {
        fileToUpload = zipFileInput.files[0];
    }

    if (!fileToUpload) {
        alert('Please select a ZIP file to upload.');
        return;
    }

    // Optional: Check file type again on submit
    if (fileToUpload.type !== 'application/zip' && !fileToUpload.name.toLowerCase().endsWith('.zip')) {
        alert('Please select a valid ZIP file.');
        return;
    }

    // Create FormData and append the correct file
    const formData = new FormData();
    formData.append('zipfile', fileToUpload, fileToUpload.name); // Explicitly append the file

    // Disable button and show loading state
    submitButton.disabled = true;
    submitButton.textContent = 'Uploading...';

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            // Try to get error message from response body
            return response.json().then(data => {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            });
        }
        return response.json();
    })
    .then(data => {
        alert(data.message || 'Upload successful!');
        if (!data.error) {
            refreshLinks(); // Refresh links after successful upload
            // Reset file state after successful upload
            zipFileInput.value = ''; // Clear the input
            droppedFile = null; // Clear the dropped file
            updateFileNameDisplay(); // Reset display
        }
    })
    .catch(error => {
        console.error('Upload Error:', error);
        alert(`An error occurred during upload: ${error.message}`);
    })
    .finally(() => {
        // Re-enable button and reset text
        submitButton.disabled = false;
        submitButton.textContent = 'Upload Files';
    });
});

// Fetch and display ALL uploaded links (published and unpublished)
function refreshLinks() {
    fetch('/api/files') // Используем новый endpoint /api/files
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        const linkList = document.getElementById('linkList');
        linkList.innerHTML = '';
        data.forEach(item => {
            const li = document.createElement('li');
            li.className = 'link-item';
            const link = document.createElement('a');
            link.href = `/static/${item[0]}`; // Assuming files are stored in uploads directory
            // Display album, article, and filename
            link.textContent = `${item[1]} - ${item[2]} - ${item[0]}`;
            link.target = '_blank';
            li.appendChild(link);

            // Добавляем кнопку публикации/снятия публикации
            const publishBtn = document.createElement('button');
            publishBtn.textContent = item[4] ? 'Unpublish' : 'Publish'; // item[4] - published flag
            publishBtn.onclick = function() {
                const action = item[4] ? 'unpublish' : 'publish';
                fetch(`/api/${action}/${encodeURIComponent(item[0])}`, {method: 'POST'})
                .then(response => response.json())
                .then(data => {
                    console.log(data.message);
                    refreshLinks(); // Обновляем список после изменения статуса
                })
                .catch(error => {
                    console.error(`Error ${action}ing file:`, error);
                    alert(`Error ${action}ing file: ${error.message}`);
                });
            };
            li.appendChild(publishBtn);

            linkList.appendChild(li);
        });
    })
    .catch(error => {
        console.error('Error fetching links:', error);
        // Optionally display an error message in the UI
        const linkList = document.getElementById('linkList');
        linkList.innerHTML = `<li class="link-item">Error loading links: ${error.message}</li>`;
    });
}

// Initial load of links
refreshLinks();

// Generate XLSX button
document.getElementById('generateBtn').addEventListener('click', function() {
    alert('Generating XLSX document...');
    // Implement actual generation logic here
});
