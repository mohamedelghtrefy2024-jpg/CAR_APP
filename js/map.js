/**
 * ═══════════════════════════════════════════════════════════
 * map.js - وحدة الخريطة
 * Leaflet Integration | Marker Management | Driver Tracking
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const MapModule = (() => {

  let _map        = null;
  let _markers    = {};   // { driverId: L.marker }
  let _initialized = false;

  const STATUS_COLORS = {
    available: '#22c55e',
    busy:      '#f59e0b',
    break:     '#06b6d4',
    offline:   '#64748b',
  };

  const STATUS_EMOJI = {
    available: '🚗',
    busy:      '🚙',
    break:     '⏸️',
    offline:   '📍',
  };

  /* ══════════════════════════════════
     تهيئة الخريطة
     ══════════════════════════════════ */

  function init(containerId = 'fleet-map') {
    if (_initialized) return;

    // تحقق من وجود Leaflet
    if (typeof L === 'undefined') {
      console.error('[Map] Leaflet (L) is not loaded! Check your internet connection or CDN.');
      Notifications.show('warning', 'الخريطة', 'تعذر تحميل مكتبة الخرائط، تحقق من الاتصال');
      return;
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    const cfg = CONSTANTS.MAP;

    _map = L.map(containerId, {
      center:       cfg.DEFAULT_CENTER,
      zoom:         cfg.DEFAULT_ZOOM,
      zoomControl:  true,
      attributionControl: true,
      // منع Leaflet من الـ animation أول مرة عشان يتجنب حسابات الحجم الخاطئة
      fadeAnimation:    false,
      markerZoomAnimation: false,
    });

    // Tile Layer - OpenStreetMap
    L.tileLayer(cfg.TILE_URL, {
      attribution: cfg.TILE_ATTRIBUTION,
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(_map);

    _initialized = true;
    console.info('[Map] Leaflet initialized');

    // بعد 300ms نعمل invalidateSize عشان نضمن الحجم الصح
    // حتى لو الـ container كان display:none وقت الـ init
    setTimeout(() => {
      if (_map) _map.invalidateSize({ animate: false });
    }, 300);
  }

  function destroy() {
    if (_map) {
      _map.remove();
      _map = null;
      _markers = {};
      _initialized = false;
    }
  }

  /* ══════════════════════════════════
     إنشاء أيقونة Marker مخصصة
     ══════════════════════════════════ */

  function _createDriverIcon(driver) {
    const status = driver.status || 'offline';
    const color  = STATUS_COLORS[status];
    const emoji  = STATUS_EMOJI[status];
    const initials = _getInitials(driver.name);

    // أيقونة HTML مخصصة - نستخدم textContent لا innerHTML في الـ Event handlers
    const html = `
      <div style="
        width: 42px; height: 42px;
        background: ${color};
        border-radius: 50%;
        border: 3px solid rgba(255,255,255,0.4);
        display: flex; align-items: center; justify-content: center;
        font-size: 14px; font-weight: 700;
        color: white;
        box-shadow: 0 3px 8px rgba(0,0,0,0.5);
        cursor: pointer;
        transition: transform 0.2s;
        font-family: 'Cairo', sans-serif;
      " title="${Security.escapeHtml(driver.name)}">
        ${Security.escapeHtml(initials)}
      </div>
    `;

    return L.divIcon({
      html,
      className: '',
      iconSize:    [42, 42],
      iconAnchor:  [21, 21],
      popupAnchor: [0, -25],
    });
  }

  function _getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2);
  }

  /* ══════════════════════════════════
     إنشاء Popup السائق
     ══════════════════════════════════ */

  function _createDriverPopup(driver, location) {
    const name    = Security.escapeHtml(driver.name || 'غير معروف');
    const plate   = Security.escapeHtml(driver.plate || '-');
    const vehicle = Security.escapeHtml(driver.vehicle || '-');
    const phone   = Security.escapeHtml(driver.phone || '-');
    const status  = CONSTANTS.STATUS_LABELS[driver.status] || 'غير معروف';
    const speed   = location?.speed || 0;
    const lastSeen = location?.timestamp
      ? _formatLastSeen(location.timestamp)
      : 'غير محدد';

    // إنشاء DOM آمن بدلاً من innerHTML مباشر
    const container = document.createElement('div');
    container.className = 'driver-popup';

    // Header
    const header = document.createElement('div');
    header.className = 'popup-header';

    const avatar = document.createElement('div');
    avatar.className = 'popup-avatar';
    avatar.style.background = STATUS_COLORS[driver.status] || '#64748b';
    avatar.textContent = _getInitials(driver.name);

    const info = document.createElement('div');
    const nameEl = document.createElement('div');
    nameEl.className = 'popup-name';
    nameEl.textContent = driver.name || 'غير معروف';

    const plateEl = document.createElement('div');
    plateEl.className = 'popup-plate';
    plateEl.textContent = driver.plate || '-';

    info.appendChild(nameEl);
    info.appendChild(plateEl);
    header.appendChild(avatar);
    header.appendChild(info);
    container.appendChild(header);

    // Info rows
    const infoDiv = document.createElement('div');
    infoDiv.className = 'popup-info';

    const rows = [
      { label: 'الحالة',   value: status },
      { label: 'المركبة',  value: driver.vehicle || '-' },
      { label: 'الهاتف',   value: driver.phone || '-' },
      { label: 'السرعة',   value: `${speed} كم/س` },
      { label: 'آخر ظهور', value: lastSeen },
    ];

    rows.forEach(({ label, value }) => {
      const row = document.createElement('div');
      row.className = 'popup-info-row';

      const labelEl = document.createElement('span');
      labelEl.className = 'popup-info-label';
      labelEl.textContent = label + ':';

      const valueEl = document.createElement('span');
      valueEl.className = 'popup-info-value';
      valueEl.textContent = value;

      row.appendChild(labelEl);
      row.appendChild(valueEl);
      infoDiv.appendChild(row);
    });

    container.appendChild(infoDiv);
    return container;
  }

  /* ══════════════════════════════════
     إضافة / تحديث Markers
     ══════════════════════════════════ */

  /**
   * رسم جميع السائقين على الخريطة
   */
  function renderAllDrivers(drivers) {
    if (!_map || !_initialized) return;

    const locations = State.get('driverLocations');

    drivers.forEach(driver => {
      const loc = locations[driver.id];
      if (!loc && !driver.lastLat) return; // لا موقع معروف

      const lat = loc?.lat ?? driver.lastLat;
      const lng = loc?.lng ?? driver.lastLng;

      if (!lat || !lng) return;

      _addOrUpdateMarker(driver, { lat, lng, speed: loc?.speed || 0, timestamp: loc?.timestamp || driver.lastSeen });
    });
  }

  /**
   * تحديث Marker سائق واحد فقط (أداء عالٍ)
   */
  function updateDriverMarker(driverId, locationData) {
    if (!_map || !_initialized) return;

    const driver = State.get('drivers').find(d => d.id === driverId);
    if (!driver) return;

    _addOrUpdateMarker(driver, locationData);
  }

  function _addOrUpdateMarker(driver, location) {
    const { lat, lng } = location;

    if (_markers[driver.id]) {
      // تحديث الموقع فقط دون إعادة إنشاء
      _markers[driver.id].setLatLng([lat, lng]);
      _markers[driver.id].setIcon(_createDriverIcon(driver));

      // تحديث الـ Popup إن كان مفتوحاً
      if (_markers[driver.id].isPopupOpen()) {
        _markers[driver.id].setPopupContent(_createDriverPopup(driver, location));
      }
    } else {
      // إنشاء marker جديد
      const marker = L.marker([lat, lng], {
        icon: _createDriverIcon(driver),
        riseOnHover: true,
      });

      marker.bindPopup(_createDriverPopup(driver, location), {
        maxWidth: 260,
        className: 'fleet-popup',
      });

      marker.addTo(_map);
      _markers[driver.id] = marker;
    }
  }

  /**
   * تحديث أيقونة الحالة فقط
   */
  function updateDriverStatus(driverId, status) {
    if (!_markers[driverId]) return;
    const driver = State.get('drivers').find(d => d.id === driverId);
    if (driver) {
      _markers[driverId].setIcon(_createDriverIcon({ ...driver, status }));
    }
  }

  /**
   * حذف Marker سائق
   */
  function removeDriverMarker(driverId) {
    if (_markers[driverId]) {
      _markers[driverId].remove();
      delete _markers[driverId];
    }
  }

  /**
   * التركيز على سائق معين
   */
  function focusDriver(driverId) {
    const marker = _markers[driverId];
    if (!marker || !_map) return;
    _map.setView(marker.getLatLng(), 15, { animate: true });
    marker.openPopup();
  }

  /**
   * إظهار جميع السائقين
   */
  function fitAllMarkers() {
    if (!_map || Object.keys(_markers).length === 0) return;
    const group = L.featureGroup(Object.values(_markers));
    _map.fitBounds(group.getBounds().pad(0.15));
  }

  /* ══════════════════════════════════
     مساعدات
     ══════════════════════════════════ */

  function _formatLastSeen(timestamp) {
    if (!timestamp) return 'غير محدد';
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return 'الآن';
    if (mins < 60)  return `منذ ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `منذ ${hrs} ساعة`;
    return `منذ ${Math.floor(hrs / 24)} يوم`;
  }

  function isReady() { return _initialized && _map !== null; }

  /**
   * إعادة حساب حجم الخريطة (ضروري بعد إظهارها من display:none)
   */
  function invalidateSize() {
    if (_map) {
      _map.invalidateSize({ animate: false });
    }
  }

  /* ── واجهة عامة ── */
  return Object.freeze({
    init,
    destroy,
    renderAllDrivers,
    updateDriverMarker,
    updateDriverStatus,
    removeDriverMarker,
    focusDriver,
    fitAllMarkers,
    isReady,
    invalidateSize,
  });

})();
