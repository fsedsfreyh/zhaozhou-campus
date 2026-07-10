// ===== 哈希路由 =====
window.router = {
  _routes: {},
  _current: '',
  register: function(path, handler) { this._routes[path] = handler; },
  navigate: function(hash) {
    if (!hash.startsWith('#')) hash = '#' + hash;
    if (this._current === hash) return;
    this._current = hash;
    history.replaceState(null, '', hash);
    this._resolve(hash);
  },
  _resolve: function(hash) {
    hash = hash || location.hash || '#/';
    // 精确匹配
    if (this._routes[hash]) { this._routes[hash]({}); return; }
    // 参数匹配 #/board/:slug, #/post/:id
    for (var p in this._routes) {
      var parts = p.split('/');
      var hashParts = hash.split('/');
      if (parts.length !== hashParts.length) continue;
      var params = {};
      var match = true;
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].startsWith(':')) { params[parts[i].slice(1)] = hashParts[i]; }
        else if (parts[i] !== hashParts[i]) { match = false; break; }
      }
      if (match) { this._routes[p](params); return; }
    }
    // 默认回首页
    if (hash !== '#/') this.navigate('#/');
  },
  init: function() {
    var self = this;
    window.addEventListener('popstate', function() { self._resolve(location.hash); });
    this._resolve(location.hash);
  }
};
