/**
 * ═══════════════════════════════════════════════════════════
 * modal.js - مكونات المودال
 * Driver Modal | User Modal | Confirm Modal
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

/* ══════════════════════════════════
   الأساس - Modal Manager
   ══════════════════════════════════ */

const ModalManager = (() => {
  let _activeModal = null;

  function open(modalEl) {
    if (_activeModal) close(_activeModal);
    document.body.appendChild(modalEl);
    document.body.style.overflow = 'hidden';
    _activeModal = modalEl;

    // إغلاق بالـ Escape
    const onKey = (e) => {
      if (e.key === 'Escape') close(modalEl);
    };
    document.addEventListener('keydown', onKey);
    modalEl._keyHandler = onKey;
  }

  function close(modalEl) {
    if (!modalEl) return;
    if (modalEl._keyHandler) {
      document.removeEventListener('keydown', modalEl._keyHandler);
    }
    modalEl.remove();
    document.body.style.overflow = '';
    if (_activeModal === modalEl) _activeModal = null;
  }

  function closeAll() {
    if (_activeModal) close(_activeModal);
  }

  /**
   * بناء Modal Shell
   */
  function build({ title, size = '', onClose } = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = `modal ${size}`;

    // Header
    const header = document.createElement('div');
    header.className = 'modal-header';

    const titleEl = document.createElement('h2');
    titleEl.className = 'modal-title';
    titleEl.textContent = title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => {
      close(overlay);
      if (onClose) onClose();
    });

    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    // Body & Footer placeholders
    const body   = document.createElement('div');
    body.className = 'modal-body';

    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);

    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        close(overlay);
        if (onClose) onClose();
      }
    });

    return { overlay, modal, body, footer, close: () => close(overlay) };
  }

  return Object.freeze({ open, close, closeAll, build });
})();

/* ══════════════════════════════════
   مودال السائق - إضافة / تعديل
   ══════════════════════════════════ */

const DriverModal = (() => {

  function _buildForm(driver = null) {
    const isEdit = Boolean(driver);

    const fields = [
      {
        id: 'driver-name', label: 'الاسم الكامل *', type: 'text',
        placeholder: 'مثال: أحمد محمد علي',
        value: driver?.name || '', required: true,
      },
      {
        id: 'driver-phone', label: 'رقم الهاتف *', type: 'tel',
        placeholder: '01012345678',
        value: driver?.phone || '', required: true,
      },
      {
        id: 'driver-vehicle', label: 'نوع المركبة', type: 'text',
        placeholder: 'مثال: تويوتا كورولا 2022',
        value: driver?.vehicle || '',
      },
      {
        id: 'driver-plate', label: 'رقم اللوحة *', type: 'text',
        placeholder: 'مثال: أ ب ج 1234',
        value: driver?.plate || '', required: true,
      },
      {
        id: 'driver-license', label: 'رقم الرخصة', type: 'text',
        placeholder: 'رقم الرخصة',
        value: driver?.license || '',
      },
      {
        id: 'driver-license-expiry', label: 'تاريخ انتهاء الرخصة', type: 'date',
        value: driver?.licenseExpiry || '',
      },
    ];

    const form = document.createElement('form');
    form.id = 'driver-form';
    form.noValidate = true;
    // منع الـ submit الافتراضي
    form.addEventListener('submit', (e) => e.preventDefault());

    // حقول في شبكة 2 عمود
    const grid = document.createElement('div');
    grid.className = 'form-row';
    grid.style.gridTemplateColumns = '1fr 1fr';

    fields.forEach((f, i) => {
      const group = document.createElement('div');
      group.className = 'form-group';
      if (i >= 4) group.style.gridColumn = i === 4 ? '1' : '2';

      const label = document.createElement('label');
      label.className = 'form-label';
      label.setAttribute('for', f.id);
      label.textContent = f.label;

      const input = document.createElement('input');
      input.type = f.type;
      input.id = f.id;
      input.name = f.id;
      input.className = 'form-control';
      input.placeholder = f.placeholder || '';
      input.value = f.value;
      if (f.required) input.required = true;

      const errorEl = document.createElement('div');
      errorEl.className = 'form-error';
      errorEl.id = `${f.id}-error`;
      errorEl.style.display = 'none';

      group.appendChild(label);
      group.appendChild(input);
      group.appendChild(errorEl);
      grid.appendChild(group);
    });

    // حقل الحالة (فقط في التعديل)
    if (isEdit) {
      const statusGroup = document.createElement('div');
      statusGroup.className = 'form-group';
      statusGroup.style.gridColumn = '1 / -1';

      const statusLabel = document.createElement('label');
      statusLabel.className = 'form-label';
      statusLabel.setAttribute('for', 'driver-status');
      statusLabel.textContent = 'الحالة';

      const select = document.createElement('select');
      select.id = 'driver-status';
      select.className = 'form-control form-select';

      Object.entries(CONSTANTS.STATUS_LABELS).forEach(([val, text]) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = text;
        opt.selected = driver?.status === val;
        select.appendChild(opt);
      });

      statusGroup.appendChild(statusLabel);
      statusGroup.appendChild(select);
      grid.appendChild(statusGroup);
    }

    // ملاحظات
    const notesGroup = document.createElement('div');
    notesGroup.className = 'form-group';
    notesGroup.style.gridColumn = '1 / -1';
    const notesLabel = document.createElement('label');
    notesLabel.className = 'form-label';
    notesLabel.textContent = 'ملاحظات';
    const textarea = document.createElement('textarea');
    textarea.id = 'driver-notes';
    textarea.className = 'form-control';
    textarea.rows = 2;
    textarea.placeholder = 'ملاحظات إضافية...';
    textarea.textContent = driver?.notes || '';
    textarea.style.resize = 'vertical';
    notesGroup.appendChild(notesLabel);
    notesGroup.appendChild(textarea);
    grid.appendChild(notesGroup);

    form.appendChild(grid);
    return form;
  }

  function _getFormData() {
    return {
      name:          document.getElementById('driver-name')?.value?.trim() || '',
      phone:         document.getElementById('driver-phone')?.value?.trim() || '',
      vehicle:       document.getElementById('driver-vehicle')?.value?.trim() || '',
      plate:         document.getElementById('driver-plate')?.value?.trim() || '',
      license:       document.getElementById('driver-license')?.value?.trim() || '',
      licenseExpiry: document.getElementById('driver-license-expiry')?.value || '',
      status:        document.getElementById('driver-status')?.value || 'offline',
      notes:         document.getElementById('driver-notes')?.value?.trim() || '',
    };
  }

  function showAdd() {
    const { overlay, body, footer, close } = ModalManager.build({
      title: 'إضافة سائق جديد',
    });

    body.appendChild(_buildForm());

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-ghost';
    cancelBtn.textContent = 'إلغاء';
    cancelBtn.addEventListener('click', close);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = 'حفظ السائق';
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'جارٍ الحفظ...';

      const data   = _getFormData();
      const result = await Drivers.add(data);

      if (result.success) {
        close();
      } else {
        // عرض الأخطاء
        if (result.errors) {
          Notifications.show('error', 'بيانات غير صحيحة', result.errors.join('\n'));
        }
        saveBtn.disabled = false;
        saveBtn.textContent = 'حفظ السائق';
      }
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    ModalManager.open(overlay);
  }

  function showEdit(driver) {
    const { overlay, body, footer, close } = ModalManager.build({
      title: `تعديل بيانات: ${Security.escapeHtml(driver.name)}`,
    });

    body.appendChild(_buildForm(driver));

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-ghost';
    cancelBtn.textContent = 'إلغاء';
    cancelBtn.addEventListener('click', close);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = 'حفظ التعديلات';
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      const data   = _getFormData();
      const result = await Drivers.edit(driver.id, data);
      if (result.success) {
        close();
      } else {
        if (result.errors) Notifications.show('error', 'خطأ', result.errors.join('\n'));
        saveBtn.disabled = false;
      }
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    ModalManager.open(overlay);
  }

  function showDelete(driver) {
    const { overlay, body, footer, close } = ModalManager.build({
      title: 'تأكيد الحذف', size: 'modal-sm',
    });

    const msg = document.createElement('p');
    msg.style.cssText = 'font-size:14px;line-height:1.7;';
    const name = document.createElement('strong');
    name.textContent = driver.name;
    msg.textContent = 'هل أنت متأكد من حذف السائق ';
    msg.appendChild(name);
    msg.appendChild(document.createTextNode('؟ لا يمكن التراجع عن هذا الإجراء.'));
    body.appendChild(msg);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-ghost';
    cancelBtn.textContent = 'إلغاء';
    cancelBtn.addEventListener('click', close);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger';
    delBtn.textContent = '🗑️ حذف نهائي';
    delBtn.addEventListener('click', async () => {
      delBtn.disabled = true;
      await Drivers.remove(driver.id);
      close();
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(delBtn);
    ModalManager.open(overlay);
  }

  return Object.freeze({ showAdd, showEdit, showDelete });
})();

/* ══════════════════════════════════
   مودال المستخدم - إضافة
   ══════════════════════════════════ */

const UserModal = (() => {

  function showAdd() {
    const { overlay, body, footer, close } = ModalManager.build({
      title: 'إضافة مستخدم جديد',
    });

    const form = document.createElement('form');
    form.addEventListener('submit', e => e.preventDefault());

    const fields = [
      { id: 'new-username',  label: 'اسم المستخدم *',  type: 'text',     placeholder: 'مثال: ahmed.mohamed' },
      { id: 'new-password',  label: 'كلمة المرور *',   type: 'password', placeholder: '6 أحرف على الأقل' },
      { id: 'new-fullname',  label: 'الاسم الكامل *',  type: 'text',     placeholder: 'أحمد محمد علي' },
      { id: 'new-phone',     label: 'رقم الهاتف',      type: 'tel',      placeholder: '01012345678' },
    ];

    const grid = document.createElement('div');
    grid.className = 'form-row';

    fields.forEach(f => {
      const group = document.createElement('div');
      group.className = 'form-group';
      const label = document.createElement('label');
      label.className = 'form-label';
      label.textContent = f.label;
      const input = document.createElement('input');
      input.type = f.type;
      input.id = f.id;
      input.className = 'form-control';
      input.placeholder = f.placeholder;
      group.appendChild(label);
      group.appendChild(input);
      grid.appendChild(group);
    });

    // الدور
    const roleGroup = document.createElement('div');
    roleGroup.className = 'form-group';
    roleGroup.style.gridColumn = '1 / -1';
    const roleLabel = document.createElement('label');
    roleLabel.className = 'form-label';
    roleLabel.textContent = 'الصلاحية *';
    const select = document.createElement('select');
    select.id = 'new-role';
    select.className = 'form-control form-select';
    Object.entries(CONSTANTS.ROLE_LABELS).forEach(([val, text]) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = text;
      if (val === 'employee') opt.selected = true;
      select.appendChild(opt);
    });
    roleGroup.appendChild(roleLabel);
    roleGroup.appendChild(select);
    grid.appendChild(roleGroup);

    form.appendChild(grid);
    body.appendChild(form);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-ghost';
    cancelBtn.textContent = 'إلغاء';
    cancelBtn.addEventListener('click', close);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = 'إنشاء المستخدم';
    saveBtn.addEventListener('click', async () => {
      const data = {
        username: document.getElementById('new-username')?.value?.trim(),
        password: document.getElementById('new-password')?.value,
        fullName: document.getElementById('new-fullname')?.value?.trim(),
        phone:    document.getElementById('new-phone')?.value?.trim(),
        role:     document.getElementById('new-role')?.value,
      };

      saveBtn.disabled = true;
      saveBtn.textContent = 'جارٍ الإنشاء...';

      const result = await Auth.createUser(data);
      if (result.success) {
        close();
        await Users.loadAll();
        Notifications.show('success', 'تم الإنشاء', 'تم إنشاء المستخدم بنجاح');
      } else {
        Notifications.show('error', 'خطأ', result.error || 'فشل الإنشاء');
        saveBtn.disabled = false;
        saveBtn.textContent = 'إنشاء المستخدم';
      }
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    ModalManager.open(overlay);
  }

  function showDelete(user) {
    const { overlay, body, footer, close } = ModalManager.build({
      title: 'تأكيد حذف المستخدم', size: 'modal-sm',
    });

    const msg = document.createElement('p');
    msg.style.cssText = 'font-size:14px;line-height:1.7;';
    msg.textContent = `هل تريد حذف المستخدم `;
    const strong = document.createElement('strong');
    strong.textContent = user.fullName;
    msg.appendChild(strong);
    msg.appendChild(document.createTextNode('؟'));
    body.appendChild(msg);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-ghost';
    cancelBtn.textContent = 'إلغاء';
    cancelBtn.addEventListener('click', close);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger';
    delBtn.textContent = 'حذف';
    delBtn.addEventListener('click', async () => {
      await Users.deleteUser(user.id);
      close();
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(delBtn);
    ModalManager.open(overlay);
  }

  return Object.freeze({ showAdd, showDelete });
})();
