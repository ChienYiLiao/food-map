/**
 * utils.js — 前端工具函式
 */

const Utils = {
  /**
   * 格式化日期
   * @param {string} dateStr - YYYY-MM-DD
   * @param {'short'|'medium'|'long'} format
   */
  formatDate(dateStr, format = 'medium') {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const weekdays = ['日','一','二','三','四','五','六'];
    const wd = weekdays[date.getDay()];
    if (format === 'short') return `${m}/${d}`;
    if (format === 'long')  return `${y} 年 ${m} 月 ${d} 日（${wd}）`;
    return `${m}/${d}（${wd}）`;
  },

  /**
   * 今天的 YYYY-MM-DD
   */
  today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  /**
   * 截斷字串
   */
  truncate(str, maxLen = 20) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '…' : str;
  },

  /**
   * 防抖
   */
  debounce(fn, delay = 300) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * 圖片壓縮（Canvas resize）
   */
  compressImage(file, maxPx = 1200, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > maxPx || h > maxPx) {
            if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
            else       { w = Math.round(w * maxPx / h); h = maxPx; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          const base64 = dataUrl.split(',')[1];
          resolve({ base64, mimeType: 'image/jpeg', dataUrl });
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /**
   * 渲染星星（靜態顯示）
   * @param {number} value - 1~5，支援小數
   * @param {boolean} small
   */
  renderStars(value, small = false) {
    const full  = Math.floor(value);
    const half  = value - full >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);
    let html = '';
    for (let i = 0; i < full;  i++) html += '⭐';
    if (half) html += '✨';
    for (let i = 0; i < empty; i++) html += '☆';
    return html;
  },

  /**
   * 計算兩點距離（Haversine，公尺）
   */
  calcDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 +
              Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
              Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  },

  /**
   * 格式化距離
   */
  formatDistance(meters) {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  },

  /**
   * 陣列分塊
   */
  chunk(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  },

  /**
   * 格式化平均評分
   */
  formatRating(rating) {
    if (!rating || rating === 0) return '—';
    return Number(rating).toFixed(1);
  },

  /**
   * 安全解析 JSON
   */
  safeJsonParse(str, fallback = null) {
    try { return JSON.parse(str); } catch(_) { return fallback; }
  }
};
