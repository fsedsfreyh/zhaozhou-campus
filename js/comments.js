// ======== 评论模块 ========

// 渲染帖子详情页
async function renderPostDetail(postId) {
  const container = document.getElementById('postDetailContainer');
  container.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';
  
  // 获取帖子
  const { data: post } = await supabase
    .from('posts')
    .select('*, profiles!inner(display_name, avatar_url, class_name, role)')
    .eq('id', postId)
    .single();
  
  if (!post) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">😅</div><div class="empty-state-text">帖子不存在或已被删除</div></div>';
    return;
  }
  
  // 获取点赞状态
  const { data: { user } } = await supabase.auth.getUser();
  let isLiked = false, isBookmarked = false;
  
  if (user) {
    const { data: like } = await supabase.from('likes').select('id').eq('user_id', user.id).eq('post_id', postId).maybeSingle();
    const { data: bookmark } = await supabase.from('bookmarks').select('id').eq('user_id', user.id).eq('post_id', postId).maybeSingle();
    isLiked = !!like;
    isBookmarked = !!bookmark;
  }
  
  const isAnon = post.is_anonymous;
  const authorName = isAnon ? '匿名用户' : (post.profiles?.display_name || '用户已注销');
  const avatarLetter = isAnon ? '匿' : getAvatarLetter(authorName);
  
  container.innerHTML = `
    <div class="post-detail">
      <div class="post-detail-header">
        <span class="post-detail-board">${getBoardName(post.board_slug)}</span>
        <h1 class="post-detail-title">${post.title}</h1>
        <div class="post-detail-meta">
          ${avatarLetter ? `<span>👤 ${authorName}</span>` : ''}
          <span>📅 ${formatTimeFull(post.created_at)}</span>
          ${post.creator_ip ? `<span>📍 IP ${post.creator_ip.split('.').slice(0,2).join('.')}.***.***</span>` : ''}
          ${post.is_pinned ? '<span style="color:var(--primary)">📌 置顶</span>' : ''}
          <span>👁 ${post.like_count || 0}</span>
          <span>💬 ${post.comment_count || 0}</span>
        </div>
      </div>
      <div class="post-detail-body">
        <div class="post-detail-content">${post.content}</div>
        ${post.images && post.images.length > 0 ? `
          <div class="post-detail-images">
            ${post.images.map(url => `<img src="${url}" loading="lazy" onclick="window.open('${url}')">`).join('')}
          </div>
        ` : ''}
      </div>
      <div class="post-detail-actions">
        <button class="post-stat-btn ${isLiked ? 'liked' : ''}" onclick="toggleDetailLike('${post.id}', this)">
          ❤ <span>${post.like_count || 0}</span>
        </button>
        <button class="post-stat-btn ${isBookmarked ? 'bookmarked' : ''}" onclick="toggleDetailBookmark('${post.id}', this)">
          🔖 收藏
        </button>
        <button class="post-stat-btn" onclick="sharePost('${post.id}')">🔗 分享</button>
        <button class="post-stat-btn" onclick="reportPost('${post.id}')">🚩 举报</button>
      </div>
      ${!post.comments_disabled ? `
        <div class="comments-section" id="commentsSection">
          <h3 class="comments-title">💬 评论 (${post.comment_count || 0})</h3>
          <div id="commentInputArea">
            <div class="comment-input-area">
              <input class="comment-input" id="commentInput" placeholder="写下你的评论..." onkeydown="if(event.key==='Enter')submitComment('${post.id}')">
              <button class="comment-send" onclick="submitComment('${post.id}')">发送</button>
            </div>
          </div>
          <div id="commentsList"></div>
        </div>
      ` : `
        <div class="comments-section">
          <div class="empty-state" style="padding:20px">
            <div class="empty-state-text">💬 评论区已关闭</div>
          </div>
        </div>
      `}
    </div>
  `;
  
  // 加载评论
  if (!post.comments_disabled) {
    await loadComments(postId);
  }
}

// 加载评论
async function loadComments(postId) {
  const listEl = document.getElementById('commentsList');
  listEl.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';
  
  const { data: comments } = await supabase
    .from('comments')
    .select('*, profiles!inner(display_name, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  
  if (!comments || comments.length === 0) {
    listEl.innerHTML = '<div class="empty-state" style="padding:20px"><div class="empty-state-text">暂无评论，来说两句吧</div></div>';
    return;
  }
  
  listEl.innerHTML = comments.map(c => `
    <div class="comment-item">
      <div class="comment-avatar">${getAvatarLetter(c.profiles?.display_name)}</div>
      <div class="comment-body">
        <div class="comment-header">
          <span class="comment-author">${c.profiles?.display_name || '用户已注销'}</span>
          <span class="comment-time">${formatTime(c.created_at)}</span>
        </div>
        <div class="comment-text">${c.content}</div>
      </div>
    </div>
  `).join('');
}

// 提交评论
async function submitComment(postId) {
  const input = document.getElementById('commentInput');
  const content = input.value.trim();
  
  if (!content) return;
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { showToast('请先登录'); router.navigate('#/login'); return; }
  
  // 违禁词检查
  const badWord = containsBannedWords(content);
  if (badWord) {
    showToast('评论包含不当词汇');
    return;
  }
  
  const ip = await getUserIP();
  
  const { error } = await supabase.from('comments').insert({
    post_id: postId,
    user_id: user.id,
    content: filterBannedWords(content),
    creator_ip: ip,
  });
  
  if (error) {
    showToast('评论失败：' + error.message);
    return;
  }
  
  input.value = '';
  showToast('评论成功');
  await loadComments(postId);
  
  // 更新评论数
  await supabase.rpc('increment_comment', { post_id: postId });
}

// 详情页点赞
async function toggleDetailLike(postId, btn) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { showToast('请先登录'); return; }
  
  const isLiked = btn.classList.toggle('liked');
  const countSpan = btn.querySelector('span');
  let count = parseInt(countSpan.textContent);
  
  if (isLiked) {
    await supabase.from('likes').upsert({ user_id: user.id, post_id: postId });
    await supabase.rpc('increment_like', { post_id: postId });
    countSpan.textContent = count + 1;
  } else {
    await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', postId);
    await supabase.rpc('decrement_like', { post_id: postId });
    countSpan.textContent = Math.max(0, count - 1);
  }
}

// 详情页收藏
async function toggleDetailBookmark(postId, btn) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { showToast('请先登录'); return; }
  
  const isBookmarked = btn.classList.toggle('bookmarked');
  
  if (isBookmarked) {
    await supabase.from('bookmarks').upsert({ user_id: user.id, post_id: postId });
    showToast('已收藏');
  } else {
    await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('post_id', postId);
    showToast('已取消收藏');
  }
}

// 举报
async function reportPost(postId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { showToast('请先登录'); return; }
  
  const reason = prompt('请输入举报原因：');
  if (!reason || !reason.trim()) return;
  
  await supabase.from('reports').insert({
    reporter_id: user.id,
    post_id: postId,
    reason: reason.trim(),
  });
  
  showToast('举报已提交，管理员将尽快处理');
}
