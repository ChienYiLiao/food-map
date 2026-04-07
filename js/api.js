/**
 * api.js — API 呼叫封裝層
 *
 * GAS API：GET + ?payload=JSON（寫入）／GET + ?action=xxx（讀取）
 * Places API (New)：REST 端點，Key 從 localStorage 讀取
 */

const API = (() => {
  // ── 取得目前有效的 GAS URL ──────────────────────────────────────────────────
  function _gasUrl() {
    return CONFIG.GAS_URL || localStorage.getItem('GAS_URL') || '';
  }

  function _url(params) {
    const base = _gasUrl();
    if (!base) throw new Error('GAS URL 未設定，請到設定頁填入');
    const qs = new URLSearchParams(params).toString();
    return `${base}?${qs}`;
  }

  /** 讀取：GET + query params */
  async function get(action, params = {}) {
    const url = _url({ action, ...params });
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'API Error');
    return data.data;
  }

  /** 寫入：GET + payload（避免 302 轉址問題） */
  async function write(action, body = {}) {
    const payload = JSON.stringify({ action, ...body });
    const url = _url({ payload });
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'API Error');
    return data.data;
  }

  /** 大檔案（頭像）：POST + text/plain */
  async function post(action, body = {}) {
    const base = _gasUrl();
    if (!base) throw new Error('GAS URL 未設定');
    const payload = JSON.stringify({ action, ...body });
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: payload
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'API Error');
    return data.data;
  }

  // ── Places API (New) ─────────────────────────────────────────────────────────
  function _mapsKey() {
    const key = CONFIG.getMapsApiKey();
    if (!key) throw new Error('Google Maps API Key 未設定，請到設定頁填入');
    return key;
  }

  /**
   * 搜尋附近餐廳（Places API New - Nearby Search）
   * @param {number} lat
   * @param {number} lng
   * @param {number} radius - 公尺
   * @returns {Promise<PlaceResult[]>}
   */
  async function searchNearby(lat, lng, radius) {
    const apiKey = _mapsKey();
    const url = 'https://places.googleapis.com/v1/places:searchNearby';
    const body = {
      includedTypes: [
        'restaurant', 'cafe', 'bar', 'bakery',
        'chinese_restaurant', 'japanese_restaurant',
        'korean_restaurant', 'hamburger_restaurant', 'pizza_restaurant',
        'ramen_restaurant', 'sushi_restaurant', 'breakfast_restaurant',
        'brunch_restaurant', 'fast_food_restaurant', 'dessert_shop',
        'ice_cream_shop', 'coffee_shop', 'sandwich_shop',
        'seafood_restaurant', 'steak_house', 'thai_restaurant',
        'vietnamese_restaurant', 'mexican_restaurant'
      ],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radius
        }
      }
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.location',
          'places.types',
          'places.priceLevel',
          'places.currentOpeningHours',
          'places.regularOpeningHours',
          'places.internationalPhoneNumber',
          'places.websiteUri',
          'places.rating',
          'places.userRatingCount'
        ].join(',')
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Places API error ${res.status}`);
    }
    const data = await res.json();
    return (data.places || []).map(_normalizePlaceResult);
  }

  /**
   * 取得單一地點詳情（用於確認目前是否營業中）
   */
  async function getPlaceDetails(placeId) {
    const apiKey = _mapsKey();
    const url = `https://places.googleapis.com/v1/places/${placeId}`;
    const res = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,currentOpeningHours,displayName'
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      place_id: data.id,
      isOpen: data.currentOpeningHours?.openNow ?? null,
      name: data.displayName?.text || ''
    };
  }

  /**
   * 批次確認多個地點是否營業中（5 個並發）
   * @param {string[]} placeIds
   * @returns {Promise<{[placeId]: boolean}>}
   */
  async function batchCheckOpen(placeIds) {
    const result = {};
    const chunks = Utils.chunk(placeIds, 5);
    for (const chunk of chunks) {
      await Promise.allSettled(chunk.map(async placeId => {
        const detail = await getPlaceDetails(placeId);
        if (detail) {
          result[placeId] = detail.isOpen;
          State.updateRestaurantOpenStatus(placeId, {
            isOpen: detail.isOpen,
            _openStatusAt: Date.now()
          });
        }
      }));
    }
    return result;
  }

  // 正規化 Places API (New) 結果
  function _normalizePlaceResult(place) {
    return {
      place_id:      place.id,
      name:          place.displayName?.text || '',
      address:       place.formattedAddress || '',
      lat:           place.location?.latitude,
      lng:           place.location?.longitude,
      google_types:  place.types || [],
      price_level:   place.priceLevel || '',
      isOpen:        place.currentOpeningHours?.openNow ?? null,
      opening_hours: place.regularOpeningHours || null,
      phone:         place.internationalPhoneNumber || '',
      website:       place.websiteUri || '',
      google_rating: place.rating || null,
      _openStatusAt: Date.now()
    };
  }

  // ── GAS API Methods ──────────────────────────────────────────────────────────

  return {
    // ── 使用者 ──────────────────────────────────────────────────────────────
    getUsers() { return get('getUsers'); },
    updateAvatar(userId, base64, mimeType) {
      return post('updateAvatar', { userId, imageBase64: base64, mimeType });
    },

    // ── 餐廳 ────────────────────────────────────────────────────────────────
    /**
     * 取得所有餐廳（含評分摘要）
     * @param {string} userId - 若傳入，標記哪些是「我吃過的」
     */
    getRestaurants(params = {}) {
      return get('getRestaurants', params);
    },

    /**
     * 新增或更新餐廳（以 place_id 去重）
     * 同時觸發 Claude AI 分類（GAS 端處理）
     */
    upsertRestaurant(data) {
      return write('upsertRestaurant', {
        place_id:           data.place_id,
        name:               data.name,
        address:            data.address,
        lat:                data.lat,
        lng:                data.lng,
        google_types:       JSON.stringify(data.google_types || []),
        price_level:        data.price_level || '',
        phone:              data.phone || '',
        website:            data.website || '',
        opening_hours_json: data.opening_hours ? JSON.stringify(data.opening_hours) : ''
      });
    },

    // ── 評價 ────────────────────────────────────────────────────────────────
    /**
     * 取得評價
     * @param {object} params - { restaurantId?, userId?, limit?, offset? }
     */
    getReviews(params = {}) {
      return get('getReviews', params);
    },

    /**
     * 新增評價
     * @param {object} data - { restaurant_id, user_id, visited_date, overall_rating, scores_json, note, meal_type }
     */
    addReview(data) {
      return write('addReview', {
        ...data,
        scores_json: typeof data.scores_json === 'object'
          ? JSON.stringify(data.scores_json)
          : (data.scores_json || '{}')
      });
    },

    updateReview(reviewId, patch) {
      return write('updateReview', {
        review_id: reviewId,
        ...patch,
        scores_json: patch.scores_json && typeof patch.scores_json === 'object'
          ? JSON.stringify(patch.scores_json)
          : patch.scores_json
      });
    },

    deleteReview(reviewId) {
      return write('deleteReview', { review_id: reviewId });
    },

    // ── Places API (直接從前端呼叫) ───────────────────────────────────────
    searchNearby,
    getPlaceDetails,
    batchCheckOpen
  };
})();
