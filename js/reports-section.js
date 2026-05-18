/**
 * reports-section.js - صفحة التقارير الكاملة مع الفلتر
 */
'use strict';

(function () {
  let _currentFilter = 'all';

  function renderReportsSection(filter) {
    if (filter !== undefined) _currentFilter = filter;
    const drivers = State.get('drivers');
    const stats   = State.get('stats');
    _renderFilterTabs();
    _renderMainReport(drivers, stats, _currentFilter);
  }

  function _renderFilterTabs() {
    const container = document.getElementById('reports-filter-tabs');
    if (!container) return;
    const drivers = State.get('drivers');
    const stats   = State.get('stats');

    const tabs = [
      { key: 'all',       label: 'الكل',             icon: '📋', color: '#3b7ff5'  },
      { key: 'available', label: 'متاح',              icon: '🟢', color: '#22c55e'  },
      { key: 'busy',      label: 'مشغول',             icon: '🟡', color: '#f59e0b'  },
      { key: 'break',     label: 'استراحة',           icon: '🔵', color: '#06b6d4'  },
      { key: 'offline',   label: 'غير متصل',          icon: '⚫', color: '#64748b'  },
      { key: 'expired',   label: 'رخص منتهية',        icon: '🔴', color: '#ef4444'  },
      { key: 'expiring',  label: 'رخص قاربت الانتهاء',icon: '🟠', color: '#f59e0b'  },
    ];

    while (container.firstChild) container.removeChild(container.firstChild);

    tabs.forEach(tab => {
      const count = _getCount(tab.key, drivers, stats);
      const isActive = tab.key === _currentFilter;

      const btn = document.createElement('button');
      btn.style.cssText = `
        display:inline-flex;align-items:center;gap:6px;
        padding:8px 16px;border-radius:20px;font-size:13px;font-weight:600;
        cursor:pointer;border:1.5px solid;font-family:var(--font-main);
        transition:all 0.15s;white-space:nowrap;
        background:${isActive ? tab.color : 'transparent'};
        color:${isActive ? '#fff' : 'var(--color-text-secondary)'};
        border-color:${isActive ? tab.color : 'var(--color-border)'};
      `;

      const iconSpan = document.createElement('span');
      iconSpan.textContent = tab.icon + ' ' + tab.label;

      const countBadge = document.createElement('span');
      countBadge.style.cssText = `
        background:${isActive ? 'rgba(255,255,255,0.25)' : 'var(--color-surface-2)'};
        padding:1px 7px;border-radius:10px;font-size:11px;font-weight:700;
        color:${isActive ? '#fff' : 'var(--color-text-muted)'};
      `;
      countBadge.textContent = count;

      btn.appendChild(iconSpan);
      btn.appendChild(countBadge);
      btn.addEventListener('click', () => renderReportsSection(tab.key));
      container.appendChild(btn);
    });
  }

  function _getCount(key, drivers, stats) {
    switch (key) {
      case 'all':       return stats.total     || 0;
      case 'available': return stats.available  || 0;
      case 'busy':      return stats.busy       || 0;
      case 'break':     return stats.break      || 0;
      case 'offline':   return stats.offline    || 0;
      case 'expired':   return stats.expired    || 0;
      case 'expiring':  return stats.expiring   || 0;
      default:          return 0;
    }
  }

  /* ══════════════════════════════════
     التقرير الرئيسي
     ══════════════════════════════════ */

  function _renderMainReport(drivers, stats, filter) {
    const container = document.getElementById('reports-main-content');
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);

    switch (filter) {
      case 'all':
        _buildAllReport(container, drivers, stats);
        break;
      case 'available':
      case 'busy':
      case 'break':
      case 'offline':
        _buildStatusReport(container, drivers, filter);
        break;
      case 'expired':
        _buildLicenseReport(container, drivers, true);
        break;
      case 'expiring':
        _buildLicenseReport(container, drivers, false);
        break;
      default:
        _buildAllReport(container, drivers, stats);
    }
  }

  /* ══════════════════════════════════
     تقرير الكل
     ══════════════════════════════════ */

  function _buildAllReport(el, drivers, stats) {
    // بطاقات الملخص
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:12px;margin-bottom:24px;';

    const cards = [
      { label:'إجمالي السائقين', value:stats.total,     color:'#3b7ff5', icon:'🚗' },
      { label:'متاح',            value:stats.available,  color:'#22c55e', icon:'🟢' },
      { label:'مشغول',           value:stats.busy,       color:'#f59e0b', icon:'🟡' },
      { label:'استراحة',         value:stats.break,      color:'#06b6d4', icon:'🔵' },
      { label:'غير متصل',        value:stats.offline,    color:'#64748b', icon:'⚫' },
      { label:'رخص منتهية',      value:stats.expired,    color:'#ef4444', icon:'🔴' },
      { label:'رخص قاربت',       value:stats.expiring,   color:'#f59e0b', icon:'🟠' },
    ];

    cards.forEach(c => {
      const card = document.createElement('div');
      card.style.cssText = `
        background:var(--color-surface);border:1px solid var(--color-border);
        border-radius:12px;padding:16px;border-right:3px solid ${c.color};
      `;
      const ico = document.createElement('div');
      ico.style.cssText = 'font-size:22px;margin-bottom:8px;';
      ico.textContent = c.icon;
      const val = document.createElement('div');
      val.style.cssText = `font-size:28px;font-weight:900;color:${c.color};line-height:1;margin-bottom:4px;`;
      val.textContent = c.value || 0;
      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:12px;color:var(--color-text-secondary);font-weight:500;';
      lbl.textContent = c.label;
      card.append(ico, val, lbl);
      grid.appendChild(card);
    });
    el.appendChild(grid);

    // نسب التشغيل
    _buildProgressBars(el, stats);

    // الجدول الكامل
    _buildDriversTable(el, drivers, 'all', `📋 جميع السائقين (${drivers.length})`);
  }

  /* ══════════════════════════════════
     تقرير حالة محددة
     ══════════════════════════════════ */

  function _buildStatusReport(el, drivers, status) {
    const filtered = drivers.filter(d => d.status === status);
    const colors = { available:'#22c55e', busy:'#f59e0b', break:'#06b6d4', offline:'#64748b' };
    const color  = colors[status] || '#64748b';
    const label  = CONSTANTS.STATUS_LABELS[status] || status;
    const total  = drivers.length || 1;
    const pct    = Math.round((filtered.length / total) * 100);

    // بطاقة ملخص الحالة
    const summary = document.createElement('div');
    summary.style.cssText = `
      background:var(--color-surface);border:1px solid var(--color-border);
      border-radius:12px;padding:24px;margin-bottom:20px;
      border-right:4px solid ${color};
      display:flex;align-items:center;gap:20px;
    `;
    const bigNum = document.createElement('div');
    bigNum.style.cssText = `font-size:56px;font-weight:900;color:${color};line-height:1;flex-shrink:0;`;
    bigNum.textContent = filtered.length;

    const info = document.createElement('div');
    const t1 = document.createElement('div');
    t1.style.cssText = 'font-size:20px;font-weight:800;margin-bottom:6px;';
    t1.textContent = `سائقون ${label}`;
    const t2 = document.createElement('div');
    t2.style.cssText = 'font-size:13px;color:var(--color-text-secondary);margin-bottom:12px;';
    t2.textContent = `${pct}% من إجمالي الأسطول (${total} سائق)`;

    // شريط النسبة
    const barBg = document.createElement('div');
    barBg.style.cssText = 'height:6px;background:var(--color-border);border-radius:3px;overflow:hidden;width:200px;max-width:100%;';
    const barFill = document.createElement('div');
    barFill.style.cssText = `height:100%;width:0;background:${color};border-radius:3px;transition:width 0.8s cubic-bezier(0.34,1.56,0.64,1);`;
    barBg.appendChild(barFill);
    info.append(t1, t2, barBg);
    summary.append(bigNum, info);
    el.appendChild(summary);

    // تأخير الأنيميشن
    setTimeout(() => { barFill.style.width = pct + '%'; }, 100);

    if (filtered.length === 0) {
      const empty = _makeEmpty('🔍', 'لا يوجد سائقون بهذه الحالة حالياً');
      el.appendChild(empty);
      return;
    }

    _buildDriversTable(el, filtered, status, `📋 السائقون ${label} (${filtered.length})`);
  }

  /* ══════════════════════════════════
     تقرير الرخص
     ══════════════════════════════════ */

  function _buildLicenseReport(el, drivers, showExpired) {
    const today    = new Date();
    const warnDate = new Date(today);
    warnDate.setDate(warnDate.getDate() + CONSTANTS.LICENSE.WARNING_DAYS);

    const filtered = showExpired
      ? drivers.filter(d => d.licenseExpiry && new Date(d.licenseExpiry) < today)
      : drivers.filter(d => {
          if (!d.licenseExpiry) return false;
          const exp = new Date(d.licenseExpiry);
          return exp >= today && exp <= warnDate;
        });

    const color   = showExpired ? '#ef4444' : '#f59e0b';
    const title   = showExpired ? 'رخصة منتهية الصلاحية' : `رخصة تنتهي خلال ${CONSTANTS.LICENSE.WARNING_DAYS} يوم`;
    const subtext = showExpired
      ? 'يجب تجديد هذه الرخص فوراً لضمان سلامة التشغيل'
      : 'يُنصح بمتابعة تجديد هذه الرخص قبل انتهاء المهلة';

    // بطاقة ملخص
    const summary = document.createElement('div');
    summary.style.cssText = `
      background:var(--color-surface);border:1px solid var(--color-border);
      border-radius:12px;padding:24px;margin-bottom:20px;
      border-right:4px solid ${color};
      display:flex;align-items:center;gap:20px;
    `;
    const bigNum = document.createElement('div');
    bigNum.style.cssText = `font-size:56px;font-weight:900;color:${color};line-height:1;flex-shrink:0;`;
    bigNum.textContent = filtered.length;

    const info = document.createElement('div');
    const t1 = document.createElement('div');
    t1.style.cssText = 'font-size:20px;font-weight:800;margin-bottom:6px;';
    t1.textContent = title;
    const t2 = document.createElement('div');
    t2.style.cssText = 'font-size:13px;color:var(--color-text-secondary);';
    t2.textContent = subtext;
    info.append(t1, t2);
    summary.append(bigNum, info);
    el.appendChild(summary);

    if (filtered.length === 0) {
      el.appendChild(_makeEmpty('✅', showExpired ? 'لا توجد رخص منتهية ✓' : 'لا توجد رخص قريبة من الانتهاء ✓'));
      return;
    }

    _buildLicenseTable(el, filtered);
  }

  /* ══════════════════════════════════
     شرائط نسب التشغيل
     ══════════════════════════════════ */

  function _buildProgressBars(el, stats) {
    const total = stats.total || 1;
    const bars  = document.createElement('div');
    bars.style.cssText = 'background:var(--color-surface);border:1px solid var(--color-border);border-radius:12px;padding:20px;margin-bottom:20px;';

    const heading = document.createElement('div');
    heading.style.cssText = 'font-size:14px;font-weight:700;margin-bottom:16px;';
    heading.textContent = '📊 توزيع الحالات';
    bars.appendChild(heading);

    const items = [
      { label:'متاح',      value:stats.available, color:'#22c55e' },
      { label:'مشغول',     value:stats.busy,      color:'#f59e0b' },
      { label:'استراحة',   value:stats.break,      color:'#06b6d4' },
      { label:'غير متصل',  value:stats.offline,    color:'#64748b' },
    ];

    items.forEach(item => {
      const pct = Math.round(((item.value || 0) / total) * 100);

      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom:12px;';

      const labelRow = document.createElement('div');
      labelRow.style.cssText = 'display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px;';
      const lbl = document.createElement('span');
      lbl.style.color = 'var(--color-text-secondary)';
      lbl.textContent = item.label;
      const cnt = document.createElement('span');
      cnt.style.cssText = `font-weight:700;color:${item.color};`;
      cnt.textContent = `${item.value || 0}  (${pct}%)`;
      labelRow.append(lbl, cnt);

      const barBg = document.createElement('div');
      barBg.style.cssText = 'height:7px;background:var(--color-border);border-radius:4px;overflow:hidden;';
      const barFill = document.createElement('div');
      barFill.style.cssText = `height:100%;width:0;background:${item.color};border-radius:4px;transition:width 0.7s ease;`;
      barBg.appendChild(barFill);
      row.append(labelRow, barBg);
      bars.appendChild(row);

      setTimeout(() => { barFill.style.width = pct + '%'; }, 100);
    });

    el.appendChild(bars);
  }

  /* ══════════════════════════════════
     جدول السائقين العام
     ══════════════════════════════════ */

  function _buildDriversTable(el, drivers, filter, heading) {
    const title = document.createElement('div');
    title.style.cssText = 'font-size:14px;font-weight:700;margin-bottom:12px;color:var(--color-text-secondary);';
    title.textContent = heading;
    el.appendChild(title);

    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    const table = document.createElement('table');
    table.className = 'data-table';

    // thead
    const thead = document.createElement('thead');
    const htr = document.createElement('tr');
    ['#', 'الاسم', 'الهاتف', 'المركبة', 'اللوحة', 'الحالة', 'الرخصة', 'آخر ظهور'].forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    table.appendChild(thead);

    // tbody
    const tbody = document.createElement('tbody');
    const locations = State.get('driverLocations');

    drivers.forEach((d, idx) => {
      const tr = document.createElement('tr');
      const loc = locations[d.id];

      const cells = [];

      const c0 = document.createElement('td');
      c0.style.cssText = 'font-family:var(--font-mono);color:var(--color-text-muted);font-size:12px;';
      c0.textContent = idx + 1;
      cells.push(c0);

      const c1 = document.createElement('td');
      const nd = document.createElement('div');
      nd.style.fontWeight = '600';
      nd.textContent = d.name;
      c1.appendChild(nd);
      cells.push(c1);

      const c2 = document.createElement('td');
      c2.className = 'td-muted';
      c2.textContent = d.phone || '-';
      cells.push(c2);

      const c3 = document.createElement('td');
      c3.textContent = d.vehicle || '-';
      cells.push(c3);

      const c4 = document.createElement('td');
      c4.style.fontFamily = 'var(--font-mono)';
      c4.textContent = d.plate || '-';
      cells.push(c4);

      const c5 = document.createElement('td');
      c5.appendChild(UI.createStatusBadge(d.status));
      cells.push(c5);

      const c6 = document.createElement('td');
      const ls = UI.licenseStatus(d.licenseExpiry);
      const lspan = document.createElement('span');
      if (ls.class) lspan.className = ls.class;
      lspan.style.cssText = 'font-size:12px;font-weight:600;';
      lspan.textContent = ls.text;
      c6.appendChild(lspan);
      cells.push(c6);

      const c7 = document.createElement('td');
      const ts = loc?.timestamp || d.lastSeen;
      const sspan = document.createElement('span');
      sspan.className = `last-seen ${UI.lastSeenClass(ts)}`;
      sspan.textContent = UI.formatLastSeen(ts);
      c7.appendChild(sspan);
      cells.push(c7);

      cells.forEach(c => tr.appendChild(c));
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrapper.appendChild(table);
    el.appendChild(wrapper);
  }

  /* ══════════════════════════════════
     جدول الرخص المفصل
     ══════════════════════════════════ */

  function _buildLicenseTable(el, drivers) {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    const table = document.createElement('table');
    table.className = 'data-table';

    const thead = document.createElement('thead');
    const htr = document.createElement('tr');
    ['#', 'الاسم', 'الهاتف', 'المركبة', 'رقم الرخصة', 'تاريخ الانتهاء', 'الحالة', 'أيام متبقية'].forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const today = new Date();

    const sorted = [...drivers].sort((a, b) => new Date(a.licenseExpiry) - new Date(b.licenseExpiry));

    sorted.forEach((d, idx) => {
      const tr = document.createElement('tr');
      const exp      = new Date(d.licenseExpiry);
      const diffDays = Math.ceil((exp - today) / 86400000);

      const c0 = document.createElement('td');
      c0.style.cssText = 'font-family:var(--font-mono);color:var(--color-text-muted);font-size:12px;';
      c0.textContent = idx + 1;

      const c1 = document.createElement('td');
      const nd = document.createElement('div');
      nd.style.fontWeight = '600';
      nd.textContent = d.name;
      c1.appendChild(nd);

      const c2 = document.createElement('td');
      c2.className = 'td-muted';
      c2.textContent = d.phone || '-';

      const c3 = document.createElement('td');
      c3.textContent = d.vehicle || '-';

      const c4 = document.createElement('td');
      c4.style.fontFamily = 'var(--font-mono)';
      c4.textContent = d.license || '-';

      const c5 = document.createElement('td');
      const espan = document.createElement('span');
      espan.style.cssText = `font-weight:700;color:${diffDays < 0 ? '#ef4444' : '#f59e0b'};`;
      espan.textContent = UI.formatDate(d.licenseExpiry);
      c5.appendChild(espan);

      const c6 = document.createElement('td');
      c6.appendChild(UI.createStatusBadge(d.status));

      const c7 = document.createElement('td');
      const dspan = document.createElement('span');
      dspan.style.cssText = `
        font-weight:700;font-family:var(--font-mono);
        color:${diffDays < 0 ? '#ef4444' : diffDays < 15 ? '#f59e0b' : 'var(--color-text-primary)'};
      `;
      dspan.textContent = diffDays < 0 ? `منذ ${Math.abs(diffDays)} يوم` : `${diffDays} يوم`;
      c7.appendChild(dspan);

      [c0,c1,c2,c3,c4,c5,c6,c7].forEach(c => tr.appendChild(c));
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrapper.appendChild(table);
    el.appendChild(wrapper);
  }

  /* ══════════════════════════════════
     مساعد: حالة فارغة
     ══════════════════════════════════ */

  function _makeEmpty(icon, text) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    const ico = document.createElement('div');
    ico.className = 'empty-state-icon';
    ico.textContent = icon;
    const t = document.createElement('div');
    t.className = 'empty-state-title';
    t.textContent = text;
    div.append(ico, t);
    return div;
  }

  /* ══════════════════════════════════
     API للـ app.js
     ══════════════════════════════════ */

  Reports.setFilter = function (filter) {
    _currentFilter = filter || 'all';
    // لو مش في صفحة التقارير، بس خزّن الفلتر
    if (State.get('activeSection') === 'reports') {
      renderReportsSection(_currentFilter);
    }
  };

  // عند الانتقال للتقارير
  State.subscribe('activeSection', (section) => {
    if (section === 'reports') renderReportsSection(_currentFilter);
  });

  // إعادة رسم لو تغيرت البيانات ونحن في التقارير
  State.subscribe('stats', () => {
    if (State.get('activeSection') === 'reports') renderReportsSection(_currentFilter);
  });

})();
