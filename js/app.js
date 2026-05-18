/**
 * ═══════════════════════════════════════════════════════════
 * app.js - نقطة البداية الرئيسية
 * Bootstrap | Auth Flow | Section Controllers
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const App = (() => {

  let _driverSearchFn = null;

  /* ══════════════════════════════════
     التهيئة الرئيسية
     ══════════════════════════════════ */

  async function init() {
    try {
      // 1. Error Boundary
      Security.initErrorBoundary();

      // 2. IndexedDB
      await Storage.init();

      // 3. Seed البيانات الأولية
      await Seed.run();

      // 4. Offline/Service Worker
      Offline.init();

      // 5. Notifications
      Notifications.init();

      // 6. محاولة استعادة الجلسة
      const restored = await Auth.restoreSession();

      if (restored && State.isAuthenticated()) {
        await _bootApp();
      } else {
        showAuthScreen();
      }

    } catch (err) {
      console.error('[App] Init failed:', err);
      _showFatalError();
    }
  }

  /* ══════════════════════════════════
     شاشة تسجيل الدخول
     ══════════════════════════════════ */

  function showAuthScreen() {
    const appWrapper = document.getElementById('app-wrapper');
    const authScreen  = document.getElementById('auth-screen');
    if (appWrapper)  appWrapper.style.display = 'none';
    if (authScreen)  authScreen.style.display = 'flex';
  }

  function hideAuthScreen() {
    const appWrapper = document.getElementById('app-wrapper');
    const authScreen  = document.getElementById('auth-screen');
    if (appWrapper)  appWrapper.style.display = 'flex';
    if (authScreen)  authScreen.style.display = 'none';
  }

  /* ══════════════════════════════════
     تشغيل التطبيق الرئيسي
     ══════════════════════════════════ */

  async function _bootApp() {
    hideAuthScreen();

    const user = State.get('currentUser');

    // تحديث اسم المستخدم في Sidebar
    _updateUserInfo(user);

    // تطبيق الصلاحيات
    _applyPermissions(user.role);

    // تحميل البيانات
    UI.setLoading(true);
    try {
      await Drivers.loadAll();
      await Users.loadAll();
    } finally {
      UI.setLoading(false);
    }

    // الانتقال للـ Dashboard
    UI.navigateTo('dashboard');

    // تقرير الـ Dashboard
    Reports.renderDashboard();

    // تشغيل محاكاة GPS
    const drivers = State.get('drivers');
    GPS.startSimulation(drivers.filter(d => d.status !== 'offline'));

    // فحص الرخص
    await Notifications.checkLicenseAlerts();

    // تهيئة الخريطة مبكراً في الخلفية (بعد 800ms)
    // عشان لما المستخدم ينتقل إليها تكون جاهزة فوراً
    setTimeout(() => {
      if (typeof L !== 'undefined' && !MapModule.isReady()) {
        MapModule.init();
        MapModule.renderAllDrivers(State.get('drivers'));
      }
    }, 800);

    // مراقبة تغيير الـ Stats
    State.subscribe('stats', () => {
      Reports.renderDashboard();
    });

    // مراقبة تغيير السائقين
    State.subscribe('drivers', (drivers) => {
      if (State.get('activeSection') === 'drivers') {
        Drivers.renderTable(Drivers.getFilteredDrivers());
      }
      if (MapModule.isReady()) {
        MapModule.renderAllDrivers(drivers);
      }
    });

    console.info('[App] Application booted for user:', user.username, '/', user.role);
  }

  /* ══════════════════════════════════
     معلومات المستخدم في Sidebar
     ══════════════════════════════════ */

  function _updateUserInfo(user) {
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-user-avatar');

    if (nameEl)   nameEl.textContent   = user.fullName;
    if (roleEl)   roleEl.textContent   = CONSTANTS.ROLE_LABELS[user.role] || user.role;
    if (avatarEl) avatarEl.textContent = (user.fullName || '?').slice(0, 2);
  }

  /* ══════════════════════════════════
     تطبيق الصلاحيات على الواجهة
     ══════════════════════════════════ */

  function _applyPermissions(role) {
    // إخفاء عناصر حسب الدور
    document.querySelectorAll('[data-permission]').forEach(el => {
      const required = el.dataset.permission;
      const perms    = CONSTANTS.PERMISSIONS[role] || [];
      if (!perms.includes(required)) {
        el.style.display = 'none';
      }
    });

    // إخفاء قسم المستخدمين من Navigation إن لم تكن مدير
    if (role !== 'admin') {
      document.querySelectorAll('[data-section="users"]').forEach(el => {
        el.style.display = 'none';
      });
    }
  }

  /* ══════════════════════════════════
     ربط الأحداث
     ══════════════════════════════════ */

  function _bindEvents() {

    /* ── تسجيل الدخول ── */
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await _handleLogin();
      });
    }

    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
      loginBtn.addEventListener('click', _handleLogin);
    }

    // إظهار/إخفاء كلمة المرور
    const pwdToggle = document.getElementById('pwd-toggle');
    const pwdInput  = document.getElementById('login-password');
    if (pwdToggle && pwdInput) {
      pwdToggle.addEventListener('click', () => {
        const isText = pwdInput.type === 'text';
        pwdInput.type = isText ? 'password' : 'text';
        pwdToggle.textContent = isText ? '👁️' : '🙈';
      });
    }

    /* ── Navigation ── */
    document.querySelectorAll('[data-section]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        if (section) UI.navigateTo(section);
      });
    });

    /* ── موبايل Sidebar ── */
    document.getElementById('sidebar-toggle')?.addEventListener('click', UI.openSidebar);
    document.getElementById('sidebar-overlay')?.addEventListener('click', UI.closeSidebar);

    /* ── تسجيل الخروج ── */
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
      await Auth.logout();
      GPS.stopSimulation();
      MapModule.destroy();
      showAuthScreen();
      Notifications.show('info', 'تم الخروج', 'تم تسجيل خروجك بنجاح');
    });

    /* ── قسم السائقين ── */
    document.getElementById('add-driver-btn')?.addEventListener('click', () => {
      DriverModal.showAdd();
    });

    // البحث مع debounce
    _driverSearchFn = UI.debounce((e) => {
      Drivers.setSearch(e.target.value);
    }, CONSTANTS.PERFORMANCE.SEARCH_DEBOUNCE_MS);

    document.getElementById('driver-search')?.addEventListener('input', _driverSearchFn);

    // فلاتر الحالة
    document.querySelectorAll('.driver-filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.driver-filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        Drivers.setFilter(chip.dataset.filter);
      });
    });

    /* ── قسم المستخدمين ── */
    document.getElementById('add-user-btn')?.addEventListener('click', () => {
      UserModal.showAdd();
    });

    /* ── خريطة ── */
    document.getElementById('fit-all-btn')?.addEventListener('click', MapModule.fitAllMarkers);

    /* ── الخريطة تحتاج تهيئة عند الظهور للمرة الأولى ── */
    State.subscribe('activeSection', (section) => {
      if (section === 'map') {
        // نعطي المتصفح وقت يرسم القسم الجديد قبل ما Leaflet يحسب الأبعاد
        setTimeout(() => {
          if (!MapModule.isReady()) {
            MapModule.init();
          } else {
            // Leaflet يعيد حساب حجم الـ container بعد ما كان مخبي
            MapModule.invalidateSize();
          }
          MapModule.renderAllDrivers(State.get('drivers'));
        }, 250);
      }
    });

    /* ── كروت Dashboard: كل كارت عند الضغط يروح للتقارير بفلتر محدد ── */
    document.querySelectorAll('.stat-card[data-filter]').forEach(card => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        const filter = card.dataset.filter;
        UI.navigateTo('reports');
        // نستخدم setTimeout عشان نضمن إن reports-section.js اتحمل وأضاف setFilter
        setTimeout(() => {
          if (typeof Reports.setFilter === 'function') {
            Reports.setFilter(filter);
          }
        }, 80);
      });
    });
  }

  /* ══════════════════════════════════
     معالجة تسجيل الدخول
     ══════════════════════════════════ */

  async function _handleLogin() {
    const usernameEl = document.getElementById('login-username');
    const passwordEl = document.getElementById('login-password');
    const loginBtn   = document.getElementById('login-btn');
    const errorEl    = document.getElementById('login-error');

    if (!usernameEl || !passwordEl) return;

    const username = usernameEl.value.trim();
    const password = passwordEl.value;

    // مسح الأخطاء
    if (errorEl) errorEl.style.display = 'none';

    if (!username || !password) {
      _showLoginError(errorEl, 'يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    // تعطيل الزر أثناء المعالجة
    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.textContent = 'جارٍ تسجيل الدخول...';
    }

    const result = await Auth.login(username, password);

    if (result.success) {
      await _bootApp();
    } else {
      _showLoginError(errorEl, result.error || 'بيانات الدخول غير صحيحة');
      if (passwordEl) passwordEl.value = '';
    }

    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.textContent = 'تسجيل الدخول';
    }
  }

  function _showLoginError(el, message) {
    if (!el) return;
    el.textContent = message;
    el.style.display = 'block';
    el.style.animation = 'none';
    requestAnimationFrame(() => {
      el.style.animation = '';
    });
  }

  /* ══════════════════════════════════
     خطأ فادح
     ══════════════════════════════════ */

  function _showFatalError() {
    document.body.innerHTML = '';
    const div = document.createElement('div');
    div.style.cssText = `
      min-height:100vh; display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      background:#0a0e1a; color:#e8edf5;
      font-family:'Cairo',sans-serif; text-align:center; gap:16px;
    `;
    const icon  = document.createElement('div');
    icon.style.fontSize = '48px';
    icon.textContent = '⚠️';
    const title = document.createElement('h2');
    title.textContent = 'حدث خطأ في التشغيل';
    const msg = document.createElement('p');
    msg.style.color = '#8899bb';
    msg.textContent = 'يرجى تحديث الصفحة أو مسح بيانات المتصفح';
    const btn = document.createElement('button');
    btn.style.cssText = 'padding:10px 20px;background:#3b7ff5;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:Cairo,sans-serif;font-size:14px;';
    btn.textContent = 'إعادة المحاولة';
    btn.addEventListener('click', () => location.reload());
    div.append(icon, title, msg, btn);
    document.body.appendChild(div);
  }

  /* ══════════════════════════════════
     تشغيل التطبيق بعد تحميل DOM
     ══════════════════════════════════ */

  document.addEventListener('DOMContentLoaded', () => {
    _bindEvents();
    init();
  });

  return Object.freeze({ init, showAuthScreen, hideAuthScreen });

})();
