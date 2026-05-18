/**
 * ═══════════════════════════════════════════════════════════
 * ui.js - وحدة الواجهة الرسومية
 * DOM Helpers | Section Routing | Safe Rendering
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const UI = (() => {

  /* ══════════════════════════════════
     التنقل بين الأقسام
     ══════════════════════════════════ */

  function navigateTo(sectionId) {
    // نخبي كل الأقسام (visibility بدل display عشان Leaflet يشتغل)
    document.querySelectorAll('.section').forEach(s => {
      s.classList.remove('active');
    });

    // نظهر القسم المطلوب
    const section = document.getElementById(`section-${sectionId}`);
    if (section) {
      section.classList.add('active');
      // أنيميشن دخول خفيف
      section.style.animation = 'none';
      section.offsetHeight; // force reflow
      section.style.animation = '';
    }

    // تحديث Navigation
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
      item.classList.toggle('active', item.dataset.section === sectionId);
    });

    document.querySelectorAll('.mobile-nav-item[data-section]').forEach(item => {
      item.classList.toggle('active', item.dataset.section === sectionId);
    });

    // تحديث عنوان الصفحة
    const titles = {
      dashboard: 'لوحة التحكم',
      drivers:   'إدارة السائقين',
      map:       'الخريطة المباشرة',
      users:     'المستخدمون',
      reports:   'التقارير',
      settings:  'الإعدادات',
    };

    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titles[sectionId] || '';

    // scroll للأعلى
    window.scrollTo({ top: 0, behavior: 'smooth' });

    State.set('activeSection', sectionId);

    // الخريطة: تهيئة + invalidateSize عشان الـ visibility لا تخلي الحجم صفر
    if (sectionId === 'map') {
      setTimeout(() => {
        if (typeof L === 'undefined') {
          Notifications.show('warning', 'الخريطة', 'تعذر تحميل مكتبة الخرائط - تأكد من الاتصال بالإنترنت');
          return;
        }
        if (!MapModule.isReady()) {
          MapModule.init();
        } else {
          MapModule.invalidateSize();
        }
        MapModule.renderAllDrivers(State.get('drivers'));
      }, 250);
    }

    // إغلاق الشريط الجانبي على الموبايل
    if (window.innerWidth <= 768) {
      closeSidebar();
    }
  }

  /* ══════════════════════════════════
     الشريط الجانبي - موبايل
     ══════════════════════════════════ */

  function openSidebar() {
    document.getElementById('sidebar')?.classList.add('open');
    document.getElementById('sidebar-overlay')?.classList.add('visible');
    State.set('isSidebarOpen', true);
  }

  function closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('visible');
    State.set('isSidebarOpen', false);
  }

  /* ══════════════════════════════════
     إنشاء عناصر DOM آمن
     ══════════════════════════════════ */

  /**
   * إنشاء عنصر HTML بأمان
   */
  function createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [key, val] of Object.entries(attrs)) {
      if (key === 'class')     el.className = val;
      else if (key === 'text') el.textContent = val; // آمن من XSS
      else if (key.startsWith('on')) {
        el.addEventListener(key.slice(2), val);
      }
      else el.setAttribute(key, val);
    }
    for (const child of children) {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        el.appendChild(child);
      }
    }
    return el;
  }

  /**
   * مسح وإعادة بناء العنصر بأمان
   */
  function clearAndRender(container, renderFn) {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    renderFn(container);
  }

  /* ══════════════════════════════════
     حالة Status Badge
     ══════════════════════════════════ */

  function createStatusBadge(status) {
    const label = CONSTANTS.STATUS_LABELS[status] || 'غير معروف';
    const span  = document.createElement('span');
    span.className = `status-badge status-${status}`;
    span.textContent = label;
    return span;
  }

  /* ══════════════════════════════════
     تنسيق التواريخ
     ══════════════════════════════════ */

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('ar-EG', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    } catch { return dateStr; }
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('ar-EG', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return dateStr; }
  }

  function formatLastSeen(timestamp) {
    if (!timestamp) return 'غير معروف';
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return 'الآن';
    if (mins < 60)  return `منذ ${mins} دق`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `منذ ${hrs} ساعة`;
    return `منذ ${Math.floor(hrs / 24)} يوم`;
  }

  /**
   * فئة CSS لآخر ظهور
   */
  function lastSeenClass(timestamp) {
    if (!timestamp) return '';
    const diff = Date.now() - new Date(timestamp).getTime();
    if (diff < 300000)  return 'recent';   // < 5 دقائق
    if (diff < 1800000) return 'medium';   // < 30 دقيقة
    return 'old';
  }

  /**
   * تحذير انتهاء الرخصة
   */
  function licenseStatus(expiryStr) {
    if (!expiryStr) return { class: '', text: '-' };
    const exp   = new Date(expiryStr);
    const today = new Date();
    const warn  = new Date(today);
    warn.setDate(warn.getDate() + CONSTANTS.LICENSE.WARNING_DAYS);

    if (exp < today) return { class: 'license-expired', text: 'منتهية ⚠️' };
    if (exp < warn)  return { class: 'license-warning',  text: `تنتهي ${formatDate(expiryStr)}` };
    return { class: '', text: formatDate(expiryStr) };
  }

  /* ══════════════════════════════════
     إظهار / إخفاء العناصر
     ══════════════════════════════════ */

  function show(el) {
    if (!el) return;
    el.style.display = '';
    el.removeAttribute('hidden');
  }

  function hide(el) {
    if (!el) return;
    el.setAttribute('hidden', '');
  }

  function setLoading(isLoading) {
    State.set('isLoading', isLoading);
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = isLoading ? 'flex' : 'none';
  }

  /* ══════════════════════════════════
     تحديث إحصائيات Dashboard
     ══════════════════════════════════ */

  function updateStats(stats) {
    const fields = ['total', 'available', 'busy', 'break', 'offline', 'expired', 'expiring'];
    fields.forEach(key => {
      const el = document.getElementById(`stat-${key}`);
      if (el) el.textContent = stats[key] ?? 0;
    });

    // Badge الشريط الجانبي للتنبيهات
    const alertBadge = document.getElementById('license-badge');
    if (alertBadge) {
      const total = (stats.expired || 0) + (stats.expiring || 0);
      alertBadge.textContent = total;
      alertBadge.style.display = total > 0 ? '' : 'none';
    }
  }

  /* ══════════════════════════════════
     تحديث مؤشر الاتصال
     ══════════════════════════════════ */

  function updateConnectionStatus(isOnline) {
    const el = document.getElementById('connection-status');
    if (!el) return;
    el.className = `connection-indicator ${isOnline ? 'online' : 'offline'}`;
    el.querySelector('.connection-label').textContent = isOnline ? 'متصل' : 'أوفلاين';
  }

  /* ══════════════════════════════════
     Debounce & Throttle
     ══════════════════════════════════ */

  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function throttle(fn, limit) {
    let lastCall = 0;
    return function (...args) {
      const now = Date.now();
      if (now - lastCall >= limit) {
        lastCall = now;
        fn.apply(this, args);
      }
    };
  }

  /* ── واجهة عامة ── */
  return Object.freeze({
    navigateTo,
    openSidebar,
    closeSidebar,
    createElement,
    clearAndRender,
    createStatusBadge,
    formatDate,
    formatDateTime,
    formatLastSeen,
    lastSeenClass,
    licenseStatus,
    show,
    hide,
    setLoading,
    updateStats,
    updateConnectionStatus,
    debounce,
    throttle,
  });

})();
