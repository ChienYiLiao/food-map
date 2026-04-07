/**
 * random-pick.js — 幸運抽選頁
 * 從已吃過的餐廳中隨機抽選，支援篩選與 isOpen 確認
 */

const RandomPickPage = (() => {
  let _selectedMealType = CONFIG.getMealTypeByHour();
  let _selectedCategories = [];   // 空 = 全部
  let _onlyOpen = true;
  let _minRating = 0;
  let _isPicking = false;
  let _lastResult = null;

  function show() {
    _render();
    const rightEl = document.getElementById('topbar-right');
    if (rightEl) rightEl.innerHTML = '';
  }

  function hide() { _isPicking = false; }

  function _render() {
    const page = document.getElementById('page-random');
    if (!page) return;

    const mealTypeHtml = CONFIG.MEAL_TYPES.map(mt => `
      <button class="meal-type-btn ${_selectedMealType === mt.key ? 'selected' : ''}"
              onclick="RandomPickPage._setMealType('${mt.key}')">
        <span class="meal-emoji">${mt.emoji}</span>
        ${mt.label}
      </button>
    `).join('');

    const categoryHtml = CONFIG.RESTAURANT_CATEGORIES.map(cat => `
      <button class="toggle-btn ${_selectedCategories.includes(cat.key) ? 'active' : ''}"
              onclick="RandomPickPage._toggleCategory('${cat.key}')"
              style="flex:none;padding:6px 12px;margin:3px;border-radius:999px;border:1px solid var(--color-border);font-size:12px;">
        ${cat.emoji} ${cat.key}
      </button>
    `).join('');

    const resultHtml = _lastResult ? `
      <div class="random-pick-result" id="pick-result">
        <div class="random-pick-emoji">${CONFIG.getCategoryEmoji(_lastResult.category)}</div>
        <div class="random-pick-name">${_lastResult.name}</div>
        <div class="random-pick-category">${_lastResult.category || ''}</div>
        <div class="random-pick-rating">
          ${'⭐'.repeat(Math.round(_lastResult.avg_rating || 0))}
          ${_lastResult.avg_rating ? `${Utils.formatRating(_lastResult.avg_rating)} 分` : ''}
        </div>
        ${_lastResult.address ? `<div style="font-size:12px;color:var(--color-text-muted);margin-top:8px;">📍 ${Utils.truncate(_lastResult.address, 30)}</div>` : ''}
        ${_lastResult.isOpen !== null ? `
          <div style="margin-top:8px;">
            ${_lastResult.isOpen
              ? '<span class="badge badge-open">目前營業中 ✓</span>'
              : '<span class="badge badge-closed">目前休息中</span>'}
          </div>` : ''}
        <div style="display:flex;gap:8px;margin-top:16px;justify-content:center;">
          <button class="btn btn-secondary" onclick="RandomPickPage._pick()">再抽一次</button>
          <button class="btn btn-primary" onclick="RandomPickPage._viewRestaurant()">查看詳情</button>
        </div>
      </div>
    ` : '';

    page.innerHTML = `
      <!-- 抽選按鈕 -->
      <div style="text-align:center;padding:24px 0 8px;">
        <div style="font-size:48px;margin-bottom:8px;">🎲</div>
        <div style="font-size:20px;font-weight:800;margin-bottom:4px;">幸運抽選</div>
        <div style="font-size:13px;color:var(--color-text-muted);">從吃過的餐廳中隨機挑選</div>
      </div>

      ${resultHtml}

      <!-- 篩選設定 -->
      <div class="section">
        <div class="section-title">餐型篩選</div>
        <div class="meal-type-grid">${mealTypeHtml}</div>
      </div>

      <div class="section">
        <div class="section-title">類別篩選（空 = 全部）</div>
        <div style="display:flex;flex-wrap:wrap;gap:0;">${categoryHtml}</div>
      </div>

      <div class="section">
        <div class="section-title">其他條件</div>
        <div class="settings-item">
          <div>
            <div class="settings-item-label">只看目前營業中</div>
            <div class="settings-item-desc">篩選現在可以去吃的店</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="only-open-toggle" ${_onlyOpen ? 'checked' : ''}>
            <span class="switch-slider"></span>
          </label>
        </div>
        <div class="settings-item" style="margin-top:4px;">
          <div>
            <div class="settings-item-label">最低評分</div>
          </div>
          <select class="form-input" id="min-rating-select"
                  style="width:auto;padding:6px 32px 6px 12px;">
            <option value="0" ${_minRating===0?'selected':''}>無限制</option>
            <option value="3" ${_minRating===3?'selected':''}>3 分以上</option>
            <option value="4" ${_minRating===4?'selected':''}>4 分以上</option>
          </select>
        </div>
      </div>

      <button class="btn btn-primary btn-block" style="margin-top:8px;font-size:17px;padding:16px;"
              id="pick-btn" onclick="RandomPickPage._pick()">
        🎲 開始抽選
      </button>
    `;

    // 事件監聽
    const toggleEl = document.getElementById('only-open-toggle');
    if (toggleEl) toggleEl.onchange = e => { _onlyOpen = e.target.checked; };

    const ratingEl = document.getElementById('min-rating-select');
    if (ratingEl) ratingEl.onchange = e => { _minRating = Number(e.target.value); };
  }

  function _setMealType(key) {
    _selectedMealType = key;
    _lastResult = null;
    _render();
  }

  function _toggleCategory(key) {
    const idx = _selectedCategories.indexOf(key);
    if (idx >= 0) {
      _selectedCategories.splice(idx, 1);
    } else {
      _selectedCategories.push(key);
    }
    _lastResult = null;
    _render();
  }

  async function _pick() {
    if (_isPicking) return;
    _isPicking = true;

    const btn = document.getElementById('pick-btn');
    if (btn) { btn.disabled = true; btn.textContent = '抽選中...'; }

    try {
      // 1. 取得快取中所有已吃過的餐廳
      let pool = State.getState().restaurantsCache || [];
      if (pool.length === 0) {
        Loader.show('載入餐廳資料...');
        const data = await API.getRestaurants({});
        pool = data?.restaurants || [];
        State.setRestaurantsCache(pool);
        Loader.hide();
      }

      // 2. 只保留有評價的
      pool = pool.filter(r => Number(r.visit_count) > 0);

      if (pool.length === 0) {
        Toast.warn('還沒有吃過任何餐廳喔！快去地圖頁新增評價吧');
        return;
      }

      // 3. 類別篩選
      if (_selectedCategories.length > 0) {
        pool = pool.filter(r => _selectedCategories.includes(r.category));
      }

      // 4. 最低評分篩選
      if (_minRating > 0) {
        pool = pool.filter(r => Number(r.avg_rating) >= _minRating);
      }

      if (pool.length === 0) {
        Toast.warn('沒有符合條件的餐廳，請放寬篩選條件！');
        return;
      }

      // 5. 確認目前營業狀態（5 個並發）
      if (_onlyOpen) {
        Loader.show('確認營業中...');
        const now = Date.now();
        const staleIds = pool
          .filter(r => !r._openStatusAt || (now - r._openStatusAt) > 5 * 60 * 1000)
          .map(r => r.place_id)
          .filter(Boolean);

        if (staleIds.length > 0) {
          await API.batchCheckOpen(staleIds);
          // 重新讀取快取（已由 batchCheckOpen 更新）
          pool = (State.getState().restaurantsCache || [])
            .filter(r => Number(r.visit_count) > 0);
          if (_selectedCategories.length > 0) {
            pool = pool.filter(r => _selectedCategories.includes(r.category));
          }
          if (_minRating > 0) {
            pool = pool.filter(r => Number(r.avg_rating) >= _minRating);
          }
        }
        Loader.hide();
        pool = pool.filter(r => r.isOpen === true);
      }

      if (pool.length === 0) {
        Toast.warn('目前沒有符合條件的餐廳正在營業中，稍後再試或關閉「只看營業中」');
        return;
      }

      // 6. 加權隨機（評分高的機率略高）
      const result = _weightedRandom(pool);
      _lastResult = result;

      // 7. 重新渲染顯示結果
      _render();

      // 動畫
      const resultEl = document.getElementById('pick-result');
      if (resultEl) {
        resultEl.style.animation = 'none';
        resultEl.offsetHeight; // reflow
        resultEl.style.animation = 'toastIn 0.4s ease';
      }

    } catch(e) {
      Toast.error('抽選失敗：' + e.message);
      Loader.hide();
    } finally {
      _isPicking = false;
      const btn2 = document.getElementById('pick-btn');
      if (btn2) { btn2.disabled = false; btn2.textContent = '🎲 再抽一次'; }
    }
  }

  function _weightedRandom(items) {
    const weights = items.map(r => Math.pow(Number(r.avg_rating) || 3, 2));
    const total = weights.reduce((s, w) => s + w, 0);
    let rand = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
      rand -= weights[i];
      if (rand <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  function _viewRestaurant() {
    if (!_lastResult) return;
    RestaurantDetail.show(_lastResult);
  }

  return { show, hide, _setMealType, _toggleCategory, _pick, _viewRestaurant };
})();

window.RandomPickPage = RandomPickPage;
