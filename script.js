let GITHUB_USERNAME = '';
let GITHUB_REPO = '';
let GITHUB_TOKEN = '';
let ADMIN_PASSWORD = '';

let posts = [];
let comments = {};
let currentPostId = 1;

async function loadEnv() {
    try {
        const response = await fetch('.env');
        const envText = await response.text();
        const envLines = envText.split('\n');
        
        envLines.forEach(line => {
            if (line.trim() && !line.startsWith('#')) {
                const [key, value] = line.split('=');
                if (key && value) {
                    const cleanKey = key.trim();
                    const cleanValue = value.trim();
                    
                    if (cleanKey === 'GITHUB_USERNAME') GITHUB_USERNAME = cleanValue;
                    if (cleanKey === 'GITHUB_REPO') GITHUB_REPO = cleanValue;
                    if (cleanKey === 'GITHUB_TOKEN') GITHUB_TOKEN = cleanValue;
                    if (cleanKey === 'ADMIN_PASSWORD') ADMIN_PASSWORD = cleanValue;
                }
            }
        });
        
        if (!GITHUB_USERNAME || !GITHUB_REPO || !GITHUB_TOKEN || !ADMIN_PASSWORD) {
            console.error('File .env tidak lengkap');
            showAlert('Error: Konfigurasi tidak lengkap', 'error');
        }
    } catch (error) {
        console.error('Gagal load .env file:', error);
        showAlert('Error: Gagal load konfigurasi', 'error');
    }
}

async function fetchFromGitHub() {
    if (!GITHUB_USERNAME || !GITHUB_REPO) {
        showAlert('Error: Konfigurasi GitHub belum diatur', 'error');
        return;
    }
    
    try {
        const response = await fetch(`https://raw.githubusercontent.com/${GITHUB_USERNAME}/${GITHUB_REPO}/main/db.json`);
        if (!response.ok) {
            console.log('Data belum ada, menggunakan data kosong');
            posts = [];
            comments = {};
            currentPostId = 1;
            loadPostsToUI();
            return;
        }
        
        const data = await response.json();
        posts = data.posts || [];
        comments = data.comments || {};
        
        if (posts.length > 0) {
            currentPostId = Math.max(...posts.map(p => p.id)) + 1;
        } else {
            currentPostId = 1;
        }
        
        loadPostsToUI();
    } catch (error) {
        console.log('Gagal load data, menggunakan data kosong');
        posts = [];
        comments = {};
        loadPostsToUI();
    }
}

async function saveToGitHub() {
    if (!GITHUB_USERNAME || !GITHUB_REPO || !GITHUB_TOKEN) {
        showAlert('Error: Konfigurasi GitHub tidak lengkap', 'error');
        return false;
    }
    
    const data = {
        posts: posts,
        comments: comments,
        lastUpdated: new Date().toISOString()
    };
    
    const content = JSON.stringify(data, null, 2);
    const encodedContent = btoa(unescape(encodeURIComponent(content)));
    
    try {
        let sha = '';
        
        try {
            const existingFile = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/db.json`);
            if (existingFile.ok) {
                const fileData = await existingFile.json();
                sha = fileData.sha;
            }
        } catch (e) {
            console.log('File belum ada, akan membuat baru');
        }
        
        const requestBody = {
            message: 'Update data SatriaCodeShare - ' + new Date().toISOString(),
            content: encodedContent
        };
        
        if (sha) {
            requestBody.sha = sha;
        }
        
        const response = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/db.json`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error from GitHub:', errorData);
            showAlert('Gagal menyimpan data ke GitHub', 'error');
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error saving to GitHub:', error);
        showAlert('Gagal menyimpan data ke GitHub', 'error');
        return false;
    }
}

function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Baru saja';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} menit lalu`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam lalu`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)} hari lalu`;
    return `${Math.floor(seconds / 2592000)} bulan lalu`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showAlert(message, type) {
    const alertElement = document.getElementById('alertMessage');
    alertElement.textContent = message;
    alertElement.className = 'alert show';
    if (type === 'success') {
        alertElement.classList.add('alert-success');
    } else {
        alertElement.classList.add('alert-error');
    }
    
    setTimeout(() => {
        alertElement.classList.remove('show');
    }, 3000);
}

function loadPostsToUI() {
    const postsTimeline = document.getElementById('postsTimeline');
    const emptyState = document.getElementById('emptyState');
    
    if (posts.length === 0) {
        postsTimeline.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    postsTimeline.innerHTML = '';
    
    posts.forEach(post => {
        const timeAgo = getTimeAgo(post.createdAt);
        const avatarLetter = post.author.charAt(0).toUpperCase();
        const codeLines = post.code.split('\n');
        const codePreview = codeLines.slice(0, 10).join('\n');
        const postComments = comments[post.id] || [];
        
        const postCard = document.createElement('div');
        postCard.className = 'post-card';
        postCard.dataset.id = post.id;
        
        postCard.innerHTML = `
            <div class="post-header">
                <div class="post-author">
                    <div class="author-avatar">${avatarLetter}</div>
                    <div class="author-info">
                        <h4>${escapeHtml(post.author)}</h4>
                        <div class="post-time">${timeAgo}</div>
                    </div>
                </div>
                <span class="post-language">${post.language.toUpperCase()}</span>
            </div>
            
            <div class="post-content">
                <h3 class="post-title">${escapeHtml(post.title)}</h3>
                <p class="post-description">${escapeHtml(post.description)}</p>
                
                <div class="post-tags">
                    ${post.tags.map(tag => `<span class="post-tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
                
                <div class="code-preview">
                    <pre>${escapeHtml(codePreview)}${codeLines.length > 10 ? '\n...' : ''}</pre>
                </div>
            </div>
            
            <div class="post-footer">
                <div class="post-stats">
                    <div class="stat-item">
                        <i class="fas fa-eye"></i> ${post.views || 0} views
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-heart"></i> ${post.likes || 0} likes
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-comment"></i> ${postComments.length} comments
                    </div>
                </div>
                
                <div class="post-actions">
                    <button class="btn btn-small btn-primary view-post-btn">
                        <i class="fas fa-expand"></i> SELENGKAPNYA
                    </button>
                    <button class="btn btn-small btn-like like-post-btn">
                        <i class="fas fa-heart"></i> LIKE
                    </button>
                </div>
            </div>
        `;
        
        postsTimeline.appendChild(postCard);
    });
    
    document.querySelectorAll('.view-post-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const postId = parseInt(this.closest('.post-card').dataset.id);
            openPostModal(postId);
        });
    });
    
    document.querySelectorAll('.like-post-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const postId = parseInt(this.closest('.post-card').dataset.id);
            toggleLike(postId);
        });
    });
}

function openPostModal(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    
    post.views = (post.views || 0) + 1;
    saveToGitHub();
    
    const postComments = comments[post.id] || [];
    
    document.getElementById('modalPostTitle').textContent = post.title;
    document.getElementById('modalPostLanguage').textContent = post.language.toUpperCase();
    document.getElementById('modalPostDescription').textContent = post.description;
    document.getElementById('modalPostCode').textContent = post.code;
    document.getElementById('modalPostAuthor').textContent = post.author;
    document.getElementById('modalPostTime').textContent = getTimeAgo(post.createdAt);
    document.getElementById('modalViews').textContent = post.views || 0;
    document.getElementById('modalLikes').textContent = post.likes || 0;
    document.getElementById('modalDownloads').textContent = post.downloads || 0;
    document.getElementById('modalCommentsCount').textContent = postComments.length;
    document.getElementById('commentsCount').textContent = postComments.length;
    
    const tagsContainer = document.getElementById('modalPostTags');
    tagsContainer.innerHTML = '';
    post.tags.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.className = 'post-tag';
        tagElement.textContent = tag;
        tagsContainer.appendChild(tagElement);
    });
    
    document.getElementById('modalLikeBtn').onclick = () => toggleLike(postId);
    document.getElementById('modalDownloadBtn').onclick = () => downloadPost(post);
    document.getElementById('modalCopyBtn').onclick = () => copyToClipboard(post.code);
    document.getElementById('submitCommentBtn').onclick = () => submitComment(postId);
    
    loadComments(postId);
    document.getElementById('postModal').classList.add('active');
}

function toggleLike(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    
    post.likes = (post.likes || 0) + 1;
    saveToGitHub();
    loadPostsToUI();
    
    if (document.getElementById('postModal').classList.contains('active')) {
        document.getElementById('modalLikes').textContent = post.likes;
    }
    
    showLikeNotification();
}

function showLikeNotification() {
    const notification = document.getElementById('likeNotification');
    notification.textContent = 'Postingan disukai!';
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 2000);
}

function loadComments(postId) {
    const commentsList = document.getElementById('commentsList');
    const postComments = comments[post.id] || [];
    
    commentsList.innerHTML = '';
    
    if (postComments.length === 0) {
        commentsList.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">Belum ada komentar. Jadilah yang pertama!</p>';
        return;
    }
    
    postComments.forEach(comment => {
        const commentItem = document.createElement('div');
        commentItem.className = 'comment-item';
        commentItem.innerHTML = `
            <div class="comment-header">
                <div class="comment-author">${escapeHtml(comment.author)}</div>
                <div class="comment-time">${getTimeAgo(comment.createdAt)}</div>
            </div>
            <div class="comment-text">${escapeHtml(comment.text)}</div>
        `;
        commentsList.appendChild(commentItem);
    });
}

function submitComment(postId) {
    const authorInput = document.getElementById('commentAuthor');
    const textInput = document.getElementById('commentText');
    
    const author = authorInput.value.trim();
    const text = textInput.value.trim();
    
    if (!author || !text) {
        showAlert('Nama dan komentar harus diisi!', 'error');
        return;
    }
    
    if (!comments[postId]) {
        comments[postId] = [];
    }
    
    const newComment = {
        id: Date.now(),
        author: author,
        text: text,
        createdAt: new Date().toISOString()
    };
    
    comments[postId].push(newComment);
    saveToGitHub();
    
    textInput.value = '';
    
    const btn = document.getElementById('submitCommentBtn');
    btn.innerHTML = '<i class="fas fa-check"></i> TERKIRIM!';
    btn.style.background = 'var(--success)';
    
    setTimeout(() => {
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> KIRIM';
        btn.style.background = '';
    }, 1000);
    
    const postComments = comments[postId].length;
    document.getElementById('modalCommentsCount').textContent = postComments;
    document.getElementById('commentsCount').textContent = postComments;
    
    loadComments(postId);
}

function downloadPost(post) {
    post.downloads = (post.downloads || 0) + 1;
    saveToGitHub();
    
    document.getElementById('modalDownloads').textContent = post.downloads;
    
    const blob = new Blob([post.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${post.title.replace(/\s+/g, '_')}.${getFileExtension(post.language)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    const downloadBtn = document.getElementById('modalDownloadBtn');
    downloadBtn.innerHTML = '<i class="fas fa-check"></i> TERDOWNLOAD!';
    downloadBtn.style.background = 'var(--success)';
    
    setTimeout(() => {
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> DOWNLOAD';
        downloadBtn.style.background = '';
    }, 1000);
    
    showAlert('Kode berhasil didownload!', 'success');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        const copyBtn = document.getElementById('modalCopyBtn');
        copyBtn.innerHTML = '<i class="fas fa-check"></i> TERSALIN!';
        copyBtn.style.background = 'var(--success)';
        
        setTimeout(() => {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> SALIN KODE';
            copyBtn.style.background = '';
        }, 1000);
        
        showAlert('Kode berhasil disalin ke clipboard!', 'success');
    });
}

function getFileExtension(language) {
    const extensions = {
        javascript: 'js',
        python: 'py',
        java: 'java',
        php: 'php',
        html: 'html',
        cpp: 'cpp',
        csharp: 'cs',
        other: 'txt'
    };
    return extensions[language] || 'txt';
}

function accessAdminPanel() {
    const adminKey = document.getElementById('adminKeyInput').value.trim();
    
    if (adminKey === ADMIN_PASSWORD) {
        document.getElementById('adminPanel').classList.add('active');
        document.getElementById('adminKeyInput').value = '';
        loadAdminPosts();
        showAlert('Berhasil login sebagai admin!', 'success');
    } else {
        showAlert('Kunci admin salah!', 'error');
    }
}

function publishPost() {
    const title = document.getElementById('postTitle').value.trim();
    const description = document.getElementById('postDescription').value.trim();
    const author = document.getElementById('postAuthor').value.trim();
    const language = document.getElementById('postLanguage').value;
    const tags = document.getElementById('postTags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
    const code = document.getElementById('postCode').value.trim();
    
    if (!title || !code || !author) {
        showAlert('Judul, kode, dan nama penulis harus diisi!', 'error');
        return;
    }
    
    const newPost = {
        id: currentPostId++,
        title: title,
        description: description || "Tidak ada deskripsi.",
        author: author,
        language: language,
        code: code,
        tags: tags.length > 0 ? tags : ["code"],
        views: 0,
        likes: 0,
        downloads: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    posts.unshift(newPost);
    saveToGitHub();
    
    document.getElementById('postTitle').value = '';
    document.getElementById('postDescription').value = '';
    document.getElementById('postCode').value = '';
    document.getElementById('postTags').value = '';
    
    const btn = document.getElementById('publishPostBtn');
    btn.innerHTML = '<i class="fas fa-check"></i> BERHASIL!';
    btn.style.background = 'var(--success)';
    
    setTimeout(() => {
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> PUBLISH';
        btn.style.background = '';
    }, 2000);
    
    showAlert('Postingan berhasil dipublish!', 'success');
    loadPostsToUI();
    loadAdminPosts();
}

function loadAdminPosts() {
    const postsList = document.getElementById('adminPostsList');
    postsList.innerHTML = '';
    
    if (posts.length === 0) {
        postsList.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">Belum ada postingan.</p>';
        return;
    }
    
    posts.forEach(post => {
        const postItem = document.createElement('div');
        postItem.className = 'admin-post-item';
        postItem.style.cssText = 'padding: 12px; border: 2px solid var(--border-color); margin-bottom: 8px; background: var(--bg-primary);';
        
        const postComments = comments[post.id] || [];
        
        postItem.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div style="flex: 1;">
                    <h4 style="margin: 0; color: var(--accent); font-size: 1rem;">${escapeHtml(post.title)}</h4>
                    <p style="margin: 5px 0 0 0; font-size: 0.85rem; color: var(--text-muted);">
                        ${post.language.toUpperCase()} • ${escapeHtml(post.author)} • ${getTimeAgo(post.createdAt)}
                    </p>
                    <div style="margin-top: 5px; font-size: 0.8rem; display: flex; gap: 15px;">
                        <span><i class="fas fa-eye"></i> ${post.views || 0} views</span>
                        <span><i class="fas fa-heart"></i> ${post.likes || 0} likes</span>
                        <span><i class="fas fa-download"></i> ${post.downloads || 0} downloads</span>
                        <span><i class="fas fa-comment"></i> ${postComments.length} comments</span>
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-small btn-primary edit-post-btn" data-id="${post.id}">
                        <i class="fas fa-edit"></i> EDIT
                    </button>
                    <button class="btn btn-small btn-danger delete-post-btn" data-id="${post.id}">
                        <i class="fas fa-trash"></i> HAPUS
                    </button>
                </div>
            </div>
        `;
        
        postsList.appendChild(postItem);
    });
    
    document.querySelectorAll('.edit-post-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const postId = parseInt(this.dataset.id);
            editPost(postId);
        });
    });
    
    document.querySelectorAll('.delete-post-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const postId = parseInt(this.dataset.id);
            deletePost(postId);
        });
    });
}

function editPost(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    
    document.getElementById('postTitle').value = post.title;
    document.getElementById('postDescription').value = post.description;
    document.getElementById('postAuthor').value = post.author;
    document.getElementById('postLanguage').value = post.language;
    document.getElementById('postTags').value = post.tags.join(', ');
    document.getElementById('postCode').value = post.code;
    
    const publishBtn = document.getElementById('publishPostBtn');
    publishBtn.innerHTML = '<i class="fas fa-save"></i> UPDATE POSTINGAN';
    publishBtn.onclick = function() {
        updatePost(postId);
    };
    
    showAlert('Postingan dimuat untuk diedit.', 'success');
}

function updatePost(postId) {
    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex === -1) return;
    
    const title = document.getElementById('postTitle').value.trim();
    const description = document.getElementById('postDescription').value.trim();
    const author = document.getElementById('postAuthor').value.trim();
    const language = document.getElementById('postLanguage').value;
    const tags = document.getElementById('postTags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
    const code = document.getElementById('postCode').value.trim();
    
    if (!title || !code || !author) {
        showAlert('Judul, kode, dan nama penulis harus diisi!', 'error');
        return;
    }
    
    posts[postIndex] = {
        ...posts[postIndex],
        title: title,
        description: description || "Tidak ada deskripsi.",
        author: author,
        language: language,
        code: code,
        tags: tags.length > 0 ? tags : ["code"],
        updatedAt: new Date().toISOString()
    };
    
    saveToGitHub();
    
    document.getElementById('postTitle').value = '';
    document.getElementById('postDescription').value = '';
    document.getElementById('postCode').value = '';
    document.getElementById('postTags').value = '';
    
    const publishBtn = document.getElementById('publishPostBtn');
    publishBtn.innerHTML = '<i class="fas fa-paper-plane"></i> PUBLISH';
    publishBtn.onclick = publishPost;
    
    showAlert('Postingan berhasil diupdate!', 'success');
    loadPostsToUI();
    loadAdminPosts();
}

function deletePost(postId) {
    if (!confirm('Apakah Anda yakin ingin menghapus postingan ini?')) return;
    
    posts = posts.filter(p => p.id !== postId);
    delete comments[postId];
    saveToGitHub();
    
    loadAdminPosts();
    loadPostsToUI();
    showAlert('Postingan berhasil dihapus!', 'success');
}

function clearAllPosts() {
    if (!confirm('Apakah Anda yakin ingin menghapus SEMUA postingan? Tindakan ini tidak dapat dibatalkan!')) return;
    
    posts = [];
    comments = {};
    currentPostId = 1;
    saveToGitHub();
    
    loadAdminPosts();
    loadPostsToUI();
    showAlert('Semua postingan berhasil dihapus!', 'success');
}

function exportPosts() {
    const exportData = {
        posts: posts,
        comments: comments,
        exportedAt: new Date().toISOString(),
        totalPosts: posts.length,
        totalComments: Object.values(comments).reduce((sum, arr) => sum + arr.length, 0)
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `satriacodeshare-export-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showAlert('Data berhasil diexport!', 'success');
}

function previewPost() {
    const title = document.getElementById('postTitle').value.trim();
    const description = document.getElementById('postDescription').value.trim();
    const author = document.getElementById('postAuthor').value.trim();
    const language = document.getElementById('postLanguage').value;
    const tags = document.getElementById('postTags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
    const code = document.getElementById('postCode').value.trim();
    
    if (!title || !code) {
        showAlert('Judul dan kode harus diisi untuk preview!', 'error');
        return;
    }
    
    document.getElementById('modalPostTitle').textContent = title;
    document.getElementById('modalPostLanguage').textContent = language.toUpperCase();
    document.getElementById('modalPostDescription').textContent = description || "Tidak ada deskripsi.";
    document.getElementById('modalPostAuthor').textContent = author || "Admin";
    document.getElementById('modalPostTime').textContent = "Preview";
    document.getElementById('modalPostCode').textContent = code;
    document.getElementById('modalViews').textContent = "0";
    document.getElementById('modalLikes').textContent = "0";
    document.getElementById('modalDownloads').textContent = "0";
    document.getElementById('modalCommentsCount').textContent = "0";
    document.getElementById('commentsCount').textContent = "0";
    document.getElementById('commentsList').innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">Ini hanya preview. Komentar tidak tersedia.</p>';
    
    const tagsContainer = document.getElementById('modalPostTags');
    tagsContainer.innerHTML = '';
    const tagList = tags.length > 0 ? tags : ["code"];
    tagList.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.className = 'post-tag';
        tagElement.textContent = tag;
        tagsContainer.appendChild(tagElement);
    });
    
    document.getElementById('modalLikeBtn').onclick = () => showAlert('Ini hanya preview!', 'warning');
    document.getElementById('modalDownloadBtn').onclick = () => showAlert('Ini hanya preview!', 'warning');
    document.getElementById('modalCopyBtn').onclick = () => copyToClipboard(code);
    
    document.getElementById('commentsSection').style.display = 'none';
    document.getElementById('postModal').classList.add('active');
}

document.addEventListener('DOMContentLoaded', async function() {
    await loadEnv();
    await fetchFromGitHub();
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const section = this.getAttribute('data-section');
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(section + 'Section').classList.add('active');
            
            if (section === 'admin') {
                loadAdminPosts();
            }
        });
    });

    document.getElementById('adminAccessBtn').addEventListener('click', accessAdminPanel);
    document.getElementById('publishPostBtn').addEventListener('click', publishPost);
    document.getElementById('previewPostBtn').addEventListener('click', previewPost);
    document.getElementById('clearAllPostsBtn').addEventListener('click', clearAllPosts);
    document.getElementById('exportPostsBtn').addEventListener('click', exportPosts);
    document.getElementById('refreshAdminBtn').addEventListener('click', () => {
        fetchFromGitHub();
        showAlert('Data diperbarui!', 'success');
    });

    document.getElementById('modalClose').addEventListener('click', () => {
        document.getElementById('postModal').classList.remove('active');
    });

    document.getElementById('postModal').addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });
});