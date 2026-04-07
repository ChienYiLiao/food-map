/**
 * Code.gs — GAS Web App 主路由
 *
 * 部署設定：
 * - 執行身分：我（帳戶擁有者）
 * - 存取權：任何人（含匿名）
 *
 * Script Properties 需設定：
 * - SPREADSHEET_ID:  Google Sheets ID
 * - DRIVE_FOLDER_ID: 頭像存放的 Drive 資料夾 ID
 * - CLAUDE_API_KEY:  Anthropic Claude API Key（AI 分類用）
 *
 * 寫入機制：前端用 GET + ?payload=JSON，避免瀏覽器跟隨 GAS 302 轉址時 POST→GET 問題。
 */

// ── GET ────────────────────────────────────────────────────────────────────────
function doGet(e) {
  // 寫入操作
  if (e.parameter && e.parameter.payload) {
    let body;
    try { body = JSON.parse(e.parameter.payload); }
    catch(_) { return jsonRes({ ok: false, error: 'Invalid payload JSON' }); }
    return handleAction(body);
  }

  // 讀取操作
  const action = (e.parameter && e.parameter.action) || '';
  try {
    switch (action) {
      case 'getUsers':       return jsonRes({ ok: true, data: handleGetUsers(e.parameter) });
      case 'getRestaurants': return jsonRes({ ok: true, data: handleGetRestaurants(e.parameter) });
      case 'getReviews':     return jsonRes({ ok: true, data: handleGetReviews(e.parameter) });
      default:               return jsonRes({ ok: false, error: 'Unknown action: ' + action });
    }
  } catch(err) {
    return jsonRes({ ok: false, error: err.message });
  }
}

// ── POST（備用） ───────────────────────────────────────────────────────────────
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch(_) { return jsonRes({ ok: false, error: 'Invalid JSON' }); }
  return handleAction(body);
}

// ── 共用 action 處理 ───────────────────────────────────────────────────────────
function handleAction(body) {
  const lock = LockService.getScriptLock();
  lock.tryLock(15000);
  try {
    const action = body.action;
    switch (action) {
      case 'updateAvatar':         return jsonRes({ ok: true, data: handleUpdateAvatar(body) });
      case 'upsertRestaurant':     return jsonRes({ ok: true, data: handleUpsertRestaurant(body) });
      case 'classifyRestaurant':   return jsonRes({ ok: true, data: handleClassifyRestaurant(body) });
      case 'addReview':            return jsonRes({ ok: true, data: handleAddReview(body) });
      case 'updateReview':         return jsonRes({ ok: true, data: handleUpdateReview(body) });
      case 'deleteReview':         return jsonRes({ ok: true, data: handleDeleteReview(body) });
      default:                     return jsonRes({ ok: false, error: 'Unknown action: ' + action });
    }
  } catch(err) {
    return jsonRes({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}
