// public/js/state.js
// Tiny global store. No framework needed for an app this size — each view
// module renders into #app or a sub-container and wires its own listeners.

const Store = {
  user: null,
  pathways: [],
  excoRoles: [],
  itemTypes: [],
  members: [],
  meetingDayRoles: [],

  async loadReferenceData() {
    const [pathways, excoRoles, itemTypes, members, meetingDayRoles] = await Promise.all([
      API.get('/pathways'),
      API.get('/exco/roles'),
      API.get('/meetings/meta/item-types'),
      API.get('/members'),
      API.get('/masters/meeting-roles'),
    ]);
    this.pathways = pathways;
    this.excoRoles = excoRoles;
    this.itemTypes = itemTypes;
    this.members = members;
    this.meetingDayRoles = meetingDayRoles.filter(function (r) { return r.is_active; });
  },
};

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initials(name) {
  if (!name) return '?';
  const trimmed = name.trim();
  if (/[\u4e00-\u9fa5]/.test(trimmed)) return trimmed.slice(-2);
  const parts = trimmed.split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d)) return iso;
  const locale = (typeof I18N !== 'undefined' && I18N.lang === 'en') ? 'en-US' : 'zh-CN';
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
}

function progressRing(level, max, size, labelOverride) {
  max = max || 5;
  size = size || 40;
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, (level || 0) / max));
  const dash = circumference * pct;
  return '<div class="prog-ring" style="width:' + size + 'px;height:' + size + 'px;">' +
    '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
    '<circle class="ring-bg" cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + radius + '"></circle>' +
    '<circle class="ring-fill" cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + radius + '" stroke-dasharray="' + dash + ' ' + circumference + '"></circle>' +
    '</svg><div class="ring-label">' + (labelOverride !== undefined ? labelOverride : (level || 0)) + '</div></div>';
}

function toast(msg, kind) {
  kind = kind || 'info';
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  const bg = kind === 'error' ? '#9A2B2B' : kind === 'success' ? '#1F5E47' : '#0B2545';
  el.style.cssText = 'background:' + bg + ';color:#FBFAF7;padding:10px 16px;border-radius:8px;font-size:13.5px;box-shadow:0 8px 24px rgba(0,0,0,0.2);max-width:320px;';
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(function () {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(function () { el.remove(); }, 300);
  }, 3200);
}
