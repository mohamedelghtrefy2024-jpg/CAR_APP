/**
 * ═══════════════════════════════════════════════════════════
 * drivers.js - إدارة السائقين
 * CRUD | Search | Filter | License Alerts
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const Drivers = (() => {

  let _currentFilter = 'all';
  let _searchQuery   = '';
  let _allDrivers    = [];

  /* ══════════════════════════════════
     تحميل السائقين
     ══════════════════════════════════ */

  async function loadAll() {
    try {
      const drivers = await Storage.getAll(CONSTANTS.DB.STORES.DRIVERS);
      _allDrivers = drivers;
      State.setDrivers(drivers);
      renderTable(drivers);
      return drivers;
    } catch (err) {
      console.error('[Drivers] Load error:', err);
      Notifications.show('error', 'خطأ', 'تعذر تحميل بيانات السائقين');
      return [];
    }
  }

  /* ══════════════════════════════════
     إضافة سائق
     ══════════════════════════════════ */

  async function add(data) {
    if (!State.hasPermission('manage_drivers')) {
      Notifications.show('error', 'رفض', 'لا تملك صلاحية إضافة سائق');
      return { success: false };
    }

    const errors = _validateDriver(data);
    if (errors.length > 0) {
      return { success: false, errors };
    }

    try {
      const clean = Security.sanitizeDriver(data);
      clean.status  = 'offline';
      clean.lastLat = null;
      clean.lastLng = null;
      clean.lastSeen = null;

      const id = await Storage.add(CONSTANTS.DB.STORES.DRIVERS, clean);
      const newDriver = { ...clean, id };

      State.addDriver(newDriver);
      _allDrivers.push(newDriver);

      await Storage.logAction(
        State.get('currentUser').id,
        'add_driver',
        `أضاف سائق: ${clean.name}`
      );

      Notifications.show('success', 'تم الإضافة', `تم إضافة السائق ${clean.name} بنجاح`);
      renderTable(getFilteredDrivers());
      return { success: true, driver: newDriver };

    } catch (err) {
      console.error('[Drivers] Add error:', err);
      Notifications.show('error', 'خطأ', 'تعذر إضافة السائق');
      return { success: false };
    }
  }

  /* ══════════════════════════════════
     تعديل سائق
     ══════════════════════════════════ */

  async function edit(id, data) {
    if (!State.hasPermission('manage_drivers')) {
      Notifications.show('error', 'رفض', 'لا تملك صلاحية تعديل بيانات السائق');
      return { success: false };
    }

    const errors = _validateDriver(data);
    if (errors.length > 0) {
      return { success: false, errors };
    }

    try {
      const existing = await Storage.getById(CONSTANTS.DB.STORES.DRIVERS, id);
      if (!existing) return { success: false, errors: ['السائق غير موجود'] };

      const clean = Security.sanitizeDriver(data);
      const updated = {
        ...existing,
        ...clean,
        id, // لا نسمح بتغيير الـ ID
      };

      await Storage.update(CONSTANTS.DB.STORES.DRIVERS, updated);
      State.updateDriver(updated);
      _allDrivers = _allDrivers.map(d => d.id === id ? updated : d);

      // تحديث الخريطة
      if (MapModule.isReady()) {
        MapModule.updateDriverStatus(id, updated.status);
      }

      await Storage.logAction(
        State.get('currentUser').id,
        'edit_driver',
        `عدّل بيانات: ${clean.name}`
      );

      Notifications.show('success', 'تم التعديل', `تم تحديث بيانات ${clean.name}`);
      renderTable(getFilteredDrivers());
      return { success: true, driver: updated };

    } catch (err) {
      console.error('[Drivers] Edit error:', err);
      Notifications.show('error', 'خطأ', 'تعذر تعديل بيانات السائق');
      return { success: false };
    }
  }

  /* ══════════════════════════════════
     حذف سائق
     ══════════════════════════════════ */

  async function remove(id) {
    if (!State.hasPermission('delete_records')) {
      Notifications.show('error', 'رفض', 'لا تملك صلاحية حذف السائقين');
      return { success: false };
    }

    try {
      const driver = await Storage.getById(CONSTANTS.DB.STORES.DRIVERS, id);
      if (!driver) return { success: false };

      await Storage.remove(CONSTANTS.DB.STORES.DRIVERS, id);
      State.removeDriver(id);
      _allDrivers = _allDrivers.filter(d => d.id !== id);

      MapModule.removeDriverMarker(id);

      await Storage.logAction(
        State.get('currentUser').id,
        'delete_driver',
        `حذف سائق: ${driver.name}`
      );

      Notifications.show('success', 'تم الحذف', `تم حذف السائق ${driver.name}`);
      renderTable(getFilteredDrivers());
      return { success: true };

    } catch (err) {
      console.error('[Drivers] Delete error:', err);
      Notifications.show('error', 'خطأ', 'تعذر حذف السائق');
      return { success: false };
    }
  }

  /* ══════════════════════════════════
     تغيير الحالة السريع
     ══════════════════════════════════ */

  async function changeStatus(driverId, newStatus) {
    if (!['available','busy','break','offline'].includes(newStatus)) return;

    try {
      const driver = await Storage.getById(CONSTANTS.DB.STORES.DRIVERS, driverId);
      if (!driver) return;

      const updated = { ...driver, status: newStatus };
      await Storage.update(CONSTANTS.DB.STORES.DRIVERS, updated);
      State.updateDriver(updated);
      _allDrivers = _allDrivers.map(d => d.id === driverId ? updated : d);

      MapModule.updateDriverStatus(driverId, newStatus);
      renderTable(getFilteredDrivers());

    } catch (err) {
      console.error('[Drivers] Status change error:', err);
    }
  }

  /* ══════════════════════════════════
     الفلاتر والبحث
     ══════════════════════════════════ */

  function setFilter(filter) {
    _currentFilter = filter;
    renderTable(getFilteredDrivers());
  }

  function setSearch(query) {
    _searchQuery = query.trim().toLowerCase();
    renderTable(getFilteredDrivers());
  }

  function getFilteredDrivers() {
    let list = [..._allDrivers];

    // فلتر الحالة
    if (_currentFilter !== 'all') {
      list = list.filter(d => d.status === _currentFilter);
    }

    // البحث
    if (_searchQuery) {
      list = list.filter(d =>
        d.name?.toLowerCase().includes(_searchQuery) ||
        d.phone?.includes(_searchQuery) ||
        d.plate?.toLowerCase().includes(_searchQuery) ||
        d.vehicle?.toLowerCase().includes(_searchQuery)
      );
    }

    return list;
  }

  /* ══════════════════════════════════
     عرض الجدول
     ══════════════════════════════════ */

  function renderTable(drivers) {
    const container = document.getElementById('drivers-table-body');
    if (!container) return;

    UI.clearAndRender(container, (tbody) => {
      if (drivers.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 8;
        td.style.padding = '40px';
        td.style.textAlign = 'center';
        td.style.color = 'var(--color-text-muted)';
        td.textContent = _searchQuery ? 'لا توجد نتائج للبحث' : 'لا يوجد سائقون مسجلون';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }

      const locations = State.get('driverLocations');

      drivers.forEach(driver => {
        const loc = locations[driver.id];
        const tr  = document.createElement('tr');

        // الاسم
        const tdName = document.createElement('td');
        const nameDiv = document.createElement('div');
        nameDiv.style.fontWeight = '600';
        nameDiv.textContent = driver.name;
        const phoneDiv = document.createElement('div');
        phoneDiv.className = 'td-muted';
        phoneDiv.textContent = driver.phone || '-';
        tdName.appendChild(nameDiv);
        tdName.appendChild(phoneDiv);

        // المركبة
        const tdVehicle = document.createElement('td');
        const vehicleDiv = document.createElement('div');
        vehicleDiv.textContent = driver.vehicle || '-';
        const plateDiv = document.createElement('div');
        plateDiv.className = 'td-muted';
        plateDiv.style.fontFamily = 'var(--font-mono)';
        plateDiv.textContent = driver.plate || '-';
        tdVehicle.appendChild(vehicleDiv);
        tdVehicle.appendChild(plateDiv);

        // الحالة
        const tdStatus = document.createElement('td');
        tdStatus.appendChild(UI.createStatusBadge(driver.status));

        // السرعة
        const tdSpeed = document.createElement('td');
        const speed = loc?.speed || 0;
        const speedDiv = document.createElement('div');
        speedDiv.className = `speed-badge ${speed > 0 ? 'moving' : ''}`;
        speedDiv.textContent = `${speed} كم/س`;
        tdSpeed.appendChild(speedDiv);

        // الرخصة
        const tdLicense = document.createElement('td');
        const ls = UI.licenseStatus(driver.licenseExpiry);
        const licenseDiv = document.createElement('div');
        if (ls.class) licenseDiv.className = ls.class;
        licenseDiv.style.fontSize = '12px';
        licenseDiv.style.fontWeight = '600';
        licenseDiv.textContent = ls.text;
        tdLicense.appendChild(licenseDiv);

        // آخر ظهور
        const tdLastSeen = document.createElement('td');
        const lsTime = loc?.timestamp || driver.lastSeen;
        const lastSeenDiv = document.createElement('div');
        lastSeenDiv.className = `last-seen ${UI.lastSeenClass(lsTime)}`;
        lastSeenDiv.textContent = UI.formatLastSeen(lsTime);
        tdLastSeen.appendChild(lastSeenDiv);

        // الإجراءات
        const tdActions = document.createElement('td');
        tdActions.className = 'actions-cell';

        // زر الخريطة
        if (driver.lastLat) {
          const mapBtn = document.createElement('button');
          mapBtn.className = 'btn btn-icon btn-ghost';
          mapBtn.title = 'عرض على الخريطة';
          mapBtn.textContent = '🗺️';
          mapBtn.addEventListener('click', () => {
            UI.navigateTo('map');
            setTimeout(() => MapModule.focusDriver(driver.id), 300);
          });
          tdActions.appendChild(mapBtn);
        }

        // زر التعديل
        if (State.hasPermission('manage_drivers')) {
          const editBtn = document.createElement('button');
          editBtn.className = 'btn btn-icon btn-ghost';
          editBtn.title = 'تعديل';
          editBtn.textContent = '✏️';
          editBtn.addEventListener('click', () => DriverModal.showEdit(driver));
          tdActions.appendChild(editBtn);
        }

        // زر الحذف
        if (State.hasPermission('delete_records')) {
          const delBtn = document.createElement('button');
          delBtn.className = 'btn btn-icon btn-danger';
          delBtn.title = 'حذف';
          delBtn.textContent = '🗑️';
          delBtn.addEventListener('click', () => DriverModal.showDelete(driver));
          tdActions.appendChild(delBtn);
        }

        tr.appendChild(tdName);
        tr.appendChild(tdVehicle);
        tr.appendChild(tdStatus);
        tr.appendChild(tdSpeed);
        tr.appendChild(tdLicense);
        tr.appendChild(tdLastSeen);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
      });
    });

    // تحديث العداد
    const countEl = document.getElementById('drivers-count');
    if (countEl) {
      countEl.textContent = `${drivers.length} سائق`;
    }
  }

  /* ══════════════════════════════════
     التحقق من البيانات
     ══════════════════════════════════ */

  function _validateDriver(data) {
    const errors = [];

    if (!data.name || !Security.validateInput(data.name, 'arabic_name')) {
      errors.push('الاسم غير صحيح (يجب أن يكون بالعربية، 2-60 حرف)');
    }
    if (!data.phone || !Security.validateInput(data.phone, 'phone')) {
      errors.push('رقم الهاتف غير صحيح (مثال: 01012345678)');
    }
    if (!data.plate || !Security.validateInput(data.plate, 'plate')) {
      errors.push('رقم اللوحة غير صحيح');
    }
    if (data.licenseExpiry && !Security.validateInput(data.licenseExpiry, 'date')) {
      errors.push('تاريخ انتهاء الرخصة غير صحيح');
    }

    return errors;
  }

  /* ── واجهة عامة ── */
  return Object.freeze({
    loadAll,
    add,
    edit,
    remove,
    changeStatus,
    setFilter,
    setSearch,
    getFilteredDrivers,
    renderTable,
  });

})();
