// ===== Supabase 客户端与 API 封装 =====
// 修改入口：更新 SUPABASE_URL / ANON_KEY 为你的项目配置
var SUPABASE_URL = 'https://nuliptmhfumxnabrslfq.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51bGlwdG1oZnVteG5hYnJzbGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NTI0MDksImV4cCI6MjA5OTIyODQwOX0.uYWdhgqVdXTf7_kqsIXhG6ff8HqeDZCtkSgwWrqjdxQ';

// 创建 Supabase 客户端
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** 获取当前会话 token */
async function apiGetToken() {
  try {
    var { data } = await supabase.auth.getSession();
    if (data && data.session) return data.session.access_token;
  } catch(e) {}
  return SUPABASE_ANON_KEY;
}

/** GET 请求 Edge Function */
async function apiGet(endpoint, params) {
  var token = await apiGetToken();
  var url = SUPABASE_URL + '/functions/v1/api/' + endpoint;
  if (params) {
    var qs = Object.keys(params).map(function(k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    if (qs) url += '?' + qs;
  }
  try {
    var res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    });
    var data = await res.json();
    return { data: data, error: res.status >= 400 ? data : null };
  } catch(e) { return { data: null, error: e }; }
}

/** POST 请求 Edge Function */
async function apiPost(endpoint, body) {
  var token = await apiGetToken();
  try {
    var res = await fetch(SUPABASE_URL + '/functions/v1/api/' + endpoint, {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    var data = await res.json();
    return { data: data, error: res.status >= 400 ? data : null };
  } catch(e) { return { data: null, error: e }; }
}

/** 获取用户 IP */
async function getUserIP() {
  try {
    var r = await fetch('https://api.ipify.org?format=json');
    var d = await r.json();
    return d.ip || '';
  } catch(e) { return ''; }
}

/** 检查登录状态 */
async function getCurrentUser() {
  var { data } = await supabase.auth.getUser();
  return data && data.user ? data.user : null;
}
