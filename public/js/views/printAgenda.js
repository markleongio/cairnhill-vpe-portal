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

async function renderPrintAgenda(meetingId) {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="empty-state">加载中…</div>';
  const m = await API.get('/meetings/' + meetingId);

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
        (row.resource_url ? '<div class="summary-sub resource-link"><i class="ti ti-link" style="font-size:10px;"></i> <a href="' + escapeHtml(row.resource_url) + '" target="_blank">' + escapeHtml(row.resource_label || '相关资源') + '</a></div>' : '') +
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
        (m.best_speaker_id ? '<div><strong>最佳备稿讲员</strong><br>' + escapeHtml(memberName(m.best_speaker_id)) + '</div>' : '') +
        (m.best_evaluator_id ? '<div><strong>最佳评论员</strong><br>' + escapeHtml(memberName(m.best_evaluator_id)) + '</div>' : '') +
        (m.best_table_topics_id ? '<div><strong>最佳即席讲员</strong><br>' + escapeHtml(memberName(m.best_table_topics_id)) + '</div>' : '') +
      '</div>'
    : '';

  app.innerHTML =
    '<div style="background:var(--paper-100);min-height:100vh;padding:24px 16px;">' +
      '<div class="no-print flex justify-between items-center" style="max-width:880px;margin:0 auto 14px;">' +
        '<a href="#/meetings/' + m.id + '" class="small"><i class="ti ti-arrow-left"></i> 返回编辑</a>' +
        '<div class="flex gap-8">' +
          '<button class="btn btn-sm" onclick="window.print()"><i class="ti ti-printer"></i> 打印</button>' +
          '<button class="btn btn-primary btn-sm" id="download-jpeg-btn"><i class="ti ti-photo"></i> 下载图片 (JPEG)</button>' +
        '</div>' +
      '</div>' +
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
        '<div class="print-pathway-legend">' +
          '<div class="legend-title">新路径 ：Pathways 十一大路线</div>' +
          '<div class="legend-grid">' +
            PATHWAY_LEGEND.map(function (s) { return '<div>' + escapeHtml(s) + '</div>'; }).join('') +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.getElementById('download-jpeg-btn').addEventListener('click', function () {
    downloadAgendaJpeg(m);
  });
}

function memberName(id) {
  const found = Store.members.filter(function (x) { return x.id === Number(id); })[0];
  return found ? found.full_name : '';
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
