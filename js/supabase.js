// Supabase 客户端初始化
const SUPABASE_URL = 'https://cersugzmtwbrywtqquvl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_53mNAXsvqFcwWLcHGMO9dg_GBXNSmOv';

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
