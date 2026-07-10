// ===== 深色模式模块 =====
defineModule('darkmode', (function() {
  var STORAGE_KEY = 'zz_dark_mode';

  function init() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'true' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme', 'dark');
      return true;
    }
    return false;
  }

  function toggle() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem(STORAGE_KEY, 'false');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    return !isDark;
  }

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  return { init: init, toggle: toggle, isDark: isDark };
})());

// ===== 草稿自动保存模块 =====
defineModule('draft', (function() {
  var KEY = 'zz_post_draft';

  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify({ data: data, at: Date.now() })); } catch(e) {}
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed.data || null;
    } catch(e) { return null; }
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch(e) {}
  }

  return { save: save, load: load, clear: clear };
})());

// ===== 浏览记录模块 =====
defineModule('history', (function() {
  var KEY = 'zz_view_history';
  var MAX = 50;

  function add(postId, post) {
    try {
      var list = getAll();
      list = list.filter(function(i) { return i.id !== postId; });
      list.unshift({ id: postId, title: post.title || '', board_slug: post.board_slug || '', time: Date.now() });
      if (list.length > MAX) list = list.slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch(e) {}
  }

  function getAll() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch(e) {}
  }

  return { add: add, getAll: getAll, clear: clear };
})());

// ===== 黑名单模块 =====
defineModule('block', (function() {
  var KEY = 'zz_blocked_users';

  function getBlocked() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function isBlocked(userId) {
    return getBlocked().indexOf(userId) > -1;
  }

  function toggle(userId) {
    var list = getBlocked();
    var idx = list.indexOf(userId);
    if (idx > -1) { list.splice(idx, 1); }
    else { list.push(userId); }
    localStorage.setItem(KEY, JSON.stringify(list));
    return list.indexOf(userId) > -1;
  }

  return { getBlocked: getBlocked, isBlocked: isBlocked, toggle: toggle };
})());
