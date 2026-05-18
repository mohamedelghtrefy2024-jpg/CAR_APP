/**
 * ═══════════════════════════════════════════════════════════
 * state.js - إدارة الحالة المركزية
 * Event-Driven State Management
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const State = (() => {

  /* ══════════════════════════════════
     الحالة الداخلية المركزية
     ══════════════════════════════════ */
  const _state = {
    // المستخدم الحالي
    currentUser:   null,
    sessionToken:  null,
    sessionExpiry: null,

    // البيانات
    drivers:  [],
    users:    [],

    // الواجهة
    activeSection:  'dashboard',
    isLoading:      false,
    isOnline:       navigator.onLine,
    isSidebarOpen:  false,

    // GPS
    gpsWatchId:     null,
    driverLocations: {},  // { driverId: { lat, lng, speed, timestamp } }

    // فلاتر
    driverFilter: 'all',
    searchQuery:  '',

    // تحذيرات الرخص
    licenseAlerts: [],

    // إحصائيات
    stats: {
      total:     0,
      available: 0,
      busy:      0,
      break:     0,
      offline:   0,
      expired:   0,
      expiring:  0,
    },
  };

  /* ══════════════════════════════════
     نظام الاشتراكات (Observer Pattern)
     ══════════════════════════════════ */
  const _listeners = new Map();

  /**
   * الاشتراك في تغييرات حقل معين
   */
  function subscribe(key, callback) {
    if (!_listeners.has(key)) {
      _listeners.set(key, new Set());
    }
    _listeners.get(key).add(callback);

    // إلغاء الاشتراك
    return () => {
      const set = _listeners.get(key);
      if (set) set.delete(callback);
    };
  }

  /**
   * إرسال حدث التغيير
   */
  function _emit(key, value, oldValue) {
    const listeners = _listeners.get(key);
    if (!listeners) return;
    listeners.forEach(cb => {
      try { cb(value, oldValue); }
      catch (err) { console.error('[State] Listener error:', err); }
    });
  }

  /* ══════════════════════════════════
     Mutations - التعديلات المتحكم بها
     ══════════════════════════════════ */

  function set(key, value) {
    if (!(key in _state)) {
      console.warn(`[State] Unknown key: ${key}`);
      return;
    }
    const oldValue = _state[key];
    _state[key] = value;
    _emit(key, value, oldValue);
  }

  function get(key) {
    return _state[key];
  }

  function getAll() {
    // إرجاع نسخة لمنع التعديل المباشر
    return { ..._state };
  }

  /* ══════════════════════════════════
     عمليات السائقين
     ══════════════════════════════════ */

  function setDrivers(drivers) {
    set('drivers', [...drivers]);
    _recalcStats(drivers);
  }

  function addDriver(driver) {
    const list = [..._state.drivers, driver];
    set('drivers', list);
    _recalcStats(list);
  }

  function updateDriver(updatedDriver) {
    const list = _state.drivers.map(d =>
      d.id === updatedDriver.id ? updatedDriver : d
    );
    set('drivers', list);
    _recalcStats(list);
  }

  function removeDriver(driverId) {
    const list = _state.drivers.filter(d => d.id !== driverId);
    set('drivers', list);
    _recalcStats(list);
  }

  function updateDriverLocation(driverId, locationData) {
    const locs = { ..._state.driverLocations };
    locs[driverId] = {
      ...locationData,
      updatedAt: new Date().toISOString(),
    };
    set('driverLocations', locs);
  }

  /* ══════════════════════════════════
     إعادة حساب الإحصائيات
     ══════════════════════════════════ */

  function _recalcStats(drivers) {
    const today = new Date();
    const warnDate = new Date(today);
    warnDate.setDate(warnDate.getDate() + CONSTANTS.LICENSE.WARNING_DAYS);

    const stats = {
      total:     drivers.length,
      available: 0,
      busy:      0,
      break:     0,
      offline:   0,
      expired:   0,
      expiring:  0,
    };

    for (const d of drivers) {
      if (d.status === 'available') stats.available++;
      else if (d.status === 'busy')  stats.busy++;
      else if (d.status === 'break') stats.break++;
      else                           stats.offline++;

      if (d.licenseExpiry) {
        const exp = new Date(d.licenseExpiry);
        if (exp < today)       stats.expired++;
        else if (exp < warnDate) stats.expiring++;
      }
    }

    set('stats', stats);
  }

  /* ══════════════════════════════════
     الجلسة
     ══════════════════════════════════ */

  function setSession(user, token, expiry) {
    set('currentUser',   user);
    set('sessionToken',  token);
    set('sessionExpiry', expiry);
  }

  function clearSession() {
    set('currentUser',   null);
    set('sessionToken',  null);
    set('sessionExpiry', null);
    set('driverLocations', {});
  }

  function isAuthenticated() {
    return _state.currentUser !== null &&
           _state.sessionToken !== null &&
           _state.sessionExpiry > Date.now();
  }

  function hasPermission(permission) {
    if (!_state.currentUser) return false;
    const perms = CONSTANTS.PERMISSIONS[_state.currentUser.role] || [];
    return perms.includes(permission);
  }

  /* ── واجهة عامة ── */
  return Object.freeze({
    subscribe,
    set,
    get,
    getAll,
    setDrivers,
    addDriver,
    updateDriver,
    removeDriver,
    updateDriverLocation,
    setSession,
    clearSession,
    isAuthenticated,
    hasPermission,
  });

})();
