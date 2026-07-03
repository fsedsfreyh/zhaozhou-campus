/**
 * SPA 路由器 + 应用核心
 * 昭州中学校园网
 */

let currentUser = null;
let currentCategory = 'all';

// ======== 初始化 ========
document.addEventListener('DOMContentLoaded', async () => {
  initSupabase();
  await checkAuth();
  handleRoute();
  window.addEventListener('hashchange', handleRoute);
});

// ======== 路由 ========
function handleRoute() {
  const hash = window.location.hash || '#/';
  const path = hash.replace('#/', '').split('/');
  const page = path[0] || '';
  const param = path[1] || '';

  hideAllPages();

  // 检查是否已配置 Supabase
  if (!isSupabaseConfigured() && page !== 'setup') {
    showPage('page-setup');
    return;
  }

  switch (page) {
    case '':
      showPage('page-home');
      loadPosts(currentCategory);
      break;
    case 'login':
      showPage('page-login');
      break;
    case 'register':
      showPage('page-register');
      break;
    case 'create':
      checkAuthAndShow('page-create-post');
      break;
    case 'post':
      showPage('page-post-detail');
      loadPostDetail(param);
      break;
    case 'profile':
      showPage('page-profile');
      loadProfile();
      break;
    case 'setup':
      showPage('page-setup');
      break;
    default:
      navigate('#/');
  }

  updateNav();
}

function navigate(hash) {
  window.location.hash = hash;
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');
}

function hideAllPages() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
}

// ======== 认证检查 ========
async function checkAuth() {
  currentUser = await getCurrentUser();
  updateNav();
}

function updateNav() {
  const loginBtn = document.getElementById('navLoginBtn');
  const profileBtn = document.getElementById('navProfileBtn');
  const logoutBtn = document.getElementById('navLogoutBtn');
  const fab = document.getElementById('fabCreate');

  if (currentUser) {
    loginBtn.style.display = 'none';
    profileBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'inline-block';
    fab.style.display = 'flex';
  } else {
    loginBtn.style.display = 'inline-block';
    profileBtn.style.display = 'none';
    logoutBtn.style.display = 'none';
    fab.style.display = 'none';
  }
}

function checkAuthAndShow(pageId) {
  if (!currentUser) {
    showToast('请先登录');
    navigate('#/login');
    return;
  }
  showPage(pageId);
}

// ======== 首页：加载帖子 ========
async function loadPosts(category = 'all') {
  const feed = document.getElementById('postFeed');
  feed.innerHTML = '<div class="loading"><div class="loading-spinner"></div>加载中...</div>';

  const result = await getPosts(category, 1, 20);

  if (result.error) {
    feed.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-text">${result.error}</div>
    </div>`;
    return;
  }

  if (!result.data || result.data.length === 0) {
    feed.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">📝</div>
      <div class="empty-state-text">还没有帖子，快来发布第一条动态吧！</div>
    </div>`;
    return;
  }

  feed.innerHTML = result.data.map(post => renderPostCard(post)).join('');
}

function renderPostCard(post) {
  const avatarLetter = (post.display_name || '?')[0];
  const previewText = (post.content || '').substring(0, 120);

  return `
    <div class="post-card" onclick="navigate('#/post/${post.id}')">
      <div class="post-card-header">
        <div class="post-avatar">${post.avatar_url ? `<img src="${post.avatar_url}" alt="">` : avatarLetter}</div>
        <div>
          <div class="post-author">${escapeHTML(post.display_name || post.username)}</div>
          <div class="post-meta">${formatTime(post.created_at)}</div>
        </div>
        <span class="post-category">${post.category || '日常'}</span>
      </div>
      <div class="post-card-body">
        <div class="post-title">${escapeHTML(post.title || '无标题')}</div>
        <div class="post-content-preview">${escapeHTML(previewText)}</div>
        ${post.image_url ? `<img class="post-image" src="${post.image_url}" alt="" loading="lazy">` : ''}
      </div>
      <div class="post-card-footer">
        <span class="post-action-btn">❤️ ${post.likes_count || 0}</span>
        <span class="post-action-btn">💬 ${post.comments_count || 0}</span>
      </div>
    </div>
  `;
}

// ======== 分类筛选 ========
function filterByCategory(category) {
  currentCategory = category;
  document.querySelectorAll('.category-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.category === category);
  });
  loadPosts(category);
}

// ======== 帖子详情 ========
async function loadPostDetail(postId) {
  const container = document.getElementById('postDetailContainer');
  container.innerHTML = '<div class="loading"><div class="loading-spinner"></div>加载中...</div>';

  const post = await getPost(postId);
  if (!post) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">😅</div><div class="empty-state-text">帖子不存在或已被删除</div></div>';
    return;
  }

  const comments = await getComments(postId);
  const liked = await hasLiked(postId);

  const avatarLetter = (post.display_name || '?')[0];

  let html = `
    <div class="post-detail-card">
      <div class="post-detail-header">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <div class="post-avatar">${post.avatar_url ? `<img src="${post.avatar_url}" alt="">` : avatarLetter}</div>
          <div>
            <div class="post-author">${escapeHTML(post.display_name || post.username)}</div>
            <div class="post-meta">${formatTime(post.created_at)} · ${post.category || '日常'}</div>
          </div>
        </div>
        <div class="post-detail-title">${escapeHTML(post.title || '无标题')}</div>
      </div>
      <div class="post-detail-body">
        <div class="post-detail-content">${escapeHTML(post.content || '')}</div>
        ${post.image_url ? `<img class="post-image" src="${post.image_url}" alt="" style="margin-top:12px;max-height:400px;">` : ''}
        <div style="display:flex;gap:16px;margin-top:16px;">
          <button class="post-action-btn ${liked ? 'liked' : ''}" onclick="handleLike('${post.id}', this)">
            ${liked ? '❤️' : '🤍'} <span>${post.likes_count || 0}</span>
          </button>
          <span class="post-action-btn">💬 ${post.comments_count || 0}</span>
          <button class="post-action-btn" style="margin-left:auto;color:var(--danger)" onclick="showReportModal('${post.id}')">🚩 举报</button>
        </div>
      </div>
  `;

  // 评论区
  html += `
    <div class="comments-section">
      <div class="comments-title">💬 评论 (${comments.length})</div>
  `;

  // 评论输入
  if (currentUser) {
    html += `
      <div class="comment-input-area">
        <input class="comment-input" id="commentInput" placeholder="说点什么..." maxlength="500">
        <button class="comment-send" onclick="handleAddComment('${post.id}')">发送</button>
      </div>
    `;
  } else {
    html += `<div style="text-align:center;padding:12px;font-size:0.85rem;color:var(--text-light)">
      <a href="#/login" onclick="navigate('#/login')" style="color:var(--primary)">登录</a> 后即可评论
    </div>`;
  }

  // 评论列表
  if (comments.length > 0) {
    comments.forEach(c => {
      const ca = (c.users?.display_name || c.users?.username || '?')[0];
      html += `
        <div class="comment-item">
          <div class="comment-avatar">${ca}</div>
          <div class="comment-body">
            <div>
              <span class="comment-author">${escapeHTML(c.users?.display_name || c.users?.username || '匿名')}</span>
              <span class="comment-time">${formatTime(c.created_at)}</span>
            </div>
            <div class="comment-text">${escapeHTML(c.content)}</div>
          </div>
        </div>
      `;
    });
  } else {
    html += `<div style="text-align:center;padding:20px;color:var(--text-light);font-size:0.85rem;">暂无评论</div>`;
  }

  html += '</div></div>';
  container.innerHTML = html;
}

// ======== 创建帖子 ========
async function handleCreatePost() {
  const title = document.getElementById('postTitle').value.trim();
  const content = document.getElementById('postContent').value.trim();
  const category = document.getElementById('postCategory').value;
  const errorEl = document.getElementById('postFormError');
  const btn = document.getElementById('submitPostBtn');

  if (!title) { showError(errorEl, '请输入标题'); return; }
  if (!content) { showError(errorEl, '请输入内容'); return; }
  if (title.length < 2) { showError(errorEl, '标题至少2个字'); return; }

  btn.disabled = true;
  btn.textContent = '发布中...';
  hideError(errorEl);

  let imageUrl = '';
  const imageInput = document.getElementById('imageInput');
  if (imageInput.files && imageInput.files[0]) {
    const uploadResult = await uploadImage(imageInput.files[0]);
    if (uploadResult.success) {
      imageUrl = uploadResult.url;
    } else {
      showError(errorEl, uploadResult.error);
      btn.disabled = false;
      btn.textContent = '发布';
      return;
    }
  }

  const result = await createPost(title, content, category, imageUrl);

  if (result.success) {
    showToast('发布成功！🎉');
    document.getElementById('postTitle').value = '';
    document.getElementById('postContent').value = '';
    document.getElementById('imageInput').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    navigate('#/');
    loadPosts(currentCategory);
  } else {
    showError(errorEl, result.error);
  }

  btn.disabled = false;
  btn.textContent = '发布';
}

// ======== 点赞 ========
async function handleLike(postId, btnElement) {
  if (!currentUser) {
    showToast('请先登录');
    navigate('#/login');
    return;
  }

  const result = await toggleLike(postId);
  if (result.error) {
    showToast(result.error);
    return;
  }

  const countSpan = btnElement.querySelector('span');
  let count = parseInt(countSpan.textContent) || 0;

  if (result.liked) {
    btnElement.classList.add('liked');
    btnElement.innerHTML = `❤️ <span>${count + 1}</span>`;
  } else {
    btnElement.classList.remove('liked');
    btnElement.innerHTML = `🤍 <span>${Math.max(0, count - 1)}</span>`;
  }
}

// ======== 评论 ========
async function handleAddComment(postId) {
  const input = document.getElementById('commentInput');
  const content = input.value.trim();

  if (!content) { showToast('请输入评论内容'); return; }

  const result = await addComment(postId, content);
  if (result.success) {
    input.value = '';
    showToast('评论成功');
    loadPostDetail(postId);
  } else {
    showToast(result.error);
  }
}

// ======== 举报 ========
function showReportModal(postId) {
  if (!currentUser) {
    showToast('请先登录');
    navigate('#/login');
    return;
  }

  const reason = prompt('请输入举报原因：');
  if (!reason || !reason.trim()) return;

  reportPost(postId, reason.trim()).then(result => {
    if (result.success) {
      showToast('举报已提交 ✅');
    } else {
      showToast(result.error);
    }
  });
}

// ======== 个人主页 ========
async function loadProfile() {
  const container = document.getElementById('profileContainer');
  
  if (!currentUser) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">🔒</div>
      <div class="empty-state-text">请先<a href="#/login" onclick="navigate('#/login')" style="color:var(--primary)">登录</a></div>
    </div>`;
    return;
  }

  container.innerHTML = '<div class="loading"><div class="loading-spinner"></div>加载中...</div>';

  const profile = currentUser.profile;
  const avatarLetter = (profile?.display_name || currentUser.email || '?')[0].toUpperCase();

  // 获取用户帖子
  const sb = getSupabase();
  const { data: userPosts } = await sb
    .from('posts')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  // 获取用户点赞数
  const { count: likesReceived } = await sb
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', currentUser.id);

  container.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar-large">
        ${profile?.avatar_url ? `<img src="${profile.avatar_url}" alt="">` : avatarLetter}
      </div>
      <div class="profile-name">${escapeHTML(profile?.display_name || '未设置昵称')}</div>
      <div class="profile-class">${profile?.student_class || '未填写班级'}</div>
      ${profile?.bio ? `<div class="profile-bio">${escapeHTML(profile.bio)}</div>` : ''}
      <div class="profile-stats">
        <div class="profile-stat">
          <div class="profile-stat-value">${(userPosts || []).length}</div>
          <div class="profile-stat-label">帖子</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-value">${likesReceived || 0}</div>
          <div class="profile-stat-label">获赞</div>
        </div>
      </div>
    </div>
    <div style="margin-top:16px;">
      ${(userPosts || []).slice(0, 10).map(post => renderPostCard({
        ...post,
        display_name: profile?.display_name,
        username: currentUser.email,
        avatar_url: profile?.avatar_url,
        likes_count: 0,
        comments_count: 0
      })).join('')}
      ${(!userPosts || userPosts.length === 0) ? '<div class="empty-state"><div class="empty-state-text">还没有发过帖子</div></div>' : ''}
    </div>
  `;
}

// ======== 登录处理 ========
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');

  if (!email) { showError(errorEl, '请输入邮箱'); return; }
  if (!password) { showError(errorEl, '请输入密码'); return; }

  hideError(errorEl);
  const result = await loginUser(email, password);

  if (result.success) {
    showToast('登录成功 🎉');
    await checkAuth();
    navigate('#/');
    loadPosts(currentCategory);
  } else {
    showError(errorEl, result.error);
  }
}

// ======== 注册处理 ========
async function handleRegister() {
  const email = document.getElementById('regEmail').value.trim();
  const displayName = document.getElementById('regDisplayName').value.trim();
  const studentClass = document.getElementById('regClass').value.trim();
  const password = document.getElementById('regPassword').value;
  const errorEl = document.getElementById('regError');
  const successEl = document.getElementById('regSuccess');

  if (!email) { showError(errorEl, '请输入邮箱'); return; }
  if (!displayName) { showError(errorEl, '请输入昵称'); return; }
  if (!password || password.length < 6) { showError(errorEl, '密码至少6位'); return; }

  hideError(errorEl);
  successEl.style.display = 'none';

  const result = await registerUser(email, password, displayName, studentClass);

  if (result.success) {
    successEl.textContent = result.message;
    successEl.style.display = 'block';
    showToast('注册成功！');
    // 自动跳转登录
    setTimeout(() => navigate('#/login'), 2000);
  } else {
    showError(errorEl, result.error);
  }
}

// ======== 配置保存 ========
function handleSetup() {
  const url = document.getElementById('setupUrl').value.trim();
  const key = document.getElementById('setupKey').value.trim();
  const errorEl = document.getElementById('setupError');

  if (!url || !key) {
    showError(errorEl, '请填写完整信息');
    return;
  }

  // 保存在 localStorage
  try {
    localStorage.setItem('zhaozhou_supabase_url', url);
    localStorage.setItem('zhaozhou_supabase_key', key);
    showToast('配置已保存，正在初始化...');
    hideError(errorEl);
    setTimeout(() => location.reload(), 1000);
  } catch (e) {
    showError(errorEl, '保存失败：' + e.message);
  }
}

// ======== 图片预览 ========
function previewImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('图片不能超过 5MB');
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById('imagePreview');
    preview.src = e.target.result;
    preview.style.display = 'block';
    document.getElementById('uploadArea').textContent = '点击更换图片';
  };
  reader.readAsDataURL(file);
}

// ======== Toast 提示 ========
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ======== 表单错误提示 ========
function showError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}

function hideError(el) {
  el.textContent = '';
  el.style.display = 'none';
}
