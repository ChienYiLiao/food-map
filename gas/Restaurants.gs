/**
 * Restaurants.gs — 餐廳 CRUD
 */

/**
 * 取得所有餐廳（含評分摘要）
 * params: { userId? }
 */
function handleGetRestaurants(params) {
  const restaurants = readAllRows('RESTAURANTS');
  const reviews     = readAllRows('REVIEWS');

  // 建立 restaurant_id → reviews 的對應
  const reviewMap = {};
  reviews.forEach(r => {
    if (!reviewMap[r.restaurant_id]) reviewMap[r.restaurant_id] = [];
    reviewMap[r.restaurant_id].push(r);
  });

  // 建立每個餐廳的訪問使用者清單
  const result = restaurants.map(rst => {
    const rst_reviews = reviewMap[rst.restaurant_id] || [];
    const visitedByUsers = [...new Set(rst_reviews.map(r => r.user_id))];
    return {
      ...rst,
      visitedByUsers,
      visit_count: Number(rst.visit_count) || 0,
      avg_rating:  Number(rst.avg_rating)  || 0,
      lat:         Number(rst.lat)         || 0,
      lng:         Number(rst.lng)         || 0
    };
  });

  return { restaurants: result };
}

/**
 * 新增或更新餐廳（以 place_id 去重）
 * 若為新餐廳，觸發 Claude AI 分類
 */
function handleUpsertRestaurant(body) {
  const { place_id, name, address, lat, lng,
          google_types, price_level, phone, website,
          opening_hours_json } = body;

  if (!place_id) throw new Error('Missing place_id');
  if (!name)     throw new Error('Missing name');

  const now = nowIso();
  const rows = readAllRows('RESTAURANTS');
  const existing = rows.find(r => r.place_id === place_id);

  if (existing) {
    // 更新現有餐廳的即時資料
    updateRow('RESTAURANTS', 'restaurant_id', existing.restaurant_id, {
      opening_hours_json: opening_hours_json || existing.opening_hours_json,
      price_level:        price_level        || existing.price_level,
      phone:              phone              || existing.phone,
      website:            website            || existing.website,
      updated_at:         now
    });

    // 若尚未分類，觸發分類
    let category = existing.category;
    if (!category) {
      try {
        const classifyResult = handleClassifyRestaurant({
          restaurant_id: existing.restaurant_id,
          name,
          google_types
        });
        category = classifyResult.category;
      } catch(e) { Logger.log('classify error: ' + e.message); }
    }

    return {
      restaurant_id: existing.restaurant_id,
      place_id,
      category
    };
  } else {
    // 新增餐廳
    const restaurant_id = generateId('rst');
    const newRow = {
      restaurant_id,
      place_id,
      name,
      address:            address            || '',
      lat:                lat                || '',
      lng:                lng                || '',
      category:           '',
      google_types:       google_types       || '[]',
      price_level:        price_level        || '',
      phone:              phone              || '',
      website:            website            || '',
      opening_hours_json: opening_hours_json || '',
      first_visited_by:   '',
      first_visited_at:   '',
      visit_count:        0,
      avg_rating:         0,
      ai_classified_at:   '',
      created_at:         now,
      updated_at:         now
    };
    appendRow('RESTAURANTS', newRow);

    // 觸發 Claude 分類
    let category = '';
    try {
      const classifyResult = handleClassifyRestaurant({
        restaurant_id,
        name,
        google_types
      });
      category = classifyResult.category;
    } catch(e) { Logger.log('classify error: ' + e.message); }

    return { restaurant_id, place_id, category };
  }
}

/**
 * 更新餐廳的 visit_count 和 avg_rating（在 addReview 後自動呼叫）
 */
function _refreshRestaurantStats(restaurantId) {
  const reviews = readAllRows('REVIEWS')
    .filter(r => r.restaurant_id === restaurantId);

  const count      = reviews.length;
  const totalRating = reviews.reduce((s, r) => s + (Number(r.overall_rating) || 0), 0);
  const avg        = count > 0 ? (totalRating / count) : 0;

  // 第一次訪問資訊
  const sorted = reviews.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  const first  = sorted[0];

  const patch = {
    visit_count: count,
    avg_rating:  Math.round(avg * 10) / 10,
    updated_at:  nowIso()
  };
  if (first && !readAllRows('RESTAURANTS').find(r => r.restaurant_id === restaurantId)?.first_visited_by) {
    patch.first_visited_by = first.user_id;
    patch.first_visited_at = first.visited_date;
  }

  updateRow('RESTAURANTS', 'restaurant_id', restaurantId, patch);
}
