/**
 * Reviews.gs — 評價 CRUD
 */

/**
 * 取得評價
 * params: { restaurantId?, userId?, limit?, offset? }
 */
function handleGetReviews(params) {
  let rows = readAllRows('REVIEWS');

  if (params.restaurantId) {
    rows = rows.filter(r => r.restaurant_id === params.restaurantId);
  }
  if (params.userId) {
    rows = rows.filter(r => r.user_id === params.userId);
  }

  // 依 visited_date 倒序
  rows.sort((a, b) => (b.visited_date || '').localeCompare(a.visited_date || ''));

  const total = rows.length;
  const offset = Number(params.offset) || 0;
  const limit  = Number(params.limit)  || 100;
  rows = rows.slice(offset, offset + limit);

  return { reviews: rows, total };
}

/**
 * 新增評價
 * body: { restaurant_id, user_id, visited_date, overall_rating, scores_json, note, items_json, meal_type }
 */
function handleAddReview(body) {
  const { restaurant_id, user_id, visited_date, overall_rating,
          scores_json, note, items_json, meal_type } = body;

  if (!restaurant_id) throw new Error('Missing restaurant_id');
  if (!user_id)       throw new Error('Missing user_id');

  const now = nowIso();
  const review_id = generateId('rev');

  appendRow('REVIEWS', {
    review_id,
    restaurant_id,
    user_id,
    visited_date:   visited_date   || todayStr(),
    overall_rating: Number(overall_rating) || 0,
    scores_json:    scores_json    || '{}',
    note:           note           || '',
    items_json:     items_json     || '',
    meal_type:      meal_type      || '',
    created_at:     now,
    updated_at:     now
  });

  // 更新餐廳統計
  _refreshRestaurantStats(restaurant_id);

  return { review_id };
}

/**
 * 更新評價
 */
function handleUpdateReview(body) {
  const { review_id, ...patch } = body;
  if (!review_id) throw new Error('Missing review_id');

  const updatePatch = {};
  const allowed = ['visited_date','overall_rating','scores_json','note','items_json','meal_type'];
  allowed.forEach(key => {
    if (patch[key] !== undefined) updatePatch[key] = patch[key];
  });
  updatePatch.updated_at = nowIso();

  const ok = updateRow('REVIEWS', 'review_id', review_id, updatePatch);
  if (!ok) throw new Error('Review not found: ' + review_id);

  // 更新餐廳統計
  const rows = readAllRows('REVIEWS');
  const review = rows.find(r => r.review_id === review_id);
  if (review) _refreshRestaurantStats(review.restaurant_id);

  return { ok: true };
}

/**
 * 刪除評價
 */
function handleDeleteReview(body) {
  const { review_id } = body;
  if (!review_id) throw new Error('Missing review_id');

  // 先取得 restaurant_id
  const rows   = readAllRows('REVIEWS');
  const review = rows.find(r => r.review_id === review_id);
  if (!review)  throw new Error('Review not found');

  const ok = deleteRow('REVIEWS', 'review_id', review_id);
  if (!ok) throw new Error('Delete failed');

  // 更新餐廳統計
  _refreshRestaurantStats(review.restaurant_id);

  return { ok: true };
}
