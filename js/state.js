/**
 * state.js — 全域狀態管理
 */

const State = (() => {
  let _state = {
    currentUser: null,           // { userId, displayName, avatarUrl }
    currentPage: 'map',
    isLoading: false,
    // 地圖狀態
    mapCenter: null,             // { lat, lng }
    mapRadius: CONFIG.DEFAULT_RADIUS,
    mapFilter: {
      categories: [],            // 空陣列 = 全部顯示
      onlyVisited: false,
      onlyUnvisited: false
    },
    // 餐廳快取（來自 GAS + Places API 合併）
    restaurantsCache: null,      // Restaurant[] | null（null = 未載入）
    restaurantsCachedAt: null,   // timestamp (ms)
    // 評價快取 { [restaurant_id]: Review[] }
    reviewsCache: {}
  };

  const _listeners = [];

  function getState() { return _state; }

  function setState(patch) {
    _state = { ..._state, ...patch };
    _listeners.forEach(fn => fn(_state));
  }

  function subscribe(fn) {
    _listeners.push(fn);
    return () => {
      const idx = _listeners.indexOf(fn);
      if (idx >= 0) _listeners.splice(idx, 1);
    };
  }

  // ── 使用者持久化 ────────────────────────────────────────────────────────────
  function saveUser(user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
    setState({ currentUser: user });
  }

  function loadUser() {
    try {
      const saved = localStorage.getItem('currentUser');
      if (saved) {
        const user = JSON.parse(saved);
        setState({ currentUser: user });
        return user;
      }
    } catch(_) {}
    return null;
  }

  function clearUser() {
    localStorage.removeItem('currentUser');
    setState({ currentUser: null });
  }

  // ── Avatar 快取 ─────────────────────────────────────────────────────────────
  function saveAvatarCache(userId, url) {
    localStorage.setItem(`avatar_${userId}`, url);
  }

  function getAvatarCache(userId) {
    return localStorage.getItem(`avatar_${userId}`) || null;
  }

  // ── 餐廳快取 ────────────────────────────────────────────────────────────────
  function invalidateRestaurantsCache() {
    setState({ restaurantsCache: null, restaurantsCachedAt: null });
  }

  function setRestaurantsCache(restaurants) {
    setState({ restaurantsCache: restaurants, restaurantsCachedAt: Date.now() });
  }

  function isRestaurantsCacheValid(maxAgeMs = 5 * 60 * 1000) {
    const { restaurantsCache, restaurantsCachedAt } = _state;
    if (!restaurantsCache || !restaurantsCachedAt) return false;
    return (Date.now() - restaurantsCachedAt) < maxAgeMs;
  }

  // 更新單一餐廳的 isOpen 狀態
  function updateRestaurantOpenStatus(placeId, status) {
    const cache = _state.restaurantsCache;
    if (!cache) return;
    const updated = cache.map(r =>
      r.place_id === placeId ? { ...r, ...status } : r
    );
    setState({ restaurantsCache: updated });
  }

  // 更新單一餐廳資料（分類完成後更新）
  function updateRestaurant(restaurantId, patch) {
    const cache = _state.restaurantsCache;
    if (!cache) return;
    const updated = cache.map(r =>
      r.restaurant_id === restaurantId ? { ...r, ...patch } : r
    );
    setState({ restaurantsCache: updated });
  }

  // ── 評價快取 ────────────────────────────────────────────────────────────────
  function cacheReviews(restaurantId, reviews) {
    setState({
      reviewsCache: { ..._state.reviewsCache, [restaurantId]: reviews }
    });
  }

  function getCachedReviews(restaurantId) {
    return _state.reviewsCache[restaurantId] || null;
  }

  function invalidateReviewsCache(restaurantId) {
    if (restaurantId) {
      const cache = { ..._state.reviewsCache };
      delete cache[restaurantId];
      setState({ reviewsCache: cache });
    } else {
      setState({ reviewsCache: {} });
    }
  }

  return {
    getState,
    setState,
    subscribe,
    saveUser,
    loadUser,
    clearUser,
    saveAvatarCache,
    getAvatarCache,
    invalidateRestaurantsCache,
    setRestaurantsCache,
    isRestaurantsCacheValid,
    updateRestaurantOpenStatus,
    updateRestaurant,
    cacheReviews,
    getCachedReviews,
    invalidateReviewsCache
  };
})();
