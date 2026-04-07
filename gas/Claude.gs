/**
 * Claude.gs — Claude API 呼叫（AI 餐廳分類）
 *
 * API Key 存放在 Script Properties: CLAUDE_API_KEY
 * 同一餐廳 24 小時內不重複分類（ai_classified_at 快取）
 */

const VALID_CATEGORIES = [
  '飲料店','中餐廳','西餐廳','小吃','日式料理',
  '韓式料理','甜點','咖啡廳','早餐店','火鍋','燒烤','速食','其他'
];

/**
 * 主入口：分類餐廳
 * body: { restaurant_id, name, google_types }
 */
function handleClassifyRestaurant(body) {
  const { restaurant_id, name, google_types } = body;
  if (!restaurant_id || !name) throw new Error('Missing restaurant_id or name');

  // 檢查是否在 24 小時內已分類
  const rows = readAllRows('RESTAURANTS');
  const existing = rows.find(r => r.restaurant_id === restaurant_id);
  if (existing && existing.category && existing.ai_classified_at) {
    const ageMs = new Date() - new Date(existing.ai_classified_at);
    if (ageMs < 86400000) {
      return { category: existing.category, cached: true };
    }
  }

  const category = _callClaudeClassify(name, google_types);
  const now = nowIso();
  updateRow('RESTAURANTS', 'restaurant_id', restaurant_id, {
    category, ai_classified_at: now, updated_at: now
  });

  // 記錄分類 log
  appendRow('CLASSIFY_LOG', {
    log_id:           generateId('clf'),
    restaurant_id,
    place_id:         existing?.place_id || '',
    restaurant_name:  name,
    google_types:     google_types || '',
    result_category:  category,
    created_at:       now
  });

  return { category };
}

/**
 * 呼叫 Claude API 進行分類
 * 使用 claude-haiku-4-5（快速、省費用）
 */
function _callClaudeClassify(name, googleTypesStr) {
  const apiKey = getProp('CLAUDE_API_KEY');
  if (!apiKey) {
    Logger.log('CLAUDE_API_KEY not set, using fallback');
    return _fallbackClassify(googleTypesStr);
  }

  const types = safeJsonParse(googleTypesStr) || [];
  const prompt = `你是一個台灣餐廳分類助手。請根據餐廳名稱和 Google Maps 類型標籤，判斷這家餐廳屬於哪個類別。

餐廳名稱：${name}
Google 類型：${types.join(', ')}

請從以下類別中選擇一個最合適的（只輸出類別名稱，不要輸出任何其他文字）：
飲料店、中餐廳、西餐廳、小吃、日式料理、韓式料理、甜點、咖啡廳、早餐店、火鍋、燒烤、速食、其他`;

  try {
    const payload = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      messages: [{ role: 'user', content: prompt }]
    };

    const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json'
      },
      payload:           JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const data = safeJsonParse(res.getContentText());
    const raw  = (data?.content?.[0]?.text || '').trim();
    return VALID_CATEGORIES.includes(raw) ? raw : _fallbackClassify(googleTypesStr);

  } catch (err) {
    Logger.log('Claude API error: ' + err.message);
    return _fallbackClassify(googleTypesStr);
  }
}

/**
 * 規則式分類（Claude API 失敗時的 fallback）
 * 根據 Google types 關鍵字判斷
 */
function _fallbackClassify(googleTypesStr) {
  const types = safeJsonParse(googleTypesStr) || [];
  const typeStr = types.join(' ').toLowerCase();

  if (typeStr.includes('bubble_tea') || typeStr.includes('juice_bar') ||
      (typeStr.includes('cafe') && typeStr.includes('tea'))) return '飲料店';
  if (typeStr.includes('coffee')) return '咖啡廳';
  if (typeStr.includes('dessert') || typeStr.includes('ice_cream')) return '甜點';
  if (typeStr.includes('japanese') || typeStr.includes('ramen') || typeStr.includes('sushi')) return '日式料理';
  if (typeStr.includes('korean')) return '韓式料理';
  if (typeStr.includes('chinese')) return '中餐廳';
  if (typeStr.includes('hamburger') || typeStr.includes('fast_food')) return '速食';
  if (typeStr.includes('pizza') || typeStr.includes('steak') || typeStr.includes('western')) return '西餐廳';
  if (typeStr.includes('breakfast') || typeStr.includes('brunch')) return '早餐店';
  if (typeStr.includes('bbq') || typeStr.includes('barbecue')) return '燒烤';
  if (typeStr.includes('cafe') || typeStr.includes('bakery')) return '咖啡廳';
  if (typeStr.includes('restaurant')) return '中餐廳';
  return '其他';
}
