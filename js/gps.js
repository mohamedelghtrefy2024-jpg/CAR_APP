/**
 * ═══════════════════════════════════════════════════════════
 * gps.js - محرك GPS والتتبع
 * Geolocation | Throttling | Battery Optimization
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const GPS = (() => {

  let _watchId         = null;
  let _lastUpdate      = 0;
  let _lastPosition    = null;
  let _offlineTimers   = {};  // { driverId: timerId }
  let _batteryMode     = false;
  let _batteryCheckAt  = Date.now() + CONSTANTS.GPS.BATTERY_SAVE_AFTER_MS;

  /* ══════════════════════════════════
     بدء التتبع
     ══════════════════════════════════ */

  function startTracking(driverId) {
    if (!navigator.geolocation) {
      Notifications.show('error', 'GPS غير مدعوم', 'المتصفح لا يدعم خدمة الموقع');
      return false;
    }

    stopTracking(); // أوقف أي تتبع سابق

    const options = _getGeoOptions();

    _watchId = navigator.geolocation.watchPosition(
      (position) => _onPositionUpdate(position, driverId),
      (error)    => _onPositionError(error, driverId),
      options
    );

    State.set('gpsWatchId', _watchId);
    console.info(`[GPS] Started tracking driver ${driverId}`);
    return true;
  }

  function stopTracking() {
    if (_watchId !== null) {
      navigator.geolocation.clearWatch(_watchId);
      _watchId = null;
      State.set('gpsWatchId', null);
    }
    // إيقاف جميع مؤقتات offline
    Object.values(_offlineTimers).forEach(t => clearTimeout(t));
    _offlineTimers = {};
  }

  /* ══════════════════════════════════
     خيارات GPS ديناميكية
     ══════════════════════════════════ */

  function _getGeoOptions() {
    const cfg = CONSTANTS.GPS;
    // وضع توفير البطارية بعد فترة
    const highAccuracy = _batteryMode ? false : cfg.HIGH_ACCURACY;

    return {
      enableHighAccuracy: highAccuracy,
      maximumAge:  cfg.MAX_AGE_MS,
      timeout:     cfg.TIMEOUT_MS,
    };
  }

  /* ══════════════════════════════════
     معالجة تحديث الموقع
     ══════════════════════════════════ */

  function _onPositionUpdate(position, driverId) {
    const now = Date.now();

    // Throttle: لا تحديث أسرع من الحد المطلوب
    if (now - _lastUpdate < CONSTANTS.GPS.UPDATE_INTERVAL_MS) return;

    const { latitude: lat, longitude: lng, speed, accuracy } = position.coords;

    // Distance Filter: تجاهل إن كان الحركة أقل من الحد الأدنى
    if (_lastPosition && _calcDistance(_lastPosition, { lat, lng }) < CONSTANTS.GPS.MIN_DISTANCE_METERS) {
      // تحديث الوقت فقط بدون رسم
      _resetOfflineTimer(driverId);
      return;
    }

    _lastUpdate   = now;
    _lastPosition = { lat, lng };

    // تحديث الحالة
    const locationData = {
      lat,
      lng,
      speed:    speed ? Math.round(speed * 3.6) : 0, // m/s → km/h
      accuracy: Math.round(accuracy),
      timestamp: new Date().toISOString(),
    };

    State.updateDriverLocation(driverId, locationData);

    // حفظ في قاعدة البيانات
    Storage.saveGpsLog(driverId, lat, lng, locationData.speed).catch(() => {});

    // تحديث موقع السائق في DB
    _updateDriverLocationInDB(driverId, locationData);

    // إعادة مؤقت offline
    _resetOfflineTimer(driverId);

    // فحص وضع البطارية
    if (now > _batteryCheckAt) {
      _batteryMode    = true;
      _batteryCheckAt = Infinity;
    }

    // تحديث الخريطة
    if (typeof MapModule !== 'undefined') {
      MapModule.updateDriverMarker(driverId, locationData);
    }
  }

  function _onPositionError(error, driverId) {
    console.warn('[GPS] Error:', error.code, error.message);
    Notifications.notifyGpsError(error);

    // تعيين السائق كـ offline إن فشل GPS
    _markDriverOffline(driverId);
  }

  /* ══════════════════════════════════
     مؤقت offline للسائق
     ══════════════════════════════════ */

  function _resetOfflineTimer(driverId) {
    if (_offlineTimers[driverId]) clearTimeout(_offlineTimers[driverId]);

    _offlineTimers[driverId] = setTimeout(() => {
      _markDriverOffline(driverId);
    }, CONSTANTS.GPS.OFFLINE_THRESHOLD_MS);
  }

  async function _markDriverOffline(driverId) {
    try {
      const driver = await Storage.getById(CONSTANTS.DB.STORES.DRIVERS, driverId);
      if (driver && driver.status !== 'offline') {
        await Storage.update(CONSTANTS.DB.STORES.DRIVERS, {
          ...driver,
          status: 'offline',
        });
        State.updateDriver({ ...driver, status: 'offline' });
        Notifications.notifyDriverOffline(driver.name);
        if (typeof MapModule !== 'undefined') {
          MapModule.updateDriverStatus(driverId, 'offline');
        }
      }
    } catch { /* silent */ }
  }

  /* ══════════════════════════════════
     تحديث موقع السائق في DB
     ══════════════════════════════════ */

  async function _updateDriverLocationInDB(driverId, locationData) {
    try {
      const driver = await Storage.getById(CONSTANTS.DB.STORES.DRIVERS, driverId);
      if (driver) {
        await Storage.update(CONSTANTS.DB.STORES.DRIVERS, {
          ...driver,
          lastLat:   locationData.lat,
          lastLng:   locationData.lng,
          lastSpeed: locationData.speed,
          lastSeen:  locationData.timestamp,
        });
      }
    } catch { /* silent */ }
  }

  /* ══════════════════════════════════
     محاكاة مواقع للـ Demo (Offline Mode)
     ══════════════════════════════════ */

  const _simulationIntervals = new Map();

  function startSimulation(drivers) {
    // محاكاة مواقع القاهرة للتطوير والعرض
    const CAIRO_BOUNDS = {
      latMin: 29.95, latMax: 30.15,
      lngMin: 31.10, lngMax: 31.40,
    };

    drivers.forEach(driver => {
      if (driver.status === 'offline') return;

      // ابدأ من موقع موجود أو عشوائي
      let lat = driver.lastLat || _rand(CAIRO_BOUNDS.latMin, CAIRO_BOUNDS.latMax);
      let lng = driver.lastLng || _rand(CAIRO_BOUNDS.lngMin, CAIRO_BOUNDS.lngMax);

      const intervalId = setInterval(async () => {
        if (driver.status === 'offline') return;

        // حركة تدريجية
        const speed = driver.status === 'busy' ? _rand(0.0002, 0.001) : 0.00005;
        lat += _rand(-speed, speed);
        lng += _rand(-speed, speed);

        // حدود القاهرة
        lat = Math.max(CAIRO_BOUNDS.latMin, Math.min(CAIRO_BOUNDS.latMax, lat));
        lng = Math.max(CAIRO_BOUNDS.lngMin, Math.min(CAIRO_BOUNDS.lngMax, lng));

        const locationData = {
          lat,
          lng,
          speed: driver.status === 'busy' ? Math.round(_rand(10, 80)) : 0,
          timestamp: new Date().toISOString(),
        };

        State.updateDriverLocation(driver.id, locationData);

        // تحديث DB بشكل دوري (كل 10 ثوانٍ)
        if (Math.random() < 0.1) {
          await _updateDriverLocationInDB(driver.id, locationData);
        }

        if (typeof MapModule !== 'undefined') {
          MapModule.updateDriverMarker(driver.id, locationData);
        }

      }, CONSTANTS.GPS.UPDATE_INTERVAL_MS);

      _simulationIntervals.set(driver.id, intervalId);
    });

    console.info('[GPS] Simulation started for', drivers.length, 'drivers');
  }

  function stopSimulation() {
    _simulationIntervals.forEach(id => clearInterval(id));
    _simulationIntervals.clear();
  }

  /* ══════════════════════════════════
     مساعدات حسابية
     ══════════════════════════════════ */

  /**
   * حساب المسافة بين نقطتين (Haversine)
   * @returns {number} المسافة بالمتر
   */
  function _calcDistance(p1, p2) {
    const R = 6371000; // نصف قطر الأرض بالمتر
    const dLat = _toRad(p2.lat - p1.lat);
    const dLng = _toRad(p2.lng - p1.lng);
    const a = Math.sin(dLat/2) ** 2 +
              Math.cos(_toRad(p1.lat)) * Math.cos(_toRad(p2.lat)) *
              Math.sin(dLng/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function _toRad(deg) { return deg * Math.PI / 180; }

  function _rand(min, max) { return min + Math.random() * (max - min); }

  /**
   * الحصول على الموقع الحالي مرة واحدة
   */
  function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('GPS غير مدعوم'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, _getGeoOptions());
    });
  }

  /* ── واجهة عامة ── */
  return Object.freeze({
    startTracking,
    stopTracking,
    startSimulation,
    stopSimulation,
    getCurrentPosition,
  });

})();
