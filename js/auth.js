/**
 * ═══════════════════════════════════════════════════════════
 * auth.js - نظام المصادقة والجلسات
 * Login | Session | Auto Logout | Role Management
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const Auth = (() => {

  let _idleTimer    = null;
  let _sessionTimer = null;
  let _lastActivity = Date.now();

  /* ══════════════════════════════════
     تسجيل الدخول
     ══════════════════════════════════ */

  /**
   * محاولة تسجيل الدخول
   */
  async function login(username, password) {
    // التحقق من المدخلات
    if (!Security.validateInput(username, 'username')) {
      return { success: false, error: 'اسم المستخدم غير صحيح' };
    }
    if (!Security.validateInput(password, 'password')) {
      return { success: false, error: 'كلمة المرور أقصر من المطلوب' };
    }

    try {
      // البحث عن المستخدم
      const user = await Storage.getByIndex(
        CONSTANTS.DB.STORES.USERS,
        'username',
        username.toLowerCase().trim()
      );

      if (!user) {
        return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
      }

      if (!user.active) {
        return { success: false, error: 'الحساب معطل، تواصل مع المسؤول' };
      }

      // التحقق من كلمة المرور
      const valid = await Security.verifyPassword(password, user.passwordHash, user.passwordSalt);
      if (!valid) {
        await Storage.logAction(user.id, 'login_failed', `محاولة دخول فاشلة: ${username}`);
        return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
      }

      // إنشاء جلسة
      const token  = Security.generateSessionToken();
      const expiry = Date.now() + CONSTANTS.SESSION.EXPIRY_MS;

      const sessionData = {
        token,
        userId:   user.id,
        username: user.username,
        role:     user.role,
        fullName: user.fullName,
        expiry,
        createdAt: new Date().toISOString(),
      };

      // حفظ الجلسة في IndexedDB
      await Storage.update(CONSTANTS.DB.STORES.SESSIONS, sessionData);

      // حفظ توكن مبسط في sessionStorage (للتحقق السريع)
      try {
        sessionStorage.setItem(CONSTANTS.SESSION.STORAGE_KEY, JSON.stringify({
          token, expiry, userId: user.id, role: user.role, fullName: user.fullName,
        }));
      } catch { /* QuotaExceeded - نتجاهل */ }

      // تحديث الحالة
      State.setSession(
        {
          id:       user.id,
          username: user.username,
          role:     user.role,
          fullName: user.fullName,
        },
        token,
        expiry
      );

      // بدء مراقبة الخمول
      _startIdleMonitoring();
      _startSessionTimer(expiry);

      await Storage.logAction(user.id, 'login_success', `دخول ناجح: ${username}`);

      return { success: true, user: sessionData };

    } catch (err) {
      console.error('[Auth] Login error:', err);
      return { success: false, error: 'خطأ في النظام، حاول مجدداً' };
    }
  }

  /* ══════════════════════════════════
     استعادة الجلسة عند إعادة التحميل
     ══════════════════════════════════ */

  async function restoreSession() {
    try {
      const raw = sessionStorage.getItem(CONSTANTS.SESSION.STORAGE_KEY);
      if (!raw) return false;

      const saved = Security.safeJsonParse(raw);
      if (!saved) return false;

      // التحقق من الصلاحية الزمنية
      if (saved.expiry < Date.now()) {
        await logout('session_expired');
        return false;
      }

      // التحقق من وجود الجلسة في DB
      const sessionRecord = await Storage.getById(
        CONSTANTS.DB.STORES.SESSIONS, saved.token
      );
      if (!sessionRecord) return false;

      // التحقق من المستخدم
      const user = await Storage.getById(CONSTANTS.DB.STORES.USERS, saved.userId);
      if (!user || !user.active) return false;

      // استعادة الجلسة
      State.setSession(
        {
          id:       user.id,
          username: user.username,
          role:     user.role,
          fullName: user.fullName,
        },
        saved.token,
        saved.expiry
      );

      _startIdleMonitoring();
      _startSessionTimer(saved.expiry);

      return true;
    } catch (err) {
      console.error('[Auth] Restore session error:', err);
      return false;
    }
  }

  /* ══════════════════════════════════
     تسجيل الخروج
     ══════════════════════════════════ */

  async function logout(reason = 'manual') {
    try {
      const token = State.get('sessionToken');
      const userId = State.get('currentUser')?.id;

      // حذف الجلسة من DB
      if (token) {
        await Storage.remove(CONSTANTS.DB.STORES.SESSIONS, token).catch(() => {});
      }

      // تسجيل العملية
      if (userId) {
        await Storage.logAction(userId, 'logout', reason);
      }

    } catch { /* silent */ } finally {
      // مسح التخزين المؤقت
      try { sessionStorage.removeItem(CONSTANTS.SESSION.STORAGE_KEY); } catch {}

      // إيقاف المراقبة
      _stopIdleMonitoring();
      _stopSessionTimer();

      // مسح الحالة
      State.clearSession();
    }
  }

  /* ══════════════════════════════════
     تسجيل مستخدم جديد
     ══════════════════════════════════ */

  async function createUser(userData) {
    // التحقق من الصلاحية
    if (!State.hasPermission('manage_users')) {
      return { success: false, error: 'لا تملك صلاحية إضافة مستخدمين' };
    }

    const clean = Security.sanitizeUser(userData);

    if (!Security.validateInput(clean.username, 'username')) {
      return { success: false, error: 'اسم المستخدم غير صحيح (3-30 حرف، أرقام وحروف فقط)' };
    }
    if (!Security.validateInput(userData.password, 'password')) {
      return { success: false, error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
    }

    try {
      // التحقق من عدم تكرار اسم المستخدم
      const existing = await Storage.getByIndex(
        CONSTANTS.DB.STORES.USERS,
        'username',
        clean.username.toLowerCase()
      );
      if (existing) {
        return { success: false, error: 'اسم المستخدم موجود بالفعل' };
      }

      // تشفير كلمة المرور
      const { hash, salt } = await Security.hashPassword(userData.password);

      const newUser = {
        ...clean,
        username:     clean.username.toLowerCase(),
        passwordHash: hash,
        passwordSalt: salt,
        active:       true,
      };

      const id = await Storage.add(CONSTANTS.DB.STORES.USERS, newUser);
      await Storage.logAction(
        State.get('currentUser').id,
        'create_user',
        `أنشأ مستخدم: ${clean.username}`
      );

      return { success: true, id };
    } catch (err) {
      console.error('[Auth] Create user error:', err);
      return { success: false, error: 'فشل إنشاء المستخدم' };
    }
  }

  /**
   * تغيير كلمة المرور
   */
  async function changePassword(userId, oldPassword, newPassword) {
    try {
      const user = await Storage.getById(CONSTANTS.DB.STORES.USERS, userId);
      if (!user) return { success: false, error: 'المستخدم غير موجود' };

      const valid = await Security.verifyPassword(
        oldPassword, user.passwordHash, user.passwordSalt
      );
      if (!valid) return { success: false, error: 'كلمة المرور الحالية غير صحيحة' };

      if (!Security.validateInput(newPassword, 'password')) {
        return { success: false, error: 'كلمة المرور الجديدة قصيرة جداً' };
      }

      const { hash, salt } = await Security.hashPassword(newPassword);
      await Storage.update(CONSTANTS.DB.STORES.USERS, {
        ...user,
        passwordHash: hash,
        passwordSalt: salt,
      });

      return { success: true };
    } catch {
      return { success: false, error: 'فشل تغيير كلمة المرور' };
    }
  }

  /* ══════════════════════════════════
     مراقبة الخمول - Auto Logout
     ══════════════════════════════════ */

  function _startIdleMonitoring() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(e => document.addEventListener(e, _resetIdleTimer, { passive: true }));
    _resetIdleTimer();
  }

  function _stopIdleMonitoring() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(e => document.removeEventListener(e, _resetIdleTimer));
    if (_idleTimer) clearTimeout(_idleTimer);
    _idleTimer = null;
  }

  function _resetIdleTimer() {
    _lastActivity = Date.now();
    if (_idleTimer) clearTimeout(_idleTimer);
    _idleTimer = setTimeout(async () => {
      if (State.isAuthenticated()) {
        Notifications.show('warning', 'انتهت الجلسة', 'تم تسجيل خروجك تلقائياً بسبب الخمول');
        await logout('idle_timeout');
        App.showAuthScreen();
      }
    }, CONSTANTS.SESSION.IDLE_TIMEOUT);
  }

  function _startSessionTimer(expiry) {
    _stopSessionTimer();
    const remaining = expiry - Date.now();
    if (remaining <= 0) return;

    _sessionTimer = setTimeout(async () => {
      if (State.isAuthenticated()) {
        Notifications.show('warning', 'انتهت الجلسة', 'تم تسجيل خروجك لانتهاء مدة الجلسة');
        await logout('session_expired');
        App.showAuthScreen();
      }
    }, remaining);
  }

  function _stopSessionTimer() {
    if (_sessionTimer) clearTimeout(_sessionTimer);
    _sessionTimer = null;
  }

  /* ── واجهة عامة ── */
  return Object.freeze({
    login,
    logout,
    restoreSession,
    createUser,
    changePassword,
  });

})();
