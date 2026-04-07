/**
 * router.js — Hash-based 前端路由
 */

const Router = (() => {
  const _routes = {};
  let _current = null;

  const PAGE_TITLES = {
    map:      '美食地圖',
    history:  '用餐紀錄',
    random:   '幸運抽選',
    settings: '設定'
  };

  function register(hash, { onEnter, onLeave }) {
    _routes[hash] = { onEnter, onLeave };
  }

  function navigate(hash, replace = false) {
    if (replace) {
      window.location.replace(`#${hash}`);
    } else {
      window.location.hash = hash;
    }
  }

  // 直接切換頁面，不依賴 hashchange 事件（iOS Safari standalone 相容）
  function go(hash) {
    window.history.pushState(null, '', '#' + hash);
    _handleRouteChange();
  }

  function _getHash() {
    return window.location.hash.replace('#', '') || 'map';
  }

  function _handleRouteChange() {
    const hash = _getHash();
    if (hash === _current) return;

    // 1. 離開目前頁面
    if (_current && _routes[_current]?.onLeave) {
      _routes[_current].onLeave();
    }

    // 2. 隱藏所有頁面
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    // 3. 非地圖頁面：main-content 可滾動；地圖頁：背景透明
    const mainContent = document.getElementById('main-content');
    const mapOverlay  = document.getElementById('map-overlay-ui');
    if (hash === 'map') {
      if (mainContent) mainContent.classList.add('map-active');
      if (mapOverlay)  mapOverlay.style.display = '';
    } else {
      if (mainContent) mainContent.classList.remove('map-active');
      if (mapOverlay)  mapOverlay.style.display = 'none';
      // 非地圖頁回頂
      if (mainContent) mainContent.scrollTop = 0;
      // 強制確保地圖容器隱藏（防止 _initMap async race condition 讓地圖蓋住其他頁面）
      const mapContainer = document.getElementById('map-container');
      if (mapContainer) mapContainer.style.visibility = 'hidden';
    }

    // 4. 顯示目標頁面
    const pageEl = document.getElementById(`page-${hash}`);
    if (pageEl) pageEl.classList.add('active');

    _current = hash;
    State.setState({ currentPage: hash });

    // 5. 進入新頁面
    if (_routes[hash]?.onEnter) {
      _routes[hash].onEnter();
    }

    _updateNavbar(hash);
    _updateTopbar(hash);
  }

  function _updateNavbar(hash) {
    document.querySelectorAll('.navbar-item').forEach(el => {
      el.classList.toggle('active', el.dataset.route === hash);
    });
  }

  function _updateTopbar(hash) {
    const titleEl = document.getElementById('topbar-title');
    const rightEl = document.getElementById('topbar-right');
    if (titleEl) titleEl.textContent = PAGE_TITLES[hash] || '美食地圖';
    if (rightEl) rightEl.innerHTML = ''; // 各頁面自行填入右上角按鈕
  }

  function init() {
    window.addEventListener('hashchange', _handleRouteChange);
    _handleRouteChange();
  }

  function getCurrent() { return _current; }

  return { register, navigate, go, init, getCurrent };
})();
