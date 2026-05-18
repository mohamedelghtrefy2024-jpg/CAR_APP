/**
 * ═══════════════════════════════════════════════════════════
 * notifications.js - نظام الإشعارات والتنبيهات
 * Toast Notifications | License Alerts | GPS Alerts
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const Notifications = (() => {

  let _container = null;
  let _activeToasts = 0;

  const ICONS = {
    success: '✅',
    error:   '❌',
    warning: '⚠️',
    info:    'ℹ️',
  };

  /* ══════════════════════════════════
     تهيئة حاوية التوست
     ══════════════════════════════════ */

  function init() {
    _container = document.getElementById('toast-container');
    if (!_container) {
      _container = document.createElement('div');
      _container.id = 'toast-container';
      _container.className = 'toast-container';
      document.body.appendChild(_container);
    }
  }

  /* ══════════════════════════════════
     عرض Toast
     ══════════════════════════════════ */

  function show(type = 'info', title = '', message = '', duration = CONSTANTS.TOAST.DURATION_MS) {
    if (!_container) init();

    // تحقق من الحد الأقصى
    if (_activeToasts >= CONSTANTS.TOAST.MAX_VISIBLE) {
      const oldest = _container.querySelector('.toast');
      if (oldest) _removeToast(oldest);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // بناء المحتوى بأمان (بدون innerHTML من بيانات المستخدم)
    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.textContent = ICONS[type] || ICONS.info;

    const body = document.createElement('div');
    body.className = 'toast-body';

    const titleEl = document.createElement('div');
    titleEl.className = 'toast-title';
    titleEl.textContent = title; // textContent آمن من XSS

    const msgEl = document.createElement('div');
    msgEl.className = 'toast-message';
    msgEl.textContent = message;

    body.appendChild(titleEl);
    if (message) body.appendChild(msgEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'إغلاق');
    closeBtn.addEventListener('click', () => _removeToast(toast));

    toast.appendChild(iconSpan);
    toast.appendChild(body);
    toast.appendChild(closeBtn);

    _container.appendChild(toast);
    _activeToasts++;

    // حذف تلقائي
    const timer = setTimeout(() => _removeToast(toast), duration);
    toast._removeTimer = timer;

    return toast;
  }

  function _removeToast(toast) {
    if (!toast || toast._removing) return;
    toast._removing = true;

    if (toast._removeTimer) clearTimeout(toast._removeTimer);

    toast.classList.add('removing');
    toast.addEventListener('animationend', () => {
      toast.remove();
      _activeToasts = Math.max(0, _activeToasts - 1);
    }, { once: true });

    // fallback إن لم تنجح الأنيمشن
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
        _activeToasts = Math.max(0, _activeToasts - 1);
      }
    }, 500);
  }

  /* ══════════════════════════════════
     تنبيهات الرخص
     ══════════════════════════════════ */

  async function checkLicenseAlerts() {
    try {
      const alerts = await Storage.getExpiredLicenses();
      if (alerts.length === 0) return;

      const expired  = alerts.filter(d => d.isExpired);
      const expiring = alerts.filter(d => !d.isExpired);

      if (expired.length > 0) {
        show(
          'error',
          `${expired.length} رخصة منتهية!`,
          expired.map(d => d.name).join('، '),
          6000
        );
      }

      if (expiring.length > 0) {
        show(
          'warning',
          `${expiring.length} رخصة تنتهي قريباً`,
          expiring.map(d => `${d.name} (${_formatDate(d.licenseExpiry)})`).join('، '),
          5000
        );
      }

      // تحديث الحالة
      State.set('licenseAlerts', alerts);

    } catch (err) {
      console.error('[Notifications] License check error:', err);
    }
  }

  /* ══════════════════════════════════
     تنبيه GPS
     ══════════════════════════════════ */

  function notifyGpsError(error) {
    let msg = 'تعذر الحصول على موقع GPS';
    switch (error.code) {
      case error.PERMISSION_DENIED:
        msg = 'تم رفض إذن الموقع';
        break;
      case error.POSITION_UNAVAILABLE:
        msg = 'الموقع غير متوفر حالياً';
        break;
      case error.TIMEOUT:
        msg = 'انتهت مهلة GPS';
        break;
    }
    show('warning', 'تحذير GPS', msg);
  }

  function notifyDriverOffline(driverName) {
    show('warning', 'سائق غير متصل', `${driverName} انقطع اتصاله`);
  }

  function notifySaveError() {
    show('error', 'خطأ في الحفظ', 'تعذر حفظ البيانات، تحقق من التخزين');
  }

  /* ══════════════════════════════════
     مساعدات
     ══════════════════════════════════ */

  function _formatDate(dateStr) {
    try {
      return new Date(dateStr).toLocaleDateString('ar-EG');
    } catch { return dateStr; }
  }

  /* ── واجهة عامة ── */
  return Object.freeze({
    init,
    show,
    checkLicenseAlerts,
    notifyGpsError,
    notifyDriverOffline,
    notifySaveError,
  });

})();
