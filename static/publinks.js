let currentAlbum = '';
let currentArticle = '';
let offset = 0;
const limit = 20;

// Fetch albums
function fetchAlbums() {
    fetch('/api/albums')
    .then(response => response.json())
    .then(data => {
        const albumSelect = document.getElementById('albumSelect');
        albumSelect.innerHTML = '<option value="">Select Album</option>';
        data.forEach(album => {
            const option = document.createElement('option');
            option.value = album;
            option.textContent = album;
            albumSelect.appendChild(option);
        });
    })
    .catch(error => {
        console.error('Error fetching albums:', error);
    });
}

// On album change
function onAlbumChange() {
    const albumSelect = document.getElementById('albumSelect');
    currentAlbum = albumSelect.value;
    document.getElementById('articleSelect').disabled = !currentAlbum;
    if (currentAlbum) {
        fetchArticles(currentAlbum);
    } else {
        document.getElementById('articleSelect').innerHTML = '<option value="">Select Article</option>';
        clearLinks();
    }
}

// Fetch articles for an album
function fetchArticles(albumName) {
    fetch(`/api/articles/${encodeURIComponent(albumName)}`)
    .then(response => response.json())
    .then(data => {
        const articleSelect = document.getElementById('articleSelect');
        articleSelect.innerHTML = '<option value="">Select Article</option>';
        data.forEach(article => {
            const option = document.createElement('option');
            option.value = article;
            option.textContent = article;
            articleSelect.appendChild(option);
        });
    })
    .catch(error => {
        console.error('Error fetching articles:', error);
    });
}

// On article change
function onArticleChange() {
    const articleSelect = document.getElementById('articleSelect');
    currentArticle = articleSelect.value;
    if (currentAlbum && currentArticle) {
        loadLinks(currentAlbum, currentArticle);
    } else {
        clearLinks();
    }
}

// Load links for a specific album and article
function loadLinks(albumName, articleNumber) {
    fetch(`/api/links/${encodeURIComponent(albumName)}/${encodeURIComponent(articleNumber)}?offset=${offset}&limit=${limit}`)
    .then(response => response.json())
    .then(data => {
        const linkList = document.getElementById('linkList');
        linkList.innerHTML = '';
        data.forEach(item => {
            const li = document.createElement('li');
            li.className = 'link-item';
            const link = document.createElement('a');
            link.href = `/static/${item[0]}`;
            link.textContent = item[0];
            link.target = '_blank';
            li.appendChild(link);
            linkList.appendChild(li);
        });
    })
    .catch(error => {
        console.error('Error fetching links:', error);
    });
}

// Clear links list
function clearLinks() {
    document.getElementById('linkList').innerHTML = '';
    offset = 0;
}

// Load more links
function loadMore() {
    if (currentAlbum && currentArticle) {
        offset += limit;
        loadLinks(currentAlbum, currentArticle);
    }
}

// Go back to index page
function goBack() {
    window.location.href = '/';
}

// Initial load
fetchAlbums();

