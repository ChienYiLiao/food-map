/**
 * config.js — 全域設定
 * 部署前必須填入 GAS_URL
 * GOOGLE_MAPS_API_KEY 存在 localStorage（不放 git）
 */

const CONFIG = {
  // ── 部署後填入 Google Apps Script Web App URL ──────────────────────────────
  GAS_URL: '',  // 填入後：'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec'

  // ── 使用者設定 ─────────────────────────────────────────────────────────────
  USERS: {
    user_pigpig: {
      displayName: '豬豬',
      defaultAvatar: 'assets/default-avatars/pigpig.png',
      emoji: '🐷'
    },
    user_gungun: {
      displayName: '滾滾',
      defaultAvatar: 'assets/default-avatars/gungun.png',
      emoji: '🧚‍♀️'
    }
  },

  // ── 餐廳類別（與 Claude API 分類結果對應） ─────────────────────────────────
  RESTAURANT_CATEGORIES: [
    { key: '飲料店',   emoji: '🧋', color: '#7a9ab5' },
    { key: '中餐廳',   emoji: '🥢', color: '#c09898' },
    { key: '西餐廳',   emoji: '🍝', color: '#9b8fb0' },
    { key: '小吃',     emoji: '🍜', color: '#c4a87a' },
    { key: '日式料理', emoji: '🍱', color: '#7aaa8e' },
    { key: '韓式料理', emoji: '🌶️', color: '#c28a8a' },
    { key: '甜點',     emoji: '🧁', color: '#b8aecf' },
    { key: '咖啡廳',   emoji: '☕', color: '#a08eb5' },
    { key: '早餐店',   emoji: '🍳', color: '#c4a87a' },
    { key: '火鍋',     emoji: '🫕', color: '#c28a8a' },
    { key: '燒烤',     emoji: '🍖', color: '#c09898' },
    { key: '速食',     emoji: '🍔', color: '#7a9ab5' },
    { key: '其他',     emoji: '🍽️', color: '#8e8aa2' }
  ],

  // ── 各類別評分維度（1~5 顆星） ─────────────────────────────────────────────
  REVIEW_DIMENSIONS: {
    '飲料店': [
      { key: 'sweetness',  label: '甜度',    emoji: '🍯', desc: '1=不甜 ~ 5=很甜' },
      { key: 'tea_flavor', label: '茶味',    emoji: '🍵', desc: '1=淡 ~ 5=濃' },
      { key: 'ice',        label: '冰塊量',  emoji: '🧊', desc: '1=去冰 ~ 5=全冰' },
      { key: 'value',      label: 'CP值',    emoji: '💰', desc: '1=差 ~ 5=超值' }
    ],
    '咖啡廳': [
      { key: 'coffee',     label: '咖啡香',  emoji: '☕', desc: '1=淡 ~ 5=濃郁' },
      { key: 'ambience',   label: '環境氣氛', emoji: '🪴', desc: '1=一般 ~ 5=很棒' },
      { key: 'sweetness',  label: '甜度',    emoji: '🍯', desc: '1=不甜 ~ 5=甜' },
      { key: 'value',      label: 'CP值',    emoji: '💰', desc: '1=差 ~ 5=超值' }
    ],
    '甜點': [
      { key: 'sweetness',  label: '甜度',    emoji: '🍯', desc: '1=不甜 ~ 5=很甜' },
      { key: 'texture',    label: '口感',    emoji: '✨', desc: '1=普通 ~ 5=絕妙' },
      { key: 'portion',    label: '份量',    emoji: '🍰', desc: '1=少 ~ 5=多' },
      { key: 'value',      label: 'CP值',    emoji: '💰', desc: '1=差 ~ 5=超值' }
    ],
    '中餐廳': [
      { key: 'flavor',     label: '口味',    emoji: '😋', desc: '1=普通 ~ 5=很好吃' },
      { key: 'portion',    label: '份量',    emoji: '🍚', desc: '1=少 ~ 5=很多' },
      { key: 'freshness',  label: '新鮮度',  emoji: '🌿', desc: '1=普通 ~ 5=很新鮮' },
      { key: 'value',      label: 'CP值',    emoji: '💰', desc: '1=差 ~ 5=超值' }
    ],
    '西餐廳': [
      { key: 'flavor',     label: '口味',    emoji: '😋', desc: '1=普通 ~ 5=很好吃' },
      { key: 'ambience',   label: '環境氣氛', emoji: '🕯️', desc: '1=一般 ~ 5=很棒' },
      { key: 'portion',    label: '份量',    emoji: '🥩', desc: '1=少 ~ 5=很多' },
      { key: 'value',      label: 'CP值',    emoji: '💰', desc: '1=差 ~ 5=超值' }
    ],
    '小吃': [
      { key: 'flavor',     label: '口味',    emoji: '😋', desc: '1=普通 ~ 5=很好吃' },
      { key: 'portion',    label: '份量',    emoji: '🍜', desc: '1=少 ~ 5=很多' },
      { key: 'value',      label: 'CP值',    emoji: '💰', desc: '1=差 ~ 5=超值' }
    ],
    '日式料理': [
      { key: 'freshness',  label: '新鮮度',  emoji: '🐟', desc: '1=普通 ~ 5=超新鮮' },
      { key: 'flavor',     label: '口味',    emoji: '😋', desc: '1=普通 ~ 5=很好吃' },
      { key: 'portion',    label: '份量',    emoji: '🍣', desc: '1=少 ~ 5=很多' },
      { key: 'value',      label: 'CP值',    emoji: '💰', desc: '1=差 ~ 5=超值' }
    ],
    '韓式料理': [
      { key: 'spicy',      label: '辣度',    emoji: '🌶️', desc: '1=不辣 ~ 5=超辣' },
      { key: 'flavor',     label: '口味',    emoji: '😋', desc: '1=普通 ~ 5=很好吃' },
      { key: 'portion',    label: '份量',    emoji: '🥘', desc: '1=少 ~ 5=很多' },
      { key: 'value',      label: 'CP值',    emoji: '💰', desc: '1=差 ~ 5=超值' }
    ],
    '早餐店': [
      { key: 'flavor',     label: '口味',    emoji: '😋', desc: '1=普通 ~ 5=很好吃' },
      { key: 'freshness',  label: '新鮮度',  emoji: '🥚', desc: '1=普通 ~ 5=很新鮮' },
      { key: 'speed',      label: '出餐速度', emoji: '⚡', desc: '1=很慢 ~ 5=很快' },
      { key: 'value',      label: 'CP值',    emoji: '💰', desc: '1=差 ~ 5=超值' }
    ],
    '火鍋': [
      { key: 'broth',      label: '湯底',    emoji: '🫕', desc: '1=普通 ~ 5=超棒' },
      { key: 'freshness',  label: '食材新鮮', emoji: '🥬', desc: '1=普通 ~ 5=很新鮮' },
      { key: 'portion',    label: '份量',    emoji: '🍖', desc: '1=少 ~ 5=很多' },
      { key: 'value',      label: 'CP值',    emoji: '💰', desc: '1=差 ~ 5=超值' }
    ],
    '燒烤': [
      { key: 'meat_quality', label: '肉質',   emoji: '🥩', desc: '1=普通 ~ 5=很嫩' },
      { key: 'flavor',       label: '口味',   emoji: '😋', desc: '1=普通 ~ 5=很好吃' },
      { key: 'portion',      label: '份量',   emoji: '🍖', desc: '1=少 ~ 5=很多' },
      { key: 'value',        label: 'CP值',   emoji: '💰', desc: '1=差 ~ 5=超值' }
    ],
    '速食': [
      { key: 'flavor',     label: '口味',    emoji: '😋', desc: '1=普通 ~ 5=很好吃' },
      { key: 'speed',      label: '出餐速度', emoji: '⚡', desc: '1=很慢 ~ 5=很快' },
      { key: 'value',      label: 'CP值',    emoji: '💰', desc: '1=差 ~ 5=超值' }
    ],
    '其他': [
      { key: 'flavor',     label: '口味',    emoji: '😋', desc: '1=普通 ~ 5=很好吃' },
      { key: 'value',      label: 'CP值',    emoji: '💰', desc: '1=差 ~ 5=超值' }
    ]
  },

  // ── 預設地圖半徑（公尺） ──────────────────────────────────────────────────
  DEFAULT_RADIUS: 1000,
  RADIUS_OPTIONS: [
    { label: '500m', value: 500 },
    { label: '1km',  value: 1000 },
    { label: '1.5km', value: 1500 },
    { label: '2km',  value: 2000 }
  ],

  // ── 餐型 ──────────────────────────────────────────────────────────────────
  MEAL_TYPES: [
    { key: 'breakfast', label: '早餐', emoji: '🌅', hours: [6, 10] },
    { key: 'lunch',     label: '午餐', emoji: '☀️',  hours: [11, 14] },
    { key: 'dinner',    label: '晚餐', emoji: '🌙', hours: [17, 21] },
    { key: 'supper',    label: '消夜', emoji: '⭐', hours: [21, 2] }
  ]
};

// ── Helper 函式 ──────────────────────────────────────────────────────────────

CONFIG.getCategoryEmoji = function(categoryKey) {
  const cat = CONFIG.RESTAURANT_CATEGORIES.find(c => c.key === categoryKey);
  return cat ? cat.emoji : '🍽️';
};

CONFIG.getCategoryColor = function(categoryKey) {
  const cat = CONFIG.RESTAURANT_CATEGORIES.find(c => c.key === categoryKey);
  return cat ? cat.color : '#8e8aa2';
};

CONFIG.getReviewDimensions = function(categoryKey) {
  return CONFIG.REVIEW_DIMENSIONS[categoryKey] || CONFIG.REVIEW_DIMENSIONS['其他'];
};

CONFIG.getMapsApiKey = function() {
  return localStorage.getItem('GOOGLE_MAPS_API_KEY') || '';
};

CONFIG.getMealTypeByHour = function(hour) {
  const h = hour ?? new Date().getHours();
  for (const mt of CONFIG.MEAL_TYPES) {
    const [start, end] = mt.hours;
    if (end > start) {
      if (h >= start && h < end) return mt.key;
    } else {
      // 跨午夜（消夜：21~2）
      if (h >= start || h < end) return mt.key;
    }
  }
  return 'lunch'; // 預設午餐
};
