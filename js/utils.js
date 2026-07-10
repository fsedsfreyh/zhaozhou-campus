// ===== 模块加载器 =====
var MODULES = {};

/** 注册模块 */
function defineModule(name, fn) { MODULES[name] = fn; }

/** 获取模块 */
function useModule(name) { return MODULES[name]; }

// ===== Toast 提示 =====
function showToast(msg, duration) {
  duration = duration || 2500;
  var el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  var container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  container.appendChild(el);
  setTimeout(function() { el.style.opacity = '0'; setTimeout(function() { el.remove(); }, 300); }, duration);
}

/** 获得板块颜色 */
function getBoardColor(slug) {
  var colors = { confession: 'var(--confession)', gossip: 'var(--gossip)', lost: 'var(--lost)', announcement: 'var(--primary)' };
  return colors[slug] || 'var(--primary)';
}

function getBoardName(slug) {
  var names = { announcement: '公告栏', confession: '表白墙', gossip: '八卦墙', lost: '失物招领' };
  return names[slug] || slug;
}

function getBoardIcon(slug) {
  var icons = { announcement: '📢', confession: '💌', gossip: '🫢', lost: '🔍' };
  return icons[slug] || '📋';
}

/** 格式化时间 */
function formatTime(t) {
  if (!t) return '';
  var d = new Date(t);
  var now = new Date();
  var diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
  return d.toLocaleDateString('zh-CN');
}

function formatTimeFull(t) {
  if (!t) return '';
  var d = new Date(t);
  return d.toLocaleString('zh-CN');
}

/** 压缩图片 */
function compressImage(file, maxW, quality) {
  maxW = maxW || 1200;
  quality = quality || 0.7;
  return new Promise(function(resolve) {
    if (!file.type.startsWith('image/')) { resolve(file); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var w = img.width, h = img.height;
        if (w > maxW) { h = h * maxW / w; w = maxW; }
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(function(blob) {
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        }, 'image/jpeg', quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/** 图片懒加载 */
function lazyLoadImages(container) {
  if (!container) container = document;
  var imgs = container.querySelectorAll('img[data-src]');
  if (!imgs.length) return;
  if ('IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) {
          var img = e.target;
          img.src = img.dataset.src;
          img.onerror = function() { img.classList.add('error'); img.src = ''; img.innerHTML = '📷'; };
          obs.unobserve(img);
        }
      });
    }, { rootMargin: '200px' });
    imgs.forEach(function(img) { obs.observe(img); });
  } else {
    imgs.forEach(function(img) { img.src = img.dataset.src; });
  }
}

/** 检查违禁词 */
var bannedWordsCache = [];
async function loadBannedWords() {
  try {
    var res = await apiGet('banned-words');
    bannedWordsCache = (res.data || []).map(function(w) { return w.word; });
  } catch(e) { bannedWordsCache = []; }
}
function containsBannedWords(text) {
  if (!text || !bannedWordsCache.length) return false;
  var t = text.toLowerCase();
  for (var i = 0; i < bannedWordsCache.length; i++) {
    if (t.indexOf(bannedWordsCache[i].toLowerCase()) > -1) return true;
  }
  return false;
}

/** 骨架屏生成 */
function skeletonCards(count) {
  var html = '';
  for (var i = 0; i < count; i++) {
    html += '<div class="post-card skeleton"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line" style="width:60%"></div><div class="skeleton-block" style="margin-top:10px"></div></div>';
  }
  return html;
}
