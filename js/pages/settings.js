/**
 * settings.js — 設定頁面
 * 管理：Google Maps API Key、使用者暱稱、頭像
 */

const SettingsPage = (() => {
  function show() {
    _render();
    // 右上角無按鈕
    const rightEl = document.getElementById('topbar-right');
    if (rightEl) rightEl.innerHTML = '';
  }

  function hide() {}

  function _render() {
    const page = document.getElementById('page-settings');
    if (!page) return;
    const user = State.getState().currentUser;
    const mapsKey = CONFIG.getMapsApiKey();
    const gasUrl  = CONFIG.GAS_URL || localStorage.getItem('GAS_URL') || '';

    page.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-title">👤 個人資料</div>
        <div class="settings-item" id="settings-avatar-item" style="cursor:pointer;">
          <div>
            <div class="settings-item-label">頭像與暱稱</div>
            <div class="settings-item-desc">${user ? user.displayName : '未登入'}</div>
          </div>
          <div class="settings-item-right">
            <img class="user-avatar sm" id="settings-user-avatar"
                 src="${_getAvatarSrc(user)}" alt="">
            <span>›</span>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">🔑 API 設定</div>
        <div class="settings-item" style="flex-direction:column;align-items:flex-start;gap:8px;">
          <div>
            <div class="settings-item-label">Google Maps API Key</div>
            <div class="settings-item-desc">用於顯示地圖與搜尋附近餐廳</div>
          </div>
          <div style="width:100%;display:flex;gap:8px;">
            <input type="password" class="form-input" id="maps-api-key-input"
                   placeholder="貼上 Google Maps API Key"
                   value="${mapsKey}"
                   style="flex:1;font-size:13px;">
            <button class="btn btn-primary" style="padding:8px 14px;white-space:nowrap;" id="save-maps-key">儲存</button>
          </div>
          <div style="font-size:11px;color:var(--color-text-muted);">
            需啟用：Maps JavaScript API + Places API (New)<br>
            並建立 Map ID（Advanced Marker 使用）
          </div>
        </div>

        <div class="settings-item" style="flex-direction:column;align-items:flex-start;gap:8px;margin-top:4px;">
          <div>
            <div class="settings-item-label">GAS Web App URL</div>
            <div class="settings-item-desc">Google Apps Script 後端網址</div>
          </div>
          <div style="width:100%;display:flex;gap:8px;">
            <input type="text" class="form-input" id="gas-url-input"
                   placeholder="https://script.google.com/macros/s/..."
                   value="${gasUrl}"
                   style="flex:1;font-size:11px;">
            <button class="btn btn-primary" style="padding:8px 14px;white-space:nowrap;" id="save-gas-url">儲存</button>
          </div>
        </div>

        <div class="settings-item" style="flex-direction:column;align-items:flex-start;gap:8px;margin-top:4px;">
          <div>
            <div class="settings-item-label">Map ID</div>
            <div class="settings-item-desc">Advanced Marker 所需（可選）</div>
          </div>
          <div style="width:100%;display:flex;gap:8px;">
            <input type="text" class="form-input" id="map-id-input"
                   placeholder="Google Cloud Console Map ID"
                   value="${localStorage.getItem('GOOGLE_MAP_ID') || ''}"
                   style="flex:1;font-size:13px;">
            <button class="btn btn-primary" style="padding:8px 14px;white-space:nowrap;" id="save-map-id">儲存</button>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">ℹ️ 關於</div>
        <div class="settings-item">
          <div>
            <div class="settings-item-label">美食地圖</div>
            <div class="settings-item-desc">豬豬 & 滾滾的美食紀錄 App</div>
          </div>
          <div class="settings-item-right">v1.0</div>
        </div>
        <div class="settings-item" style="cursor:pointer;" id="settings-logout">
          <div class="settings-item-label" style="color:var(--color-expense);">切換使用者</div>
        </div>
      </div>
    `;

    // 儲存 Maps API Key
    page.querySelector('#save-maps-key').onclick = () => {
      const key = page.querySelector('#maps-api-key-input').value.trim();
      if (!key) { Toast.error('請輸入 API Key'); return; }
      localStorage.setItem('GOOGLE_MAPS_API_KEY', key);
      Toast.success('Google Maps API Key 已儲存！重新整理後生效');
      State.invalidateRestaurantsCache();
    };

    // 儲存 GAS URL
    page.querySelector('#save-gas-url').onclick = () => {
      const url = page.querySelector('#gas-url-input').value.trim();
      if (!url) { Toast.error('請輸入 GAS URL'); return; }
      localStorage.setItem('GAS_URL', url);
      CONFIG.GAS_URL = url;
      Toast.success('GAS URL 已儲存！');
      State.invalidateRestaurantsCache();
    };

    // 儲存 Map ID
    page.querySelector('#save-map-id').onclick = () => {
      const id = page.querySelector('#map-id-input').value.trim();
      localStorage.setItem('GOOGLE_MAP_ID', id);
      Toast.success('Map ID 已儲存！重新整理後生效');
    };

    // 頭像設定
    page.querySelector('#settings-avatar-item').onclick = () => {
      if (!user) return;
      _showAvatarMenu(user);
    };

    // 切換使用者
    page.querySelector('#settings-logout').onclick = async () => {
      const ok = await Modal.confirm('確定要切換使用者嗎？', { confirmText: '切換', danger: true });
      if (ok) {
        State.clearUser();
        window.location.href = 'index.html';
      }
    };
  }

  function _getAvatarSrc(user) {
    if (!user) return 'assets/default-avatars/pigpig.png';
    return State.getAvatarCache(user.userId) || user.avatarUrl || CONFIG.USERS[user.userId]?.defaultAvatar || '';
  }

  function _showAvatarMenu(user) {
    const avatarKey = user.userId === 'user_pigpig' ? 'pigpig' : 'gungun';
    let overlay = document.getElementById('settings-avatar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'settings-avatar-overlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }
    const currentName = localStorage.getItem(`nickname_${user.userId}`) || user.displayName || '';
    overlay.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">個人設定</div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <button class="btn btn-secondary btn-block" id="sav-camera">📷 拍攝更換頭像</button>
          <button class="btn btn-secondary btn-block" id="sav-gallery">🖼️ 從相簿選擇頭像</button>
          <div style="border-top:1px solid var(--color-border);padding-top:12px;">
            <div style="font-size:12px;color:var(--color-text-muted);margin-bottom:8px;">修改暱稱</div>
            <div style="display:flex;gap:8px;">
              <input type="text" id="sav-nickname" class="form-input" style="flex:1;"
                     placeholder="輸入新暱稱" value="${currentName}" maxlength="10">
              <button class="btn btn-primary" style="padding:8px 16px;white-space:nowrap;" id="sav-save-name">儲存</button>
            </div>
          </div>
          <button class="btn btn-ghost btn-block" id="sav-cancel">取消</button>
        </div>
      </div>
    `;
    overlay.querySelector('#sav-cancel').onclick = () => Modal.hide('settings-avatar-overlay');
    overlay.querySelector('#sav-camera').onclick = () => {
      Modal.hide('settings-avatar-overlay');
      AvatarCropper.pick('camera', r => _applyAvatar(user, r));
    };
    overlay.querySelector('#sav-gallery').onclick = () => {
      Modal.hide('settings-avatar-overlay');
      AvatarCropper.pick('gallery', r => _applyAvatar(user, r));
    };
    overlay.querySelector('#sav-save-name').onclick = () => {
      const newName = overlay.querySelector('#sav-nickname').value.trim();
      if (!newName) return;
      localStorage.setItem(`nickname_${user.userId}`, newName);
      const updatedUser = { ...user, displayName: newName };
      State.saveUser(updatedUser);
      Modal.hide('settings-avatar-overlay');
      _render(); // 重新渲染設定頁
      Toast.success('暱稱已更新！');
    };
    Modal.show('settings-avatar-overlay');
  }

  async function _applyAvatar(user, { base64, mimeType, dataUrl }) {
    try {
      State.saveAvatarCache(user.userId, dataUrl);
      const updatedUser = { ...user, avatarUrl: dataUrl };
      State.saveUser(updatedUser);
      _render();
      // 更新 topbar 頭像
      const topbarImg = document.getElementById('topbar-avatar');
      if (topbarImg) topbarImg.src = dataUrl;
      Toast.success('頭像更新成功！');
    } catch (err) {
      Toast.error('頭像更新失敗');
    }
  }

  // 初始化：從 localStorage 讀取 GAS_URL 到 CONFIG
  (function _init() {
    const savedGasUrl = localStorage.getItem('GAS_URL');
    if (savedGasUrl && !CONFIG.GAS_URL) {
      CONFIG.GAS_URL = savedGasUrl;
    }
  })();

  return { show, hide };
})();
