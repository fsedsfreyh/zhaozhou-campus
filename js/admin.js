// ======== 管理员模块 ========

let currentAdminTab = 'dashboard';

// 检查管理员权限
async function checkAdminAuth() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert('请先登录');
    location.href = 'index.html#/login';
    return null;
  }
  
  const { data: profile } = await apiGet('profile');
  if (profile?.role !== 'admin') {
    alert('无管理员权限');
    location.href = 'index.html';
    return null;
  }
  
  return { user, profile };
}

// ======== 概览 ========
async function loadDashboard() {
  const { data: { count: postCount } } = await supabase.from('posts').select('id', { count: 'exact', head: true });
  const { data: { count: commentCount } } = await supabase.from('comments').select('id', { count: 'exact', head: true });
  const { data: { count: userCount } } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
  const { data: { count: reportCount } } = await supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending');
  
  document.getElementById('statPosts').textContent = postCount || 0;
  document.getElementById('statComments').textContent = commentCount || 0;
  document.getElementById('statUsers').textContent = userCount || 0;
  document.getElementById('statReports').textContent = reportCount || 0;
}

// ======== 帖子管理 ========
async function loadPosts() {
  const list = document.getElementById('adminPostList');
  list.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';
  
  const { data: posts } = await supabase
    .from('posts')
    .select('*, profiles!inner(display_name)')
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (!posts || posts.length === 0) {
    list.innerHTML = '<div class="empty-state">暂无帖子</div>';
    return;
  }
  
  list.innerHTML = `
    <table class="admin-table">
      <thead><tr>
        <th>标题</th><th>作者</th><th>板块</th><th>时间</th><th>互动</th><th>状态</th><th>操作</th>
      </tr></thead>
      <tbody>
        ${posts.map(p => `
          <tr>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.title}</td>
            <td>${p.is_anonymous ? '匿名' : p.profiles?.display_name}</td>
            <td>${getBoardName(p.board_slug)}</td>
            <td>${formatTime(p.created_at)}</td>
            <td>❤${p.like_count} 💬${p.comment_count}</td>
            <td>${p.is_hidden ? '<span class="admin-badge dismissed">已隐藏</span>' : p.is_pinned ? '<span class="admin-badge resolved">置顶</span>' : '<span class="admin-badge pending">正常</span>'}</td>
            <td>
              <button class="admin-btn admin-btn-primary admin-btn-sm" onclick="viewPostInfo('${p.id}')">查看</button>
              <button class="admin-btn admin-btn-sm" onclick="togglePin('${p.id}', ${p.is_pinned})">${p.is_pinned ? '取置' : '置顶'}</button>
              <button class="admin-btn ${p.is_hidden ? 'admin-btn-primary' : 'admin-btn-danger'} admin-btn-sm" onclick="toggleHide('${p.id}', ${p.is_hidden})">${p.is_hidden ? '显示' : '隐藏'}</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// 查看帖子发布人信息
async function viewPostInfo(postId) {
  const { data: post } = await supabase
    .from('posts')
    .select('*, profiles!inner(display_name, class_name, role, is_banned, created_at, last_sign_in_ip, last_sign_in_at)')
    .eq('id', postId)
    .single();
  
  if (!post) { alert('帖子不存在'); return; }
  
  alert(`
📝 帖子信息
标题：${post.title}
板块：${getBoardName(post.board_slug)}
发布时间：${formatTimeFull(post.created_at)}
发布IP：${post.creator_ip || '未记录'}
匿名：${post.is_anonymous ? '是' : '否'}

👤 发布人信息
用户ID：${post.user_id}
昵称：${post.profiles?.display_name}
班级：${post.profiles?.class_name || '未填写'}
身份：${post.profiles?.role}
注册时间：${formatTimeFull(post.profiles?.created_at)}
最后登录IP：${post.profiles?.last_sign_in_ip || '未记录'}
最后登录时间：${formatTimeFull(post.profiles?.last_sign_in_at)}
封禁状态：${post.profiles?.is_banned ? '已封禁' : '正常'}
`);
}

// 置顶/取消置顶
async function togglePin(postId, isPinned) {
  await supabase.from('posts').update({ is_pinned: !isPinned }).eq('id', postId);
  showToast(isPinned ? '已取消置顶' : '已置顶');
  loadPosts();
}

// 隐藏/显示
async function toggleHide(postId, isHidden) {
  await supabase.from('posts').update({ is_hidden: !isHidden, is_approved: isHidden }).eq('id', postId);
  showToast(isHidden ? '已恢复显示' : '已隐藏');
  loadPosts();
}

// 批量删除
async function batchDelete() {
  if (!confirm('确定要批量删除选中帖子？此操作不可恢复。')) return;
  // 简化版：批量删除所有举报过的帖子
  const { data: reports } = await supabase.from('reports').select('post_id').eq('status', 'pending');
  if (!reports || reports.length === 0) { showToast('没有待处理的举报帖子'); return; }
  
  const ids = [...new Set(reports.map(r => r.post_id).filter(Boolean))];
  await supabase.from('posts').update({ is_hidden: true, is_approved: false }).in('id', ids);
  await supabase.from('reports').update({ status: 'resolved' }).eq('status', 'pending');
  showToast(`已隐藏 ${ids.length} 个帖子`);
  loadPosts();
}

// ======== 举报管理 ========
async function loadReports() {
  const list = document.getElementById('adminReportList');
  list.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';
  
  const { data: reports } = await supabase
    .from('reports')
    .select('*, profiles!inner(display_name), posts!left(title)')
    .order('created_at', { ascending: false })
    .limit(30);
  
  if (!reports || reports.length === 0) {
    list.innerHTML = '<div class="empty-state">暂无举报记录</div>';
    return;
  }
  
  list.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>举报人</th><th>被举报内容</th><th>原因</th><th>时间</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>
        ${reports.map(r => `
          <tr>
            <td>${r.profiles?.display_name}</td>
            <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.posts?.title || '评论'}</td>
            <td>${r.reason}</td>
            <td>${formatTime(r.created_at)}</td>
            <td><span class="admin-badge ${r.status}">${r.status === 'pending' ? '待处理' : r.status === 'resolved' ? '已处理' : '已驳回'}</span></td>
            <td>
              ${r.post_id ? `<button class="admin-btn admin-btn-sm" onclick="viewPostInfo('${r.post_id}')">查看</button>` : ''}
              ${r.status === 'pending' ? `
                <button class="admin-btn admin-btn-success admin-btn-sm" onclick="resolveReport('${r.id}', 'resolved')">处理</button>
                <button class="admin-btn admin-btn-sm" onclick="resolveReport('${r.id}', 'dismissed')">驳回</button>
              ` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function resolveReport(reportId, status) {
  await supabase.from('reports').update({ status, resolved_at: new Date().toISOString() }).eq('id', reportId);
  showToast(status === 'resolved' ? '已标记为已处理' : '已驳回');
  loadReports();
}

// ======== 违禁词管理 ========
async function loadBannedWordsAdmin() {
  const list = document.getElementById('bannedWordList');
  const { data: words } = await supabase.from('banned_words').select('*').order('created_at', { ascending: false });
  
  if (!words || words.length === 0) {
    list.innerHTML = '<div class="empty-state">暂无违禁词</div>';
    return;
  }
  
  list.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>违禁词</th><th>状态</th><th>添加时间</th><th>操作</th></tr></thead>
      <tbody>
        ${words.map(w => `
          <tr>
            <td><strong>${w.word}</strong></td>
            <td>${w.is_active ? '<span class="admin-badge resolved">启用</span>' : '<span class="admin-badge dismissed">停用</span>'}</td>
            <td>${formatTime(w.created_at)}</td>
            <td>
              <button class="admin-btn admin-btn-sm" onclick="toggleBannedWord('${w.id}', ${w.is_active})">${w.is_active ? '停用' : '启用'}</button>
              <button class="admin-btn admin-btn-danger admin-btn-sm" onclick="deleteBannedWord('${w.id}')">删除</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function addBannedWord() {
  const input = document.getElementById('bannedWordInput');
  const word = input.value.trim();
  if (!word) return;
  
  const { error } = await supabase.from('banned_words').insert({ word, created_by: (await supabase.auth.getUser()).data.user?.id });
  if (error && error.code === '23505') {
    showToast('该违禁词已存在');
  } else if (error) {
    showToast('添加失败：' + error.message);
  } else {
    showToast('添加成功');
    input.value = '';
    loadBannedWordsAdmin();
    loadBannedWords(); // 更新全局违禁词列表
  }
}

async function toggleBannedWord(id, isActive) {
  await supabase.from('banned_words').update({ is_active: !isActive }).eq('id', id);
  loadBannedWordsAdmin();
  loadBannedWords();
}

async function deleteBannedWord(id) {
  if (!confirm('确定删除该违禁词？')) return;
  await supabase.from('banned_words').delete().eq('id', id);
  showToast('已删除');
  loadBannedWordsAdmin();
  loadBannedWords();
}

// ======== 公告管理 ========
async function loadAnnouncementsAdmin() {
  const list = document.getElementById('announcementList');
  const { data: announcements } = await supabase.from('announcements').select('*').order('sort_order');
  
  if (!announcements || announcements.length === 0) {
    list.innerHTML = '<div class="empty-state">暂无公告</div>';
    return;
  }
  
  list.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>标题</th><th>内容</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>
        ${announcements.map(a => `
          <tr>
            <td>${a.title}</td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.content}</td>
            <td>${a.is_active ? '<span class="admin-badge resolved">显示中</span>' : '<span class="admin-badge dismissed">已停用</span>'}</td>
            <td>
              <button class="admin-btn admin-btn-sm" onclick="toggleAnnouncement('${a.id}', ${a.is_active})">${a.is_active ? '停用' : '启用'}</button>
              <button class="admin-btn admin-btn-danger admin-btn-sm" onclick="deleteAnnouncement('${a.id}')">删除</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function addAnnouncement() {
  const title = document.getElementById('announceTitle').value.trim();
  const content = document.getElementById('announceContent').value.trim();
  if (!title || !content) { showToast('请填写标题和内容'); return; }
  
  await supabase.from('announcements').insert({
    title,
    content,
    created_by: (await supabase.auth.getUser()).data.user?.id,
  });
  
  showToast('公告已发布');
  document.getElementById('announceTitle').value = '';
  document.getElementById('announceContent').value = '';
  loadAnnouncementsAdmin();
}

async function toggleAnnouncement(id, isActive) {
  await supabase.from('announcements').update({ is_active: !isActive }).eq('id', id);
  loadAnnouncementsAdmin();
}

async function deleteAnnouncement(id) {
  if (!confirm('确定删除该公告？')) return;
  await supabase.from('announcements').delete().eq('id', id);
  loadAnnouncementsAdmin();
}

// ======== 用户管理 ========
async function loadUsers() {
  const list = document.getElementById('adminUserList');
  list.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';
  
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);
  
  if (!users || users.length === 0) {
    list.innerHTML = '<div class="empty-state">暂无用户</div>';
    return;
  }
  
  list.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>昵称</th><th>班级</th><th>角色</th><th>状态</th><th>注册时间</th><th>操作</th></tr></thead>
      <tbody>
        ${users.map(u => `
          <tr>
            <td>${u.display_name}</td>
            <td>${u.class_name || '-'}</td>
            <td>${u.role === 'admin' ? '管理员' : '用户'}</td>
            <td>${u.is_banned ? '<span class="admin-badge pending">已封禁</span>' : '<span class="admin-badge resolved">正常</span>'}</td>
            <td>${formatTime(u.created_at)}</td>
            <td>
              <button class="admin-btn ${u.is_banned ? 'admin-btn-primary' : 'admin-btn-danger'} admin-btn-sm" onclick="toggleBanUser('${u.id}', ${u.is_banned})">${u.is_banned ? '解封' : '封禁'}</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function toggleBanUser(userId, isBanned) {
  if (!isBanned) {
    const reason = prompt('请输入封禁原因：');
    if (!reason) return;
    await supabase.from('profiles').update({ is_banned: true, ban_reason: reason }).eq('id', userId);
    showToast('账号已封禁');
  } else {
    await supabase.from('profiles').update({ is_banned: false, ban_reason: '' }).eq('id', userId);
    showToast('账号已解封');
  }
  loadUsers();
}

// ======== Tab 切换 ========
function switchAdminTab(tab) {
  currentAdminTab = tab;
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.admin-nav-item').forEach(n => n.classList.remove('active'));
  
  document.getElementById('section-' + tab)?.classList.add('active');
  
  // 找到对应的 nav item
  document.querySelectorAll('.admin-nav-item').forEach(n => {
    if (n.textContent.includes('概览') && tab === 'dashboard') n.classList.add('active');
    if (n.textContent.includes('帖子管理') && tab === 'posts') n.classList.add('active');
    if (n.textContent.includes('举报') && tab === 'reports') n.classList.add('active');
    if (n.textContent.includes('违禁词') && tab === 'banned') n.classList.add('active');
    if (n.textContent.includes('公告') && tab === 'announcements') n.classList.add('active');
    if (n.textContent.includes('用户') && tab === 'users') n.classList.add('active');
  });
  
  // 加载对应数据
  switch (tab) {
    case 'dashboard': loadDashboard(); break;
    case 'posts': loadPosts(); break;
    case 'reports': loadReports(); break;
    case 'banned': loadBannedWordsAdmin(); break;
    case 'announcements': loadAnnouncementsAdmin(); break;
    case 'users': loadUsers(); break;
  }
}

// ======== 初始化 ========
document.addEventListener('DOMContentLoaded', async () => {
  await checkAdminAuth();
  await loadBannedWords();
  loadDashboard();
  updateNav();
});

// 全局函数导出
window.switchAdminTab = switchAdminTab;
window.addBannedWord = addBannedWord;
window.deleteBannedWord = deleteBannedWord;
window.toggleBannedWord = toggleBannedWord;
window.addAnnouncement = addAnnouncement;
window.toggleAnnouncement = toggleAnnouncement;
window.deleteAnnouncement = deleteAnnouncement;
window.viewPostInfo = viewPostInfo;
window.togglePin = togglePin;
window.toggleHide = toggleHide;
window.resolveReport = resolveReport;
window.toggleBanUser = toggleBanUser;
