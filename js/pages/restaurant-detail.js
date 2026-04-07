/**
 * restaurant-detail.js — 餐廳詳情 Bottom Sheet
 * 顯示：基本資訊 / 用餐紀錄 / 新增評價
 */

const RestaurantDetail = (() => {
  let _current = null;          // 目前顯示的餐廳
  let _reviews = [];            // 該餐廳的評價列表
  let _activeTab = 'info';      // 'info' | 'reviews' | 'add-review'
  let _prevMenuItems = [];      // 上次評價的品項（作為快速新增參考）
  let _reviewForm = {           // 新增評價表單資料
    overall: 0,
    scores: {},
    note: '',
    visitedDate: Utils.today(),
    mealType: CONFIG.getMealTypeByHour(),
    items: []
  };

  // ── 公開：顯示餐廳詳情 ─────────────────────────────────────────────────────
  function show(restaurant) {
    _current = restaurant;
    _activeTab = 'info';
    _prevMenuItems = [];
    _reviewForm = {
      overall: 0,
      scores: {},
      note: '',
      visitedDate: Utils.today(),
      mealType: CONFIG.getMealTypeByHour(),
      items: []
    };
    _loadAndRender();
    Modal.show('restaurant-sheet-overlay');
  }

  function hide() {
    Modal.hide('restaurant-sheet-overlay');
    _current = null;
  }

  // ── 載入評價並渲染 ─────────────────────────────────────────────────────────
  async function _loadAndRender() {
    _render(); // 先渲染骨架

    if (!_current.restaurant_id) {
      // 新餐廳，尚未在 GAS 存在，直接渲染（無評價）
      _reviews = [];
      _render();
      return;
    }

    // 從快取或 API 取得評價
    const cached = State.getCachedReviews(_current.restaurant_id);
    if (cached) {
      _reviews = cached;
    } else {
      try {
        const data = await API.getReviews({ restaurantId: _current.restaurant_id });
        _reviews = data?.reviews || [];
        State.cacheReviews(_current.restaurant_id, _reviews);
      } catch(e) {
        _reviews = [];
      }
    }

    // 從最近一筆評價中提取品項，作為快速新增參考
    _prevMenuItems = [];
    if (_reviews.length > 0) {
      const latestReview = _reviews[0]; // 已按 visited_date 倒序排列
      if (latestReview.items_json) {
        const parsed = Utils.safeJsonParse(latestReview.items_json);
        if (Array.isArray(parsed) && parsed.length > 0) {
          _prevMenuItems = parsed;
        }
      }
    }

    _render();
  }

  // ── 主渲染 ──────────────────────────────────────────────────────────────────
  function _render() {
    const sheet = document.getElementById('restaurant-sheet-content');
    if (!sheet || !_current) return;

    const r = _current;
    const categoryEmoji = CONFIG.getCategoryEmoji(r.category);
    const isOpen = r.isOpen === true;
    const isOpenStr = r.isOpen === null ? '' :
                      (isOpen ? '<span class="badge badge-open">營業中</span>' :
                                '<span class="badge badge-closed">休息中</span>');
    const visitedBadge = r.visit_count > 0
      ? `<span class="badge badge-visited">已吃過 ${r.visit_count} 次</span>`
      : `<span class="badge badge-unvisited">未吃過</span>`;
    const ratingStr = r.avg_rating > 0
      ? `⭐ ${Utils.formatRating(r.avg_rating)}`
      : '';

    sheet.innerHTML = `
      <div class="modal-handle"></div>

      <!-- 餐廳基本資訊 -->
      <div class="restaurant-sheet-header">
        <div class="restaurant-sheet-icon">${categoryEmoji}</div>
        <div style="flex:1;min-width:0;">
          <div class="restaurant-sheet-name">${Utils.truncate(r.name, 18)}</div>
          <div class="restaurant-sheet-meta">
            ${isOpenStr}
            ${visitedBadge}
            ${r.category ? `<span class="category-chip">${r.category}</span>` : ''}
            ${ratingStr ? `<span style="font-size:13px;color:var(--color-star);font-weight:700;">${ratingStr}</span>` : ''}
          </div>
        </div>
        <button onclick="RestaurantDetail.hide()"
                style="align-self:flex-start;color:var(--color-text-muted);font-size:20px;padding:4px;">✕</button>
      </div>

      ${r.address ? `<div class="restaurant-sheet-address">📍 ${r.address}</div>` : ''}

      ${(r.lat && r.lng) ? `
      <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}&travelmode=driving','_blank')"
              style="width:100%;padding:10px;margin-bottom:8px;background:rgba(74,144,217,0.15);
                     border:1px solid rgba(74,144,217,0.4);border-radius:var(--radius-md);
                     color:#4A90D9;font-weight:600;font-size:14px;">
        🗺️ Google Maps 導航
      </button>` : ''}

      <!-- 分頁 -->
      <div class="tab-group" style="margin-top:4px;">
        <button class="tab-btn ${_activeTab==='info'?'active':''}"
                onclick="RestaurantDetail._setTab('info')">資訊</button>
        <button class="tab-btn ${_activeTab==='reviews'?'active':''}"
                onclick="RestaurantDetail._setTab('reviews')">
          評價 ${_reviews.length > 0 ? `(${_reviews.length})` : ''}
        </button>
        <button class="tab-btn ${_activeTab==='add-review'?'active':''}"
                onclick="RestaurantDetail._setTab('add-review')">新增評價</button>
      </div>

      <!-- 分頁內容 -->
      <div id="detail-tab-content"></div>
    `;

    _renderTabContent();
  }

  function _setTab(tab) {
    _activeTab = tab;
    _render();
  }

  function _renderTabContent() {
    const container = document.getElementById('detail-tab-content');
    if (!container) return;
    if (_activeTab === 'info')       _renderInfoTab(container);
    else if (_activeTab === 'reviews') _renderReviewsTab(container);
    else if (_activeTab === 'add-review') _renderAddReviewTab(container);
  }

  // ── 資訊分頁 ──────────────────────────────────────────────────────────────
  function _renderInfoTab(container) {
    const r = _current;
    const openingText = _getOpeningHoursText(r.opening_hours);
    const priceMap = {
      'PRICE_LEVEL_FREE': '免費',
      'PRICE_LEVEL_INEXPENSIVE': '$',
      'PRICE_LEVEL_MODERATE': '$$',
      'PRICE_LEVEL_EXPENSIVE': '$$$',
      'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$'
    };
    const priceStr = priceMap[r.price_level] || '';

    container.innerHTML = `
      <div style="padding:8px 0;display:flex;flex-direction:column;gap:8px;">
        ${openingText ? `
          <div class="settings-item" style="gap:8px;">
            <span style="font-size:18px;">🕐</span>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:600;">營業時間</div>
              <div style="font-size:12px;color:var(--color-text-muted);margin-top:2px;">${openingText}</div>
            </div>
          </div>` : ''}
        ${priceStr ? `
          <div class="settings-item" style="gap:8px;">
            <span style="font-size:18px;">💰</span>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:600;">價位</div>
              <div style="font-size:13px;color:var(--color-primary-light);margin-top:2px;">${priceStr}</div>
            </div>
          </div>` : ''}
        ${r.phone ? `
          <div class="settings-item" style="gap:8px;">
            <span style="font-size:18px;">📞</span>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:600;">電話</div>
              <a href="tel:${r.phone}" style="font-size:13px;color:var(--color-credit-card);margin-top:2px;display:block;">${r.phone}</a>
            </div>
          </div>` : ''}
        ${r.website ? `
          <div class="settings-item" style="gap:8px;">
            <span style="font-size:18px;">🌐</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;">網站</div>
              <a href="${r.website}" target="_blank" style="font-size:12px;color:var(--color-credit-card);word-break:break-all;">${r.website}</a>
            </div>
          </div>` : ''}
        <button class="btn btn-primary btn-block" style="margin-top:8px;"
                onclick="RestaurantDetail._setTab('add-review')">
          ✍️ 新增用餐評價
        </button>
      </div>
    `;
  }

  function _getOpeningHoursText(openingHours) {
    if (!openingHours) return '';
    if (typeof openingHours === 'string') {
      openingHours = Utils.safeJsonParse(openingHours);
    }
    if (!openingHours) return '';
    const weekdayText = openingHours.weekday_text;
    if (weekdayText && Array.isArray(weekdayText)) {
      const today = new Date().getDay();
      const days = ['週日','週一','週二','週三','週四','週五','週六'];
      const todayLine = weekdayText.find(t => t.startsWith(days[today]));
      return todayLine || weekdayText[0] || '';
    }
    return '';
  }

  // ── 評價列表分頁 ───────────────────────────────────────────────────────────
  function _renderReviewsTab(container) {
    if (_reviews.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:32px 0;">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-title">還沒有評價</div>
          <div class="empty-state-desc">快去吃一次然後留下紀錄吧！</div>
          <button class="btn btn-primary" style="margin-top:16px;"
                  onclick="RestaurantDetail._setTab('add-review')">新增評價</button>
        </div>`;
      return;
    }

    const cards = _reviews.map(review => {
      const user = CONFIG.USERS[review.user_id];
      const userEmoji = user?.emoji || '👤';
      const userName = localStorage.getItem(`nickname_${review.user_id}`) || user?.displayName || review.user_id;
      const scores = Utils.safeJsonParse(review.scores_json) || {};
      const scoresHtml = Object.entries(scores)
        .map(([key, val]) => `<span class="visit-score-item">${key} ${'⭐'.repeat(val)}</span>`)
        .join('');
      const mealTypeEmoji = CONFIG.MEAL_TYPES.find(m => m.key === review.meal_type)?.emoji || '';

      // 品項顯示
      let itemsHtml = '';
      if (review.items_json) {
        const items = Utils.safeJsonParse(review.items_json);
        if (Array.isArray(items) && items.length > 0) {
          const chips = items.map(item =>
            `<span class="visit-item-chip">
              ${item.name}${item.price ? ` $${item.price}` : ''}
              ${item.price_changed ? `<span class="price-change-badge">↑漲價</span>` : ''}
            </span>`
          ).join('');
          itemsHtml = `<div class="visit-items">${chips}</div>`;
        }
      }

      return `
        <div class="visit-card">
          <div class="visit-card-header">
            <div class="visit-user">
              <span>${userEmoji}</span>
              <span>${userName}</span>
              ${mealTypeEmoji ? `<span style="font-size:12px;">${mealTypeEmoji}</span>` : ''}
            </div>
            <div class="visit-date">${Utils.formatDate(review.visited_date)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span id="review-stars-${review.review_id}"></span>
            <span style="font-size:13px;color:var(--color-star);font-weight:700;">
              ${review.overall_rating ? `${review.overall_rating}/5` : ''}
            </span>
          </div>
          ${scoresHtml ? `<div class="visit-scores">${scoresHtml}</div>` : ''}
          ${review.note ? `<div class="visit-note">${review.note}</div>` : ''}
          ${itemsHtml}
          <div style="display:flex;justify-content:flex-end;margin-top:8px;gap:8px;">
            <button onclick="RestaurantDetail._deleteReview('${review.review_id}')"
                    style="font-size:12px;color:var(--color-expense);">刪除</button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `<div style="padding:8px 0;">${cards}</div>`;

    // 渲染星星
    _reviews.forEach(review => {
      const starsEl = document.getElementById(`review-stars-${review.review_id}`);
      if (starsEl) {
        StarRating.renderStatic(starsEl, Number(review.overall_rating) || 0);
      }
    });
  }

  // ── 新增評價分頁 ────────────────────────────────────────────────────────────
  function _renderAddReviewTab(container) {
    const r = _current;
    const user = State.getState().currentUser;
    const dimensions = CONFIG.getReviewDimensions(r.category || '其他');

    const mealTypeHtml = CONFIG.MEAL_TYPES.map(mt => `
      <button class="meal-type-btn ${_reviewForm.mealType === mt.key ? 'selected' : ''}"
              onclick="RestaurantDetail._setMealType('${mt.key}')">
        <span class="meal-emoji">${mt.emoji}</span>
        ${mt.label}
      </button>
    `).join('');

    const dimensionsHtml = dimensions.map(dim => `
      <div class="dimension-row">
        <div>
          <div class="dimension-label">
            <span>${dim.emoji}</span>
            <span>${dim.label}</span>
          </div>
          <div class="dimension-desc">${dim.desc}</div>
        </div>
        <div id="dim-stars-${dim.key}"></div>
      </div>
    `).join('');

    // 快速新增 chips（來自上次評價）
    const quickChipsHtml = _prevMenuItems.length > 0 ? `
      <div style="font-size:12px;color:var(--color-text-muted);margin-bottom:6px;">上次點的：</div>
      <div class="menu-quick-chips">
        ${_prevMenuItems.map((item, i) => `
          <button class="menu-quick-chip"
                  onclick="RestaurantDetail._addItemFromPrev('${item.name.replace(/'/g,"\\'")}', ${item.price || 0})">
            <span>${item.name}</span>
            ${item.price ? `<span class="chip-price">$${item.price}</span>` : ''}
          </button>
        `).join('')}
      </div>
    ` : '';

    // 當前品項列表
    const currentItemsHtml = _reviewForm.items.map((item, i) => {
      const prevItem = _prevMenuItems.find(p => p.name === item.name);
      const priceChanged = prevItem && prevItem.price && item.price && Number(item.price) > Number(prevItem.price);
      return `
        <div class="menu-item-row" id="menu-item-row-${i}">
          <input class="menu-item-name-input" type="text"
                 value="${item.name}" placeholder="品項名稱"
                 oninput="RestaurantDetail._updateItemName(${i}, this.value)">
          <input class="menu-item-price-input" type="number"
                 value="${item.price || ''}" placeholder="價格"
                 oninput="RestaurantDetail._updateItemPrice(${i}, this.value)">
          ${priceChanged ? `<span class="price-change-badge">↑漲價</span>` : ''}
          <button class="menu-item-remove-btn" onclick="RestaurantDetail._removeItem(${i})">✕</button>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div style="padding:8px 0;">
        <!-- 用餐者 -->
        <div class="form-group">
          <div class="form-label">用餐者</div>
          <div style="font-size:15px;font-weight:600;">
            ${CONFIG.USERS[user?.userId]?.emoji || '👤'}
            ${user?.displayName || '未知'}
          </div>
        </div>

        <!-- 用餐日期 -->
        <div class="form-group">
          <div class="form-label">用餐日期</div>
          <input type="date" class="form-input" id="review-date"
                 value="${_reviewForm.visitedDate}" max="${Utils.today()}">
        </div>

        <!-- 餐型 -->
        <div class="form-group">
          <div class="form-label">餐型</div>
          <div class="meal-type-grid">${mealTypeHtml}</div>
        </div>

        <!-- 整體評分 -->
        <div class="review-form-section">
          <div class="review-form-title">整體評分</div>
          <div class="review-overall">
            <div class="review-overall-label">整體</div>
            <div id="overall-stars"></div>
          </div>

          <!-- 類別評分維度 -->
          ${dimensionsHtml}
        </div>

        <!-- 備註 -->
        <div class="form-group" style="margin-top:16px;">
          <div class="form-label">備註</div>
          <textarea class="form-input" id="review-note" rows="3"
                    placeholder="好吃嗎？有什麼特別推薦的？"
                    style="resize:none;">${_reviewForm.note}</textarea>
        </div>

        <!-- 本次點了什麼 -->
        <div class="menu-items-section">
          <div class="review-form-title">🍽️ 本次點了什麼</div>
          ${quickChipsHtml}
          <div id="menu-items-list">${currentItemsHtml}</div>
          <button class="menu-add-btn" onclick="RestaurantDetail._addNewItem()">
            ➕ 新增品項
          </button>
        </div>

        <!-- 送出 -->
        <button class="btn btn-primary btn-block" id="submit-review-btn"
                style="margin-top:16px;margin-bottom:8px;">
          ✅ 送出評價
        </button>
        <button class="btn btn-ghost btn-block"
                onclick="RestaurantDetail._setTab('info')">取消</button>
      </div>
    `;

    // 整體評分星星
    const overallEl = document.getElementById('overall-stars');
    if (overallEl) {
      StarRating.render(overallEl, {
        value: _reviewForm.overall,
        size: 'lg',
        onChange: v => { _reviewForm.overall = v; }
      });
    }

    // 各維度評分星星
    dimensions.forEach(dim => {
      const el = document.getElementById(`dim-stars-${dim.key}`);
      if (el) {
        StarRating.render(el, {
          value: _reviewForm.scores[dim.key] || 0,
          size: 'sm',
          onChange: v => { _reviewForm.scores[dim.key] = v; }
        });
      }
    });

    // 日期變更
    document.getElementById('review-date').onchange = e => {
      _reviewForm.visitedDate = e.target.value;
    };

    // 備註變更（使用 input event，user-select 允許）
    const noteEl = document.getElementById('review-note');
    if (noteEl) {
      noteEl.style.userSelect = 'text';
      noteEl.addEventListener('input', e => { _reviewForm.note = e.target.value; });
    }

    // 送出按鈕
    document.getElementById('submit-review-btn').onclick = () => _submitReview();
  }

  // ── 品項管理函式 ─────────────────────────────────────────────────────────────

  function _addItemFromPrev(name, price) {
    // 避免重複新增同名品項
    if (_reviewForm.items.find(i => i.name === name)) {
      Toast.info(`「${name}」已在清單中`);
      return;
    }
    const prevItem = _prevMenuItems.find(p => p.name === name);
    const priceChanged = prevItem && prevItem.price && price && Number(price) > Number(prevItem.price);
    _reviewForm.items.push({
      name,
      price: price || 0,
      prev_price: prevItem?.price || null,
      price_changed: priceChanged
    });
    _renderMenuItemsList();
  }

  function _addNewItem() {
    _reviewForm.items.push({ name: '', price: 0, prev_price: null, price_changed: false });
    _renderMenuItemsList();
    // 聚焦最後一個 name input
    const rows = document.querySelectorAll('.menu-item-name-input');
    if (rows.length > 0) rows[rows.length - 1].focus();
  }

  function _removeItem(idx) {
    _reviewForm.items.splice(idx, 1);
    _renderMenuItemsList();
  }

  function _updateItemName(idx, val) {
    if (_reviewForm.items[idx] !== undefined) {
      _reviewForm.items[idx].name = val;
    }
  }

  function _updateItemPrice(idx, val) {
    if (_reviewForm.items[idx] !== undefined) {
      const price = Number(val) || 0;
      _reviewForm.items[idx].price = price;
      // 檢查漲價
      const prevItem = _prevMenuItems.find(p => p.name === _reviewForm.items[idx].name);
      _reviewForm.items[idx].price_changed = !!(prevItem && prevItem.price && price > Number(prevItem.price));
      _reviewForm.items[idx].prev_price = prevItem?.price || null;
      // 更新漲價 badge（不重繪整個列表，只更新 badge）
      const row = document.getElementById(`menu-item-row-${idx}`);
      if (row) {
        let badge = row.querySelector('.price-change-badge');
        if (_reviewForm.items[idx].price_changed) {
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'price-change-badge';
            badge.textContent = '↑漲價';
            const removeBtn = row.querySelector('.menu-item-remove-btn');
            row.insertBefore(badge, removeBtn);
          }
        } else {
          if (badge) badge.remove();
        }
      }
    }
  }

  function _renderMenuItemsList() {
    const listEl = document.getElementById('menu-items-list');
    if (!listEl) return;
    listEl.innerHTML = _reviewForm.items.map((item, i) => {
      const prevItem = _prevMenuItems.find(p => p.name === item.name);
      const priceChanged = prevItem && prevItem.price && item.price && Number(item.price) > Number(prevItem.price);
      return `
        <div class="menu-item-row" id="menu-item-row-${i}">
          <input class="menu-item-name-input" type="text"
                 value="${item.name}" placeholder="品項名稱"
                 oninput="RestaurantDetail._updateItemName(${i}, this.value)">
          <input class="menu-item-price-input" type="number"
                 value="${item.price || ''}" placeholder="價格"
                 oninput="RestaurantDetail._updateItemPrice(${i}, this.value)">
          ${priceChanged ? `<span class="price-change-badge">↑漲價</span>` : ''}
          <button class="menu-item-remove-btn" onclick="RestaurantDetail._removeItem(${i})">✕</button>
        </div>
      `;
    }).join('');
  }

  function _setMealType(key) {
    _reviewForm.mealType = key;
    _renderAddReviewTab(document.getElementById('detail-tab-content'));
  }

  async function _submitReview() {
    const user = State.getState().currentUser;
    if (!user) { Toast.error('請先登入'); return; }
    if (!_reviewForm.overall) { Toast.error('請給予整體評分'); return; }

    // 若餐廳還沒在 GAS 中，先 upsert
    let restaurantId = _current.restaurant_id;
    if (!restaurantId) {
      try {
        Loader.show('儲存餐廳資料中...');
        const result = await API.upsertRestaurant(_current);
        restaurantId = result.restaurant_id;
        // 更新本地 _current
        _current = { ..._current, restaurant_id: restaurantId, category: result.category || _current.category };
      } catch(e) {
        Loader.hide();
        Toast.error('儲存餐廳失敗：' + e.message);
        return;
      } finally {
        Loader.hide();
      }
    }

    // 整理品項資料（濾掉沒有名稱的）
    const validItems = _reviewForm.items.filter(item => item.name && item.name.trim() !== '');

    Loader.show('送出評價中...');
    try {
      await API.addReview({
        restaurant_id:  restaurantId,
        user_id:        user.userId,
        visited_date:   _reviewForm.visitedDate,
        overall_rating: _reviewForm.overall,
        scores_json:    _reviewForm.scores,
        note:           _reviewForm.note,
        meal_type:      _reviewForm.mealType,
        items_json:     validItems.length > 0 ? JSON.stringify(validItems) : ''
      });

      // 清除快取
      State.invalidateReviewsCache(restaurantId);
      State.invalidateRestaurantsCache();

      Toast.success('評價已送出！');

      // 重新載入並切回評價頁
      _activeTab = 'reviews';
      await _loadAndRender();

      // 刷新地圖 Marker
      if (window.MapPage) MapPage.refreshNearby(true);

    } catch(e) {
      Toast.error('送出失敗：' + e.message);
    } finally {
      Loader.hide();
    }
  }

  async function _deleteReview(reviewId) {
    const ok = await Modal.confirm('確定要刪除這筆評價嗎？', { danger: true, confirmText: '刪除' });
    if (!ok) return;

    Loader.show('刪除中...');
    try {
      await API.deleteReview(reviewId);
      State.invalidateReviewsCache(_current.restaurant_id);
      State.invalidateRestaurantsCache();
      Toast.success('已刪除');
      _reviews = _reviews.filter(r => r.review_id !== reviewId);
      _render();
      if (window.MapPage) MapPage.refreshNearby(true);
    } catch(e) {
      Toast.error('刪除失敗：' + e.message);
    } finally {
      Loader.hide();
    }
  }

  // 公開 _setTab、_setMealType、_deleteReview 及品項管理函式（inline onclick 需要）
  return {
    show, hide,
    _setTab, _setMealType, _deleteReview,
    _addItemFromPrev, _addNewItem, _removeItem,
    _updateItemName, _updateItemPrice
  };
})();

window.RestaurantDetail = RestaurantDetail;
