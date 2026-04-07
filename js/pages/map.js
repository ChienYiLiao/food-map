/**
 * map.js — 地圖主頁
 * Google Maps JavaScript API + Places API Nearby Search + Marker 管理
 */

const MapPage = (() => {
  let _map = null;
  let _markers = {};            // { [place_id]: Marker | AdvancedMarkerElement }
  let _currentCenter = null;    // { lat, lng }
  let _currentRadius = CONFIG.DEFAULT_RADIUS;
  let _isInitialized = false;
  let _selectedPlaceId = null;
  let _gasRestaurants = [];     // GAS 端的餐廳資料（已吃過的資訊）
  let _useAdvancedMarker = false; // 有 Map ID 才用 AdvancedMarkerElement

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
      // 地圖已初始化，確保容器可見
      const container = document.getElementById('map-container');
      if (container) container.style.visibility = 'visible';
    }

    // FAB 按鈕事件
    const fabRefresh = document.getElementById('fab-refresh');
    const fabLocate  = document.getElementById('fab-locate');
    if (fabRefresh) fabRefresh.onclick = () => refreshNearby(true);
    if (fabLocate)  fabLocate.onclick  = () => _locateAndCenter();
  }

  function hide() {
    // 地圖頁離開時，保留地圖實例
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
      const center = await _getUserLocation();
      _currentCenter = center;

      const mapId = localStorage.getItem('GOOGLE_MAP_ID') || '';
      _useAdvancedMarker = !!mapId;
      const { Map } = await google.maps.importLibrary('maps');
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
      if (mapId) mapOptions.mapId = mapId;
      _map = new Map(document.getElementById('map-container'), mapOptions);

      // 地圖拖曳結束後更新中心點並刷新
      _map.addListener('dragend', () => {
        const c = _map.getCenter();
        _currentCenter = { lat: c.lat(), lng: c.lng() };
        refreshNearby(false);
      });

      _isInitialized = true;
      State.setState({ mapCenter: _currentCenter });

      // 初次載入附近餐廳
      await refreshNearby(true);
    } catch (err) {
      Toast.error('地圖載入失敗：' + err.message);
      console.error(err);
    } finally {
      Loader.hide();
    }
  }

  // 載入 Google Maps Script（動態注入）
  function _loadGoogleMapsScript(apiKey) {
    return new Promise((resolve, reject) => {
      if (window._googleMapsReady) { resolve(); return; }
      if (document.getElementById('gmaps-script')) {
        // 已在載入中，等待
        const check = setInterval(() => {
          if (window._googleMapsReady) { clearInterval(check); resolve(); }
        }, 100);
        return;
      }
      window.initGoogleMaps = () => {
        window._googleMapsReady = true;
        resolve();
      };
      const script = document.createElement('script');
      script.id  = 'gmaps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=maps,marker&v=weekly&loading=async&callback=initGoogleMaps`;
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
      _currentCenter = center;
      if (_map) _map.panTo({ lat: center.lat, lng: center.lng });
      State.setState({ mapCenter: center });
      await refreshNearby(true);
    } finally {
      Loader.hide();
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
      const placeResults = await API.searchNearby(
        _currentCenter.lat,
        _currentCenter.lng,
        _currentRadius
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
        if (m.map !== undefined) m.map = null; else m.setMap(null);
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
    if (_useAdvancedMarker) {
      const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
      const content = _buildMarkerContent(restaurant);
      const marker = new AdvancedMarkerElement({
        map: _map,
        position: { lat: restaurant.lat, lng: restaurant.lng },
        content: content,
        title: restaurant.name
      });
      marker.addEventListener('click', () => _onMarkerClick(restaurant));
      return marker;
    } else {
      // 傳統 Marker（不需要 Map ID）
      const isVisited = restaurant.visit_count > 0;
      const marker = new google.maps.Marker({
        map: _map,
        position: { lat: restaurant.lat, lng: restaurant.lng },
        title: restaurant.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isVisited ? 10 : 7,
          fillColor: isVisited ? '#9b8fb0' : '#7a9ab5',
          fillOpacity: isVisited ? 0.9 : 0.7,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });
      marker.addListener('click', () => _onMarkerClick(restaurant));
      // 模擬 AdvancedMarker 的 map 屬性介面
      marker._isClassicMarker = true;
      return marker;
    }
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
      marker.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        scale: isVisited ? 10 : 7,
        fillColor: isVisited ? '#9b8fb0' : '#7a9ab5',
        fillOpacity: isVisited ? 0.9 : 0.7,
        strokeColor: '#ffffff',
        strokeWeight: 2
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
    refreshNearby(false);
  }

  // ── 統計條 ───────────────────────────────────────────────────────────────────
  function _updateStatsBar(restaurants) {
    const visited = restaurants.filter(r => r.visit_count > 0).length;
    const open    = restaurants.filter(r => r.isOpen === true).length;
    const total   = restaurants.length;
    const statVisited = document.getElementById('stat-visited');
    const statTotal   = document.getElementById('stat-total');
    const statOpen    = document.getElementById('stat-open');
    if (statVisited) statVisited.textContent = visited;
    if (statTotal)   statTotal.textContent   = total;
    if (statOpen)    statOpen.textContent    = open;
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

  // 公開方法
  return { show, hide, setRadius, refreshNearby };
})();

// 讓 Router 可以存取
window.MapPage = MapPage;
