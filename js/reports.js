/**
 * ═══════════════════════════════════════════════════════════
 * reports.js - التقارير والإحصائيات
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const Reports = (() => {

  async function renderDashboard() {
    const stats   = State.get('stats');
    const drivers = State.get('drivers');

    UI.updateStats(stats);
    _renderStatusChart(stats);
    _renderLicenseAlerts(drivers);
    _renderRecentActivity(drivers);
  }

  /* ── رسم بياني للحالات ── */
  function _renderStatusChart(stats) {
    const container = document.getElementById('status-chart');
    if (!container) return;

    const total = stats.total || 1;
    const data = [
      { label: 'متاح',    value: stats.available, color: 'var(--color-success)' },
      { label: 'مشغول',   value: stats.busy,      color: 'var(--color-warning)' },
      { label: 'استراحة', value: stats.break,      color: 'var(--color-info)'    },
      { label: 'غير متصل',value: stats.offline,    color: 'var(--color-text-muted)' },
    ];

    // SVG Donut chart
    const size   = 120;
    const cx     = size / 2;
    const cy     = size / 2;
    const radius = 45;
    const stroke = 16;
    const circumference = 2 * Math.PI * radius;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('class', 'donut-chart');

    // دائرة الخلفية
    const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bgCircle.setAttribute('cx', cx);
    bgCircle.setAttribute('cy', cy);
    bgCircle.setAttribute('r', radius);
    bgCircle.setAttribute('fill', 'none');
    bgCircle.setAttribute('stroke', 'var(--color-border)');
    bgCircle.setAttribute('stroke-width', stroke);
    svg.appendChild(bgCircle);

    // الأقواس
    let offset = 0;
    data.forEach(item => {
      if (!item.value) return;
      const pct    = item.value / total;
      const dash   = pct * circumference;
      const gap    = circumference - dash;

      const arc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      arc.setAttribute('cx', cx);
      arc.setAttribute('cy', cy);
      arc.setAttribute('r', radius);
      arc.setAttribute('fill', 'none');
      arc.setAttribute('stroke', item.color);
      arc.setAttribute('stroke-width', stroke);
      arc.setAttribute('stroke-dasharray', `${dash} ${gap}`);
      arc.setAttribute('stroke-dashoffset', -offset * circumference);
      arc.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
      arc.style.transition = 'stroke-dasharray 0.6s ease';
      svg.appendChild(arc);
      offset += pct;
    });

    // النص في المنتصف
    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textEl.setAttribute('x', cx);
    textEl.setAttribute('y', cy + 2);
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('dominant-baseline', 'middle');
    textEl.setAttribute('font-size', '20');
    textEl.setAttribute('font-weight', '900');
    textEl.setAttribute('fill', 'var(--color-text-primary)');
    textEl.setAttribute('font-family', 'Cairo, sans-serif');
    textEl.textContent = stats.total;
    svg.appendChild(textEl);

    const subText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    subText.setAttribute('x', cx);
    subText.setAttribute('y', cy + 18);
    subText.setAttribute('text-anchor', 'middle');
    subText.setAttribute('font-size', '8');
    subText.setAttribute('fill', 'var(--color-text-muted)');
    subText.setAttribute('font-family', 'Cairo, sans-serif');
    subText.textContent = 'إجمالي';
    svg.appendChild(subText);

    // Legend
    const legendDiv = document.getElementById('status-legend');
    if (legendDiv) {
      UI.clearAndRender(legendDiv, el => {
        data.forEach(item => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:13px;';

          const dot = document.createElement('span');
          dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${item.color};flex-shrink:0;`;

          const label = document.createElement('span');
          label.style.color = 'var(--color-text-secondary)';
          label.textContent = item.label;

          const val = document.createElement('span');
          val.style.cssText = 'margin-right:auto;font-weight:700;';
          val.textContent = item.value || 0;

          row.appendChild(dot);
          row.appendChild(label);
          row.appendChild(val);
          el.appendChild(row);
        });
      });
    }

    UI.clearAndRender(container, el => el.appendChild(svg));
  }

  /* ── تحذيرات الرخص ── */
  function _renderLicenseAlerts(drivers) {
    const container = document.getElementById('license-alerts-list');
    if (!container) return;

    const today    = new Date();
    const warnDate = new Date(today);
    warnDate.setDate(warnDate.getDate() + CONSTANTS.LICENSE.WARNING_DAYS);

    const alerts = drivers.filter(d => {
      if (!d.licenseExpiry) return false;
      return new Date(d.licenseExpiry) <= warnDate;
    }).sort((a, b) => new Date(a.licenseExpiry) - new Date(b.licenseExpiry));

    UI.clearAndRender(container, el => {
      if (alerts.length === 0) {
        const empty = document.createElement('p');
        empty.style.cssText = 'text-align:center;color:var(--color-text-muted);padding:20px;font-size:13px;';
        empty.textContent = '✅ جميع الرخص سارية المفعول';
        el.appendChild(empty);
        return;
      }

      alerts.forEach(driver => {
        const isExpired = new Date(driver.licenseExpiry) < today;
        const div = document.createElement('div');
        div.className = `license-alert ${isExpired ? 'license-expired' : 'license-warning'}`;

        const icon = document.createTextNode(isExpired ? '🔴 ' : '🟡 ');
        const nameSpan = document.createElement('strong');
        nameSpan.textContent = driver.name;
        const dash = document.createTextNode(' — ');
        const dateSpan = document.createElement('span');
        dateSpan.textContent = isExpired
          ? `انتهت في ${UI.formatDate(driver.licenseExpiry)}`
          : `تنتهي في ${UI.formatDate(driver.licenseExpiry)}`;

        div.appendChild(icon);
        div.appendChild(nameSpan);
        div.appendChild(dash);
        div.appendChild(dateSpan);
        el.appendChild(div);
      });
    });
  }

  /* ── آخر نشاط ── */
  function _renderRecentActivity(drivers) {
    const container = document.getElementById('recent-activity');
    if (!container) return;

    // السائقون المتاحون والمشغولون
    const active = drivers
      .filter(d => d.status !== 'offline')
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 6);

    UI.clearAndRender(container, el => {
      if (active.length === 0) {
        const p = document.createElement('p');
        p.style.cssText = 'color:var(--color-text-muted);text-align:center;padding:20px;font-size:13px;';
        p.textContent = 'لا يوجد سائقون نشطون حالياً';
        el.appendChild(p);
        return;
      }

      active.forEach(driver => {
        const row = document.createElement('div');
        row.style.cssText = `
          display:flex;align-items:center;gap:12px;padding:10px 0;
          border-bottom:1px solid var(--color-border);
        `;

        const avatar = document.createElement('div');
        avatar.style.cssText = `
          width:36px;height:36px;border-radius:50%;
          background:var(--color-primary);display:flex;align-items:center;
          justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;
        `;
        avatar.textContent = (driver.name || '?').slice(0, 2);

        const info = document.createElement('div');
        info.style.flex = '1';
        const nameEl = document.createElement('div');
        nameEl.style.cssText = 'font-size:13px;font-weight:600;';
        nameEl.textContent = driver.name;
        const plateEl = document.createElement('div');
        plateEl.style.cssText = 'font-size:11px;color:var(--color-text-muted);font-family:var(--font-mono);';
        plateEl.textContent = driver.plate || '-';
        info.appendChild(nameEl);
        info.appendChild(plateEl);

        const badge = UI.createStatusBadge(driver.status);

        row.appendChild(avatar);
        row.appendChild(info);
        row.appendChild(badge);
        el.appendChild(row);
      });
    });
  }

  // لا نستخدم Object.freeze هنا عشان reports-section.js محتاج يضيف setFilter
  return { renderDashboard };
})();
