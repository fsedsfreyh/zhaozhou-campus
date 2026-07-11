// ===== 主应用 - 路由注册与页面渲染 =====

document.addEventListener('DOMContentLoaded', async function() {
  // 深色模式初始化
  var dm = useModule('darkmode');
  dm.init();

  // 加载违禁词（不阻塞初始化）
  loadBannedWords();
  // 更新登录状态
  await updateAuth();
  // 注册路由
  registerRoutes();
  // 初始化路由
  router.init();
});

// ===== 路由注册 =====
function registerRoutes() {
  router.register('#/', renderHome);
  router.register('#/board/:slug', function(p) { renderBoard(p.slug); });
  router.register('#/post/:id', function(p) { renderPostDetail(p.id); });
  router.register('#/create', renderCreate);
  router.register('#/chat', renderChat);
  router.register('#/chat/:id', function(p) { renderChatDetail(p.id); });
  router.register('#/login', function() { openAuthModal('login'); });
  router.register('#/register', function() { openAuthModal('register'); });
  router.register('#/profile', renderProfile);
  router.register('#/my-posts', renderMyPosts);
  router.register('#/history', renderHistory);
  router.register('#/search/:q', function(p) { renderSearch(p.q); });
  router.register('#/admin', renderAdmin);
}

// ===== 首页 =====
async function renderHome() {
  var main = document.getElementById('mainContent');
  main.innerHTML =
    '<div class="container" style="padding-top:12px">' +
    '<div class="board-selector" id="boardSelector">' +
      '<button class="board-chip active" onclick="switchBoard(\'all\',this)">📋 全部</button>' +
      '<button class="board-chip" onclick="switchBoard(\'announcement\',this)" style="border-color:rgba(35,79,176,0.2)">📢 公告栏</button>' +
      '<button class="board-chip" onclick="switchBoard(\'confession\',this)" style="border-color:rgba(216,130,172,0.2)">💌 表白墙</button>' +
      '<button class="board-chip" onclick="switchBoard(\'gossip\',this)" style="border-color:rgba(226,144,55,0.2)">🫢 八卦墙</button>' +
      '<button class="board-chip" onclick="switchBoard(\'lost\',this)" style="border-color:rgba(71,160,199,0.2)">🔍 失物招领</button>' +
    '</div>' +
    '<div id="postList">' + skeletonCards(4) + '</div>' +
    '</div>';
  await loadPosts('all');
}

window.switchBoard = async function(slug, btn) {
  document.querySelectorAll('.board-chip').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  document.getElementById('postList').innerHTML = skeletonCards(4);
  await loadPosts(slug);
};

async function loadPosts(boardSlug) {
  var list = document.getElementById('postList');
  if (!list) return;
  try {
    var endpoint = boardSlug === 'all' ? 'posts' : 'posts?board=' + boardSlug;
    var res = await apiGet(endpoint);
    var posts = res.data || [];
    if (posts.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">🌿</div><div class="empty-text">还没有内容呢</div><div class="empty-sub">慢慢来，会有人来的</div></div>';
      return;
    }
    // 过滤黑名单
    var block = useModule('block');
    posts = posts.filter(function(p) { return !block.isBlocked(p.user_id); });
    list.innerHTML = posts.map(function(p) { return renderPostCard(p); }).join('');
    lazyLoadImages(list);
  } catch(e) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">😅</div><div class="empty-text">加载失败</div><div class="empty-sub">试试刷新一下</div></div>';
  }
}

// ===== 帖子卡片渲染 =====
function renderPostCard(p) {
  var boardName = getBoardName(p.board_slug);
  var boardColor = getBoardColor(p.board_slug);
  var isGossip = p.board_slug === 'gossip';
  var authorName = p.is_anonymous || isGossip ? '匿名同学' : (p.profiles ? p.profiles.display_name : '神秘人');
  var adminBadge = p.profiles && p.profiles.role === 'admin' && !p.is_anonymous && !isGossip ? '<span class="admin-badge">管理员</span>' : '';
  var authorAvatar = (!p.is_anonymous && !isGossip && p.profiles && p.profiles.avatar_url)
    ? '<img class="mini-avatar" src="' + p.profiles.avatar_url + '" alt="">'
    : '';
  var imagesHtml = '';
  if (p.images && p.images.length) {
    var cls = p.images.length === 1 ? 'single' : 'multi';
    imagesHtml = '<div class="post-card-images ' + cls + '">';
    p.images.forEach(function(img) {
      imagesHtml += '<img class="post-card-img" data-src="' + img + '" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="" loading="lazy" onerror="this.classList.add(\'error\');this.src=\'\'">';
    });
    imagesHtml += '</div>';
  }

  var tagsHtml = '';
  if (p.tags && p.tags.length) {
    tagsHtml = '<div class="post-card-tags">' + p.tags.map(function(t) { return '<span class="post-card-tag">#' + t + '</span>'; }).join('') + '</div>';
  }

  return '<div class="post-card" onclick="router.navigate(\'#/post/' + p.id + '\')">' +
    '<div class="post-card-header">' +
      '<span class="post-card-author">' + authorAvatar + escapeHtml(authorName) + adminBadge + '</span>' +
      '<span class="post-card-time">' + formatTime(p.created_at) + '</span>' +
      '<span class="post-card-board ' + p.board_slug + '">' + boardName + '</span>' +
    '</div>' +
    '<div class="post-card-title">' + escapeHtml(p.title) + '</div>' +
    '<div class="post-card-content collapsed">' + escapeHtml(p.content) + '</div>' +
    tagsHtml +
    imagesHtml +
    '<div class="post-card-actions">' +
      '<button class="post-card-action" onclick="event.stopPropagation();toggleLike(\'' + p.id + '\', this)"><span>' + (p.liked ? '❤️' : '🤍') + '</span><span>' + (p.likes_count || 0) + '</span></button>' +
      '<button class="post-card-action" onclick="event.stopPropagation();router.navigate(\'#/post/' + p.id + '\')">💬<span>' + (p.comments_count || 0) + '</span></button>' +
      '<button class="post-card-action' + (p.bookmarked ? ' active' : '') + '" onclick="event.stopPropagation();toggleBookmark(\'' + p.id + '\', this)"><span>' + (p.bookmarked ? '🔖' : '🏷️') + '</span></button>' +
      '<button class="post-card-action" onclick="event.stopPropagation();reportPost(\'' + p.id + '\')" style="margin-left:auto">🚩</button>' +
    '</div>' +
  '</div>';
}

function escapeHtml(str) {
  if (!str) return '';
  var d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ===== 点赞 =====
async function toggleLike(postId, btn) {
  if (!currentUser) { showToast('请先登录'); openAuthModal('login'); return; }
  var res = await apiPost('likes', { post_id: postId });
  if (res.data) {
    var liked = res.data.liked;
    var cur = parseInt(btn.querySelector('span:last-child').textContent) || 0;
    var nxt = liked ? cur + 1 : Math.max(0, cur - 1);
    btn.innerHTML = '<span>' + (liked ? '❤️' : '🤍') + '</span><span>' + nxt + '</span>';
  }
}

// ===== 评论点赞 =====
async function toggleCommentLike(commentId, btn) {
  if (!currentUser) { showToast('请先登录'); openAuthModal('login'); return; }
  var res = await apiPost('comment-like', { comment_id: commentId });
  if (res.data) {
    btn.innerHTML = '❤️ <span>' + (res.data.like_count || 0) + '</span>';
  }
}

// ===== 收藏 =====
async function toggleBookmark(postId, btn) {
  if (!currentUser) { showToast('请先登录'); openAuthModal('login'); return; }
  var res = await apiPost('bookmarks', { post_id: postId });
  if (res.data) {
    btn.classList.toggle('active', res.data.bookmarked);
    btn.innerHTML = '<span>' + (res.data.bookmarked ? '🔖' : '🏷️') + '</span>';
  }
}

// ===== 举报 =====
function reportPost(postId) {
  if (!currentUser) { showToast('请先登录'); openAuthModal('login'); return; }
  var options = ['恶意挂人', '造谣', '低俗', '广告', '辱骂', '虚假失物'];
  var html = '<div style="display:flex;flex-direction:column;gap:8px">';
  options.forEach(function(o) {
    html += '<button class="btn-outline" onclick="submitReport(\'' + postId + '\',\'' + o + '\')" style="justify-content:center">' + o + '</button>';
  });
  html += '</div>';
  showCustomModal('选择举报原因', html);
}

async function submitReport(postId, reason) {
  closeCustomModal();
  await apiPost('reports', { post_id: postId, reason: reason });
  showToast('举报已提交，感谢你的反馈');
}

// ===== 自定义弹窗 =====
function showCustomModal(title, bodyHtml) {
  var existing = document.getElementById('customModal');
  if (existing) existing.remove();
  var modal = document.createElement('div');
  modal.id = 'customModal';
  modal.className = 'modal-overlay show';
  modal.innerHTML = '<div class="modal-content"><div class="modal-header"><span class="modal-title">' + title + '</span><button class="modal-close" onclick="closeCustomModal()">✕</button></div><div class="modal-body">' + bodyHtml + '</div></div>';
  modal.addEventListener('click', function(e) { if (e.target === modal) closeCustomModal(); });
  document.body.appendChild(modal);
}
window.showCustomModal = showCustomModal;

function closeCustomModal() {
  var m = document.getElementById('customModal');
  if (m) m.remove();
}
window.closeCustomModal = closeCustomModal;

// ===== 板块页 =====
async function renderBoard(slug) {
  var main = document.getElementById('mainContent');
  var boardName = getBoardName(slug);
  var boardIcon = getBoardIcon(slug);
  var isGossip = slug === 'gossip';
  main.innerHTML =
    '<div class="container" style="padding-top:12px">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
      '<h2 style="font-size:1.2rem;font-weight:700">' + boardIcon + ' ' + boardName + '</h2>' +
      (isGossip ? '<div style="display:flex;gap:8px">' +
        '<button class="tag active" id="sortLatest" onclick="switchSort(\'latest\',this)">最新</button>' +
        '<button class="tag" id="sortHot" onclick="switchSort(\'hot\',this)">热门</button>' +
      '</div>' : '') +
    '</div>' +
    '<div id="postList">' + skeletonCards(4) + '</div>' +
    '</div>';
  var endpoint = 'posts?board=' + slug;
  if (isGossip && window._gossipSort === 'hot') endpoint += '&sort=likes_count';
  try {
    var res = await apiGet(endpoint);
    var posts = res.data || [];
    var list = document.getElementById('postList');
    if (posts.length === 0) {
      var emptyMsgs = {
        confession: '<div class="empty-icon">💝</div><div class="empty-text">还没有收到表白</div><div class="empty-sub">勇敢一点，去发出你的心声吧</div>',
        gossip: '<div class="empty-icon">🫢</div><div class="empty-text">八卦区暂时安静</div><div class="empty-sub">风声会来的</div>',
        lost: '<div class="empty-icon">🔍</div><div class="empty-text">暂无失物信息</div><div class="empty-sub">希望你的东西都好好的</div>',
      };
      list.innerHTML = '<div class="empty-state">' + (emptyMsgs[slug] || '<div class="empty-icon">📭</div><div class="empty-text">这里空空的</div>') + '</div>';
      return;
    }
    var block = useModule('block');
    posts = posts.filter(function(p) { return !block.isBlocked(p.user_id); });
    list.innerHTML = posts.map(function(p) { return renderPostCard(p); }).join('');
    lazyLoadImages(list);
  } catch(e) {
    document.getElementById('postList').innerHTML = '<div class="empty-state"><div class="empty-icon">😅</div><div class="empty-text">加载失败</div></div>';
  }
}

window._gossipSort = 'latest';

window.switchSort = function(sort, btn) {
  window._gossipSort = sort;
  document.querySelectorAll('.tag').forEach(function(t) { t.classList.remove('active'); });
  btn.classList.add('active');
  var slug = location.hash.split('/')[2];
  if (slug) renderBoard(slug);
};

// ===== 帖子详情 =====
async function renderPostDetail(postId) {
  var main = document.getElementById('mainContent');
  main.innerHTML = '<div class="loading-wrap"><div class="loading-ring"></div></div>';

  // 记录浏览历史
  try {
    var res = await apiGet('posts/' + postId);
    var post = res.data;
    if (!post) { main.innerHTML = '<div class="empty-state"><div class="empty-text">帖子不存在</div></div>'; return; }
    var hist = useModule('history');
    hist.add(postId, post);
  } catch(e) { main.innerHTML = '<div class="empty-state"><div class="empty-text">加载失败</div></div>'; return; }

  var p = res.data;
  var block = useModule('block');
  if (block.isBlocked(p.user_id)) {
    main.innerHTML = '<div class="empty-state"><div class="empty-icon">🚫</div><div class="empty-text">该用户已被你屏蔽</div></div>';
    return;
  }

  var boardName = getBoardName(p.board_slug);
  var isGossip = p.board_slug === 'gossip';
  var authorName = p.is_anonymous || isGossip ? '匿名同学' : (p.profiles ? p.profiles.display_name : '神秘人');
  var adminBadge = p.profiles && p.profiles.role === 'admin' && !p.is_anonymous && !isGossip ? '<span class="admin-badge">管理员</span>' : '';
  var detailAvatar = (!p.is_anonymous && !isGossip && p.profiles && p.profiles.avatar_url)
    ? '<img class="mini-avatar" src="' + p.profiles.avatar_url + '" alt="">'
    : '';

  var imagesHtml = '';
  if (p.images && p.images.length) {
    var cls = p.images.length === 1 ? 'single' : 'multi';
    imagesHtml = '<div class="post-card-images ' + cls + '">';
    p.images.forEach(function(img) {
      imagesHtml += '<img class="post-card-img" src="' + img + '" alt="" onerror="this.classList.add(\'error\');this.src=\'\'">';
    });
    imagesHtml += '</div>';
  }

  main.innerHTML =
    '<div class="post-detail">' +
    '<div class="post-card">' +
      '<div class="post-card-header">' +
        '<span class="post-card-author">' + detailAvatar + escapeHtml(authorName) + adminBadge + '</span>' +
        '<span class="post-card-time">' + formatTime(p.created_at) + '</span>' +
        '<span class="post-card-board ' + p.board_slug + '">' + boardName + '</span>' +
      '</div>' +
      '<div class="post-card-title">' + escapeHtml(p.title) + '</div>' +
      '<div class="post-card-content">' + escapeHtml(p.content) + '</div>' +
      imagesHtml +
      '<div class="post-card-actions">' +
        '<button class="post-card-action" onclick="toggleLike(\'' + p.id + '\',this)"><span>🤍</span><span>' + (p.likes_count || 0) + '</span></button>' +
        '<button class="post-card-action" onclick="toggleBookmark(\'' + p.id + '\',this)"><span>🏷️</span></button>' +
        '<button class="post-card-action" onclick="blockUser(\'' + p.user_id + '\')" style="margin-left:auto">🚫 屏蔽</button>' +
        '<button class="post-card-action" onclick="reportPost(\'' + p.id + '\')">🚩</button>' +
      '</div>' +
    '</div>' +
    '<div class="comments-section" id="commentsSection">' +
      '<h3 style="font-size:0.95rem;font-weight:600;margin-bottom:12px">💬 评论</h3>' +
      '<div id="commentInput">' +
        (currentUser ? '<div class="comment-input-wrap"><input class="comment-input" id="commentText" placeholder="说点什么..." onkeydown="if(event.key===\'Enter\')submitComment(\'' + p.id + '\')"><button class="comment-submit" onclick="submitComment(\'' + p.id + '\')">发送</button></div>' :
          '<p style="font-size:0.85rem;color:var(--text-light);text-align:center;padding:12px"><a href="#" onclick="openAuthModal(\'login\');return false" style="color:var(--primary)">登录</a>后可评论</p>') +
        '<div style="margin-top:4px"><label class="modal-switch"><input type="checkbox" id="commentPrivate"> 仅楼主与自己可见</label></div>' +
      '</div>' +
      '<div id="commentList"><div class="loading-wrap"><div class="loading-ring"></div></div></div>' +
    '</div>' +
    '</div>';

  loadComments(postId);
}

async function loadComments(postId) {
  try {
    var res = await apiGet('comments/' + postId);
    var comments = res.data || [];
    var list = document.getElementById('commentList');
    if (comments.length === 0) {
      list.innerHTML = '<div class="empty-state" style="padding:20px"><div class="empty-text" style="font-size:0.85rem">还没有评论</div></div>';
      return;
    }
    var block = useModule('block');
    comments = comments.filter(function(c) { return !block.isBlocked(c.user_id); });
    // Separate top-level comments and replies
    var topLevel = comments.filter(function(c) { return !c.parent_id; });
    var replies = {};
    comments.forEach(function(c) {
      if (c.parent_id) {
        if (!replies[c.parent_id]) replies[c.parent_id] = [];
        replies[c.parent_id].push(c);
      }
    });
    list.innerHTML = topLevel.map(function(c) {
      return renderCommentItem(c, replies[c.id] || [], postId);
    }).join('');
    // Add click handler for reply buttons
    document.querySelectorAll('.reply-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        var cid = this.dataset.commentId;
        var name = this.dataset.authorName;
        var container = document.getElementById('replyForm-' + cid);
        if (container) {
          container.style.display = container.style.display === 'none' ? '' : 'none';
          if (container.style.display !== 'none') {
            var input = container.querySelector('.reply-input');
            if (input) { input.focus(); input.placeholder = '回复 @' + name; }
          }
        }
      });
    });
  } catch(e) {
    document.getElementById('commentList').innerHTML = '<div class="empty-state" style="padding:20px"><div class="empty-text">评论加载失败</div></div>';
  }
}

function renderCommentItem(c, replyList, postId) {
  var isOwner = currentUser && currentUser.id === c.user_id;
  var commentAuthor = c.is_private && !isOwner ? '仅楼主可见' : (c.profiles ? c.profiles.display_name : '匿名');
  var commentAdminBadge = c.profiles && c.profiles.role === 'admin' && !c.is_private ? '<span class="admin-badge">管理员</span>' : '';
  var commentAvatar = (!c.is_private && c.profiles && c.profiles.avatar_url)
    ? '<img class="mini-avatar" src="' + c.profiles.avatar_url + '" alt="">'
    : '';
  var repliesHtml = '';
  if (replyList && replyList.length) {
    repliesHtml = '<div class="comment-replies">' +
      replyList.map(function(r) {
        var rAuthor = r.is_private ? '仅楼主可见' : (r.profiles ? r.profiles.display_name : '匿名');
        var rAdminBadge = r.profiles && r.profiles.role === 'admin' && !r.is_private ? '<span class="admin-badge">管理员</span>' : '';
        var rAvatar = (!r.is_private && r.profiles && r.profiles.avatar_url)
          ? '<img class="mini-avatar mini-avatar-sm" src="' + r.profiles.avatar_url + '" alt="">'
          : '';
        return '<div class="comment-reply-item">' +
          '<span class="comment-author">' + rAvatar + escapeHtml(rAuthor) + rAdminBadge + '</span>' +
          '<span class="comment-time">' + formatTime(r.created_at) + '</span>' +
          '<div class="comment-content">' + escapeHtml(r.content) + '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }
  return '<div class="comment-item" id="comment-' + c.id + '">' +
    '<div class="comment-header">' +
      '<span class="comment-author">' + commentAvatar + escapeHtml(commentAuthor) + commentAdminBadge + '</span>' +
      '<span class="comment-time">' + formatTime(c.created_at) + '</span>' +
    '</div>' +
    '<div class="comment-content">' + escapeHtml(c.content) + '</div>' +
    '<div class="comment-actions">' +
      '<button class="reply-btn" data-comment-id="' + c.id + '" data-author-name="' + escapeHtml(commentAuthor) + '">💬 回复</button>' +
      '<button class="comment-like-btn" onclick="toggleCommentLike(\'' + c.id + '\',this)">❤️ <span>' + (c.like_count || 0) + '</span></button>' +
    '</div>' +
    '<div id="replyForm-' + c.id + '" class="reply-form" style="display:none">' +
      '<div class="reply-input-wrap"><input class="reply-input" placeholder="回复..."><button class="comment-submit" onclick="submitReply(\'' + c.id + '\',\'' + postId + '\')">发送</button></div>' +
    '</div>' +
    repliesHtml +
  '</div>';
}

async function submitReply(parentId, postId) {
  var container = document.getElementById('replyForm-' + parentId);
  if (!container) return;
  var input = container.querySelector('.reply-input');
  if (!input || !input.value.trim()) return;
  input.disabled = true;
  await apiPost('comments', { post_id: postId, parent_id: parentId, content: input.value.trim() });
  input.value = '';
  input.disabled = false;
  container.style.display = 'none';
  loadComments(postId);
  showToast('回复成功');
}
window.submitReply = submitReply;
window.toggleCommentLike = toggleCommentLike;

async function submitComment(postId) {
  var text = document.getElementById('commentText');
  if (!text || !text.value.trim()) return;
  var isPrivate = document.getElementById('commentPrivate') && document.getElementById('commentPrivate').checked;
  document.getElementById('commentText').disabled = true;
  await apiPost('comments', { post_id: postId, content: text.value.trim(), is_private: isPrivate });
  text.value = '';
  text.disabled = false;
  loadComments(postId);
  showToast('评论成功');
}
window.submitComment = submitComment;

// ===== 屏蔽用户 =====
function blockUser(userId) {
  if (!currentUser) { showToast('请先登录'); return; }
  if (currentUser.id === userId) { showToast('不能屏蔽自己'); return; }
  var block = useModule('block');
  var blocked = block.toggle(userId);
  showToast(blocked ? '已屏蔽该用户' : '已取消屏蔽');
}

// ===== 投稿弹窗 =====
async function renderCreate() {
  if (!currentUser) { showToast('请先登录'); openAuthModal('login'); return; }

  var draft = useModule('draft');
  var saved = draft.load();

  var main = document.getElementById('mainContent');
  main.innerHTML =
    '<div class="container" style="padding-top:12px;max-width:600px">' +
    '<div class="glass-card" style="padding:20px">' +
      '<h2 style="font-size:1.1rem;font-weight:700;margin-bottom:16px">✏️ 发布内容</h2>' +
      '<div style="display:flex;flex-direction:column;gap:12px">' +
        '<select id="createBoard" class="modal-input">' +
          '<option value="confession">💌 表白墙</option>' +
          '<option value="gossip">🫢 八卦墙</option>' +
          '<option value="lost">🔍 失物招领</option>' +
        '</select>' +
        '<input class="modal-input" id="createTitle" placeholder="标题（选填）" value="' + escapeHtml(saved ? saved.title || '' : '') + '">' +
        '<textarea class="modal-textarea" id="createContent" placeholder="写点什么..." oninput="autoSaveDraft()" style="min-height:150px">' + escapeHtml(saved ? saved.content || '' : '') + '</textarea>' +
        '<div class="modal-options">' +
          '<label class="modal-switch"><input type="checkbox" id="createAnonymous" ' + (saved && saved.anonymous ? 'checked' : '') + '> 匿名发布</label>' +
        '</div>' +
        '<div id="createTags" style="display:' + (saved && saved.board === 'gossip' ? 'block' : 'none') + '">' +
          '<div style="font-size:0.82rem;color:var(--text-light);margin-bottom:6px">标签（选填）</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
            ['吃瓜','爆料','求助','吐槽','分享','讨论'].map(function(t) { return '<button class="tag" onclick="toggleTag(this)">' + t + '</button>'; }).join('') +
          '</div>' +
        '</div>' +
        '<div id="createLostFields" style="display:none">' +
          '<div style="font-size:0.82rem;color:var(--text-light);margin-bottom:6px">物品分类</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
            ['书本','耳机','校服','水杯','其他'].map(function(c) { return '<button class="tag active" onclick="toggleTag(this)" style="border-color:var(--lost)">' + c + '</button>'; }).join('') +
          '</div>' +
        '</div>' +
        '<div class="modal-images" id="createImagePreviews"></div>' +
        '<div style="display:flex;gap:8px">' +
          '<div class="modal-image-add" onclick="document.getElementById(\'createFileInput\').click()">+</div>' +
          '<input type="file" accept="image/*" multiple style="display:none" id="createFileInput" onchange="handleCreateImages(this.files)">' +
        '</div>' +
        '<button class="btn-primary" id="createSubmitBtn" onclick="submitCreatePost()">' +
          '<span class="btn-text">📤 发布</span><span class="spinner"></span>' +
        '</button>' +
      '</div>' +
    '</div>' +
    '</div>';

  // 监听板块切换
  document.getElementById('createBoard').addEventListener('change', function() {
    document.getElementById('createTags').style.display = this.value === 'gossip' ? 'block' : 'none';
    document.getElementById('createLostFields').style.display = this.value === 'lost' ? 'block' : 'none';
  });

  // 从草稿恢复
  if (saved && saved.board) document.getElementById('createBoard').value = saved.board;
  if (saved && saved.tags) {
    saved.tags.forEach(function(t) {
      document.querySelectorAll('#createTags .tag, #createLostFields .tag').forEach(function(btn) {
        if (btn.textContent === t) btn.classList.add('active');
      });
    });
  }
}

window.toggleTag = function(btn) { btn.classList.toggle('active'); };

window.handleCreateImages = async function(files) {
  var previews = document.getElementById('createImagePreviews');
  for (var i = 0; i < files.length && i < 9; i++) {
    if (files[i].size > 20 * 1024 * 1024) { showToast('每张图片不能超过 20MB'); continue; }
    var compressed = await compressImage(files[i]);
    var reader = new FileReader();
    reader.onload = function(e) {
      var div = document.createElement('div');
      div.style.cssText = 'position:relative;display:inline-block';
      div.innerHTML = '<img src="' + e.target.result + '" style="width:64px;height:64px;border-radius:8px;object-fit:cover"><button onclick="this.parentElement.remove()" style="position:absolute;top:-4px;right:-4px;width:20px;height:20px;border-radius:50%;background:#ef4444;color:#fff;border:none;font-size:0.7rem;cursor:pointer">✕</button>';
      previews.appendChild(div);
    };
    reader.readAsDataURL(compressed);
  }
};

window.autoSaveDraft = function() {
  var draft = useModule('draft');
  var title = document.getElementById('createTitle');
  var content = document.getElementById('createContent');
  var board = document.getElementById('createBoard');
  if (content && content.value) {
    draft.save({
      title: title ? title.value : '',
      content: content.value,
      board: board ? board.value : 'confession',
      anonymous: document.getElementById('createAnonymous') ? document.getElementById('createAnonymous').checked : true,
      tags: Array.from(document.querySelectorAll('#createTags .tag.active, #createLostFields .tag.active')).map(function(b) { return b.textContent; })
    });
  }
};

async function submitCreatePost() {
  var btn = document.getElementById('createSubmitBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  var board = document.getElementById('createBoard').value;
  var title = document.getElementById('createTitle').value.trim();
  var content = document.getElementById('createContent').value.trim();
  var isAnonymous = document.getElementById('createAnonymous').checked;

  if (!content) { showToast('请填写内容'); btn.classList.remove('loading'); btn.disabled = false; return; }
  if (containsBannedWords(title + content)) { showToast('内容包含不当词汇'); btn.classList.remove('loading'); btn.disabled = false; return; }

  // 上传图片
  var imageUrls = [];
  var previews = document.getElementById('createImagePreviews').querySelectorAll('img');
  for (var i = 0; i < previews.length; i++) {
    var imgSrc = previews[i].src;
    if (imgSrc.startsWith('data:')) {
      try {
        var res = await apiPost('images/upload', { image: imgSrc, mime_type: 'image/jpeg' });
        if (res.data && res.data.url) imageUrls.push(res.data.url);
      } catch(e) {}
    } else {
      imageUrls.push(imgSrc);
    }
  }

  var tags = Array.from(document.querySelectorAll('#createTags .tag.active')).map(function(b) { return b.textContent; });
  var lostCategory = '';
  if (board === 'lost') {
    lostCategory = Array.from(document.querySelectorAll('#createLostFields .tag.active')).map(function(b) { return b.textContent; })[0] || '';
  }

  var res = await apiPost('posts', {
    title: title, content: content, board_slug: board,
    images: imageUrls, is_anonymous: isAnonymous,
    tags: tags, lost_category: lostCategory
  });

  btn.classList.remove('loading');
  btn.disabled = false;

  if (res.error) { showToast('发布失败'); return; }

  var draft = useModule('draft');
  draft.clear();
  showToast('发布成功');
  router.navigate('#/');
}

// ===== 私信 =====
async function renderChat() {
  if (!currentUser) { showToast('请先登录'); openAuthModal('login'); return; }
  var main = document.getElementById('mainContent');
  main.innerHTML =
    '<div class="container" style="padding-top:12px">' +
    '<h2 style="font-size:1.1rem;font-weight:700;margin-bottom:12px">💬 私信</h2>' +
    '<div id="chatList">' +
      '<div class="empty-state"><div class="empty-icon">💬</div><div class="empty-text">暂无私信</div><div class="empty-sub">去帖子页面找感兴趣的同学聊天吧</div></div>' +
    '</div>' +
    '</div>';
}

async function renderChatDetail(chatId) {
  if (!currentUser) { showToast('请先登录'); return; }
  var main = document.getElementById('mainContent');
  main.innerHTML =
    '<div style="display:flex;flex-direction:column;height:calc(100vh - 56px)">' +
    '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--glass-bg);backdrop-filter:blur(20px);border-bottom:1px solid var(--glass-border)">' +
      '<button onclick="router.navigate(\'#/chat\')" style="background:none;border:none;font-size:1.2rem;cursor:pointer">←</button>' +
      '<span style="font-weight:600">聊天</span>' +
    '</div>' +
    '<div class="chat-messages" id="chatMessages">' +
      '<div class="empty-state"><div class="empty-text">开始聊天吧</div></div>' +
    '</div>' +
    '<div class="chat-input-wrap">' +
      '<input class="chat-input" id="chatMsgInput" placeholder="输入消息..." onkeydown="if(event.key===\'Enter\')sendChatMsg()">' +
      '<button class="chat-send" onclick="sendChatMsg()">➤</button>' +
    '</div>' +
    '</div>';
}

function sendChatMsg() {
  var input = document.getElementById('chatMsgInput');
  if (!input || !input.value.trim()) return;
  // 发送消息 - 通过 Edge Function
  showToast('私信功能开发中');
}
window.sendChatMsg = sendChatMsg;

// ===== 个人中心 =====
async function renderProfile() {
  if (!currentUser) { showToast('请先登录'); openAuthModal('login'); return; }
  var main = document.getElementById('mainContent');
  var name = currentProfile ? currentProfile.display_name : '用户';
  var initial = name.charAt(0).toUpperCase();
  var avatarUrl = currentProfile && currentProfile.avatar_url ? currentProfile.avatar_url : null;
  var avatarHtml = avatarUrl
    ? '<img class="avatar-img" src="' + avatarUrl + '" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover;margin:0 auto 12px">'
    : '<div class="avatar" style="width:64px;height:64px;font-size:1.5rem;margin:0 auto 12px;background:var(--primary)">' + initial + '</div>';
  main.innerHTML =
    '<div class="container" style="padding-top:12px;max-width:600px">' +
    '<div class="glass-card" style="padding:24px;text-align:center">' +
      avatarHtml +
      '<button class="btn-outline" onclick="document.getElementById(\'avatarInput\').click()" style="font-size:0.75rem;padding:2px 10px;margin-bottom:8px">📷 更换头像</button>' +
      '<input type="file" id="avatarInput" accept="image/*" style="display:none" onchange="uploadAvatar(this.files[0])">' +
      '<h3 style="font-size:1.1rem;font-weight:700">' + escapeHtml(name) + '</h3>' +
      '<p style="font-size:0.82rem;color:var(--text-light);margin-top:4px">' + (currentProfile && currentProfile.role === 'admin' ? '管理员' : '同学') + '</p>' +
    '</div>' +
    '<div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">' +
      '<button onclick="showEditNameModal()" class="glass-card" style="display:flex;align-items:center;gap:12px;padding:14px 16px;border:none;cursor:pointer;text-align:left;color:var(--text);width:100%">✏️ <span>修改昵称</span></button>' +
      '<a href="#/my-posts" class="glass-card" style="display:flex;align-items:center;gap:12px;padding:14px 16px;text-decoration:none;color:var(--text)">📝 <span>我的帖子</span></a>' +
      '<a href="#/history" class="glass-card" style="display:flex;align-items:center;gap:12px;padding:14px 16px;text-decoration:none;color:var(--text)">🕐 <span>浏览记录</span></a>' +
      '<a href="#/chat" class="glass-card" style="display:flex;align-items:center;gap:12px;padding:14px 16px;text-decoration:none;color:var(--text)">💬 <span>私信</span></a>' +
      (currentProfile && currentProfile.role === 'admin' ? '<a href="#/admin" class="glass-card" style="display:flex;align-items:center;gap:12px;padding:14px 16px;text-decoration:none;color:var(--text)">⚙️ <span>管理后台</span></a>' : '') +
      '<button onclick="logoutUser()" class="btn-outline" style="justify-content:center;margin-top:8px;border-color:rgba(239,68,68,0.3);color:#ef4444">🚪 退出登录</button>' +
    '</div>' +
    '</div>';
}

// ===== 我的帖子 =====
async function renderMyPosts() {
  if (!currentUser) { showToast('请先登录'); openAuthModal('login'); return; }
  var main = document.getElementById('mainContent');
  main.innerHTML = '<div class="container" style="padding-top:12px"><h2 style="font-size:1.1rem;font-weight:700;margin-bottom:12px">📝 我的帖子</h2><div id="postList">' + skeletonCards(3) + '</div></div>';
  try {
    var res = await apiGet('posts?user=' + currentUser.id);
    var posts = res.data || [];
    var list = document.getElementById('postList');
    if (posts.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-text">还没有发过帖子</div><div class="empty-sub">去发布你的第一条内容吧</div></div>';
      return;
    }
    list.innerHTML = posts.map(function(p) { return renderPostCard(p); }).join('');
  } catch(e) {
    document.getElementById('postList').innerHTML = '<div class="empty-state"><div class="empty-text">加载失败</div></div>';
  }
}

// ===== 浏览记录 =====
function renderHistory() {
  if (!currentUser) { showToast('请先登录'); openAuthModal('login'); return; }
  var hist = useModule('history');
  var items = hist.getAll();
  var main = document.getElementById('mainContent');
  main.innerHTML = '<div class="container" style="padding-top:12px">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
      '<h2 style="font-size:1.1rem;font-weight:700">🕐 浏览记录</h2>' +
      (items.length ? '<button class="btn-outline" onclick="clearHistory()" style="padding:4px 12px;font-size:0.78rem">清空</button>' : '') +
    '</div>' +
    '<div id="historyList"></div></div>';

  var list = document.getElementById('historyList');
  if (items.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-text">还没有浏览记录</div><div class="empty-sub">去看看大家在聊什么</div></div>';
    return;
  }
  list.innerHTML = items.map(function(i) {
    return '<div class="glass-card" style="padding:12px 16px;margin-bottom:8px;cursor:pointer" onclick="router.navigate(\'#/post/' + i.id + '\')">' +
      '<div style="font-weight:600;font-size:0.9rem;margin-bottom:4px">' + escapeHtml(i.title) + '</div>' +
      '<div style="font-size:0.78rem;color:var(--text-light)">' + getBoardName(i.board_slug) + ' · ' + formatTime(i.time) + '</div>' +
    '</div>';
  }).join('');
}

function clearHistory() {
  var hist = useModule('history');
  hist.clear();
  renderHistory();
  showToast('浏览记录已清空');
}
window.clearHistory = clearHistory;

// ===== 修改昵称 =====
function showEditNameModal() {
  var curName = currentProfile ? currentProfile.display_name : '';
  var html = '<div style="display:flex;flex-direction:column;gap:12px">' +
    '<input type="text" id="editNameInput" class="modal-input" placeholder="输入新昵称" value="' + escapeHtml(curName) + '" maxlength="20">' +
    '<button class="btn-primary" onclick="submitEditName()" style="justify-content:center">保存</button>' +
    '</div>';
  showCustomModal('修改昵称', html);
  setTimeout(function() { var inp = document.getElementById('editNameInput'); if (inp) inp.focus(); }, 100);
}
async function submitEditName() {
  var inp = document.getElementById('editNameInput');
  if (!inp || !inp.value.trim()) { showToast('昵称不能为空'); return; }
  var name = inp.value.trim();
  try {
    await apiPost('profiles/upsert', { display_name: name });
    if (currentProfile) currentProfile.display_name = name;
    showToast('昵称已更新');
    closeCustomModal();
    renderProfile();
  } catch(e) {
    showToast('修改失败，请重试');
  }
}
window.showEditNameModal = showEditNameModal;
window.submitEditName = submitEditName;

// ===== 上传头像 =====
async function uploadAvatar(file) {
  if (!file || !currentUser) return;
  if (file.size > 10 * 1024 * 1024) { showToast('头像不能超过 10MB'); return; }
  showToast('上传中...');
  try {
    // Convert file to base64
    var base64 = await fileToBase64(file);
    var res = await apiPost('avatar/upload', { image: base64, mime_type: file.type });
    if (res.data && res.data.url) {
      if (currentProfile) currentProfile.avatar_url = res.data.url;
      showToast('头像已更新');
      renderProfile();
    } else {
      showToast('上传失败：' + JSON.stringify(res.error));
    }
  } catch(e) {
    showToast('上传失败，请重试');
    console.error('Avatar upload error:', e);
  }
}
function fileToBase64(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() { resolve(reader.result); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
window.uploadAvatar = uploadAvatar;

// ===== 搜索 =====
function renderSearch(q) {
  var main = document.getElementById('mainContent');
  main.innerHTML = '<div class="container" style="padding-top:12px"><h2 style="font-size:1.1rem;font-weight:700;margin-bottom:12px">🔍 搜索: ' + escapeHtml(q) + '</h2><div id="postList">' + skeletonCards(3) + '</div></div>';
}

// ===== 管理后台占位 =====
function renderAdmin() {
  if (!currentUser || !currentProfile || currentProfile.role !== 'admin') {
    showToast('无管理员权限');
    router.navigate('#/');
    return;
  }
  window.open('admin.html', '_blank');
  router.navigate('#/');
}

// ===== 全局搜索 =====
window.searchPosts = function() {
  var q = document.getElementById('searchInput');
  if (q && q.value.trim()) {
    router.navigate('#/search/' + encodeURIComponent(q.value.trim()));
  }
};

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeAuthModal();
});
