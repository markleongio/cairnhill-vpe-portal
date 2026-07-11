// public/js/views/printAgenda.js

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

    const speaker = row.speaker_name || row.speaker_guest_name || '';
    const responsible = row.responsible_name || row.responsible_label || '';
    const summarySub = [
      row.speech_title ? '题目：' + row.speech_title : '',
      row.pathway_name ? '路线：' + row.pathway_name + (row.level_no ? '　级别：' + row.level_no : '') : '',
      row.project_name_zh ? '单元：' + row.project_name_zh : '',
      row.evaluates_speaker_name || row.evaluates_guest_name ? '评论：' + (row.evaluates_speaker_name || row.evaluates_guest_name) : '',
    ].filter(Boolean).join('　');

    const personCell = [speaker, responsible].filter(function (v, i, a) { return v && a.indexOf(v) === i; }).join(' / ') || '—';

    rows += '<tr>' +
      '<td class="time-col">' + (row.scheduled_time || '') + '</td>' +
      '<td><div class="summary-main">' + escapeHtml(row.summary_zh) + '</div>' +
        (summarySub ? '<div class="summary-sub">' + escapeHtml(summarySub) + '</div>' : '') +
        (row.resource_url ? '<div class="summary-sub resource-link"><i class="ti ti-link" style="font-size:10px;"></i> <a href="' + escapeHtml(row.resource_url) + '" target="_blank">' + escapeHtml(row.resource_label || '相关资源') + '</a></div>' : '') +
      '</td>' +
      '<td class="limit-col">' + (row.time_limit_min ? row.time_limit_min + (row.time_limit_max ? '-' + row.time_limit_max : '') : '') + '</td>' +
      '<td class="role-col">' + escapeHtml(personCell) + '</td>' +
    '</tr>';
    return rows;
  }).join('');

  const excoRows = (m.exco || []).map(function (e) {
    return '<div class="exco-entry">' +
      '<div class="role">' + escapeHtml(e.role_name_zh) + '</div>' +
      '<div class="name">' + escapeHtml(e.full_name) + (e.designation ? ' <span class="designation">' + escapeHtml(e.designation) + '</span>' : '') + '</div>' +
      (e.member_no ? '<div class="memberno">' + escapeHtml(e.member_no) + '</div>' : '') +
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
        '<button class="btn btn-primary btn-sm" onclick="window.print()"><i class="ti ti-printer"></i> 打印 / 另存为 PDF</button>' +
      '</div>' +
      '<div class="print-page card">' +
        '<div class="print-banner">' +
          '<img class="crest-logo" src="/images/toastmasters-logo.jpg" alt="Toastmasters International District 80">' +
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
      '</div>' +
    '</div>';
}

function memberName(id) {
  const found = Store.members.filter(function (x) { return x.id === Number(id); })[0];
  return found ? found.full_name : '';
}
