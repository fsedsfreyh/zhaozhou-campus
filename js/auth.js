/**
 * 用户认证模块
 * 昭州中学校园网
 */

// ======== 注册 ========
async function registerUser(email, password, displayName, studentClass) {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase 未配置' };

  try {
    // 1. 创建认证用户
    const { data: authData, error: authError } = await sb.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          display_name: displayName,
          student_class: studentClass || ''
        }
      }
    });

    if (authError) return { error: authError.message };

    // 2. 记录注册IP（通过触发器自动创建 profile）
    return { 
      success: true, 
      data: authData,
      message: '注册成功！请查收邮箱验证邮件（如果没有收到，可能不需要验证，直接登录即可）'
    };
  } catch (err) {
    return { error: '注册失败：' + err.message };
  }
}

// ======== 登录 ========
async function loginUser(email, password) {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase 未配置' };

  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) return { error: error.message };

    // 更新最后登录时间
    if (data.user) {
      await sb.from('users')
        .update({ 
          last_login_at: new Date().toISOString(),
          last_login_ip: await getClientIP()
        })
        .eq('id', data.user.id);
    }

    return { success: true, data };
  } catch (err) {
    return { error: '登录失败：' + err.message };
  }
}

// ======== 退出登录 ========
async function logoutUser() {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
  window.location.hash = '#/';
  location.reload();
}

// ======== 获取当前用户 ========
async function getCurrentUser() {
  const sb = getSupabase();
  if (!sb) return null;

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  // 获取用户详细信息
  const { data: profile } = await sb.from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  return { ...user, profile };
}

// ======== 获取客户端 IP（用于安全追溯） ========
async function getClientIP() {
  try {
    const resp = await fetch('https://api.ipify.org?format=json');
    const data = await resp.json();
    return data.ip;
  } catch {
    return 'unknown';
  }
}

// ======== 监听认证状态变化 ========
function onAuthChange(callback) {
  const sb = getSupabase();
  if (!sb) return;
  
  sb.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}
