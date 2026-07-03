/**
 * Supabase 初始化与配置
 * 昭州中学校园网
 */

// ======== 配置区：部署前请修改这里的值 ========
const SUPABASE_CONFIG = {
  url: 'https://cersugzmtwbrywtqquvl.supabase.co',
  anonKey: 'sb_publishable_53mNAXsvqFcwWLcHGMO9dg_GBXNSmOv',
  siteName: '昭州中学校园网',
  categories: ['日常', '食堂', '学习', '社团', '八卦', '公告', '求助']
};

// 从 localStorage 读取覆盖配置
function getEffectiveConfig() {
  const cfg = { ...SUPABASE_CONFIG };
  try {
    const storedUrl = localStorage.getItem('zhaozhou_supabase_url');
    const storedKey = localStorage.getItem('zhaozhou_supabase_key');
    if (storedUrl) cfg.url = storedUrl;
    if (storedKey) cfg.anonKey = storedKey;
  } catch(e) {}
  return cfg;
}

// 检测是否已配置
function isSupabaseConfigured() {
  const cfg = getEffectiveConfig();
  return cfg.url !== 'https://YOUR_PROJECT.supabase.co' &&
         cfg.anonKey !== 'YOUR_ANON_KEY';
}

// Supabase 客户端
let supabaseClient = null;

function initSupabase() {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase 未配置，请在 js/supabase.js 中设置 SUPABASE_CONFIG');
    return null;
  }
  
  const cfg = getEffectiveConfig();
  supabaseClient = supabase.createClient(cfg.url, cfg.anonKey);
  return supabaseClient;
}

// 获取客户端实例
function getSupabase() {
  if (!supabaseClient) {
    return initSupabase();
  }
  return supabaseClient;
}
