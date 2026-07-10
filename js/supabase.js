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
    // Race with timeout to prevent hanging on cold auth
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise(r => setTimeout(() => r(null), 3000))
    ]);
    if (result && result.data?.session?.access_token) return result.data.session.access_token;
  } catch {}
  return '';
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
