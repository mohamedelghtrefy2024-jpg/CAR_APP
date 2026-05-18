/**
 * ═══════════════════════════════════════════════════════════
 * storage.js - طبقة IndexedDB الكاملة
 * كل عمليات قاعدة البيانات المحلية
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const Storage = (() => {

  let _db = null;

  /* ══════════════════════════════════
     تهيئة قاعدة البيانات
     ══════════════════════════════════ */

  /**
   * فتح وتهيئة IndexedDB
   */
  function init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(CONSTANTS.DB.NAME, CONSTANTS.DB.VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        _createStores(db);
      };

      request.onsuccess = (event) => {
        _db = event.target.result;
        _db.onerror = (e) => {
          console.error('[Storage] DB Error:', e.target.error);
        };
        console.info('[Storage] IndexedDB initialized successfully');
        resolve(_db);
      };

      request.onerror = (event) => {
        console.error('[Storage] Failed to open DB:', event.target.error);
        reject(new Error('فشل فتح قاعدة البيانات'));
      };

      request.onblocked = () => {
        console.warn('[Storage] DB upgrade blocked by another tab');
        reject(new Error('قاعدة البيانات محجوبة بتبويب آخر'));
      };
    });
  }

  /**
   * إنشاء مخازن البيانات
   */
  function _createStores(db) {
    const stores = CONSTANTS.DB.STORES;

    // المستخدمون
    if (!db.objectStoreNames.contains(stores.USERS)) {
      const usersStore = db.createObjectStore(stores.USERS, {
        keyPath: 'id',
        autoIncrement: true,
      });
      usersStore.createIndex('username', 'username', { unique: true });
      usersStore.createIndex('role', 'role', { unique: false });
    }

    // السائقون
    if (!db.objectStoreNames.contains(stores.DRIVERS)) {
      const driversStore = db.createObjectStore(stores.DRIVERS, {
        keyPath: 'id',
        autoIncrement: true,
      });
      driversStore.createIndex('status', 'status', { unique: false });
      driversStore.createIndex('phone', 'phone', { unique: false });
    }

    // المركبات
    if (!db.objectStoreNames.contains(stores.VEHICLES)) {
      const vehiclesStore = db.createObjectStore(stores.VEHICLES, {
        keyPath: 'id',
        autoIncrement: true,
      });
      vehiclesStore.createIndex('plate', 'plate', { unique: true });
    }

    // سجلات GPS
    if (!db.objectStoreNames.contains(stores.GPS_LOGS)) {
      const gpsStore = db.createObjectStore(stores.GPS_LOGS, {
        keyPath: 'id',
        autoIncrement: true,
      });
      gpsStore.createIndex('driverId', 'driverId', { unique: false });
      gpsStore.createIndex('timestamp', 'timestamp', { unique: false });
    }

    // الجلسات
    if (!db.objectStoreNames.contains(stores.SESSIONS)) {
      db.createObjectStore(stores.SESSIONS, { keyPath: 'token' });
    }

    // الإعدادات
    if (!db.objectStoreNames.contains(stores.SETTINGS)) {
      db.createObjectStore(stores.SETTINGS, { keyPath: 'key' });
    }

    // سجل العمليات
    if (!db.objectStoreNames.contains(stores.AUDIT)) {
      const auditStore = db.createObjectStore(stores.AUDIT, {
        keyPath: 'id',
        autoIncrement: true,
      });
      auditStore.createIndex('userId', 'userId', { unique: false });
      auditStore.createIndex('timestamp', 'timestamp', { unique: false });
    }
  }

  /* ══════════════════════════════════
     عمليات CRUD عامة
     ══════════════════════════════════ */

  /**
   * فتح Transaction
   */
  function _transaction(storeName, mode = 'readonly') {
    if (!_db) throw new Error('قاعدة البيانات غير مهيأة');
    const tx = _db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  /**
   * تنفيذ Request وإرجاع Promise
   */
  function _promisify(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror   = () => reject(request.error);
    });
  }

  /**
   * إضافة سجل
   */
  function add(storeName, data) {
    try {
      const record = {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const store = _transaction(storeName, 'readwrite');
      return _promisify(store.add(record));
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * تعديل سجل
   */
  function update(storeName, data) {
    try {
      const record = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      const store = _transaction(storeName, 'readwrite');
      return _promisify(store.put(record));
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * حذف سجل
   */
  function remove(storeName, id) {
    try {
      const store = _transaction(storeName, 'readwrite');
      return _promisify(store.delete(id));
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * جلب سجل واحد بالـ ID
   */
  function getById(storeName, id) {
    try {
      const store = _transaction(storeName);
      return _promisify(store.get(id));
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * جلب كل السجلات
   */
  function getAll(storeName) {
    try {
      const store = _transaction(storeName);
      return _promisify(store.getAll());
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * جلب سجل بفهرس (مثلاً username)
   */
  function getByIndex(storeName, indexName, value) {
    try {
      const store = _transaction(storeName);
      const index = store.index(indexName);
      return _promisify(index.get(value));
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * جلب عدة سجلات بفهرس
   */
  function getAllByIndex(storeName, indexName, value) {
    try {
      const store = _transaction(storeName);
      const index = store.index(indexName);
      const range = IDBKeyRange.only(value);
      return _promisify(index.getAll(range));
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * عد السجلات
   */
  function count(storeName) {
    try {
      const store = _transaction(storeName);
      return _promisify(store.count());
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * حذف كل السجلات من مخزن
   */
  function clearStore(storeName) {
    try {
      const store = _transaction(storeName, 'readwrite');
      return _promisify(store.clear());
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /* ══════════════════════════════════
     عمليات مخصصة للسائقين
     ══════════════════════════════════ */

  async function getDriversByStatus(status) {
    const all = await getAll(CONSTANTS.DB.STORES.DRIVERS);
    return all.filter(d => d.status === status);
  }

  async function searchDrivers(query) {
    const all = await getAll(CONSTANTS.DB.STORES.DRIVERS);
    const q = query.toLowerCase().trim();
    return all.filter(d =>
      d.name?.includes(q) ||
      d.phone?.includes(q) ||
      d.plate?.toLowerCase().includes(q) ||
      d.vehicle?.includes(q)
    );
  }

  async function getExpiredLicenses() {
    const all = await getAll(CONSTANTS.DB.STORES.DRIVERS);
    const today = new Date();
    const warnDate = new Date(today);
    warnDate.setDate(warnDate.getDate() + CONSTANTS.LICENSE.WARNING_DAYS);

    return all.filter(d => {
      if (!d.licenseExpiry) return false;
      const exp = new Date(d.licenseExpiry);
      return exp <= warnDate;
    }).map(d => ({
      ...d,
      isExpired: new Date(d.licenseExpiry) < today,
    }));
  }

  /* ══════════════════════════════════
     عمليات الإعدادات
     ══════════════════════════════════ */

  async function getSetting(key) {
    try {
      const record = await getById(CONSTANTS.DB.STORES.SETTINGS, key);
      return record ? record.value : null;
    } catch {
      return null;
    }
  }

  async function setSetting(key, value) {
    return update(CONSTANTS.DB.STORES.SETTINGS, { key, value });
  }

  /* ══════════════════════════════════
     سجل التدقيق Audit Log
     ══════════════════════════════════ */

  async function logAction(userId, action, details = '') {
    try {
      await add(CONSTANTS.DB.STORES.AUDIT, {
        userId,
        action: Security.sanitizeText(action, 100),
        details: Security.sanitizeText(details, 500),
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent.slice(0, 200),
      });
    } catch {
      // silent - audit logging shouldn't break main flow
    }
  }

  /* ══════════════════════════════════
     GPS Logs
     ══════════════════════════════════ */

  async function saveGpsLog(driverId, lat, lng, speed = 0) {
    // نحافظ على آخر 1000 سجل فقط لمنع ملء التخزين
    const STORES = CONSTANTS.DB.STORES;
    await add(STORES.GPS_LOGS, {
      driverId,
      lat,
      lng,
      speed,
      timestamp: new Date().toISOString(),
    });

    // تنظيف القديم (كل 50 عملية)
    if (Math.random() < 0.02) {
      await _cleanOldGpsLogs();
    }
  }

  async function _cleanOldGpsLogs() {
    try {
      const all = await getAll(CONSTANTS.DB.STORES.GPS_LOGS);
      if (all.length > 5000) {
        // احذف الأقدم
        const sorted = all.sort((a, b) => a.id - b.id);
        const toDelete = sorted.slice(0, all.length - 5000);
        for (const log of toDelete) {
          await remove(CONSTANTS.DB.STORES.GPS_LOGS, log.id);
        }
      }
    } catch {
      // silent
    }
  }

  async function getDriverGpsHistory(driverId, limit = 50) {
    const all = await getAllByIndex(CONSTANTS.DB.STORES.GPS_LOGS, 'driverId', driverId);
    return all
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /* ── واجهة عامة ── */
  return Object.freeze({
    init,
    add,
    update,
    remove,
    getById,
    getAll,
    getByIndex,
    getAllByIndex,
    count,
    clearStore,
    getDriversByStatus,
    searchDrivers,
    getExpiredLicenses,
    getSetting,
    setSetting,
    logAction,
    saveGpsLog,
    getDriverGpsHistory,
  });

})();
