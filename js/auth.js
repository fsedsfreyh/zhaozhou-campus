// ===== 认证模块 =====
var currentUser = null;
var currentProfile = null;

async function updateAuth() {
  currentUser = await getCurrentUser();
  if (currentUser) {
    var r = await apiGet('profile');
    currentProfile = r.data || null;
  } else {
    currentProfile = null;
  }
  renderNav();
  renderTabbar();
}

function renderNav() {
  var navRight = document.getElementById('navRight');
  if (!navRight) return;
  if (currentUser) {
    var name = currentProfile ? currentProfile.display_name : (currentUser.email || '用户');
    var initial = name.charAt(0).toUpperCase();
    navRight.innerHTML =
      '<button class="dark-toggle" id="darkToggleBtn" onclick="toggleDarkMode()">🌓</button>' +
      '<div class="avatar" style="background:var(--primary)" onclick="toggleUserMenu()">' + initial + '</div>' +
      '<div id="userMenu" class="user-menu hidden" style="position:absolute;top:48px;right:16px;z-index:200;min-width:160px;background:var(--glass-bg);backdrop-filter:blur(20px);border:1px solid var(--glass-border);border-radius:var(--radius);padding:8px 0;box-shadow:0 4px 20px rgba(0,0,0,0.08)">' +
        '<a class="user-menu-item" href="#/my-posts" style="display:block;padding:10px 16px;font-size:0.85rem;color:var(--text);text-decoration:none;transition:all var(--transition)">📝 我的帖子</a>' +
        '<a class="user-menu-item" href="#/history" style="display:block;padding:10px 16px;font-size:0.85rem;color:var(--text);text-decoration:none;transition:all var(--transition)">🕐 浏览记录</a>' +
        '<a class="user-menu-item" href="#/chat" style="display:block;padding:10px 16px;font-size:0.85rem;color:var(--text);text-decoration:none;transition:all var(--transition)">💬 私信</a>' +
        (currentProfile && currentProfile.role === 'admin' ? '<a class="user-menu-item" href="#/admin" style="display:block;padding:10px 16px;font-size:0.85rem;color:var(--text);text-decoration:none;transition:all var(--transition)">⚙️ 管理后台</a>' : '') +
        '<div style="border-top:1px solid var(--glass-border);margin:4px 0"></div>' +
        '<a class="user-menu-item" href="#" onclick="logoutUser();return false;" style="display:block;padding:10px 16px;font-size:0.85rem;color:#ef4444;text-decoration:none;transition:all var(--transition)">🚪 退出登录</a>' +
      '</div>';
  } else {
    navRight.innerHTML = '<button class="dark-toggle" id="darkToggleBtn" onclick="toggleDarkMode()">🌓</button><button class="btn-outline" onclick="openAuthModal()" style="padding:6px 16px;font-size:0.82rem">登录</button>';
  }
}

function toggleUserMenu() {
  var menu = document.getElementById('userMenu');
  if (menu) menu.classList.toggle('hidden');
}

document.addEventListener('click', function(e) {
  var menu = document.getElementById('userMenu');
  if (menu && !menu.classList.contains('hidden') && !e.target.closest('.avatar') && !e.target.closest('.user-menu')) {
    menu.classList.add('hidden');
  }
});

function toggleDarkMode() {
  var dm = useModule('darkmode');
  dm.toggle();
}

function renderTabbar() {
  var tabbar = document.getElementById('tabbar');
  if (!tabbar) return;
  var hash = location.hash || '#/';
  var tabs = [
    { icon: '🏠', label: '首页', href: '#/' },
    { icon: '💌', label: '表白', href: '#/board/confession' },
    { icon: '🫢', label: '八卦', href: '#/board/gossip' },
    { icon: '🔍', label: '失物', href: '#/board/lost' },
    { icon: '👤', label: '我的', href: currentUser ? '#/profile' : '#/login' }
  ];
  tabbar.innerHTML = tabs.map(function(t) {
    var active = hash.indexOf(t.href) === 0 || (t.href === '#/' && hash === '#/');
    return '<button class="tab-item' + (active ? ' active' : '') + '" onclick="router.navigate(\'' + t.href + '\')">' +
      '<span class="tab-icon">' + t.icon + '</span><span class="tab-label">' + t.label + '</span></button>';
  }).join('');
}

window.addEventListener('hashchange', function() { renderTabbar(); });

// ===== 登录弹窗 =====
function openAuthModal(tab) {
  tab = tab || 'login';
  var modal = document.getElementById('authModal');
  if (!modal) return;
  modal.classList.add('show');
  document.getElementById('authError').textContent = '';
  document.getElementById('authSubmit').disabled = false;
  document.getElementById('authSubmit').textContent = tab === 'login' ? '登录' : '注册';
  switchAuthTab(tab);
}

function closeAuthModal() {
  var modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('show');
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(function(t) { t.classList.toggle('active', t.dataset.mode === tab); });
  document.getElementById('authForm').dataset.mode = tab;
  document.getElementById('authTitle').textContent = tab === 'login' ? '登录' : '注册';
  document.getElementById('authSubmit').textContent = tab === 'login' ? '登录' : '注册';
  document.getElementById('displayNameGroup').style.display = tab === 'login' ? 'none' : '';
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  var mode = document.getElementById('authForm').dataset.mode || 'login';
  var phone = document.getElementById('authPhone').value.trim();
  var password = document.getElementById('authPassword').value.trim();
  var displayName = document.getElementById('authDisplayName') ? document.getElementById('authDisplayName').value.trim() : '';
  var errorEl = document.getElementById('authError');

  if (!phone || phone.length < 11) { errorEl.textContent = '请输入11位手机号'; return; }
  if (!password) { errorEl.textContent = '请输入密码'; return; }
  if (mode === 'register') {
    if (!displayName) { errorEl.textContent = '请填写显示名称'; return; }
    if (password.length < 6) { errorEl.textContent = '密码至少6位'; return; }
    if (containsBannedWords(displayName)) { errorEl.textContent = '昵称包含不当词汇'; return; }
  }

  errorEl.textContent = '';
  document.getElementById('authSubmit').disabled = true;
  document.getElementById('authSubmit').textContent = mode === 'login' ? '登录中...' : '注册中...';

  var email = phone + '@ztzx.edu.cn';

  if (mode === 'login') {
    var { data, error } = await supabase.auth.signInWithPassword({ email: email, password: password });
    if (error) {
      errorEl.textContent = error.message.includes('Invalid login') ? '手机号或密码错误' : error.message;
      document.getElementById('authSubmit').disabled = false;
      document.getElementById('authSubmit').textContent = '登录';
      return;
    }
    showToast('登录成功');
  } else {
    var { data, error } = await supabase.auth.signUp({
      email: email, password: password,
      options: { data: { display_name: displayName, phone: phone } }
    });
    if (error) {
      errorEl.textContent = error.message;
      document.getElementById('authSubmit').disabled = false;
      document.getElementById('authSubmit').textContent = '注册';
      return;
    }
    // 创建 profile
    try {
      var ip = await getUserIP();
      await apiPost('profiles/upsert', { display_name: displayName });
    } catch(e) {}
    showToast('注册成功！欢迎加入');
  }

  closeAuthModal();
  await updateAuth();
  router.navigate('#/');
}

async function logoutUser() {
  await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
  showToast('已退出');
  renderNav();
  router.navigate('#/');
}
