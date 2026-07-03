// ======== 帖子模块 ========

// 上传图片到 Supabase Storage
async function uploadImages(files) {
  const urls = [];
  for (const file of files) {
    const ext = file.name.split('.').pop();
    const filename = `posts/${generateId()}.${ext}`;
    const { data, error } = await supabase.storage
      .from('images')
      .upload(filename, file);
    
    if (error) {
      console.error('上传图片失败:', error);
      continue;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(filename);
    
    urls.push(publicUrl);
  }
  return urls;
}

// 创建帖子
async function handleCreatePost() {
  const board = document.getElementById('createBoard').value;
  const title = document.getElementById('createTitle').value.trim();
  const content = document.getElementById('createContent').value.trim();
  const isAnonymous = document.getElementById('createAnonymous').checked;
  const lockComments = document.getElementById('createLockComments').checked;
  const errorEl = document.getElementById('createError');
  const submitBtn = document.getElementById('createSubmit');
  
  if (!title) {
    errorEl.textContent = '请输入标题';
    errorEl.style.display = 'block';
    return;
  }
  
  if (!content) {
    errorEl.textContent = '请输入内容';
    errorEl.style.display = 'block';
    return;
  }
  
  // 违禁词检查
  const badTitle = containsBannedWords(title);
  const badContent = containsBannedWords(content);
  if (badTitle || badContent) {
    errorEl.textContent = '内容包含不当词汇，请修改后重新发布';
    errorEl.style.display = 'block';
    return;
  }
  
  errorEl.style.display = 'none';
  submitBtn.disabled = true;
  submitBtn.textContent = '发布中...';
  
  // 获取当前用户
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    showToast('请先登录');
    router.navigate('#/login');
    return;
  }
  
  // 获取IP
  const ip = await getUserIP();
  
  // 上传图片
  const imageFiles = window._pendingImages || [];
  let imageUrls = [];
  if (imageFiles.length > 0) {
    imageUrls = await uploadImages(imageFiles);
  }
  
  // 创建帖子
  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      board_slug: board,
      title: filterBannedWords(title),
      content: filterBannedWords(content),
      images: imageUrls,
      is_anonymous: isAnonymous,
      comments_disabled: lockComments,
      creator_ip: ip,
    })
    .select()
    .single();
  
  if (error) {
    errorEl.textContent = '发布失败：' + error.message;
    errorEl.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.textContent = '发布';
    return;
  }
  
  // 清理
  window._pendingImages = [];
  document.getElementById('uploadGrid').innerHTML = `
    <div class="upload-btn" onclick="document.getElementById('imageInput').click()">
      <span>+</span>
      <span class="upload-btn-text">添加图片</span>
    </div>
  `;
  document.getElementById('createTitle').value = '';
  document.getElementById('createContent').value = '';
  document.getElementById('contentCount').textContent = '0';
  document.getElementById('createAnonymous').checked = false;
  document.getElementById('createLockComments').checked = false;
  
  showToast('发布成功！');
  submitBtn.disabled = false;
  submitBtn.textContent = '发布';
  router.navigate('#/post/' + data.id);
}

// 图片选择
function handleImageSelect(event) {
  const files = Array.from(event.target.files);
  const maxFiles = 9;
  
  const existing = window._pendingImages || [];
  const total = existing.length + files.length;
  
  if (total > maxFiles) {
    showToast('最多上传9张图片');
    return;
  }
  
  window._pendingImages = [...existing, ...files];
  renderImagePreviews();
}

function renderImagePreviews() {
  const grid = document.getElementById('uploadGrid');
  const files = window._pendingImages || [];
  
  let html = '';
  files.forEach((file, i) => {
    html += `<div class="upload-preview-item">
      <img src="${URL.createObjectURL(file)}">
      <button class="upload-preview-remove" onclick="removeImage(${i})">×</button>
    </div>`;
  });
  
  if (files.length < 9) {
    html += `<div class="upload-btn" onclick="document.getElementById('imageInput').click()">
      <span>+</span>
      <span class="upload-btn-text">添加图片</span>
    </div>`;
  }
  
  grid.innerHTML = html;
}

function removeImage(index) {
  const files = window._pendingImages || [];
  files.splice(index, 1);
  window._pendingImages = files;
  renderImagePreviews();
}

// ======== 首页渲染 ========

// 渲染板块网格
async function renderBoards() {
  const grid = document.getElementById('boardGrid');
  const { data: boards } = await supabase
    .from('boards')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  
  if (!boards) {
    grid.innerHTML = '<div class="empty-state">暂无板块</div>';
    return;
  }
  
  grid.innerHTML = boards.map(b => `
    <div class="board-card" onclick="router.navigate('#/board/${b.slug}')">
      <div class="board-card-icon">${b.icon}</div>
      <div class="board-card-name">${b.name}</div>
      <div class="board-card-desc">${b.description || ''}</div>
    </div>
  `).join('');
}

// 渲染热帖
async function renderHotPosts(tab = 'daily') {
  const feed = document.getElementById('hotPostFeed');
  
  const since = tab === 'daily' 
    ? new Date(Date.now() - 86400000).toISOString()
    : new Date(Date.now() - 604800000).toISOString();
  
  const { data: posts } = await supabase
    .from('posts')
    .select('*, profiles!inner(display_name, avatar_url)')
    .eq('is_approved', true)
    .eq('is_hidden', false)
    .gte('created_at', since)
    .order('like_count', { ascending: false })
    .limit(10);
  
  if (!posts || posts.length === 0) {
    feed.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">暂无热帖</div></div>';
    return;
  }
  
  feed.innerHTML = posts.map(renderPostCard).join('');
}

// 渲染最新动态
async function renderLatestPosts() {
  const feed = document.getElementById('latestPostFeed');
  
  const { data: posts } = await supabase
    .from('posts')
    .select('*, profiles!inner(display_name, avatar_url)')
    .eq('is_approved', true)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (!posts || posts.length === 0) {
    feed.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">暂无内容，快来发布第一条动态吧</div></div>';
    return;
  }
  
  feed.innerHTML = posts.map(renderPostCard).join('');
}

// 渲染公告
async function renderAnnouncements() {
  const track = document.getElementById('announcementTrack');
  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
    .limit(5);
  
  if (!announcements || announcements.length === 0) {
    track.innerHTML = '<span class="announcement-text">欢迎来到昭州校园社区</span>';
    return;
  }
  
  // 轮播
  let index = 0;
  const render = () => {
    const a = announcements[index];
    track.innerHTML = `<span class="announcement-text">📌 ${a.title}：${a.content}</span>`;
  };
  
  render();
  setInterval(() => {
    index = (index + 1) % announcements.length;
    render();
  }, 5000);
}

// Hot tab switch
function switchHotTab(tab) {
  document.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  renderHotPosts(tab);
}

// ======== 板块页 ========
let currentBoardSlug = 'all';
let currentBoardSort = 'latest';
let boardPage = 0;

async function renderBoardPage(slug) {
  currentBoardSlug = slug;
  boardPage = 0;
  
  const headerEl = document.getElementById('boardHeader');
  const feed = document.getElementById('boardPostFeed');
  
  if (slug === 'all') {
    headerEl.querySelector('.board-title').textContent = '📋 全部板块';
    headerEl.querySelector('.board-desc').textContent = '查看所有最新动态';
  } else {
    const boardName = getBoardName(slug);
    headerEl.querySelector('.board-title').textContent = boardName;
    headerEl.querySelector('.board-desc').textContent = '';
  }
  
  await loadBoardPosts();
}

async function loadBoardPosts(append = false) {
  const feed = document.getElementById('boardPostFeed');
  
  if (!append) {
    feed.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';
  }
  
  let query = supabase
    .from('posts')
    .select('*, profiles!inner(display_name, avatar_url)')
    .eq('is_approved', true)
    .eq('is_hidden', false);
  
  if (currentBoardSlug !== 'all') {
    query = query.eq('board_slug', currentBoardSlug);
  }
  
  if (currentBoardSort === 'hot') {
    query = query.order('like_count', { ascending: false });
  }
  query = query.order('created_at', { ascending: false });
  
  query = query.range(boardPage * 20, (boardPage + 1) * 20 - 1);
  
  const { data: posts } = await query;
  
  if (!posts || posts.length === 0) {
    if (!append) {
      feed.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">暂无内容</div></div>';
    }
    return;
  }
  
  if (append) {
    feed.innerHTML += posts.map(renderPostCard).join('');
  } else {
    feed.innerHTML = posts.map(renderPostCard).join('');
  }
}

function switchBoardSort(sort) {
  currentBoardSort = sort;
  boardPage = 0;
  document.querySelectorAll('.board-sort-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-sort="${sort}"]`).classList.add('active');
  loadBoardPosts();
}

// ======== 搜索 ========
async function performSearch() {
  const query = document.getElementById('searchInput').value.trim();
  if (!query) return;
  
  router.navigate('#/search/' + encodeURIComponent(query));
  
  const feed = document.getElementById('searchResults');
  feed.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';
  
  const { data: posts } = await supabase
    .from('posts')
    .select('*, profiles!inner(display_name, avatar_url)')
    .eq('is_approved', true)
    .eq('is_hidden', false)
    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (!posts || posts.length === 0) {
    feed.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">没有找到相关结果</div></div>';
    return;
  }
  
  feed.innerHTML = posts.map(renderPostCard).join('');
}

// ======== 帖子卡片渲染 ========
function renderPostCard(post) {
  const isAnon = post.is_anonymous;
  const authorName = isAnon ? '匿名用户' : (post.profiles?.display_name || '用户已注销');
  const avatarLetter = isAnon ? '匿' : getAvatarLetter(authorName);
  const boardName = getBoardName(post.board_slug);
  
  return `
    <div class="post-card">
      <div class="post-card-header">
        <div class="post-avatar">${avatarLetter}</div>
        <div class="post-author-info">
          <div class="post-author-name">${authorName}</div>
          <div class="post-meta">
            <span>${formatTime(post.created_at)}</span>
            ${post.is_pinned ? '<span class="post-meta-dot"></span><span style="color:var(--primary)">📌 置顶</span>' : ''}
          </div>
        </div>
        <span class="post-board-tag">${boardName}</span>
      </div>
      <div class="post-card-body" onclick="router.navigate('#/post/${post.id}')">
        <div class="post-title">${post.is_anonymous ? '💬 ' : ''}${post.title}</div>
        <div class="post-excerpt">${post.content}</div>
        ${post.images && post.images.length > 0 ? `
          <div class="post-images-preview">
            ${post.images.slice(0, 4).map(url => `<img src="${url}" loading="lazy">`).join('')}
            ${post.images.length > 4 ? `<div class="post-avatar" style="width:80px;height:80px;border-radius:8px;font-size:0.9rem;">+${post.images.length - 4}</div>` : ''}
          </div>
        ` : ''}
      </div>
      <div class="post-card-footer">
        <button class="post-stat-btn ${post._liked ? 'liked' : ''}" onclick="toggleLike('${post.id}', this)">
          ❤ ${post.like_count || 0}
        </button>
        <button class="post-stat-btn" onclick="router.navigate('#/post/${post.id}')">
          💬 ${post.comment_count || 0}
        </button>
        <button class="post-stat-btn ${post._bookmarked ? 'bookmarked' : ''}" onclick="toggleBookmark('${post.id}', this)">
          🔖 ${post.bookmark_count || 0}
        </button>
        <button class="post-stat-btn" onclick="sharePost('${post.id}')">
          🔗 分享
        </button>
      </div>
    </div>
  `;
}

// ======== 点赞 ========
async function toggleLike(postId, btn) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { showToast('请先登录'); return; }
  
  const isLiked = btn.classList.toggle('liked');
  const countEl = btn;
  
  if (isLiked) {
    await supabase.from('likes').upsert({ user_id: user.id, post_id: postId });
    await supabase.rpc('increment_like', { post_id: postId });
    btn.innerHTML = `❤ ${parseInt(btn.textContent.match(/\d+/)?.[0] || 0) + 1}`;
  } else {
    await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', postId);
    await supabase.rpc('decrement_like', { post_id: postId });
    btn.innerHTML = `❤ ${Math.max(0, parseInt(btn.textContent.match(/\d+/)?.[0] || 0) - 1)}`;
  }
}

// ======== 收藏 ========
async function toggleBookmark(postId, btn) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { showToast('请先登录'); return; }
  
  const isBookmarked = btn.classList.toggle('bookmarked');
  
  if (isBookmarked) {
    await supabase.from('bookmarks').upsert({ user_id: user.id, post_id: postId });
    await supabase.rpc('increment_bookmark', { post_id: postId });
  } else {
    await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('post_id', postId);
    await supabase.rpc('decrement_bookmark', { post_id: postId });
  }
}

// ======== 分享 ========
function sharePost(postId) {
  const url = window.location.origin + window.location.pathname + '#/post/' + postId;
  if (navigator.share) {
    navigator.share({ url });
  } else {
    navigator.clipboard.writeText(url).then(() => showToast('链接已复制'));
  }
}
