// ===== 管理后台 =====
let currentAdminTab = 'dashboard';

async function checkAdmin() {
  var u = await getCurrentUser();
  if (!u) { alert('请先登录'); location.href = 'index.html'; return null; }
  var r = await apiGet('profile');
  var p = r.data;
  if (!p || p.role !== 'admin') { alert('无权限'); location.href = 'index.html'; return null; }
  return { user: u, profile: p };
}

async function loadDashboard() {
  var r = await apiGet('admin/stats');
  var d = r.data || {};
  document.getElementById('statPosts').textContent = d.posts || 0;
  document.getElementById('statComments').textContent = d.comments || 0;
  document.getElementById('statUsers').textContent = d.users || 0;
  document.getElementById('statReports').textContent = d.pending_reports || 0;
}

async function loadAdminPosts() {
  var list = document.getElementById('adminPostList');
  list.innerHTML = '<div class="loading-wrap"><div class="loading-ring"></div></div>';
  var r = await apiGet('admin/posts');
  var posts = r.data || [];
  if (!posts.length) { list.innerHTML = '<div class="empty-state"><div class="empty-text">暂无帖子</div></div>'; return; }
  list.innerHTML =
    '<table style="width:100%;font-size:0.82rem;border-collapse:collapse">' +
    '<thead><tr style="background:var(--glass-bg)"><th style="padding:8px 10px;text-align:left">标题</th><th style="padding:8px 10px;text-align:left">板块</th><th style="padding:8px 10px;text-align:left">时间</th><th style="padding:8px 10px;text-align:left">操作</th></tr></thead><tbody>' +
    posts.map(function(p) { return '<tr style="border-bottom:1px solid var(--glass-border)">' +
      '<td style="padding:8px 10px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(p.title) + '</td>' +
      '<td style="padding:8px 10px">' + getBoardName(p.board_slug) + '</td>' +
      '<td style="padding:8px 10px;font-size:0.75rem;color:var(--text-light)">' + formatTime(p.created_at) + '</td>' +
      '<td style="padding:8px 10px">' +
        '<button class="admin-btn admin-btn-sm" onclick="togglePin(\'' + p.id + '\',' + (p.is_pinned ? 'false' : 'true') + ')">' + (p.is_pinned ? '取消置顶' : '置顶') + '</button> ' +
        '<button class="admin-btn admin-btn-sm ' + (p.is_hidden ? 'admin-btn-primary' : 'admin-btn-danger') + '" onclick="toggleHide(\'' + p.id + '\',' + (p.is_hidden ? 'false' : 'true') + ')">' + (p.is_hidden ? '显示' : '隐藏') + '</button>' +
      '</td></tr>'; }).join('') +
    '</tbody></table>';
}

async function togglePin(postId, pinned) {
  await apiPost('admin/posts/pin', { post_id: postId, pinned: pinned });
  showToast(pinned ? '已置顶' : '已取消置顶');
  loadAdminPosts();
}
window.togglePin = togglePin;

async function toggleHide(postId, hidden) {
  await apiPost('admin/posts/hide', { post_id: postId, hidden: hidden });
  showToast(hidden ? '已隐藏' : '已显示');
  loadAdminPosts();
}
window.toggleHide = toggleHide;

async function loadAdminReports() {
  var list = document.getElementById('adminReportList');
  list.innerHTML = '<div class="loading-wrap"><div class="loading-ring"></div></div>';
  var r = await apiGet('admin/reports');
  var reports = r.data || [];
  if (!reports.length) { list.innerHTML = '<div class="empty-state"><div class="empty-text">暂无举报</div></div>'; return; }
  list.innerHTML =
    '<table style="width:100%;font-size:0.82rem;border-collapse:collapse">' +
    '<thead><tr style="background:var(--glass-bg)"><th style="padding:8px 10px;text-align:left">原因</th><th style="padding:8px 10px;text-align:left">类型</th><th style="padding:8px 10px;text-align:left">时间</th><th style="padding:8px 10px;text-align:left">操作</th></tr></thead><tbody>' +
    reports.map(function(r) { return '<tr style="border-bottom:1px solid var(--glass-border)">' +
      '<td style="padding:8px 10px">' + escapeHtml(r.reason) + '</td>' +
      '<td style="padding:8px 10px">' + (r.report_type || '未分类') + '</td>' +
      '<td style="padding:8px 10px;font-size:0.75rem;color:var(--text-light)">' + formatTime(r.created_at) + '</td>' +
      '<td style="padding:8px 10px">' +
        '<button class="admin-btn admin-btn-primary admin-btn-sm" onclick="resolveReport(\'' + r.id + '\',\'resolved\')">处理</button> ' +
        '<button class="admin-btn admin-btn-sm" onclick="resolveReport(\'' + r.id + '\',\'dismissed\')">驳回</button>' +
      '</td></tr>'; }).join('') +
    '</tbody></table>';
}

async function resolveReport(reportId, status) {
  await apiPost('admin/reports', { report_id: reportId, status: status });
  showToast('已更新');
  loadAdminReports();
}
window.resolveReport = resolveReport;

async function loadBannedWordsAdmin() {
  var list = document.getElementById('bannedWordList');
  var r = await apiGet('admin/banned-words');
  var words = r.data || [];
  if (!words.length) { list.innerHTML = '<div class="empty-state"><div class="empty-text">暂无违禁词</div></div>'; return; }
  list.innerHTML = words.map(function(w) { return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:8px;margin-bottom:6px">' +
    '<span>' + escapeHtml(w.word) + '</span>' +
    '<button class="admin-btn admin-btn-danger admin-btn-sm" onclick="deleteBannedWord(\'' + w.id + '\')">删除</button>' +
  '</div>'; }).join('');
}

async function addBannedWord() {
  var input = document.getElementById('bannedWordInput');
  var word = input.value.trim();
  if (!word) return;
  await apiPost('admin/banned-words/add', { word: word });
  input.value = '';
  showToast('已添加');
  loadBannedWordsAdmin();
  loadBannedWords();
}
window.addBannedWord = addBannedWord;

async function deleteBannedWord(id) {
  if (!confirm('确定删除？')) return;
  await apiPost('admin/banned-words/delete', { id: id });
  loadBannedWordsAdmin();
  loadBannedWords();
}
window.deleteBannedWord = deleteBannedWord;

async function loadAnnouncementsAdmin() {
  var list = document.getElementById('announcementList');
  var r = await apiGet('admin/announcements');
  var items = r.data || [];
  if (!items.length) { list.innerHTML = '<div class="empty-state"><div class="empty-text">暂无公告</div></div>'; return; }
  list.innerHTML = items.map(function(a) { return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:8px;margin-bottom:6px">' +
    '<div><div style="font-weight:600;font-size:0.88rem">' + escapeHtml(a.title) + '</div><div style="font-size:0.78rem;color:var(--text-light)">' + escapeHtml((a.content || '').substring(0,50)) + '</div></div>' +
    '<div style="display:flex;gap:6px">' +
      '<button class="admin-btn admin-btn-sm" onclick="toggleAnnouncement(\'' + a.id + '\',' + (a.is_active ? 'false' : 'true') + ')">' + (a.is_active ? '停用' : '启用') + '</button>' +
      '<button class="admin-btn admin-btn-danger admin-btn-sm" onclick="deleteAnnouncement(\'' + a.id + '\')">删除</button>' +
    '</div></div>'; }).join('');
}

async function addAnnouncement() {
  var title = document.getElementById('announceTitle').value.trim();
  var content = document.getElementById('announceContent').value.trim();
  if (!title || !content) { showToast('请填写完整'); return; }
  await apiPost('admin/announcements/add', { title: title, content: content });
  document.getElementById('announceTitle').value = '';
  document.getElementById('announceContent').value = '';
  showToast('公告已发布');
  loadAnnouncementsAdmin();
}
window.addAnnouncement = addAnnouncement;

async function toggleAnnouncement(id, active) {
  await apiPost('admin/announcements/toggle', { id: id, is_active: active });
  loadAnnouncementsAdmin();
}
window.toggleAnnouncement = toggleAnnouncement;

async function deleteAnnouncement(id) {
  if (!confirm('确定删除？')) return;
  await apiPost('admin/announcements/delete', { id: id });
  loadAnnouncementsAdmin();
}
window.deleteAnnouncement = deleteAnnouncement;

function switchTab(tab) {
  currentAdminTab = tab;
  document.querySelectorAll('.admin-section').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.admin-nav-item').forEach(function(n) { n.classList.remove('active'); });
  document.getElementById('section-' + tab).classList.add('active');
  document.querySelectorAll('.admin-nav-item').forEach(function(n) {
    var labels = { dashboard: '概览', posts: '帖子', reports: '举报', banned: '违禁词', announcements: '公告' };
    if (n.textContent.includes(labels[tab])) n.classList.add('active');
  });
  var fns = { dashboard: loadDashboard, posts: loadAdminPosts, reports: loadAdminReports, banned: loadBannedWordsAdmin, announcements: loadAnnouncementsAdmin };
  if (fns[tab]) fns[tab]();
}
window.switchTab = switchTab;

document.addEventListener('DOMContentLoaded', async function() {
  var a = await checkAdmin();
  if (a) { loadDashboard(); }
});
