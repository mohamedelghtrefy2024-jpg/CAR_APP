/**
 * ═══════════════════════════════════════════════════════════
 * users.js - إدارة المستخدمين والصلاحيات
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const Users = (() => {

  let _allUsers = [];

  async function loadAll() {
    try {
      const users = await Storage.getAll(CONSTANTS.DB.STORES.USERS);
      _allUsers = users;
      State.set('users', users);
      renderTable(users);
      return users;
    } catch (err) {
      console.error('[Users] Load error:', err);
      Notifications.show('error', 'خطأ', 'تعذر تحميل المستخدمين');
      return [];
    }
  }

  async function toggleActive(userId) {
    if (!State.hasPermission('manage_users')) {
      Notifications.show('error', 'رفض', 'لا تملك هذه الصلاحية');
      return;
    }
    try {
      const user = await Storage.getById(CONSTANTS.DB.STORES.USERS, userId);
      if (!user) return;

      // لا يمكن تعطيل المستخدم الحالي
      if (userId === State.get('currentUser').id) {
        Notifications.show('warning', 'تحذير', 'لا يمكنك تعطيل حسابك الخاص');
        return;
      }

      const updated = { ...user, active: !user.active };
      await Storage.update(CONSTANTS.DB.STORES.USERS, updated);
      _allUsers = _allUsers.map(u => u.id === userId ? updated : u);
      renderTable(_allUsers);

      Notifications.show(
        'success', 'تم',
        `تم ${updated.active ? 'تفعيل' : 'تعطيل'} المستخدم ${user.fullName}`
      );
    } catch {
      Notifications.show('error', 'خطأ', 'تعذر تحديث حالة المستخدم');
    }
  }

  async function deleteUser(userId) {
    if (!State.hasPermission('manage_users')) return;
    if (userId === State.get('currentUser').id) {
      Notifications.show('warning', 'تحذير', 'لا يمكنك حذف حسابك الخاص');
      return;
    }
    try {
      await Storage.remove(CONSTANTS.DB.STORES.USERS, userId);
      _allUsers = _allUsers.filter(u => u.id !== userId);
      renderTable(_allUsers);
      Notifications.show('success', 'تم الحذف', 'تم حذف المستخدم');
    } catch {
      Notifications.show('error', 'خطأ', 'تعذر حذف المستخدم');
    }
  }

  function renderTable(users) {
    const container = document.getElementById('users-table-body');
    if (!container) return;

    UI.clearAndRender(container, tbody => {
      if (users.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 6;
        td.style.cssText = 'padding:40px;text-align:center;color:var(--color-text-muted)';
        td.textContent = 'لا يوجد مستخدمون';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }

      const canManage = State.hasPermission('manage_users');

      users.forEach(user => {
        const tr = document.createElement('tr');

        // الاسم
        const tdName = document.createElement('td');
        const nameDiv = document.createElement('div');
        nameDiv.style.fontWeight = '600';
        nameDiv.textContent = user.fullName;
        const usernameDiv = document.createElement('div');
        usernameDiv.className = 'td-muted';
        usernameDiv.style.fontFamily = 'var(--font-mono)';
        usernameDiv.textContent = '@' + user.username;
        tdName.appendChild(nameDiv);
        tdName.appendChild(usernameDiv);

        // الدور
        const tdRole = document.createElement('td');
        const roleBadge = document.createElement('span');
        roleBadge.style.cssText = `
          display:inline-block; padding:3px 10px; border-radius:20px;
          font-size:12px; font-weight:700;
          background:var(--color-primary-glow); color:var(--color-primary);
        `;
        roleBadge.textContent = CONSTANTS.ROLE_LABELS[user.role] || user.role;
        tdRole.appendChild(roleBadge);

        // الهاتف
        const tdPhone = document.createElement('td');
        tdPhone.className = 'td-muted';
        tdPhone.textContent = user.phone || '-';

        // الحالة
        const tdStatus = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.className = user.active
          ? 'status-badge status-available'
          : 'status-badge status-offline';
        statusBadge.textContent = user.active ? 'نشط' : 'معطل';
        tdStatus.appendChild(statusBadge);

        // تاريخ الإنشاء
        const tdDate = document.createElement('td');
        tdDate.className = 'td-muted';
        tdDate.textContent = UI.formatDate(user.createdAt);

        // الإجراءات
        const tdActions = document.createElement('td');
        tdActions.className = 'actions-cell';

        if (canManage && user.id !== State.get('currentUser').id) {
          const toggleBtn = document.createElement('button');
          toggleBtn.className = `btn btn-sm ${user.active ? 'btn-ghost' : 'btn-success'}`;
          toggleBtn.textContent = user.active ? 'تعطيل' : 'تفعيل';
          toggleBtn.addEventListener('click', () => toggleActive(user.id));
          tdActions.appendChild(toggleBtn);

          const delBtn = document.createElement('button');
          delBtn.className = 'btn btn-sm btn-icon btn-danger';
          delBtn.textContent = '🗑️';
          delBtn.title = 'حذف';
          delBtn.addEventListener('click', () => UserModal.showDelete(user));
          tdActions.appendChild(delBtn);
        } else {
          const selfLabel = document.createElement('span');
          selfLabel.className = 'td-muted';
          selfLabel.style.fontSize = '12px';
          selfLabel.textContent = user.id === State.get('currentUser').id ? '(أنت)' : '-';
          tdActions.appendChild(selfLabel);
        }

        tr.append(tdName, tdRole, tdPhone, tdStatus, tdDate, tdActions);
        tbody.appendChild(tr);
      });
    });

    const countEl = document.getElementById('users-count');
    if (countEl) countEl.textContent = `${users.length} مستخدم`;
  }

  return Object.freeze({ loadAll, toggleActive, deleteUser, renderTable });
})();
