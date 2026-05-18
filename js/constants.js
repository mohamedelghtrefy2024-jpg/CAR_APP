/**
 * ═══════════════════════════════════════════════════════════
 * constants.js - ثوابت النظام
 * نظام إدارة أسطول السيارات
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const CONSTANTS = Object.freeze({

  /* ── معلومات التطبيق ── */
  APP: {
    NAME:    'أسطول برو',
    VERSION: '1.0.0',
    COMPANY: 'نظام إدارة الأسطول',
  },

  /* ── قاعدة البيانات IndexedDB ── */
  DB: {
    NAME:    'FleetManagementDB',
    VERSION: 1,
    STORES: {
      USERS:    'users',
      DRIVERS:  'drivers',
      VEHICLES: 'vehicles',
      GPS_LOGS: 'gps_logs',
      SESSIONS: 'sessions',
      SETTINGS: 'settings',
      AUDIT:    'audit_log',
    },
  },

  /* ── صلاحيات الأدوار ── */
  ROLES: {
    ADMIN:     'admin',
    SUPERVISOR:'supervisor',
    DRIVER:    'driver',
    EMPLOYEE:  'employee',
  },

  ROLE_LABELS: {
    admin:      'مدير عام',
    supervisor: 'مشرف',
    driver:     'سواق',
    employee:   'موظف',
  },

  /* ── صلاحيات المميزات ── */
  PERMISSIONS: {
    admin: [
      'view_dashboard', 'manage_drivers', 'manage_vehicles',
      'view_map', 'view_reports', 'manage_users',
      'export_data', 'delete_records', 'edit_settings',
    ],
    supervisor: [
      'view_dashboard', 'manage_drivers', 'manage_vehicles',
      'view_map', 'view_reports',
    ],
    driver: [
      'view_dashboard', 'update_status', 'view_map',
    ],
    employee: [
      'view_dashboard', 'view_map', 'view_reports',
    ],
  },

  /* ── حالات السائقين ── */
  DRIVER_STATUS: {
    AVAILABLE: 'available',
    BUSY:      'busy',
    BREAK:     'break',
    OFFLINE:   'offline',
  },

  STATUS_LABELS: {
    available: 'متاح',
    busy:      'مشغول',
    break:     'استراحة',
    offline:   'غير متصل',
  },

  STATUS_EMOJI: {
    available: '🟢',
    busy:      '🟡',
    break:     '🔵',
    offline:   '⚫',
  },

  /* ── إعدادات GPS ── */
  GPS: {
    UPDATE_INTERVAL_MS:    5000,     // كل 5 ثوانٍ
    OFFLINE_THRESHOLD_MS:  300000,   // 5 دقائق → offline
    MIN_DISTANCE_METERS:   20,       // أقل مسافة للتحديث
    MAX_AGE_MS:            30000,    // أقدم موقع مقبول
    TIMEOUT_MS:            15000,    // timeout لـ GPS
    HIGH_ACCURACY:         true,
    BATTERY_SAVE_AFTER_MS: 600000,  // 10 دقائق → توفير بطارية
  },

  /* ── Session وإدارة الوقت ── */
  SESSION: {
    EXPIRY_MS:     28800000,  // 8 ساعات
    IDLE_TIMEOUT:  1800000,   // 30 دقيقة خمول → logout
    STORAGE_KEY:   'fleet_session',
    CHECK_INTERVAL: 60000,   // فحص كل دقيقة
  },

  /* ── تحذيرات الرخص ── */
  LICENSE: {
    DANGER_DAYS:  0,   // منتهية
    WARNING_DAYS: 30,  // تحذير
  },

  /* ── تحسين الأداء ── */
  PERFORMANCE: {
    SEARCH_DEBOUNCE_MS: 300,
    GPS_THROTTLE_MS:    1000,
    TABLE_PAGE_SIZE:    50,
    MAP_CLUSTER_ZOOM:   12,
  },

  /* ── توست الإشعارات ── */
  TOAST: {
    DURATION_MS: 4000,
    MAX_VISIBLE:  5,
  },

  /* ── مواقع مصر الافتراضية ── */
  MAP: {
    DEFAULT_CENTER: [30.0444, 31.2357],  // القاهرة
    DEFAULT_ZOOM:   11,
    TILE_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    TILE_ATTRIBUTION: '© OpenStreetMap contributors',
  },

  /* ── لأغراض الـ Hashing ── */
  SECURITY: {
    HASH_ITERATIONS: 1000,
    SALT_LENGTH:     16,
    MIN_PASSWORD_LEN: 6,
  },

});
