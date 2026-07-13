// public/js/views/printAgenda.js

// Fixed reference list for the print footer legend. Intentionally not
// pulled from the admin-editable pathways table — this always shows the
// full canonical 11 Toastmasters paths regardless of which ones the club
// has active/inactive, so it stays constant and isn't something admins
// need to (or can) edit.
const PATHWAY_LEGEND = [
  '精通演说 - PM', '运用幽默 - EH', '劝说影响 - PI',
  '动态领导 - DL', '愿景沟通 - VC', '激励策略 - MS',
  '创新规划 - IP', '策略关系 - SR', '有效教练 - EC',
  '发展领导 - LD', '团队协作 - TC',
];

// Builds the .print-page card HTML shared by the authenticated print view
// (renderPrintAgenda) and the public, unauthenticated view reached via the
// QR code (renderPublicAgenda). Keeping this in one place means the two
// can never visually drift apart. includeQr is only meaningful for
// published meetings — a QR code pointing at a draft would just 404.
function buildPrintPageHtml(m, includeQr, includeSocial) {
  let sectionLastSeen = null;
  const agendaTableRows = (m.agenda || []).map(function (row) {
    let rows = '';
    if (row.section_label && row.section_label !== sectionLastSeen) {
      rows += '<tr class="section-row"><td colspan="5">' + escapeHtml(row.section_label) + '</td></tr>';
      sectionLastSeen = row.section_label;
    } else if (!row.section_label) {
      sectionLastSeen = null;
    }

    const speakerSplit = row.speaker_is_guest
      ? splitNameDesignation(row.speaker_guest_name)
      : {
          name: row.speaker_name || '',
          designation: '',
          pathwayBadge: row.speaker_member_id && row.speaker_primary_pathway_code
            ? row.speaker_primary_pathway_code + (row.speaker_primary_level ? ' L' + row.speaker_primary_level : '')
            : '',
        };
    const responsibleSplit = row.responsible_is_guest
      ? splitNameDesignation(row.responsible_label)
      : {
          name: row.responsible_name || row.responsible_label || '',
          designation: '',
          pathwayBadge: row.responsible_member_id && row.responsible_primary_pathway_code
            ? row.responsible_primary_pathway_code + (row.responsible_primary_level ? ' L' + row.responsible_primary_level : '')
            : '',
        };

    const summarySub = [
      row.summary_zh || '',
      row.speech_title ? '题目：' + row.speech_title : '',
      row.pathway_name ? '路线：' + row.pathway_name + (row.level_no ? '　' + (row.level_label || ('级别：' + row.level_no)) : '') : '',
      row.project_name_zh ? '单元：' + row.project_name_zh : '',
      row.evaluates_speaker_name || row.evaluates_guest_name ? '评论：' + (row.evaluates_speaker_name || row.evaluates_guest_name) : '',
    ].filter(Boolean).join('　');

    const personEntries = [speakerSplit, responsibleSplit].filter(function (p, i, arr) {
      return p.name && arr.findIndex(function (x) { return x.name === p.name; }) === i;
    });
    const personCellHtml = personEntries.length
      ? personEntries.map(function (p) {
          return '<div class="person-entry"><div class="person-name">' + escapeHtml(p.name) +
            (p.pathwayBadge ? ' <span class="person-pathway">' + escapeHtml(p.pathwayBadge) + '</span>' : '') +
          '</div>' +
            (p.designation ? '<div class="person-designation">' + escapeHtml(p.designation) + '</div>' : '') +
          '</div>';
        }).join('')
      : '—';

    rows += '<tr>' +
      '<td class="time-col">' + (row.scheduled_time || '') + '</td>' +
      '<td><div class="summary-main">' + escapeHtml(row.type_label || row.summary_zh || '') + '</div>' +
        (summarySub ? '<div class="summary-sub">' + escapeHtml(summarySub) + '</div>' : '') +
        (row.resource_url ? '<div class="summary-sub resource-link"><i class="ti ti-link" style="font-size:10px;"></i> <a href="' + escapeHtml(row.resource_url) + '" download target="_blank">' + escapeHtml(row.resource_label || '相关资源') + '</a></div>' : '') +
      '</td>' +
      '<td class="limit-col">' + (row.time_limit_min ? row.time_limit_min + (row.time_limit_max ? '-' + row.time_limit_max : '') : '') + '</td>' +
      '<td class="role-col">' + personCellHtml + '</td>' +
    '</tr>';
    return rows;
  }).join('');

  const excoByRole = [];
  const excoRoleIndex = {};
  (m.exco || []).forEach(function (e) {
    if (excoRoleIndex[e.role_id] === undefined) {
      excoRoleIndex[e.role_id] = excoByRole.length;
      excoByRole.push({ role_name_zh: e.role_name_zh, holders: [] });
    }
    excoByRole[excoRoleIndex[e.role_id]].holders.push(e);
  });
  const excoRows = excoByRole.map(function (group) {
    return '<div class="exco-entry">' +
      '<div class="role">' + escapeHtml(group.role_name_zh) + '</div>' +
      group.holders.map(function (e) {
        return '<div class="name">' + escapeHtml(e.full_name) + (e.designation ? ' <span class="designation">' + escapeHtml(e.designation) + '</span>' : '') +
          (e.member_no ? ' <span class="memberno">' + escapeHtml(e.member_no) + '</span>' : '') +
        '</div>';
      }).join('') +
    '</div>';
  }).join('');

  // Meeting-day duty roles (礼宾司/司仪/计时员 etc) for this specific meeting
  const dutyRoleRows = (m.roleAssignments || []).map(function (a) {
    const heldBy = a.is_guest ? a.guest_name : a.member_name;
    return '<div class="exco-entry">' +
      '<div class="role">' + escapeHtml(a.role_name_zh) + '</div>' +
      '<div class="name">' + escapeHtml(heldBy || '—') + '</div>' +
    '</div>';
  }).join('');

  const resultsBar = (m.best_speaker_id || m.best_evaluator_id || m.best_table_topics_id)
    ? '<div class="print-results-bar">' +
        (m.best_speaker_id ? '<div><strong>最佳备稿讲员</strong><br>' + escapeHtml(m.best_speaker_name || '') + '</div>' : '') +
        (m.best_evaluator_id ? '<div><strong>最佳评论员</strong><br>' + escapeHtml(m.best_evaluator_name || '') + '</div>' : '') +
        (m.best_table_topics_id ? '<div><strong>最佳即席讲员</strong><br>' + escapeHtml(m.best_table_topics_name || '') + '</div>' : '') +
      '</div>'
    : '';

  return (
    '<div class="print-page card">' +
      '<div class="print-banner">' +
        '<img class="crest-logo" src="/images/toastmasters-logo.png" alt="Toastmasters International">' +
        '<h1>经禧华语讲演会</h1>' +
        '<div class="tagline">训练口才的讲台，交流知识的平台，挥洒才情的舞台</div>' +
        '<div class="meta">国际演讲会　80区域　分会编号 1453287</div>' +
      '</div>' +
      '<div class="print-venue">地点：' + escapeHtml(m.venue || '') + '</div>' +
      '<div class="print-mission">分会使命：我们提供互助互益的学习体验，使会员提高沟通和领导能力，最终达到提高自信，促进个人成长的目标</div>' +
      '<div class="print-meeting-no">' + escapeHtml(m.meeting_no || '') + '　（' + fmtDate(m.meeting_date) + '　晚间 ' + (m.meeting_time || '') + '）</div>' +
      '<div class="print-theme-bar">例会主题：' + escapeHtml(m.theme || '') + '</div>' +

      '<div class="print-body">' +
        '<div class="print-exco-panel">' +
          '<div class="term-label">' + escapeHtml(m.term_label || '执委名单') + '</div>' +
          excoRows +
          (dutyRoleRows ? '<div class="term-label" style="margin-top:8px;">职务分配</div>' + dutyRoleRows : '') +
        '</div>' +
        '<div class="print-agenda-panel">' +
          '<table class="agenda-table">' +
            '<thead><tr><th>时间</th><th>摘要</th><th>时限</th><th>讲员/负责会友</th></tr></thead>' +
            '<tbody>' + agendaTableRows + '</tbody>' +
          '</table>' +
          resultsBar +
        '</div>' +
      '</div>' +

      '<div class="print-dresscode">衣着：女士服装端庄大方，男士衬衫长裤。欢迎公众人士观摩</div>' +
      (m.footer_remarks ? '<div class="print-remarks">' + escapeHtml(m.footer_remarks) + '</div>' : '') +
      (includeQr
        ? '<div class="print-qr-row">' +
            '<div id="print-qr-canvas"></div>' +
            '<div class="qr-caption">扫码在线查看议程<br>Scan to view online</div>' +
            (includeSocial ? buildSocialLinksHtml(m.clubSocial) : '') +
          '</div>'
        : (includeSocial ? '<div class="print-qr-row">' + buildSocialLinksHtml(m.clubSocial) + '</div>' : '')
      ) +
      '<div class="print-pathway-legend">' +
        '<div class="legend-title">新路径 ：Pathways 十一大路线</div>' +
        '<div class="legend-grid">' +
          PATHWAY_LEGEND.map(function (s) { return '<div>' + escapeHtml(s) + '</div>'; }).join('') +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

async function renderPrintAgenda(meetingId) {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="empty-state">加载中…</div>';
  const m = await API.get('/meetings/' + meetingId);
  const includeQr = m.status === 'published';

  app.innerHTML =
    '<div style="background:var(--paper-100);min-height:100vh;padding:24px 16px;">' +
      '<div class="no-print flex justify-between items-center" style="max-width:880px;margin:0 auto 14px;">' +
        '<a href="#/meetings/' + m.id + '" class="small"><i class="ti ti-arrow-left"></i> 返回编辑</a>' +
        '<div class="flex gap-8">' +
          '<button class="btn btn-sm" onclick="window.print()"><i class="ti ti-printer"></i> 打印</button>' +
          '<button class="btn btn-primary btn-sm" id="download-jpeg-btn"><i class="ti ti-photo"></i> 下载图片 (JPEG)</button>' +
        '</div>' +
      '</div>' +
      buildPrintPageHtml(m, includeQr, includeQr) +
    '</div>';

  if (includeQr) renderQrCode('print-qr-canvas', window.location.origin + '/#/public/meetings/' + m.id);

  document.getElementById('download-jpeg-btn').addEventListener('click', function () {
    downloadAgendaJpeg(m);
  });
}

// Public, unauthenticated view reached by scanning the QR code — no
// sidebar, no login, no edit/print controls beyond a plain browser print.
// Fetches from /api/public/meetings/:id, which only serves meetings with
// status='published' (drafts 404).
async function renderPublicAgenda(meetingId) {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="empty-state">加载中…</div>';
  let m;
  try {
    m = await API.get('/public/meetings/' + meetingId);
  } catch (err) {
    app.innerHTML = '<div class="empty-state"><i class="ti ti-file-off"></i> 找不到此议程，或尚未公开发布。</div>';
    return;
  }
  app.innerHTML =
    '<div style="background:var(--paper-100);min-height:100vh;padding:24px 16px;">' +
      buildPrintPageHtml(m, false, true) +
    '</div>';
}

function memberName(id) {
  const found = Store.members.filter(function (x) { return x.id === Number(id); })[0];
  return found ? found.full_name : '';
}

// Builds the club's social channel icons (only the ones actually configured
// in Club Settings). Used beside the QR code in print, and again on the
// public post-scan view. Uses inline SVG rather than an icon font so it
// always renders correctly regardless of whether a CDN icon font loaded.
const SOCIAL_ICON_PATHS = {
  youtube_url: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  facebook_url: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.353.995-.353 1.752v1.297h3.919l-.386 1.913-.287 1.754h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.628-5.373-12-12-12s-12 5.372-12 12c0 6.135 4.604 11.194 10.101 11.647',
  instagram_url: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z',
  linkedin_url: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  tiktok_url: 'M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z',
};
function buildSocialLinksHtml(clubSocial) {
  clubSocial = clubSocial || {};
  const platforms = [
    ['youtube_url', 'YouTube'],
    ['facebook_url', 'Facebook'],
    ['instagram_url', 'Instagram'],
    ['linkedin_url', 'LinkedIn'],
    ['tiktok_url', 'TikTok'],
  ];
  const icons = platforms
    .filter(function (p) { return clubSocial[p[0]]; })
    .map(function (p) {
      return '<a href="' + escapeHtml(clubSocial[p[0]]) + '" target="_blank" class="social-icon" title="' + p[1] + '">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="' + SOCIAL_ICON_PATHS[p[0]] + '"></path></svg>' +
      '</a>';
    })
    .join('');
  if (!icons) return '';
  return '<div class="social-links-block">' +
    '<div class="social-links-title">Subscribe 点赞</div>' +
    '<div class="social-links">' + icons + '</div>' +
  '</div>';
}

// Splits free-text like "邱兰英 L5分区总监" into { name: "邱兰英", designation: "L5分区总监" }
// on the first space. Only meant for guest name fields — registered members'
// full_name has no embedded designation and is never passed through this.
function splitNameDesignation(text) {
  if (!text) return { name: '', designation: '' };
  const trimmed = text.trim();
  const idx = trimmed.indexOf(' ');
  if (idx === -1) return { name: trimmed, designation: '' };
  return { name: trimmed.slice(0, idx).trim(), designation: trimmed.slice(idx + 1).trim() };
}

// Loads html2canvas once, from CDN, and caches the loading promise so
// repeated clicks don't inject the script twice.
let _html2canvasLoadPromise = null;
function loadHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve();
  if (_html2canvasLoadPromise) return _html2canvasLoadPromise;
  _html2canvasLoadPromise = new Promise(function (resolve, reject) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = function () { resolve(); };
    script.onerror = function () { reject(new Error('无法加载图片组件，请检查网络连接')); };
    document.head.appendChild(script);
  });
  return _html2canvasLoadPromise;
}

// Loads the QR code library once, from CDN, and caches the loading promise.
let _qrLoadPromise = null;
function loadQrLib() {
  if (window.QRCode) return Promise.resolve();
  if (_qrLoadPromise) return _qrLoadPromise;
  _qrLoadPromise = new Promise(function (resolve, reject) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    script.onload = function () { resolve(); };
    script.onerror = function () { reject(new Error('QR code library failed to load')); };
    document.head.appendChild(script);
  });
  return _qrLoadPromise;
}

async function renderQrCode(containerId, url) {
  try {
    await loadQrLib();
    const el = document.getElementById(containerId);
    if (!el) return;
    new window.QRCode(el, { text: url, width: 84, height: 84, correctLevel: window.QRCode.CorrectLevel.M });
  } catch (err) {
    console.error(err);
    // Non-fatal: the printout still works fine without the QR code.
  }
}

// Captures the .print-page element exactly as rendered on screen (which
// already matches the @media print rules — the only difference is the
// no-print toolbar, which sits outside .print-page and is therefore
// naturally excluded) and saves it as a JPEG image. Pure WYSIWYG: this is
// literally a screenshot of the same DOM/CSS the print/preview uses.
async function downloadAgendaJpeg(m) {
  const btn = document.getElementById('download-jpeg-btn');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2"></i> 生成中…';
  try {
    await loadHtml2Canvas();
    if (document.fonts && document.fonts.ready) await document.fonts.ready;

    const el = document.querySelector('.print-page');
    const safeName = ((m.meeting_no || '例会议程') + '_' + (m.meeting_date || '')).replace(/[\\/:*?"<>|]/g, '').trim();

    const canvas = await window.html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = safeName + '.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error(err);
    toast(err.message || '图片生成失败，请重试', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}
