/**
 * map.js — 地圖主頁
 * Google Maps JavaScript API + Places API Nearby Search + Marker 管理
 */

const MapPage = (() => {
  let _map = null;
  let _markers = {};
  let _userLocation = null;     // 使用者 GPS 位置（不隨拖曳改變）
  let _currentCenter = null;    // 目前搜尋中心（自由模式時跟隨拖曳）
  let _currentRadius = CONFIG.DEFAULT_RADIUS;
  let _isInitialized = false;
  let _selectedPlaceId = null;
  let _gasRestaurants = [];
  let _useAdvancedMarker = false;
  let _locationMarker = null;   // 「我的位置」標記（頭像）
  let _rangeCircle = null;      // 搜尋範圍圓圈
  let _allRestaurants = [];     // 當前顯示的所有餐廳（供統計條點擊用）
  const _markerIconCache = {};  // emoji marker icon 快取

  // ── 頁面進入 ──────────────────────────────────────────────────────────────
  async function show() {
    // 初始化半徑按鈕
    _renderRadiusOptions();

    // 右上角 refresh 按鈕
    const rightEl = document.getElementById('topbar-right');
    if (rightEl) rightEl.innerHTML = '';

    // 初始化地圖（第一次進入）
    if (!_isInitialized) {
      await _initMap();
    } else {
      // 地圖已初始化：還原 display 並觸發 resize（因 hide 時設了 display:none）
      const container = document.getElementById('map-container');
      if (container) {
        container.style.display = 'block';
        container.style.visibility = 'visible';
        container.style.width = window.innerWidth + 'px';
        container.style.height = window.innerHeight + 'px';
      }
      if (_map) setTimeout(() => {
        google.maps.event.trigger(_map, 'resize');
        if (_currentCenter) _map.setCenter({ lat: _currentCenter.lat, lng: _currentCenter.lng });
      }, 50);
    }

    // FAB 按鈕事件
    const fabRefresh = document.getElementById('fab-refresh');
    const fabLocate  = document.getElementById('fab-locate');
    if (fabRefresh) fabRefresh.onclick = () => refreshNearby(true);
    if (fabLocate)  fabLocate.onclick  = () => _locateAndCenter();
  }

  function hide() {
    const container = document.getElementById('map-container');
    if (container) { container.style.visibility = 'hidden'; container.style.display = 'none'; }
    Loader.forceHide(); // 確保 Loader 不會卡住導覽列
  }

  // ── 初始化地圖 ──────────────────────────────────────────────────────────────
  async function _initMap() {
    const apiKey = CONFIG.getMapsApiKey();
    if (!apiKey) {
      _showNoKeyMessage();
      return;
    }

    Loader.show('載入地圖中...');
    try {
      await _loadGoogleMapsScript(apiKey);

      // ── Race condition 保護：如果使用者已切換到其他頁面，停止初始化
      if (State.getState().currentPage !== 'map') {
        Loader.hide();
        return;
      }

      const center = await _getUserLocation();
      _userLocation  = center;
      _currentCenter = center;
      State.setState({ userLocation: center }); // 供 random-pick 使用

      // 再次確認仍在地圖頁
      if (State.getState().currentPage !== 'map') {
        Loader.hide();
        return;
      }

      _useAdvancedMarker = false;

      const container = document.getElementById('map-container');
      container.style.display = 'block';
      container.style.visibility = 'visible';
      container.style.width = window.innerWidth + 'px';
      container.style.height = window.innerHeight + 'px';

      const mapOptions = {
        center: { lat: center.lat, lng: center.lng },
        zoom: 16,
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: false
      };
      _map = new google.maps.Map(container, mapOptions);

      // 拖曳：只有「自由模式」（radius=0）才重新搜尋
      _map.addListener('dragend', () => {
        if (_currentRadius === 0) {
          const c = _map.getCenter();
          _currentCenter = { lat: c.lat(), lng: c.lng() };
          refreshNearby(false);
        }
      });

      _isInitialized = true;
      State.setState({ mapCenter: _currentCenter });

      google.maps.event.trigger(_map, 'resize');
      _map.setCenter({ lat: center.lat, lng: center.lng });

      // 建立「我的位置」頭像標記 & 搜尋範圍圓圈
      await _createLocationMarker();
      _updateRangeCircle();

      // 初次載入附近餐廳（最後一次確認仍在地圖頁）
      if (State.getState().currentPage === 'map') {
        await refreshNearby(true);
      }
    } catch (err) {
      Toast.error('地圖載入失敗：' + err.message);
      console.error(err);
    } finally {
      Loader.hide();
    }
  }

  // 載入 Google Maps Script（傳統同步回呼方式，最相容）
  function _loadGoogleMapsScript(apiKey) {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) { resolve(); return; }
      if (document.getElementById('gmaps-script')) {
        const check = setInterval(() => {
          if (window.google && window.google.maps) { clearInterval(check); resolve(); }
        }, 100);
        setTimeout(() => { clearInterval(check); reject(new Error('Google Maps 載入逾時')); }, 15000);
        return;
      }
      window._gmapsResolve = resolve;
      window._gmapsReject  = reject;
      window.initGoogleMaps = () => { window._gmapsResolve && window._gmapsResolve(); };
      const script = document.createElement('script');
      script.id    = 'gmaps-script';
      script.async = true;
      script.defer = true;
      script.src   = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMaps`;
      script.onerror = () => reject(new Error('Google Maps 腳本載入失敗，請確認 API Key 是否正確'));
      document.head.appendChild(script);
    });
  }

  // 取得使用者 GPS 位置
  function _getUserLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: 25.0330, lng: 121.5654 }); // 台北預設
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        ()  => resolve({ lat: 25.0330, lng: 121.5654 }),
        { timeout: 8000, maximumAge: 60000 }
      );
    });
  }

  // 定位並移動到目前位置
  async function _locateAndCenter() {
    Loader.show('定位中...');
    try {
      const center = await _getUserLocation();
      _userLocation  = center;
      _currentCenter = center;
      if (_map) _map.panTo({ lat: center.lat, lng: center.lng });
      State.setState({ mapCenter: center, userLocation: center });
      await _createLocationMarker();
      _updateRangeCircle();
      await refreshNearby(true);
    } finally {
      Loader.hide();
    }
  }

  // ── 我的位置標記（使用者頭像） ───────────────────────────────────────────────
  async function _createLocationMarker() {
    if (!_map || !_userLocation) return;
    if (_locationMarker) _locationMarker.setMap(null);

    const user = State.getState().currentUser;
    const avatarSrc = user?.avatarUrl || user?.defaultAvatar || null;
    let icon = null;

    if (avatarSrc) {
      try {
        const circularUrl = await _makeCircularAvatar(avatarSrc, 44);
        if (circularUrl) {
          icon = {
            url: circularUrl,
            scaledSize: new google.maps.Size(48, 48),
            anchor: new google.maps.Point(24, 24)
          };
        }
      } catch (e) { /* fallback */ }
    }

    if (!icon) {
      icon = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#4A90D9',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3
      };
    }

    _locationMarker = new google.maps.Marker({
      map: _map,
      position: { lat: _userLocation.lat, lng: _userLocation.lng },
      title: '我的位置',
      zIndex: 999,
      icon
    });
  }

  // 將頭像圖片繪製成帶白色圓框的圓形 data URL
  function _makeCircularAvatar(src, size) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const total = size + 6;
          const canvas = document.createElement('canvas');
          canvas.width = total;
          canvas.height = total;
          const ctx = canvas.getContext('2d');
          const cx = total / 2;
          const r = size / 2;
          // 白色外框
          ctx.beginPath();
          ctx.arc(cx, cx, r + 3, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          // 藍色邊框
          ctx.beginPath();
          ctx.arc(cx, cx, r + 2, 0, Math.PI * 2);
          ctx.fillStyle = '#4A90D9';
          ctx.fill();
          // 圓形裁切後貼圖
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cx, r, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, 3, 3, size, size);
          ctx.restore();
          resolve(canvas.toDataURL());
        } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      // 確保是絕對路徑
      img.src = new URL(src, location.href).href;
    });
  }

  // 將 emoji 繪製成圓形 marker icon 的 data URL（有快取）
  function _emojiMarkerUrl(emoji, isVisited) {
    const key = `${emoji}_${isVisited ? 1 : 0}`;
    if (_markerIconCache[key]) return _markerIconCache[key];

    const size = 40;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;

    // 背景圓
    ctx.beginPath();
    ctx.arc(cx, cx, cx - 1, 0, Math.PI * 2);
    ctx.fillStyle = isVisited ? '#9b8fb0' : '#7a9ab5';
    ctx.fill();

    // 白色邊框
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // emoji 文字
    ctx.font = '20px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, cx, cx + 1);

    const url = canvas.toDataURL();
    _markerIconCache[key] = url;
    return url;
  }

  // 根據餐廳資料取得顯示 emoji
  function _getRestaurantEmoji(restaurant) {
    if (restaurant.category) {
      return CONFIG.getCategoryEmoji(restaurant.category);
    }
    // 從 google types 猜測
    const types = restaurant.google_types || [];
    if (types.some(t => t.includes('cafe') || t.includes('coffee'))) return '☕';
    if (types.some(t => t.includes('bakery'))) return '🥐';
    if (types.some(t => t.includes('bar'))) return '🍺';
    if (types.some(t => t.includes('japanese'))) return '🍱';
    if (types.some(t => t.includes('korean'))) return '🌶️';
    if (types.some(t => t.includes('chinese'))) return '🥢';
    if (types.some(t => t.includes('ramen'))) return '🍜';
    if (types.some(t => t.includes('sushi'))) return '🍣';
    if (types.some(t => t.includes('pizza'))) return '🍕';
    if (types.some(t => t.includes('hamburger') || t.includes('fast_food'))) return '🍔';
    if (types.some(t => t.includes('dessert') || t.includes('ice_cream'))) return '🧁';
    if (types.some(t => t.includes('breakfast') || t.includes('brunch'))) return '🍳';
    return '🍽️';
  }

  // ── 搜尋範圍圓圈 ─────────────────────────────────────────────────────────────
  function _updateRangeCircle() {
    if (!_map || !_userLocation) return;
    if (_rangeCircle) _rangeCircle.setMap(null);
    _rangeCircle = null;
    if (_currentRadius > 0) {
      _rangeCircle = new google.maps.Circle({
        map: _map,
        center: { lat: _userLocation.lat, lng: _userLocation.lng },
        radius: _currentRadius,
        strokeColor: '#9b8fb0',
        strokeOpacity: 0.7,
        strokeWeight: 2,
        fillColor: '#9b8fb0',
        fillOpacity: 0.06
      });
    }
  }

  // ── 刷新附近餐廳 ────────────────────────────────────────────────────────────
  async function refreshNearby(forceGas = false) {
    if (!_map || !_currentCenter) return;

    try {
      // 1. 從 GAS 取得已存的餐廳資料（快取 5 分鐘內不重複拉）
      if (forceGas || !State.isRestaurantsCacheValid()) {
        const user = State.getState().currentUser;
        const gasData = await API.getRestaurants({ userId: user?.userId || '' });
        _gasRestaurants = gasData?.restaurants || [];
      } else {
        _gasRestaurants = State.getState().restaurantsCache || [];
      }

      // 2. 從 Places API 取得附近餐廳
      // 有限範圍：以我的位置為中心；自由模式：以地圖中心搜尋
      const searchCenter = (_currentRadius > 0 && _userLocation) ? _userLocation : _currentCenter;
      const searchRadius = _currentRadius > 0 ? _currentRadius : 2000;
      const placeResults = await API.searchNearby(
        searchCenter.lat,
        searchCenter.lng,
        searchRadius
      );

      // 3. 合併資料
      const merged = _mergeRestaurants(placeResults, _gasRestaurants);

      // 4. 將新餐廳 upsert 到 GAS（背景執行，不阻塞 UI）
      _backgroundUpsertNewRestaurants(placeResults, _gasRestaurants);

      // 5. 更新快取
      State.setRestaurantsCache(merged);

      // 6. 渲染 Markers
      _renderMarkers(merged);

      // 7. 更新統計條
      _updateStatsBar(merged);

    } catch (err) {
      Toast.error('取得附近餐廳失敗：' + err.message);
      console.error(err);
    }
  }

  // 合併 Places API 結果 + GAS 資料（以 place_id 為鍵）
  function _mergeRestaurants(placeResults, gasRestaurants) {
    const gasMap = {};
    gasRestaurants.forEach(r => { gasMap[r.place_id] = r; });

    return placeResults.map(place => {
      const gasData = gasMap[place.place_id] || {};
      return {
        // Places API 基礎資料
        ...place,
        // GAS 資料覆蓋（有則用 GAS 的，因為包含評分等）
        restaurant_id:    gasData.restaurant_id || null,
        category:         gasData.category || '',
        visit_count:      Number(gasData.visit_count) || 0,
        avg_rating:       Number(gasData.avg_rating) || 0,
        visitedByUsers:   gasData.visitedByUsers || [],
        first_visited_by: gasData.first_visited_by || '',
        first_visited_at: gasData.first_visited_at || ''
      };
    });
  }

  // 背景 upsert 新餐廳到 GAS（不阻塞 UI）
  async function _backgroundUpsertNewRestaurants(placeResults, gasRestaurants) {
    const gasPlaceIds = new Set(gasRestaurants.map(r => r.place_id));
    const newPlaces = placeResults.filter(p => !gasPlaceIds.has(p.place_id));
    if (newPlaces.length === 0) return;

    // 逐一 upsert（有節流，避免 GAS 過載）
    for (const place of newPlaces.slice(0, 5)) {
      try {
        const result = await API.upsertRestaurant(place);
        if (result?.restaurant_id) {
          // 更新快取中的 category 等資訊
          State.updateRestaurant(result.restaurant_id, {
            restaurant_id: result.restaurant_id,
            category: result.category || ''
          });
          // 更新對應 marker（分類完成後改顏色）
          _refreshMarkerCategory(place.place_id, result.category);
        }
      } catch (err) {
        // 背景操作失敗不顯示 error
        console.warn('upsert restaurant failed:', err);
      }
      await new Promise(r => setTimeout(r, 200)); // 避免 rate limit
    }
  }

  // ── Marker 管理 ────────────────────────────────────────────────────────────
  async function _renderMarkers(restaurants) {
    // 移除不在新結果中的 markers
    const newPlaceIds = new Set(restaurants.map(r => r.place_id));
    Object.keys(_markers).forEach(pid => {
      if (!newPlaceIds.has(pid)) {
        const m = _markers[pid];
        m.setMap(null);
        delete _markers[pid];
      }
    });

    // 新增或更新 markers
    for (const restaurant of restaurants) {
      if (!restaurant.lat || !restaurant.lng) continue;
      if (_markers[restaurant.place_id]) {
        _updateMarkerContent(_markers[restaurant.place_id], restaurant);
      } else {
        const marker = await _createMarker(restaurant);
        _markers[restaurant.place_id] = marker;
      }
    }
  }

  async function _createMarker(restaurant) {
    const isVisited = restaurant.visit_count > 0;
    const emoji = _getRestaurantEmoji(restaurant);
    const iconUrl = _emojiMarkerUrl(emoji, isVisited);
    const marker = new google.maps.Marker({
      map: _map,
      position: { lat: restaurant.lat, lng: restaurant.lng },
      title: restaurant.name,
      icon: {
        url: iconUrl,
        scaledSize: new google.maps.Size(isVisited ? 40 : 32, isVisited ? 40 : 32),
        anchor: new google.maps.Point(isVisited ? 20 : 16, isVisited ? 20 : 16)
      }
    });
    marker.addListener('click', () => _onMarkerClick(restaurant));
    marker._isClassicMarker = true;
    return marker;
  }

  function _buildMarkerContent(restaurant) {
    const isVisited = restaurant.visit_count > 0;
    const isSelected = _selectedPlaceId === restaurant.place_id;
    const div = document.createElement('div');
    div.className = `map-marker ${isVisited ? 'visited' : 'unvisited'} ${isSelected ? 'selected' : ''}`;
    div.dataset.placeId = restaurant.place_id;

    const inner = document.createElement('div');
    inner.className = 'marker-content';
    if (isVisited && restaurant.category) {
      inner.textContent = CONFIG.getCategoryEmoji(restaurant.category);
    } else if (!isVisited) {
      inner.textContent = ''; // 空心圓點（CSS 處理）
    } else {
      inner.textContent = '🍽️';
    }
    div.appendChild(inner);
    return div;
  }

  function _updateMarkerContent(marker, restaurant) {
    if (marker._isClassicMarker) {
      const isVisited = restaurant.visit_count > 0;
      const emoji = _getRestaurantEmoji(restaurant);
      const iconUrl = _emojiMarkerUrl(emoji, isVisited);
      marker.setIcon({
        url: iconUrl,
        scaledSize: new google.maps.Size(isVisited ? 40 : 32, isVisited ? 40 : 32),
        anchor: new google.maps.Point(isVisited ? 20 : 16, isVisited ? 20 : 16)
      });
    } else if (marker.content) {
      marker.content = _buildMarkerContent(restaurant);
    }
  }

  function _refreshMarkerCategory(placeId, category) {
    const marker = _markers[placeId];
    if (!marker) return;
    const restaurants = State.getState().restaurantsCache || [];
    const restaurant = restaurants.find(r => r.place_id === placeId);
    if (restaurant) _updateMarkerContent(marker, { ...restaurant, category });
  }

  // Marker 點擊 → 顯示餐廳詳情
  function _onMarkerClick(restaurant) {
    // 更新選中狀態
    if (_selectedPlaceId && _markers[_selectedPlaceId]) {
      const prev = _markers[_selectedPlaceId];
      if (prev.content) prev.content.classList.remove('selected');
    }
    _selectedPlaceId = restaurant.place_id;
    if (_markers[restaurant.place_id]?.content) {
      _markers[restaurant.place_id].content.classList.add('selected');
    }

    // 顯示詳情 Bottom Sheet
    RestaurantDetail.show(restaurant);
  }

  // ── 半徑選擇 ────────────────────────────────────────────────────────────────
  function _renderRadiusOptions() {
    const container = document.getElementById('radius-options');
    if (!container) return;
    container.innerHTML = CONFIG.RADIUS_OPTIONS.map(opt => `
      <button class="radius-btn ${opt.value === _currentRadius ? 'active' : ''}"
              onclick="MapPage.setRadius(${opt.value})">${opt.label}</button>
    `).join('');
  }

  function setRadius(meters) {
    _currentRadius = meters;
    State.setState({ mapRadius: meters });
    _renderRadiusOptions();
    // 有限範圍：回到我的位置並更新圓圈
    if (meters > 0 && _userLocation) {
      _currentCenter = _userLocation;
      if (_map) _map.panTo({ lat: _userLocation.lat, lng: _userLocation.lng });
    }
    _updateRangeCircle();
    refreshNearby(false);
  }

  // ── 統計條 ───────────────────────────────────────────────────────────────────
  function _updateStatsBar(restaurants) {
    _allRestaurants = restaurants; // 存起來供點擊用

    const visited = restaurants.filter(r => r.visit_count > 0);
    const open    = restaurants.filter(r => r.isOpen === true);

    const statVisited = document.getElementById('stat-visited');
    const statTotal   = document.getElementById('stat-total');
    const statOpen    = document.getElementById('stat-open');
    if (statVisited) statVisited.textContent = visited.length;
    if (statTotal)   statTotal.textContent   = restaurants.length;
    if (statOpen)    statOpen.textContent    = open.length;

    // 綁定點擊（只綁一次，用 delegation）
    const bar = document.getElementById('map-stats-bar');
    if (bar && !bar._listenersAdded) {
      bar._listenersAdded = true;
      const items = bar.querySelectorAll('.map-stat-item');
      if (items[0]) items[0].addEventListener('click', () =>
        _showRestaurantList('已吃過', _allRestaurants.filter(r => r.visit_count > 0)));
      if (items[1]) items[1].addEventListener('click', () =>
        _showRestaurantList('附近餐廳', _allRestaurants));
      if (items[2]) items[2].addEventListener('click', () =>
        _showRestaurantList('營業中', _allRestaurants.filter(r => r.isOpen === true)));
    }
  }

  // 顯示餐廳條列 Modal
  function _showRestaurantList(title, restaurants) {
    let overlay = document.getElementById('restaurant-list-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'restaurant-list-overlay';
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-sheet" style="max-height:75vh;overflow-y:auto;">
          <div class="modal-handle"></div>
          <div class="modal-title" id="rlist-title"></div>
          <div id="rlist-body"></div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', e => {
        if (e.target === overlay) Modal.hide('restaurant-list-overlay');
      });
    }

    document.getElementById('rlist-title').textContent = title + `（${restaurants.length}）`;
    const body = document.getElementById('rlist-body');

    if (restaurants.length === 0) {
      body.innerHTML = `<div style="padding:24px;text-align:center;color:var(--color-text-muted);">目前沒有資料</div>`;
    } else {
      body.innerHTML = restaurants.map((r, i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:12px 16px;border-bottom:1px solid var(--color-border);">
          <div>
            <div style="font-weight:600;font-size:14px;">${r.name}</div>
            <div style="font-size:12px;color:var(--color-text-muted);">${r.category || '未分類'} ${r.isOpen === true ? '・營業中' : r.isOpen === false ? '・已打烊' : ''}</div>
          </div>
          <button class="btn btn-sm btn-primary" data-idx="${i}" onclick="MapPage.panToRestaurant(${i})">前往</button>
        </div>
      `).join('');
      // 暫存當前清單供 panToRestaurant 使用
      MapPage._currentList = restaurants;
    }

    Modal.show('restaurant-list-overlay');
  }

  // ── 無 API Key 提示 ──────────────────────────────────────────────────────────
  function _showNoKeyMessage() {
    const container = document.getElementById('map-container');
    if (!container) return;
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  height:100%;background:var(--color-bg);padding:32px;text-align:center;">
        <div style="font-size:56px;margin-bottom:16px;">🗺️</div>
        <div style="font-size:18px;font-weight:700;margin-bottom:8px;">需要設定 API Key</div>
        <div style="font-size:14px;color:var(--color-text-muted);margin-bottom:24px;">
          請先到「設定」頁面填入<br>Google Maps API Key
        </div>
        <button class="btn btn-primary" onclick="Router.navigate('settings')">前往設定</button>
      </div>
    `;
  }

  // 前往指定餐廳（從清單呼叫）
  function panToRestaurant(idx) {
    const restaurant = MapPage._currentList?.[idx];
    if (!restaurant || !_map) return;
    Modal.hide('restaurant-list-overlay');
    Router.navigate('map');
    _map.panTo({ lat: restaurant.lat, lng: restaurant.lng });
    _map.setZoom(17);
    // 模擬點擊 Marker
    setTimeout(() => _onMarkerClick(restaurant), 400);
  }

  // 公開方法
  return { show, hide, setRadius, refreshNearby, panToRestaurant };
})();

// 讓 Router 可以存取
window.MapPage = MapPage;
