// ======== SPA Hash 路由器 ========
const router = {
  currentRoute: null,
  routes: {},
  history: [],

  register(path, handler) {
    this.routes[path] = handler;
  },

  async navigate(hash) {
    if (!hash.startsWith('#')) hash = '#' + hash;
    
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // 记录历史
    if (this.currentRoute) {
      this.history.push(this.currentRoute);
      if (this.history.length > 50) this.history.shift();
    }
    this.currentRoute = hash;
    
    // 更新 URL
    window.location.hash = hash;
    
    // 查找匹配路由
    let matched = false;
    for (const [pattern, handler] of Object.entries(this.routes)) {
      const params = matchRoute(pattern, hash);
      if (params) {
        matched = true;
        await handler(params);
        break;
      }
    }
    
    if (!matched) {
      // 默认路由
      if (this.routes['#/']) {
        await this.routes['#/']({});
      }
    }
  },

  back() {
    if (this.history.length > 0) {
      const prev = this.history.pop();
      this.currentRoute = prev;
      this.navigate(prev);
    } else {
      this.navigate('#/');
    }
  },

  start() {
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash || '#/';
      this.navigate(hash);
    });
    
    const initialHash = window.location.hash || '#/';
    this.navigate(initialHash);
  }
};

// 路由匹配（支持 :param 和 * 通配符）
function matchRoute(pattern, hash) {
  if (pattern === hash) return {};
  
  const patternParts = pattern.split('/');
  const hashParts = hash.split('/');
  
  if (patternParts.length !== hashParts.length) return null;
  
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(hashParts[i] || '');
    } else if (patternParts[i] !== hashParts[i]) {
      return null;
    }
  }
  
  return params;
}
