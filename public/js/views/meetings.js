// public/js/views/meetings.js

async function renderMeetings() {
  renderShell('/meetings', '<div class="empty-state">' + t('loading') + '</div>');
  const meetings = await API.get('/meetings');

  const rows = meetings.map(function (m) {
    return '<tr data-id="' + m.id + '">' +
      '<td>' + fmtDate(m.meeting_date) + '<div class="small muted">' + (m.meeting_time || '') + '</div></td>' +
      '<td>' + escapeHtml(m.meeting_no || '—') + '</td>' +
      '<td>' + escapeHtml(m.theme || '—') + '</td>' +
      '<td>' + statusBadge(m.status) + '</td>' +
      '<td class="no-print"><button class="btn btn-sm clone-btn" data-clone="' + m.id + '"><i class="ti ti-copy"></i> ' + escapeHtml(t('clone_as_new')) + '</button></td>' +
    '</tr>';
  }).join('');

  const html =
    '<div class="page-head">' +
      '<div><div class="eyebrow">' + escapeHtml(t('meeting_management')) + '</div><h1>' + escapeHtml(t('meeting_records')) + '</h1></div>' +
      '<a href="#/meetings/new" class="btn btn-primary"><i class="ti ti-plus"></i> ' + escapeHtml(t('new_meeting')) + '</a>' +
    '</div>' +
    '<div class="card card-pad">' +
      '<table class="data-table clickable">' +
        '<thead><tr><th>' + escapeHtml(t('date')) + '</th><th>' + escapeHtml(t('meeting_no')) + '</th><th>' + escapeHtml(t('theme')) + '</th><th>' + escapeHtml(t('status')) + '</th><th></th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="5" class="muted" style="text-align:center;padding:24px;">—</td></tr>') + '</tbody>' +
      '</table>' +
    '</div>';

  setContent(html);

  document.querySelectorAll('tr[data-id]').forEach(function (tr) {
    tr.addEventListener('click', function (e) {
      if (e.target.closest('.clone-btn')) return;
      navigate('/meetings/' + tr.dataset.id);
    });
  });
  document.querySelectorAll('.clone-btn').forEach(function (btn) {
    btn.addEventListener('click', async function (e) {
      e.stopPropagation();
      const id = btn.dataset.clone;
      const newDate = prompt(I18N.lang === 'zh' ? '请输入新例会日期 (YYYY-MM-DD)：' : 'Enter new meeting date (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
      if (!newDate) return;
      try {
        const res = await API.post('/meetings/' + id + '/clone', { new_date: newDate });
        toast(I18N.lang === 'zh' ? '已建立新例会草稿' : 'New draft meeting created', 'success');
        navigate('/meetings/' + res.id + '/edit');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });
}

async function renderMeetingNew() {
  renderShell('/meetings', '<div class="empty-state">' + t('loading') + '</div>');

  // 条件 d: term dropdown defaulting to the latest term.
  // 条件 a: venue/time defaults pulled from Club Masters settings.
  const terms = await API.get('/exco/terms');
  const clubSettings = await API.get('/club').catch(function () { return null; });
  const latestTerm = terms[0] ? terms[0].term_label : '';

  const termOptions = terms.length
    ? terms.map(function (term) {
        return '<option value="' + escapeHtml(term.term_label) + '"' + (term.term_label === latestTerm ? ' selected' : '') + '>' + escapeHtml(term.term_label) + '</option>';
      }).join('')
    : '<option value="">' + escapeHtml(t('no_terms_yet')) + '</option>';

  const defaultVenue = (clubSettings && clubSettings.default_venue) || '';
  const defaultTime = (clubSettings && clubSettings.meeting_time) || '19:00';

  const html =
    '<div class="page-head">' +
      '<div><a href="#/meetings" class="small muted"><i class="ti ti-arrow-left"></i> ' + escapeHtml(t('back')) + '</a><h1 class="mt-8">' + escapeHtml(t('new_meeting')) + '</h1></div>' +
    '</div>' +
    '<div class="card card-pad" style="max-width:560px;">' +
      '<div class="field"><label>' + escapeHtml(t('meeting_no')) + '</label><input type="text" id="f-no" placeholder="第十六届第十三次例会"></div>' +
      '<div class="field-row">' +
        '<div class="field"><label>' + escapeHtml(t('date')) + ' *</label><input type="date" id="f-date" required></div>' +
        '<div class="field"><label>' + escapeHtml(t('time')) + '</label><input type="time" id="f-time" value="' + escapeHtml(defaultTime) + '"></div>' +
      '</div>' +
      '<div class="field"><label>' + escapeHtml(t('theme')) + '</label><input type="text" id="f-theme" placeholder="万众一心，携手前进"></div>' +
      '<div class="field"><label>' + escapeHtml(t('select_term')) + '</label><select id="f-term">' + termOptions + '</select></div>' +
      '<div class="field"><label>' + escapeHtml(t('venue')) + '</label><textarea id="f-venue">' + escapeHtml(defaultVenue) + '</textarea></div>' +
      '<div class="flex gap-12 mt-16">' +
        '<button class="btn btn-primary" id="create-btn"><i class="ti ti-check"></i> ' + escapeHtml(t('new_meeting')) + '</button>' +
      '</div>' +
    '</div>';
  setContent(html);

  document.getElementById('create-btn').addEventListener('click', async function () {
    const meeting_date = document.getElementById('f-date').value;
    if (!meeting_date) { toast(I18N.lang === 'zh' ? '请选择日期' : 'Please select a date', 'error'); return; }
    try {
      const res = await API.post('/meetings', {
        meeting_no: document.getElementById('f-no').value.trim(),
        meeting_date: meeting_date,
        meeting_time: document.getElementById('f-time').value,
        theme: document.getElementById('f-theme').value.trim(),
        term_label: document.getElementById('f-term').value || null,
        venue: document.getElementById('f-venue').value.trim(),
      });
      toast(I18N.lang === 'zh' ? '例会已建立' : 'Meeting created', 'success');
      navigate('/meetings/' + res.id + '/edit');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
