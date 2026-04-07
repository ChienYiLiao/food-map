/**
 * history.js — 用餐紀錄列表頁
 */

const HistoryPage = (() => {
  let _reviews  = [];
  let _restaurants = [];
  let _filterUserId = 'all';

  function show() {
    _render();
    _loadData();
    const rightEl = document.getElementById('topbar-right');
    if (rightEl) rightEl.innerHTML = '';
  }

  function hide() {}

  async function _loadData() {
    const page = document.getElementById('page-history');
    if (!page) return;

    try {
      // 評價（全部，不限 userId）
      const data = await API.getReviews({ limit: 200 });
      _reviews = data?.reviews || [];

      // 餐廳資料（從快取）
      _restaurants = State.getState().restaurantsCache || [];
      if (_restaurants.length === 0) {
        const rData = await API.getRestaurants({});
        _restaurants = rData?.restaurants || [];
        State.setRestaurantsCache(_restaurants);
      }

      _renderList();
    } catch(e) {
      page.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-title">載入失敗</div>
          <div class="empty-state-desc">${e.message}</div>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="HistoryPage.reload()">重試</button>
        </div>`;
    }
  }

  function _render() {
    const page = document.getElementById('page-history');
    if (!page) return;
    const user = State.getState().currentUser;
    const userEmoji = CONFIG.USERS[user?.userId]?.emoji || '👤';
    const otherUserId = user?.userId === 'user_pigpig' ? 'user_gungun' : 'user_pigpig';
    const otherEmoji = CONFIG.USERS[otherUserId]?.emoji || '👤';

    page.innerHTML = `
      <!-- 篩選列 -->
      <div class="toggle-group" style="margin-bottom:16px;">
        <button class="toggle-btn ${_filterUserId==='all'?'active':''}"
                onclick="HistoryPage._setFilter('all')">全部</button>
        <button class="toggle-btn ${_filterUserId===user?.userId?'active':''}"
                onclick="HistoryPage._setFilter('${user?.userId}')">
          ${userEmoji} 我的
        </button>
        <button class="toggle-btn ${_filterUserId===otherUserId?'active':''}"
                onclick="HistoryPage._setFilter('${otherUserId}')">
          ${otherEmoji} TA的
        </button>
      </div>
      <!-- 列表 -->
      <div id="history-list">
        <div class="empty-state">
          <div class="loader-spinner" style="margin:0 auto;"></div>
          <div class="empty-state-desc" style="margin-top:12px;">載入中...</div>
        </div>
      </div>
    `;
  }

  function _renderList() {
    const container = document.getElementById('history-list');
    if (!container) return;

    let filtered = _reviews;
    if (_filterUserId !== 'all') {
      filtered = _reviews.filter(r => r.user_id === _filterUserId);
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🍽️</div>
          <div class="empty-state-title">還沒有用餐紀錄</div>
          <div class="empty-state-desc">快去地圖頁選一家餐廳吃飯吧！</div>
        </div>`;
      return;
    }

    // 建立 restaurant lookup
    const rstMap = {};
    _restaurants.forEach(r => { rstMap[r.restaurant_id] = r; });

    // 依日期分組
    const groups = {};
    filtered.forEach(review => {
      const date = review.visited_date || '未知';
      if (!groups[date]) groups[date] = [];
      groups[date].push(review);
    });
    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    const html = sortedDates.map(date => {
      const dayReviews = groups[date];
      const reviewItems = dayReviews.map(review => {
        const rst = rstMap[review.restaurant_id] || {};
        const user = CONFIG.USERS[review.user_id];
        const emoji = CONFIG.getCategoryEmoji(rst.category);
        const mealType = CONFIG.MEAL_TYPES.find(m => m.key === review.meal_type);
        const starsHtml = '⭐'.repeat(Number(review.overall_rating) || 0);
        const scores = Utils.safeJsonParse(review.scores_json) || {};
        const topScore = Object.entries(scores)[0];

        return `
          <div class="restaurant-item" onclick="HistoryPage._openRestaurant('${rst.place_id}')">
            <div class="restaurant-icon">${emoji}</div>
            <div class="restaurant-info">
              <div class="restaurant-name">${Utils.truncate(rst.name || review.restaurant_id, 16)}</div>
              <div class="restaurant-meta">
                ${user?.emoji || '👤'}
                ${mealType ? mealType.emoji : ''}
                ${rst.category ? `・${rst.category}` : ''}
                ${topScore ? `・${topScore[0]} ${'⭐'.repeat(topScore[1])}` : ''}
              </div>
            </div>
            <div class="restaurant-right">
              <div class="restaurant-stars">${starsHtml}</div>
              ${review.note ? `<div class="restaurant-count" style="max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${review.note}</div>` : ''}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="date-group-header" style="padding:8px 2px 4px;">
          <div style="font-size:12px;font-weight:700;color:var(--color-text-muted);">
            ${Utils.formatDate(date, 'long')}
          </div>
        </div>
        ${reviewItems}
      `;
    }).join('');

    container.innerHTML = `<div class="txn-list">${html}</div>`;
  }

  function _setFilter(userId) {
    _filterUserId = userId;
    // 重新渲染頁面（保留已載入的資料）
    _render();
    if (_reviews.length > 0) _renderList();
    else _loadData();
  }

  async function _openRestaurant(placeId) {
    if (!placeId) return;
    const rst = (_restaurants || []).find(r => r.place_id === placeId);
    if (rst) RestaurantDetail.show(rst);
  }

  function reload() {
    _render();
    _loadData();
  }

  // 公開 _setFilter 和 _openRestaurant（inline onclick）
  return { show, hide, reload, _setFilter, _openRestaurant };
})();

window.HistoryPage = HistoryPage;
