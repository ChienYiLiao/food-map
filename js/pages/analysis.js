/**
 * analysis.js — 飲食分析頁面
 * 顯示當月用餐統計：總次數、平均評分、類別分布、餐型分布、Top5、豬豬 vs 滾滾
 */

const AnalysisPage = (() => {
  let _allReviews = [];     // 從 API 載入的全部評價
  let _selectedMonth = '';  // YYYY-MM

  // ── 公開：顯示頁面 ─────────────────────────────────────────────────────────
  async function show() {
    const page = document.getElementById('page-analysis');
    if (!page) return;

    // 預設當月
    const now = new Date();
    _selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    page.innerHTML = `
      <div style="height:100%;overflow-y:auto;-webkit-overflow-scrolling:touch;">
        <div class="analysis-header">
          <div class="analysis-month-selector">
            <label>📅 月份</label>
            <input type="month" id="analysis-month-input" value="${_selectedMonth}">
          </div>
        </div>
        <div id="analysis-body" class="analysis-body">
          <div class="analysis-empty">載入中…</div>
        </div>
      </div>
    `;

    document.getElementById('analysis-month-input').addEventListener('change', e => {
      _selectedMonth = e.target.value;
      _renderStats();
    });

    await _loadData();
  }

  function hide() {
    // 頁面離開時不需特殊清理
  }

  // ── 載入資料 ───────────────────────────────────────────────────────────────
  async function _loadData() {
    try {
      Loader.show('載入分析資料中…');
      const data = await API.getReviews({ limit: 500 });
      _allReviews = data?.reviews || [];
    } catch(e) {
      _allReviews = [];
      Toast.error('載入評價失敗：' + e.message);
    } finally {
      Loader.hide();
    }
    _renderStats();
  }

  // ── 渲染統計 ───────────────────────────────────────────────────────────────
  function _renderStats() {
    const body = document.getElementById('analysis-body');
    if (!body) return;

    // 篩選當月評價
    const filtered = _allReviews.filter(r =>
      r.visited_date && r.visited_date.startsWith(_selectedMonth)
    );

    if (filtered.length === 0) {
      body.innerHTML = `<div class="analysis-empty">這個月還沒有用餐紀錄 🍽️</div>`;
      return;
    }

    // ── 基礎統計 ──────────────────────────────────────────────────────────────
    const totalVisits = filtered.length;
    const ratingsWithValue = filtered.filter(r => Number(r.overall_rating) > 0);
    const avgRating = ratingsWithValue.length > 0
      ? (ratingsWithValue.reduce((sum, r) => sum + Number(r.overall_rating), 0) / ratingsWithValue.length).toFixed(1)
      : '—';

    // 計算總消費（需要 items_json）
    let totalSpending = 0;
    let hasSpending = false;
    filtered.forEach(r => {
      if (r.items_json) {
        const items = Utils.safeJsonParse(r.items_json);
        if (Array.isArray(items) && items.length > 0) {
          items.forEach(item => {
            if (item.price && Number(item.price) > 0) {
              totalSpending += Number(item.price);
              hasSpending = true;
            }
          });
        }
      }
    });
    const spendingStr = hasSpending ? `$${totalSpending}` : '—';

    // ── 類別分布 ──────────────────────────────────────────────────────────────
    const restaurantsCache = State.getState().restaurantsCache || [];
    const restaurantMap = {};
    restaurantsCache.forEach(r => {
      if (r.restaurant_id) restaurantMap[r.restaurant_id] = r;
    });

    const categoryCount = {};
    filtered.forEach(r => {
      const restaurant = restaurantMap[r.restaurant_id];
      const cat = restaurant?.category || '未分類';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
    const categoryEntries = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1]);
    const maxCatCount = categoryEntries[0]?.[1] || 1;

    // ── 餐型分布 ──────────────────────────────────────────────────────────────
    const mealTypes = CONFIG.MEAL_TYPES || [
      { key: 'breakfast', emoji: '🌅', label: '早餐' },
      { key: 'lunch',     emoji: '☀️', label: '午餐' },
      { key: 'dinner',    emoji: '🌙', label: '晚餐' },
      { key: 'latenight', emoji: '🌃', label: '消夜' }
    ];
    const mealCount = {};
    mealTypes.forEach(mt => { mealCount[mt.key] = 0; });
    filtered.forEach(r => {
      if (r.meal_type && mealCount[r.meal_type] !== undefined) {
        mealCount[r.meal_type]++;
      }
    });

    // ── Top 5 餐廳 ────────────────────────────────────────────────────────────
    const restaurantVisits = {};
    filtered.forEach(r => {
      if (!r.restaurant_id) return;
      if (!restaurantVisits[r.restaurant_id]) {
        restaurantVisits[r.restaurant_id] = {
          count: 0,
          name: restaurantMap[r.restaurant_id]?.name || r.restaurant_id
        };
      }
      restaurantVisits[r.restaurant_id].count++;
    });
    const top5 = Object.entries(restaurantVisits)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    // ── 豬豬 vs 滾滾 ─────────────────────────────────────────────────────────
    const userVisits = {};
    filtered.forEach(r => {
      userVisits[r.user_id] = (userVisits[r.user_id] || 0) + 1;
    });

    const users = CONFIG.USERS || {};
    const userEntries = Object.entries(users).map(([uid, udata]) => ({
      uid,
      emoji: udata.emoji || '👤',
      name: localStorage.getItem(`nickname_${uid}`) || udata.displayName || uid,
      count: userVisits[uid] || 0
    }));
    const maxUserCount = Math.max(...userEntries.map(u => u.count), 1);

    // ── 組合 HTML ─────────────────────────────────────────────────────────────
    const rankClass = i => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';

    body.innerHTML = `
      <!-- 概覽卡片 -->
      <div class="analysis-stat-cards">
        <div class="analysis-stat-card">
          <div class="stat-value">${totalVisits}</div>
          <div class="stat-label">用餐次數</div>
        </div>
        <div class="analysis-stat-card">
          <div class="stat-value">${avgRating === '—' ? avgRating : `⭐${avgRating}`}</div>
          <div class="stat-label">平均評分</div>
        </div>
        <div class="analysis-stat-card">
          <div class="stat-value" style="font-size:var(--font-size-lg);">${spendingStr}</div>
          <div class="stat-label">估算消費</div>
        </div>
      </div>

      <!-- 餐型分布 -->
      <div class="analysis-section">
        <div class="analysis-section-title">餐型分布</div>
        <div class="analysis-meal-grid">
          ${mealTypes.map(mt => `
            <div class="analysis-meal-cell">
              <div class="meal-emoji">${mt.emoji}</div>
              <div class="meal-count">${mealCount[mt.key] || 0}</div>
              <div class="meal-name">${mt.label}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 類別分布 -->
      <div class="analysis-section">
        <div class="analysis-section-title">類別分布</div>
        ${categoryEntries.map(([cat, count]) => {
          const pct = Math.round(count / totalVisits * 100);
          const barWidth = Math.round(count / maxCatCount * 100);
          return `
            <div class="analysis-bar-row">
              <div class="analysis-bar-label">${cat}</div>
              <div class="analysis-bar-track">
                <div class="analysis-bar-fill" style="width:${barWidth}%;"></div>
              </div>
              <div class="analysis-bar-meta">${count} 次 (${pct}%)</div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Top 5 餐廳 -->
      <div class="analysis-section">
        <div class="analysis-section-title">本月最常去 Top 5</div>
        ${top5.length === 0
          ? '<div style="color:var(--color-text-muted);font-size:var(--font-size-sm);">暫無資料</div>'
          : top5.map(([rid, info], i) => `
            <div class="analysis-top5-item">
              <div class="analysis-rank ${rankClass(i)}">${i + 1}</div>
              <div class="analysis-top5-name">${info.name}</div>
              <div class="analysis-top5-count">${info.count} 次</div>
            </div>
          `).join('')
        }
      </div>

      <!-- 豬豬 vs 滾滾 -->
      <div class="analysis-section">
        <div class="analysis-section-title">豬豬 vs 滾滾</div>
        ${userEntries.map(u => {
          const barWidth = maxUserCount > 0 ? Math.round(u.count / maxUserCount * 100) : 0;
          return `
            <div class="analysis-user-row">
              <div class="analysis-user-label">${u.emoji} ${u.name}</div>
              <div class="analysis-bar-track" style="flex:1;">
                <div class="analysis-bar-fill" style="width:${barWidth}%;"></div>
              </div>
              <div class="analysis-bar-meta" style="margin-left:8px;">${u.count} 次</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  return { show, hide };
})();

window.AnalysisPage = AnalysisPage;
