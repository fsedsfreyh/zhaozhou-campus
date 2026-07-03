// ======== 工具函数 ========

// 违禁词列表（也会从数据库加载）
let BANNED_WORDS = [
  '傻逼', '草泥马', '操你妈', 'cnm', 'nmsl',
  'sb', '尼玛', '他妈', '混蛋', '废物',
  '去死', '垃圾人', '脑残', '白痴', '弱智',
  '滚蛋', '不要脸', 'fuck'
];

// 从数据库加载违禁词
async function loadBannedWords() {
  try {
    const { data, error } = await supabase
      .from('banned_words')
      .select('word')
      .eq('is_active', true);
    if (!error && data && data.length > 0) {
      BANNED_WORDS = data.map(w => w.word.toLowerCase());
    }
  } catch (e) {
    console.warn('加载违禁词失败:', e);
  }
}

// 检查内容是否包含违禁词
function containsBannedWords(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (lower.includes(word.toLowerCase())) {
      return word;
    }
  }
  return null;
}

// 过滤违禁词（替换为***）
function filterBannedWords(text) {
  let result = text;
  for (const word of BANNED_WORDS) {
    const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    result = result.replace(regex, '***');
  }
  return result;
}

// 时间格式化
function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return minutes + '分钟前';
  if (hours < 24) return hours + '小时前';
  if (days < 7) return days + '天前';
  
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  if (y === now.getFullYear()) return m + '-' + d;
  return y + '-' + m + '-' + d;
}

// 完整时间格式
function formatTimeFull(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

// Toast 提示
function showToast(message, duration = 2500) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

// 获取当前用户
async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  
  return { ...user, profile };
}

// 获取用户头像首字母
function getAvatarLetter(name) {
  if (!name) return '?';
  return name.charAt(0);
}

// 更新导航栏状态
async function updateNav() {
  const user = await getCurrentUser();
  const loginBtn = document.getElementById('navLoginBtn');
  const userMenu = document.getElementById('navUserMenu');
  const avatarEl = document.getElementById('navAvatar');
  const adminBtn = document.getElementById('navAdmin');

  if (user) {
    loginBtn.style.display = 'none';
    userMenu.style.display = 'flex';
    avatarEl.textContent = getAvatarLetter(user.profile?.display_name);
    adminBtn.style.display = user.profile?.role === 'admin' ? 'block' : 'none';
  } else {
    loginBtn.style.display = 'block';
    userMenu.style.display = 'none';
    adminBtn.style.display = 'none';
  }
}

// 导航栏滚动效果
function initNavScroll() {
  const navbar = document.getElementById('navbar');
  let ticking = false;
  
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        const heroHeight = window.innerHeight;
        
        if (scrollY > 80) {
          navbar.classList.remove('top-hero');
          navbar.classList.add('scrolled');
        } else {
          navbar.classList.remove('scrolled');
          navbar.classList.add('top-hero');
        }
        ticking = false;
      });
      ticking = true;
    }
  });
  
  // 初始状态
  if (window.scrollY > 80) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.add('top-hero');
  }
}

// 视差滚动背景
function initParallax() {
  const bg = document.querySelector('.campus-bg');
  if (!bg) return;
  
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const heroHeight = window.innerHeight;
    
    if (scrollY <= heroHeight) {
      const translateY = scrollY * 0.3;
      bg.style.transform = `translate(-50%, -50%) translateY(${translateY}px) scale(1.05)`;
    }
  });
}

// 用户IP获取（用于后台记录）
async function getUserIP() {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip;
  } catch {
    return '';
  }
}

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// 获取板块显示名
function getBoardName(slug) {
  const map = {
    'confession': '💌 表白墙',
    'lost-found': '🔍 失物招领',
    'treehole': '🌲 匿名树洞',
    'qa': '❓ 校园问答',
    'club': '🎭 社团招新',
    'part-time': '💼 校内兼职',
    'rental': '🏠 租房转租',
    'carpool': '🚗 拼车拼单',
    'notice': '📢 校园通知',
    'campus-life': '🏫 校园周边',
  };
  return map[slug] || slug;
}
