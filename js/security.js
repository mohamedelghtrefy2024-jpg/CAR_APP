/**
 * ═══════════════════════════════════════════════════════════
 * security.js - طبقة الأمان الكاملة
 * XSS Protection | Password Hashing | Input Sanitization
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const Security = (() => {

  /* ══════════════════════════════════
     تشفير كلمات المرور (بدون backend)
     PBKDF2-like بـ Web Crypto API
     ══════════════════════════════════ */

  /**
   * توليد Salt عشوائي
   */
  function generateSalt() {
    const arr = new Uint8Array(CONSTANTS.SECURITY.SALT_LENGTH);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * تحويل نص إلى ArrayBuffer
   */
  function strToBuffer(str) {
    return new TextEncoder().encode(str);
  }

  /**
   * تحويل ArrayBuffer إلى hex
   */
  function bufferToHex(buf) {
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Hash كلمة المرور باستخدام PBKDF2
   * @returns {Promise<{hash: string, salt: string}>}
   */
  async function hashPassword(password) {
    const salt = generateSalt();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      strToBuffer(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: strToBuffer(salt),
        iterations: CONSTANTS.SECURITY.HASH_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    return { hash: bufferToHex(bits), salt };
  }

  /**
   * التحقق من كلمة المرور
   */
  async function verifyPassword(password, storedHash, salt) {
    try {
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        strToBuffer(password),
        'PBKDF2',
        false,
        ['deriveBits']
      );
      const bits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: strToBuffer(salt),
          iterations: CONSTANTS.SECURITY.HASH_ITERATIONS,
          hash: 'SHA-256',
        },
        keyMaterial,
        256
      );
      const hash = bufferToHex(bits);
      return timingSafeEqual(hash, storedHash);
    } catch {
      return false;
    }
  }

  /**
   * مقارنة آمنة زمنياً (منع Timing Attacks)
   */
  function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }

  /* ══════════════════════════════════
     حماية XSS - تنظيف النصوص
     ══════════════════════════════════ */

  /** قائمة بيضاء للأحرف المسموحة في الأسماء */
  const ARABIC_NAME_PATTERN = /^[\u0600-\u06FF\u0750-\u077F\s\-a-zA-Z]{2,60}$/;
  const PHONE_PATTERN  = /^(01[0125]\d{8}|0\d{8,10})$/;
  const PLATE_PATTERN  = /^[\u0600-\u06FF0-9A-Za-z\s\-]{2,20}$/;
  const USERNAME_PATTERN = /^[a-zA-Z0-9_\-.]{3,30}$/;

  /**
   * Escape HTML خام - أساس الحماية من XSS
   */
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * تنظيف النص من أي محتوى خطير
   */
  function sanitizeText(input, maxLength = 200) {
    if (input === null || input === undefined) return '';
    const str = String(input).trim();
    return escapeHtml(str).slice(0, maxLength);
  }

  /**
   * تحقق صارم من المدخلات
   */
  function validateInput(value, type) {
    if (value === null || value === undefined) return false;
    const str = String(value).trim();

    switch (type) {
      case 'arabic_name': return ARABIC_NAME_PATTERN.test(str);
      case 'phone':       return PHONE_PATTERN.test(str);
      case 'plate':       return PLATE_PATTERN.test(str);
      case 'username':    return USERNAME_PATTERN.test(str);
      case 'password':    return str.length >= CONSTANTS.SECURITY.MIN_PASSWORD_LEN;
      case 'date':        return !isNaN(Date.parse(str));
      case 'email':       return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
      case 'url':         return /^https?:\/\/.+/.test(str);
      default:            return str.length > 0 && str.length <= 500;
    }
  }

  /**
   * تحليل JSON آمن (يمنع الـ prototype pollution)
   */
  function safeJsonParse(jsonStr) {
    try {
      if (typeof jsonStr !== 'string') return null;
      const obj = JSON.parse(jsonStr);
      // منع prototype pollution
      if (obj && typeof obj === 'object') {
        if ('__proto__' in obj || 'constructor' in obj || 'prototype' in obj) {
          console.warn('[Security] Blocked potential prototype pollution attempt');
          return null;
        }
      }
      return obj;
    } catch {
      return null;
    }
  }

  /**
   * تنظيف بيانات السائق قبل الحفظ
   */
  function sanitizeDriver(data) {
    return {
      name:         sanitizeText(data.name, 60),
      phone:        sanitizeText(data.phone, 20),
      vehicle:      sanitizeText(data.vehicle, 60),
      plate:        sanitizeText(data.plate, 20),
      license:      sanitizeText(data.license, 40),
      licenseExpiry:sanitizeText(data.licenseExpiry, 20),
      status:       ['available','busy','break','offline'].includes(data.status)
                    ? data.status : 'offline',
      notes:        sanitizeText(data.notes, 500),
    };
  }

  /**
   * تنظيف بيانات المستخدم
   */
  function sanitizeUser(data) {
    const allowedRoles = Object.keys(CONSTANTS.ROLES).map(k => CONSTANTS.ROLES[k]);
    return {
      username:    sanitizeText(data.username, 30),
      fullName:    sanitizeText(data.fullName, 60),
      role:        allowedRoles.includes(data.role) ? data.role : 'employee',
      phone:       sanitizeText(data.phone, 20),
      active:      Boolean(data.active),
    };
  }

  /**
   * إنشاء توكن جلسة عشوائي
   */
  function generateSessionToken() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Global Error Boundary - معالجة الأخطاء غير المتوقعة
   */
  function initErrorBoundary() {
    window.addEventListener('error', (e) => {
      console.error('[Error Boundary]', e.message, e.filename, e.lineno);
      // لا نعرض تفاصيل الخطأ للمستخدم لأسباب أمنية
    });

    window.addEventListener('unhandledrejection', (e) => {
      console.error('[Unhandled Promise]', e.reason);
      e.preventDefault();
    });
  }

  /* ── واجهة عامة ── */
  return Object.freeze({
    hashPassword,
    verifyPassword,
    escapeHtml,
    sanitizeText,
    validateInput,
    safeJsonParse,
    sanitizeDriver,
    sanitizeUser,
    generateSessionToken,
    initErrorBoundary,
  });

})();
