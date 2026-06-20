// public/js/views/meetings.js

async function renderMeetings() {
  renderShell('/meetings', '<div class="empty-state">加载中…</div>');
  const meetings = await API.get('/meetings');

  const rows = meetings.map(function (m) {
    return '<tr data-id="' + m.id + '">' +
      '<td>' + fmtDate(m.meeting_date) + '<div class="small muted">' + (m.meeting_time || '') + '</div></td>' +
      '<td>' + escapeHtml(m.meeting_no || '—') + '</td>' +
      '<td>' + escapeHtml(m.theme || '—') + '</td>' +
      '<td>' + statusBadge(m.status) + '</td>' +
      '<td class="no-print"><button class="btn btn-sm clone-btn" data-clone="' + m.id + '"><i class="ti ti-copy"></i> 复制为新例会</button></td>' +
    '</tr>';
  }).join('');

  const html =
    '<div class="page-head">' +
      '<div><div class="eyebrow">例会管理</div><h1>例会记录</h1></div>' +
      '<a href="#/meetings/new" class="btn btn-primary"><i class="ti ti-plus"></i> 新建例会</a>' +
    '</div>' +
    '<div class="card card-pad">' +
      '<table class="data-table clickable">' +
        '<thead><tr><th>日期</th><th>届次</th><th>主题</th><th>状态</th><th></th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="5" class="muted" style="text-align:center;padding:24px;">尚无例会记录，点击右上角新建</td></tr>') + '</tbody>' +
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
      const newDate = prompt('请输入新例会日期 (YYYY-MM-DD)：', new Date().toISOString().slice(0, 10));
      if (!newDate) return;
      try {
        const res = await API.post('/meetings/' + id + '/clone', { new_date: newDate });
        toast('已建立新例会草稿', 'success');
        navigate('/meetings/' + res.id + '/edit');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });
}

async function renderMeetingNew() {
  renderShell('/meetings', '<div class="empty-state">准备中…</div>');
  const html =
    '<div class="page-head">' +
      '<div><a href="#/meetings" class="small muted"><i class="ti ti-arrow-left"></i> 返回例会列表</a><h1 class="mt-8">新建例会</h1></div>' +
    '</div>' +
    '<div class="card card-pad" style="max-width:560px;">' +
      '<div class="field"><label>届次/期数 Meeting No.</label><input type="text" id="f-no" placeholder="例：第十六届第十三次例会"></div>' +
      '<div class="field-row">' +
        '<div class="field"><label>日期 Date *</label><input type="date" id="f-date" required></div>' +
        '<div class="field"><label>时间 Time</label><input type="time" id="f-time" value="19:00"></div>' +
      '</div>' +
      '<div class="field"><label>主题 Theme</label><input type="text" id="f-theme" placeholder="例：万众一心，携手前进"></div>' +
      '<div class="field"><label>执委届次 Exco term</label><input type="text" id="f-term" placeholder="例：2024-2025年度经禧执委" value="2024-2025年度经禧执委"></div>' +
      '<div class="field"><label>地点 Venue</label><textarea id="f-venue">经禧民众俱乐部，二楼会议室，1 Anthony Road, (S) 229944</textarea></div>' +
      '<div class="flex gap-12 mt-16">' +
        '<button class="btn btn-primary" id="create-btn"><i class="ti ti-check"></i> 建立例会并编辑议程</button>' +
      '</div>' +
    '</div>';
  setContent(html);

  document.getElementById('create-btn').addEventListener('click', async function () {
    const meeting_date = document.getElementById('f-date').value;
    if (!meeting_date) { toast('请选择日期', 'error'); return; }
    try {
      const res = await API.post('/meetings', {
        meeting_no: document.getElementById('f-no').value.trim(),
        meeting_date: meeting_date,
        meeting_time: document.getElementById('f-time').value,
        theme: document.getElementById('f-theme').value.trim(),
        term_label: document.getElementById('f-term').value.trim(),
        venue: document.getElementById('f-venue').value.trim(),
      });
      toast('例会已建立', 'success');
      navigate('/meetings/' + res.id + '/edit');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
