/**
 * Sheets.gs — Google Sheets 操作封裝層
 */

const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');

const SHEET_NAMES = {
  USERS:        'Users',
  RESTAURANTS:  'Restaurants',
  REVIEWS:      'Reviews',
  CLASSIFY_LOG: 'ClassifyLog'
};

const SHEET_HEADERS = {
  USERS: [
    'user_id','display_name','avatar_url','avatar_updated_at','created_at'
  ],
  RESTAURANTS: [
    'restaurant_id','place_id','name','address','lat','lng',
    'category','google_types','price_level','phone','website',
    'opening_hours_json','first_visited_by','first_visited_at',
    'visit_count','avg_rating','ai_classified_at','created_at','updated_at'
  ],
  REVIEWS: [
    'review_id','restaurant_id','user_id','visited_date',
    'overall_rating','scores_json','note','items_json','meal_type','created_at','updated_at'
  ],
  CLASSIFY_LOG: [
    'log_id','restaurant_id','place_id','restaurant_name',
    'google_types','result_category','created_at'
  ]
};

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getOrCreateSheet(sheetKey) {
  const name    = SHEET_NAMES[sheetKey];
  const headers = SHEET_HEADERS[sheetKey];
  const ss      = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#2d2d2d')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  } else {
    // 自動修復 header
    const lastCol = Math.max(sheet.getLastColumn(), headers.length);
    const cur = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
    if (cur.slice(0, headers.length).join(',') !== headers.join(',')) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  return sheet;
}

function readAllRows(sheetKey) {
  const sheet = getOrCreateSheet(sheetKey);
  const rows  = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  const headers = rows[0].map(String);
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return normalizeRow(obj);
  }).filter(r => r[headers[0]]);
}

function appendRow(sheetKey, obj) {
  const sheet   = getOrCreateSheet(sheetKey);
  const headers = SHEET_HEADERS[sheetKey];
  const row     = headers.map(h => (obj[h] !== undefined && obj[h] !== null) ? obj[h] : '');
  sheet.appendRow(row);
}

function updateRow(sheetKey, primaryKey, id, patch) {
  const sheet   = getOrCreateSheet(sheetKey);
  const headers = SHEET_HEADERS[sheetKey];
  const pkIdx   = headers.indexOf(primaryKey);
  if (pkIdx < 0) return false;
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][pkIdx]) === String(id)) {
      Object.keys(patch).forEach(key => {
        const colIdx = headers.indexOf(key);
        if (colIdx >= 0) sheet.getRange(i + 1, colIdx + 1).setValue(patch[key]);
      });
      return true;
    }
  }
  return false;
}

function deleteRow(sheetKey, primaryKey, id) {
  const sheet   = getOrCreateSheet(sheetKey);
  const headers = SHEET_HEADERS[sheetKey];
  const pkIdx   = headers.indexOf(primaryKey);
  if (pkIdx < 0) return false;
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][pkIdx]) === String(id)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function normalizeRow(obj) {
  const tz = Session.getScriptTimeZone();
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    if (val instanceof Date) {
      if (key === 'visited_date' || key === 'date') {
        obj[key] = Utilities.formatDate(val, tz, 'yyyy-MM-dd');
      } else if (key.endsWith('_at')) {
        obj[key] = Utilities.formatDate(val, tz, "yyyy-MM-dd'T'HH:mm:ss'Z'");
      } else {
        obj[key] = Utilities.formatDate(val, tz, 'yyyy-MM-dd');
      }
    } else if (typeof val === 'number') {
      obj[key] = val;
    } else {
      obj[key] = String(val === null || val === undefined ? '' : val);
    }
  });
  return obj;
}

function initAllSheets() {
  Object.keys(SHEET_NAMES).forEach(key => getOrCreateSheet(key));
  const users = readAllRows('USERS');
  const existingIds = users.map(u => u.user_id);
  const now = nowIso();
  if (!existingIds.includes('user_pigpig')) {
    appendRow('USERS', { user_id: 'user_pigpig', display_name: '豬豬', avatar_url: '', avatar_updated_at: now, created_at: now });
  }
  if (!existingIds.includes('user_gungun')) {
    appendRow('USERS', { user_id: 'user_gungun', display_name: '滾滾', avatar_url: '', avatar_updated_at: now, created_at: now });
  }
  Logger.log('✓ Sheets 初始化完成');
}
