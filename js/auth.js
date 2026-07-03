// ======== 认证模块 ========

// 登录
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const errorEl = document.getElementById('loginError');
  
  if (!email || !password) {
    errorEl.textContent = '请填写邮箱和密码';
    errorEl.style.display = 'block';
    return;
  }
  
  errorEl.style.display = 'none';
  
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  
  if (error) {
    errorEl.textContent = error.message.includes('Invalid login') ? '邮箱或密码错误' : error.message;
    errorEl.style.display = 'block';
    return;
  }
  
  // 更新登录IP
  const ip = await getUserIP();
  await supabase.from('profiles').update({ 
    last_sign_in_ip: ip, 
    last_sign_in_at: new Date().toISOString() 
  }).eq('id', data.user.id);
  
  showToast('登录成功');
  await updateNav();
  router.navigate('#/');
}

// 注册
async function handleRegister() {
  const email = document.getElementById('regEmail').value.trim();
  const displayName = document.getElementById('regDisplayName').value.trim();
  const className = document.getElementById('regClass').value.trim();
  const password = document.getElementById('regPassword').value.trim();
  const errorEl = document.getElementById('regError');
  const successEl = document.getElementById('regSuccess');
  
  if (!email || !displayName || !password) {
    errorEl.textContent = '请填写所有必填项';
    errorEl.style.display = 'block';
    successEl.style.display = 'none';
    return;
  }
  
  if (password.length < 6) {
    errorEl.textContent = '密码至少6位';
    errorEl.style.display = 'block';
    return;
  }
  
  // 检查违禁词（昵称不能包含违禁词）
  const badWord = containsBannedWords(displayName);
  if (badWord) {
    errorEl.textContent = '昵称包含不当词汇，请修改';
    errorEl.style.display = 'block';
    return;
  }
  
  errorEl.style.display = 'none';
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName }
    }
  });
  
  if (error) {
    errorEl.textContent = error.message;
    errorEl.style.display = 'block';
    return;
  }
  
  // 更新 profile
  const ip = await getUserIP();
  const updates = { 
    display_name: displayName,
    class_name: className || '',
    last_sign_in_ip: ip,
    last_sign_in_at: new Date().toISOString()
  };
  
  // 先 profile 已存在（trigger 创建了）
  await supabase.from('profiles').update(updates).eq('id', data.user.id);
  
  showToast('注册成功！欢迎加入昭州校园社区');
  router.navigate('#/');
  await updateNav();
}

// 登出
async function logoutUser() {
  await supabase.auth.signOut();
  showToast('已退出登录');
  await updateNav();
  router.navigate('#/');
}

// 检查用户是否被封禁
async function checkBanStatus(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('is_banned, ban_reason, banned_until')
    .eq('id', userId)
    .single();
  
  if (!data || !data.is_banned) return null;
  
  if (data.banned_until && new Date(data.banned_until) < new Date()) {
    // 封禁已过期，自动解封
    await supabase.from('profiles').update({ 
      is_banned: false, 
      ban_reason: '',
      banned_until: null 
    }).eq('id', userId);
    return null;
  }
  
  return data;
}

// 检查发帖权限
async function checkPostPermission() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    showToast('请先登录');
    router.navigate('#/login');
    return false;
  }
  
  const ban = await checkBanStatus(user.id);
  if (ban) {
    showToast('账号已被限制发帖' + (ban.ban_reason ? '：' + ban.ban_reason : ''));
    return false;
  }
  
  return true;
}

// 弹出合规弹窗
function handleCreateClick() {
  // 检查登录
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) {
      showToast('请先登录');
      router.navigate('#/login');
      return;
    }
    // 显示合规弹窗
    document.getElementById('complianceModal').classList.add('show');
  });
}

function closeComplianceModal() {
  document.getElementById('complianceModal').classList.remove('show');
}

function confirmCompliance() {
  document.getElementById('complianceModal').classList.remove('show');
  router.navigate('#/create');
}
