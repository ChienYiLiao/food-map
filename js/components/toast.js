/**
 * toast.js — Toast 通知
 */

const Toast = (() => {
  let _container;

  function _getContainer() {
    if (!_container) {
      _container = document.getElementById('toast-container');
      if (!_container) {
        _container = document.createElement('div');
        _container.id = 'toast-container';
        document.body.appendChild(_container);
      }
    }
    return _container;
  }

  function show(message, type = 'default', duration = 2500) {
    const container = _getContainer();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  return {
    success: (msg, dur) => show(msg, 'success', dur),
    error:   (msg, dur) => show(msg, 'error',   dur),
    info:    (msg, dur) => show(msg, 'info',     dur),
    warn:    (msg, dur) => show(msg, 'info',     dur),
    show
  };
})();
