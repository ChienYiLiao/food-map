/**
 * loader.js — 全域 Loading 遮罩
 */

const Loader = (() => {
  let _el;
  let _count = 0;

  function _getEl() {
    if (!_el) _el = document.getElementById('loader-overlay');
    return _el;
  }

  function show(text = '載入中...') {
    _count++;
    const el = _getEl();
    if (!el) return;
    const textEl = el.querySelector('.loader-text') || document.getElementById('loader-text');
    if (textEl) textEl.textContent = text;
    el.classList.add('active');
  }

  function hide() {
    _count = Math.max(0, _count - 1);
    if (_count === 0) {
      const el = _getEl();
      if (el) el.classList.remove('active');
    }
  }

  function forceHide() {
    _count = 0;
    const el = _getEl();
    if (el) el.classList.remove('active');
  }

  return { show, hide, forceHide };
})();
