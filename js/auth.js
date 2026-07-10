// ======== 认证模块 ========

/** 初始化认证模块 */
document.addEventListener('DOMContentLoaded', function() {
  // 登录按钮 → 打开弹窗
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) loginBtn.onclick = function() { openAuthModal('login'); };

  // 切换登录/注册 tab
  document.querySelectorAll('.auth-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.auth-tab').forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      var mode = this.getAttribute('data-mode');
      document.getElementById('authTitle').textContent = mode === 'login' ? '登录' : '注册';
      document.getElementById('authSubmit').textContent = mode === 'login' ? '登录' : '注册';
      document.getElementById('displayNameGroup').style.display = mode === 'login' ? 'none' : '';
    });
  });

  // 表单提交
  document.getElementById('authForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var mode = document.querySelector('.auth-tab.active').getAttribute('data-mode');
    if (mode === 'login') await handleLogin();
    else await handleRegister();
  });

  // 关闭弹窗
  document.getElementById('authModalClose').onclick = function() { closeAuthModal(); };
  document.getElementById('authModal').addEventListener('click', function(e) {
    if (e.target === this) closeAuthModal();
  });
});

function openAuthModal(mode) {
  document.getElementById('authError').style.display = 'none';
  document.getElementById('authError').textContent = '';
  document.getElementById('authSubmit').disabled = false;
  document.getElementById('authSubmit').textContent = mode === 'login' ? '登录' : '注册';
  document.getElementById('authTitle').textContent = mode === 'login' ? '登录' : '注册';
  document.getElementById('displayNameGroup').style.display = mode === 'login' ? 'none' : '';
  document.querySelectorAll('.auth-tab').forEach(function(t) { t.classList.toggle('active', t.getAttribute('data-mode') === mode); });
  document.getElementById('authModal').classList.add('show');
}

function closeAuthModal() {
  document.getElementById('authModal').classList.remove('show');
}

/** 登录 */
async function handleLogin() {
  var email = document.getElementById('authEmail').value.trim();
  var password = document.getElementById('authPassword').value.trim();
  var errorEl = document.getElementById('authError');
  
  if (!email || !password) {
    errorEl.textContent = '请填写邮箱和密码';
    errorEl.style.display = 'block';
    return;
  }
  
  errorEl.style.display = 'none';
  document.getElementById('authSubmit').disabled = true;
  document.getElementById('authSubmit').textContent = '登录中...';
  
  var { data, error } = await supabase.auth.signInWithPassword({ email, password });
  
  document.getElementById('authSubmit').disabled = false;
  
  if (error) {
    errorEl.textContent = error.message.includes('Invalid login') ? '邮箱或密码错误' : error.message;
    errorEl.style.display = 'block';
    document.getElementById('authSubmit').textContent = '登录';
    return;
  }
  
  showToast('登录成功');
  closeAuthModal();
  await updateNav();
  router.navigate('#/');
}

/** 注册 */
async function handleRegister() {
  var email = document.getElementById('authEmail').value.trim();
  var password = document.getElementById('authPassword').value.trim();
  var displayName = document.getElementById('authDisplayName').value.trim();
  var errorEl = document.getElementById('authError');
  
  if (!email || !password || !displayName) {
    errorEl.textContent = '请填写所有必填项';
    errorEl.style.display = 'block';
    return;
  }
  
  if (password.length < 6) {
    errorEl.textContent = '密码至少6位';
    errorEl.style.display = 'block';
    return;
  }
  
  // 检查违禁词
  if (typeof containsBannedWords === 'function' && containsBannedWords(displayName)) {
    errorEl.textContent = '昵称包含不当词汇，请修改';
    errorEl.style.display = 'block';
    return;
  }
  
  errorEl.style.display = 'none';
  document.getElementById('authSubmit').disabled = true;
  document.getElementById('authSubmit').textContent = '注册中...';
  
  var { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { display_name: displayName } }
  });
  
  document.getElementById('authSubmit').disabled = false;
  document.getElementById('authSubmit').textContent = '注册';
  
  if (error) {
    errorEl.textContent = error.message;
    errorEl.style.display = 'block';
    return;
  }
  
  // 更新 profile
  try {
    var ip = await (typeof getUserIP === 'function' ? getUserIP() : Promise.resolve(''));
    await apiPost('profiles/upsert', {
      id: data.user.id,
      display_name: displayName,
      last_sign_in_ip: ip,
      last_sign_in_at: new Date().toISOString()
    });
  } catch {}
  
  showToast('注册成功！欢迎加入昭州校园社区');
  closeAuthModal();
  await updateNav();
  router.navigate('#/');
}

/** 登出 */
async function logoutUser() {
  await supabase.auth.signOut();
  showToast('已退出登录');
  await updateNav();
  router.navigate('#/');
}

/** 检查用户是否被封禁 */
async function checkBanStatus(userId) {
  try {
    var res = await apiGet('profile/ban-status');
    if (!res.data || !res.data.is_banned) return null;
    if (res.data.banned_until && new Date(res.data.banned_until) < new Date()) {
      await apiPost('profiles/upsert', { is_banned: false, ban_reason: '', banned_until: null });
      return null;
    }
    return res.data;
  } catch { return null; }
}

/** 检查发帖权限 */
async function checkPostPermission() {
  var { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    showToast('请先登录');
    return false;
  }
  var ban = await checkBanStatus(user.id);
  if (ban) {
    showToast('账号已被限制发帖' + (ban.ban_reason ? '：' + ban.ban_reason : ''));
    return false;
  }
  return true;
}

/** FAB 点击 → 发帖 */
function handleCreateClick() {
  supabase.auth.getUser().then(function({ data: { user } }) {
    if (!user) {
      showToast('请先登录');
      openAuthModal('login');
      return;
    }
    router.navigate('#/create');
  });
}
