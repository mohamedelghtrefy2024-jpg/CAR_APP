/**
 * ═══════════════════════════════════════════════════════════
 * seed.js - بيانات تجريبية للتشغيل الأول
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const Seed = (() => {

  const DRIVERS_DATA = [
    { name: 'أحمد محمد علي',    phone: '01012345678', vehicle: 'تويوتا كورولا 2022',  plate: 'أ ب ج 1234', license: 'DL-1001', licenseExpiry: '2025-03-15', status: 'busy',      notes: 'سائق متمرس' },
    { name: 'محمود عبد الرحمن', phone: '01123456789', vehicle: 'كيا سبورتاج 2021',    plate: 'د هـ و 5678', license: 'DL-1002', licenseExpiry: '2026-08-20', status: 'available', notes: '' },
    { name: 'علي حسين محمد',    phone: '01234567890', vehicle: 'هيونداي تاكسون 2023', plate: 'ز ح ط 9012', license: 'DL-1003', licenseExpiry: '2025-05-10', status: 'available', notes: 'يعمل في المناطق الشمالية' },
    { name: 'خالد إبراهيم سيد', phone: '01098765432', vehicle: 'نيسان صنى 2020',      plate: 'ي ك ل 3456', license: 'DL-1004', licenseExpiry: '2024-12-01', status: 'break',     notes: '' },
    { name: 'عمر فاروق محمود',  phone: '01187654321', vehicle: 'مرسيدس E200 2022',    plate: 'م ن س 7890', license: 'DL-1005', licenseExpiry: '2026-11-30', status: 'available', notes: 'سائق VIP' },
    { name: 'يوسف مصطفى عادل', phone: '01276543210', vehicle: 'بي إم دبليو 320i',     plate: 'ع غ ف 2345', license: 'DL-1006', licenseExpiry: '2025-02-28', status: 'offline',   notes: '' },
    { name: 'حسن أحمد طاهر',   phone: '01365432109', vehicle: 'هوندا سيفيك 2021',    plate: 'ص ق ر 6789', license: 'DL-1007', licenseExpiry: '2026-07-15', status: 'busy',      notes: '' },
    { name: 'إبراهيم سعيد كمال',phone: '01454321098', vehicle: 'فولكسفاجن باسات',     plate: 'ش ت ث 0123', license: 'DL-1008', licenseExpiry: '2026-04-22', status: 'available', notes: 'مدرب سواقة' },
  ];

  // مواقع القاهرة التجريبية
  const CAIRO_LOCATIONS = [
    { lat: 30.0559, lng: 31.2243 }, // وسط القاهرة
    { lat: 30.0444, lng: 31.2357 }, // التحرير
    { lat: 30.0626, lng: 31.2497 }, // مصر الجديدة
    { lat: 29.9792, lng: 31.1342 }, // الجيزة
    { lat: 30.0731, lng: 31.3278 }, // النزهة
    { lat: 30.1220, lng: 31.3362 }, // مدينة نصر
    { lat: 29.9871, lng: 31.4362 }, // القطامية
    { lat: 30.0186, lng: 31.4979 }, // العاشر من رمضان
  ];

  async function run() {
    try {
      // تحقق إذا مضت عملية الـ seed
      const seeded = await Storage.getSetting('seeded');
      if (seeded === 'true') return;

      console.info('[Seed] Running initial seed...');

      // 1. إنشاء المدير العام
      const adminPwd = await Security.hashPassword('admin123');
      await Storage.add(CONSTANTS.DB.STORES.USERS, {
        username:     'admin',
        fullName:     'المدير العام',
        role:         'admin',
        phone:        '01000000000',
        passwordHash: adminPwd.hash,
        passwordSalt: adminPwd.salt,
        active:       true,
      });

      // 2. إنشاء مشرف
      const supPwd = await Security.hashPassword('super123');
      await Storage.add(CONSTANTS.DB.STORES.USERS, {
        username:     'supervisor',
        fullName:     'مشرف الأسطول',
        role:         'supervisor',
        phone:        '01011111111',
        passwordHash: supPwd.hash,
        passwordSalt: supPwd.salt,
        active:       true,
      });

      // 3. إنشاء موظف
      const empPwd = await Security.hashPassword('emp123');
      await Storage.add(CONSTANTS.DB.STORES.USERS, {
        username:     'employee',
        fullName:     'موظف المتابعة',
        role:         'employee',
        phone:        '01022222222',
        passwordHash: empPwd.hash,
        passwordSalt: empPwd.salt,
        active:       true,
      });

      // 4. إنشاء السائقين مع مواقع
      for (let i = 0; i < DRIVERS_DATA.length; i++) {
        const d   = DRIVERS_DATA[i];
        const loc = CAIRO_LOCATIONS[i] || CAIRO_LOCATIONS[0];
        await Storage.add(CONSTANTS.DB.STORES.DRIVERS, {
          ...d,
          lastLat:   loc.lat + (Math.random() - 0.5) * 0.02,
          lastLng:   loc.lng + (Math.random() - 0.5) * 0.02,
          lastSpeed: d.status === 'busy' ? Math.round(Math.random() * 60 + 10) : 0,
          lastSeen:  new Date(Date.now() - Math.random() * 3600000).toISOString(),
        });
      }

      // تعيين علامة الـ seed
      await Storage.setSetting('seeded', 'true');
      console.info('[Seed] Initial seed completed successfully');

    } catch (err) {
      console.error('[Seed] Seed error:', err);
    }
  }

  return Object.freeze({ run });
})();
