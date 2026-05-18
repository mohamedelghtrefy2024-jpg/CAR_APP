/**
 * ═══════════════════════════════════════════════════════════
 * offline.js - دعم Offline والـ Service Worker
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const Offline = (() => {

  function init() {
    // تسجيل Service Worker (يشتغل فقط على http/https مش على file://)
    if ('serviceWorker' in navigator && location.protocol !== 'null:' && location.protocol !== 'file:') {
      navigator.serviceWorker.register('./service-worker.js')
        .then(reg => {
          console.info('[Offline] Service Worker registered:', reg.scope);
        })
        .catch(err => {
          // مش error حقيقي — بيحصل على file:// أو بعض البيئات
          console.info('[Offline] Service Worker skipped:', err.message);
        });
    } else {
      console.info('[Offline] Service Worker not available (file:// or unsupported)');
    }

    // مراقبة حالة الشبكة
    window.addEventListener('online',  _onOnline);
    window.addEventListener('offline', _onOffline);

    // الحالة الأولية
    State.set('isOnline', navigator.onLine);
    UI.updateConnectionStatus(navigator.onLine);
  }

  function _onOnline() {
    State.set('isOnline', true);
    UI.updateConnectionStatus(true);
    Notifications.show('success', 'الاتصال عاد', 'تم استعادة الاتصال بالإنترنت');
  }

  function _onOffline() {
    State.set('isOnline', false);
    UI.updateConnectionStatus(false);
    Notifications.show('warning', 'لا يوجد اتصال', 'النظام يعمل في وضع أوفلاين - البيانات محفوظة محلياً');
  }

  return Object.freeze({ init });
})();
