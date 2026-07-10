// 独立路由器文件（文件名唯一，浏览器不会缓存旧版本）
window.router = {
  _routes: {},
  register: function(p, h) { this._routes[p] = h; },
  navigate: function(h) { if (!h.startsWith('#')) h = '#' + h; history.replaceState(null, '', h); this._resolve(h); },
  start: function() { this._resolve(location.hash || '#/'); var self = this; window.addEventListener('hashchange', function() { self._resolve(location.hash); }); },
  _resolve: function(hash) {
    document.querySelectorAll('.page-container').forEach(function(e) { e.classList.remove('active'); });
    if (this._routes[hash]) { this._routes[hash]({}).catch(function(e) { console.error('Route error:', e.message); }); return; }
    for (var p in this._routes) {
      if (!p.includes(':')) continue;
      var ps = p.split('/'), hs = hash.split('/');
      if (ps.length !== hs.length) continue;
      var params = {}, match = true;
      for (var i = 0; i < ps.length; i++) {
        if (ps[i].startsWith(':')) { params[ps[i].slice(1)] = decodeURIComponent(hs[i]); }
        else if (ps[i] !== hs[i]) { match = false; break; }
      }
      if (match) { this._routes[p](params).catch(function(e) { console.error('Route error:', e.message); }); return; }
    }
    console.log('No route matched:', hash);
  }
};
