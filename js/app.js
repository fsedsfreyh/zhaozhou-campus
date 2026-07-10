// 路由器已在 HTML 中内联定义（window.router）
// 路由器已在 HTML 中内联定义（window.router）
// 路由器已在 HTML 中内联定义（window.router）
// ======== 应用入口 ========

// 注册路由
router.register('#/', async (params) => {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('page-home').classList.add('active');
  document.body.classList.add('home-hero-mode');
  
  await renderBoards();
  await renderHotPosts('daily');
  await renderLatestPosts();
  try { await renderAnnouncements(); } catch(e) { console.warn('Announcements failed:', e); }
});

router.register('#/board/:slug', async (params) => {
  document.getElementById('page-board').classList.add('active');
  document.body.classList.remove('home-hero-mode');
  await renderBoardPage(params.slug);
});

router.register('#/post/:id', async (params) => {
  document.getElementById('page-post').classList.add('active');
  document.body.classList.remove('home-hero-mode');
  await renderPostDetail(params.id);
});

router.register('#/create', async () => {
  // 检查权限
  const hasPermission = await checkPostPermission();
  if (!hasPermission) {
    router.navigate('#/');
    return;
  }
  
  document.getElementById('page-create').classList.add('active');
  document.body.classList.remove('home-hero-mode');
  
  // 加载板块下拉
  const { data: boards } = await apiGet('boards');
  
  const select = document.getElementById('createBoard');
  if (boards && select) {
    select.innerHTML = boards.map(b => `<option value="${b.slug}">${b.icon} ${b.name}</option>`).join('');
  }
});

router.register('#/login', async () => {
  document.getElementById('loadingScreen').style.display = 'none';
  if (typeof openAuthModal === 'function') openAuthModal('login');
});

router.register('#/register', async () => {
  document.getElementById('loadingScreen').style.display = 'none';
  if (typeof openAuthModal === 'function') openAuthModal('register');
});

router.register('#/profile', async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    showToast('请先登录');
    router.navigate('#/login');
    return;
  }
  
  document.getElementById('page-profile').classList.add('active');
  document.body.classList.remove('home-hero-mode');
  await renderProfile();
});

router.register('#/search/:q', async (params) => {
  document.getElementById('page-search').classList.add('active');
  document.body.classList.remove('home-hero-mode');
  document.getElementById('searchInput').value = decodeURIComponent(params.q);
  await performSearch();
});

router.register('#/search', async () => {
  document.getElementById('page-search').classList.add('active');
  document.body.classList.remove('home-hero-mode');
});

router.register('#/convention', async () => {
  document.getElementById('page-convention').classList.add('active');
  document.body.classList.remove('home-hero-mode');
  
  // 加载公约内容
  const container = document.getElementById('conventionContent');
  try {
    const res = await fetch('community_convention.md');
    const text = await res.text();
    // 简单转换为 HTML
    container.innerHTML = text
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<ul><li>$1</li></ul>')
      .replace(/<\/ul>\n<ul>/g, '\n')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^([^<].+)$/gm, '<p>$1</p>');
  } catch {
    container.innerHTML = '<p>加载失败</p>';
  }
});

router.register('#/admin', async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { showToast('请先登录'); router.navigate('#/login'); return; }
  
  const { data: profile } = await apiGet('profile');
  if (profile?.role !== 'admin') {
    showToast('无管理员权限');
    router.navigate('#/');
    return;
  }
  
  window.open('admin.html', '_blank');
  router.navigate('#/');
});

// ======== 个人中心 ========
async function renderProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  
  if (!profile) return;
  
  // 获取用户帖子数
  const { count: postCount } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  
  const container = document.getElementById('profileContainer');
  container.innerHTML = `
    <div class="profile-card">
      <div class="profile-avatar-lg">
        ${profile.avatar_url ? `<img src="${profile.avatar_url}">` : getAvatarLetter(profile.display_name)}
      </div>
      <div class="profile-name-lg">${profile.display_name}</div>
      ${profile.class_name ? `<div class="profile-class">📚 ${profile.class_name}</div>` : ''}
      ${profile.bio ? `<div class="profile-bio">${profile.bio}</div>` : ''}
      <div style="margin-top:16px;display:flex;justify-content:center;gap:24px;">
        <div style="text-align:center"><div style="font-weight:700;font-size:1.1rem;">${postCount || 0}</div><div style="font-size:0.75rem;color:var(--text-light)">帖子</div></div>
        <div style="text-align:center"><div style="font-weight:700;font-size:1.1rem;">${profile.role === 'admin' ? '管理员' : '用户'}</div><div style="font-size:0.75rem;color:var(--text-light)">身份</div></div>
      </div>
    </div>
    <div class="profile-tabs">
      <button class="profile-tab active" onclick="switchProfileTab('posts', this)">我的帖子</button>
      <button class="profile-tab" onclick="switchProfileTab('bookmarks', this)">我的收藏</button>
    </div>
    <div id="profileContent">
      <div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>
    </div>
    <div style="margin-top:16px;text-align:center;">
      <button class="board-sort-btn" onclick="logoutUser()" style="color:var(--danger);border-color:rgba(231,76,60,0.3);">退出登录</button>
    </div>
  `;
  
  await loadUserPosts();
}

async function loadUserPosts() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  const content = document.getElementById('profileContent');
  
  const { data: posts } = await supabase
    .from('posts')
    .select('*, profiles!inner(display_name, avatar_url)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (!posts || posts.length === 0) {
    content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">暂无内容</div></div>';
    return;
  }
  
  content.innerHTML = posts.map(renderPostCard).join('');
}

async function loadUserBookmarks() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  const content = document.getElementById('profileContent');
  
  const { data: bookmarks } = await supabase
    .from('bookmarks')
    .select('post_id, posts!inner(*, profiles!inner(display_name, avatar_url))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (!bookmarks || bookmarks.length === 0) {
    content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔖</div><div class="empty-state-text">还没有收藏</div></div>';
    return;
  }
  
  content.innerHTML = bookmarks.map(b => renderPostCard(b.posts)).join('');
}

function switchProfileTab(tab, btn) {
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  
  if (tab === 'posts') loadUserPosts();
  else loadUserBookmarks();
}

// ======== 初始化 ========
document.addEventListener('DOMContentLoaded', async () => {
  // 加载违禁词
  await loadBannedWords();
  
  // 初始化导航
  await updateNav();
  initNavScroll();
  initParallax();
  
  // 监听认证状态变化
  supabase.auth.onAuthStateChange(async (event) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
      await updateNav();
    }
  });
  
  // 内容字数统计
  document.getElementById('createContent')?.addEventListener('input', function() {
    document.getElementById('contentCount').textContent = this.value.length;
  });
  
  // 启动路由
  router.start();
});

// 导出全局函数
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.logoutUser = logoutUser;
window.handleCreatePost = handleCreatePost;
window.handleCreateClick = handleCreateClick;
window.closeComplianceModal = closeComplianceModal;
window.confirmCompliance = confirmCompliance;
window.handleImageSelect = handleImageSelect;
window.removeImage = removeImage;
window.performSearch = performSearch;
window.sharePost = sharePost;
window.toggleLike = toggleLike;
window.toggleBookmark = toggleBookmark;
window.toggleDetailLike = toggleDetailLike;
window.toggleDetailBookmark = toggleDetailBookmark;
window.submitComment = submitComment;
window.reportPost = reportPost;
window.switchHotTab = switchHotTab;
window.switchBoardSort = switchBoardSort;
window.switchProfileTab = switchProfileTab;
// router is defined inline in HTML
