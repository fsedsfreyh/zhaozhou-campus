// Supabase 客户端初始化 — NEW PROJECT
const SUPABASE_URL = 'https://nuliptmhfumxnabrslfq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51bGlwdG1oZnVteG5hYnJzbGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NTI0MDksImV4cCI6MjA5OTIyODQwOX0.uYWdhgqVdXTf7_kqsIXhG6ff8HqeDZCtkSgwWrqjdxQ';

// 挂载到 window 以便所有脚本共享
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public',
  },
});

// ======== Edge Function API Wrapper (代替 PostgREST) ========
const API_BASE = SUPABASE_URL + '/functions/v1/api';

/** 获取当前用户 token */
async function apiGetToken() {
  try {
    // Try user session first
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise(r => setTimeout(() => r(null), 3000))
    ]);
    if (result && result.data?.session?.access_token) return result.data.session.access_token;
  } catch {}
  // Fallback: use anon key for public access
  return SUPABASE_ANON_KEY;
}

/** GET 请求 */
async function apiGet(endpoint, params = {}) {
  const token = await apiGetToken();
  const query = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
  const res = await fetch(`${API_BASE}/${endpoint}${query}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); return { data: null, error: e.error || 'Request failed' }; }
  return { data: await res.json(), error: null };
}

/** POST 请求 */
async function apiPost(endpoint, body = {}) {
  const token = await apiGetToken();
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); return { data: null, error: e.error || 'Request failed' }; }
  return { data: await res.json(), error: null };
}

/** 全局违禁词缓存 */
let bannedWordsGlobally = [];

/** 从 Edge Function 加载违禁词 */
async function loadBannedWords() {
  try {
    const { data } = await apiGet('banned-words');
    if (data && Array.isArray(data)) bannedWordsGlobally = data.map(w => w.word).filter(Boolean);
  } catch {}
  return bannedWordsGlobally;
}

/** 更新导航栏（安全桩，防止 app.js 崩溃） */
async function updateNav() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const isLoggedIn = !!user;
    document.getElementById('loginBtn').style.display = isLoggedIn ? 'none' : '';
    document.getElementById('userMenu').style.display = isLoggedIn ? '' : 'none';
    if (user) {
      const { data: profile } = await apiGet('profile');
      document.getElementById('userAvatarText').textContent = profile?.display_name?.charAt(0) || 'U';
      document.getElementById('adminLink').style.display = profile?.role === 'admin' ? '' : 'none';
    }
  } catch {}
}

/** 导航滚动效果（安全桩） */
function initNavScroll() {
  const bar = document.getElementById('topBar');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    bar.classList.toggle('scrolled', window.scrollY > 50);
  });
}

/** 视差效果（安全桩） */
function initParallax() {
  // Parallax is handled by CSS
}

/** 检查文本是否包含违禁词 */
function containsBannedWords(text) {
  if (!bannedWordsGlobally || !bannedWordsGlobally.length) return false;
  var lower = text.toLowerCase();
  for (var w of bannedWordsGlobally) {
    if (lower.includes(w.toLowerCase())) return true;
  }
  return false;
}

/** 获取用户IP */
async function getUserIP() {
  try {
    var r = await fetch('https://api.ipify.org?format=json');
    var d = await r.json();
    return d.ip || '';
  } catch { return ''; }
}
