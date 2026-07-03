/**
 * 帖⼦模块
 * 昭州中学校园网
 */

// ======== 获取帖子列表（带分页） ========
async function getPosts(category = 'all', page = 1, pageSize = 10) {
  const sb = getSupabase();
  if (!sb) return { data: [], error: 'Supabase 未配置' };

  try {
    let query = sb
      .from('post_stats')
      .select('*')
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };

    return { data, error: null };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

// ======== 获取单篇帖子 ========
async function getPost(postId) {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from('post_stats')
    .select('*')
    .eq('id', postId)
    .single();

  if (error) return null;
  return data;
}

// ======== 创建帖子 ========
async function createPost(title, content, category, imageUrl = '') {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase 未配置' };

  const user = await getCurrentUser();
  if (!user) return { error: '请先登录' };

  // XSS 防护：转义 HTML
  const safeTitle = escapeHTML(title);
  const safeContent = escapeHTML(content);

  // 敏感词过滤
  if (containsBannedWords(safeTitle) || containsBannedWords(safeContent)) {
    return { error: '内容包含违禁词汇，请修改后重试' };
  }

  try {
    const { data, error } = await sb
      .from('posts')
      .insert({
        user_id: user.id,
        title: safeTitle,
        content: safeContent,
        category: category,
        image_url: imageUrl
      })
      .select()
      .single();

    if (error) return { error: error.message };
    return { success: true, data };
  } catch (err) {
    return { error: '发帖失败：' + err.message };
  }
}

// ======== 删除帖子 ========
async function deletePost(postId) {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase 未配置' };

  const user = await getCurrentUser();
  if (!user) return { error: '请先登录' };

  try {
    const { error } = await sb
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', user.id);

    if (error) return { error: error.message };
    return { success: true };
  } catch (err) {
    return { error: '删除失败：' + err.message };
  }
}

// ======== 获取评论 ========
async function getComments(postId) {
  const sb = getSupabase();
  if (!sb) return [];

  const { data } = await sb
    .from('comments')
    .select(`
      *,
      users:user_id (username, display_name, avatar_url)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  return data || [];
}

// ======== 发表评论 ========
async function addComment(postId, content) {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase 未配置' };

  const user = await getCurrentUser();
  if (!user) return { error: '请先登录' };

  const safeContent = escapeHTML(content);

  try {
    const { data, error } = await sb
      .from('comments')
      .insert({
        post_id: postId,
        user_id: user.id,
        content: safeContent
      })
      .select()
      .single();

    if (error) return { error: error.message };
    return { success: true, data };
  } catch (err) {
    return { error: '评论失败：' + err.message };
  }
}

// ======== 点赞 / 取消点赞 ========
async function toggleLike(postId) {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase 未配置' };

  const user = await getCurrentUser();
  if (!user) return { error: '请先登录' };

  try {
    // 检查是否已经点赞
    const { data: existingLike } = await sb
      .from('likes')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingLike) {
      // 取消点赞
      const { error } = await sb
        .from('likes')
        .delete()
        .eq('id', existingLike.id);
      if (error) return { error: error.message };
      return { liked: false };
    } else {
      // 点赞
      const { error } = await sb
        .from('likes')
        .insert({ post_id: postId, user_id: user.id });
      if (error) return { error: error.message };
      return { liked: true };
    }
  } catch (err) {
    return { error: err.message };
  }
}

// ======== 检查是否已点赞 ========
async function hasLiked(postId) {
  const sb = getSupabase();
  if (!sb) return false;

  const user = await getCurrentUser();
  if (!user) return false;

  const { data } = await sb
    .from('likes')
    .select('*')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle();

  return !!data;
}

// ======== 举报帖子 ========
async function reportPost(postId, reason) {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase 未配置' };

  const user = await getCurrentUser();
  if (!user) return { error: '请先登录' };

  try {
    const { error } = await sb
      .from('reports')
      .insert({ post_id: postId, user_id: user.id, reason });
    if (error) return { error: error.message };
    return { success: true, message: '举报已提交，管理员会尽快处理' };
  } catch (err) {
    return { error: err.message };
  }
}

// ======== 图片上传 ========
async function uploadImage(file) {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase 未配置' };

  // 文件大小限制：5MB
  if (file.size > 5 * 1024 * 1024) {
    return { error: '图片不能超过 5MB' };
  }

  // 文件类型检查
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { error: '只支持 JPG/PNG/GIF/WebP 格式' };
  }

  const fileName = `${Date.now()}_${file.name}`;
  const filePath = `post_images/${fileName}`;

  try {
    const { error: uploadError } = await sb.storage
      .from('images')
      .upload(filePath, file);

    if (uploadError) return { error: uploadError.message };

    const { data: { publicUrl } } = sb.storage
      .from('images')
      .getPublicUrl(filePath);

    return { success: true, url: publicUrl };
  } catch (err) {
    return { error: '上传失败：' + err.message };
  }
}

// ======== 上传头像 ========
async function uploadAvatar(file) {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase 未配置' };

  const user = await getCurrentUser();
  if (!user) return { error: '请先登录' };

  if (file.size > 2 * 1024 * 1024) {
    return { error: '头像不能超过 2MB' };
  }

  const filePath = `avatars/${user.id}_${Date.now()}.${file.name.split('.').pop()}`;

  try {
    const { error: uploadError } = await sb.storage
      .from('images')
      .upload(filePath, file);

    if (uploadError) return { error: uploadError.message };

    const { data: { publicUrl } } = sb.storage
      .from('images')
      .getPublicUrl(filePath);

    await sb.from('users')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);

    return { success: true, url: publicUrl };
  } catch (err) {
    return { error: '上传失败：' + err.message };
  }
}

// ======== 工具函数 ========

// 防 XSS：转义 HTML 特殊字符
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 防 XSS：解码回正常文本（用于显示）
function unescapeHTML(str) {
  const div = document.createElement('div');
  div.innerHTML = str;
  return div.textContent;
}

// 敏感词列表（简版，可根据需要扩充）
const BANNED_WORDS = [
  // 这里可以配置敏感词
];

function containsBannedWords(text) {
  return BANNED_WORDS.some(word => text.includes(word));
}

// 格式化时间
function formatTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
}
