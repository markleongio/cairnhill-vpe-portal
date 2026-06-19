// public/js/views/memberDetail.js

async function renderMemberDetail(id) {
  renderShell('/members', '<div class="empty-state">加载中…</div>');
  const m = await API.get('/members/' + id);

  const progressCards = (m.progress || []).map(function (p) {
    return '<div class="card card-pad flex items-center gap-12" style="min-width:220px;">' +
      progressRing(p.current_level, 5, 48) +
      '<div><div style="font-weight:500">' + escapeHtml(p.code) + ' · ' + escapeHtml(p.name_zh) + '</div>' +
      '<div class="small muted">级别 ' + p.current_level + ' / 5' + (p.is_primary_pathway ? ' · 主修' : '') + '</div></div>' +
    '</div>';
  }).join('');

  const completionRows = (m.completions || []).map(function (c) {
    return '<tr>' +
      '<td>' + fmtDate(c.completed_date) + '</td>' +
      '<td><span class="badge badge-jade">' + escapeHtml(c.pathway_code) + '</span> 级别' + c.level_no + ' · ' + escapeHtml(c.project_name_zh) + '</td>' +
      '<td>' + escapeHtml(c.speech_title || '—') + '</td>' +
      '<td>' + (c.meeting_no ? escapeHtml(c.meeting_no) : '—') + '</td>' +
    '</tr>';
  }).join('');

  const excoRows = (m.excoHistory || []).map(function (e) {
    return '<tr><td>' + escapeHtml(e.term_label) + '</td><td>' + escapeHtml(e.role_name_zh) + '</td><td>' + escapeHtml(e.designation || '—') + '</td></tr>';
  }).join('');

  const pathwayOptions = Store.pathways.map(function (p) {
    return '<option value="' + p.id + '">' + escapeHtml(p.code) + ' · ' + escapeHtml(p.name_zh) + '</option>';
  }).join('');

  const html =
    '<div class="page-head">' +
      '<div>' +
        '<a href="#/members" class="small muted"><i class="ti ti-arrow-left"></i> 返回会员列表</a>' +
        '<h1 class="mt-8">' + escapeHtml(m.full_name) + '</h1>' +
        '<div class="small muted mt-8">会员编号 ' + escapeHtml(m.member_no || '—') + (m.email ? ' · ' + escapeHtml(m.email) : '') + (m.phone ? ' · ' + escapeHtml(m.phone) : '') + '</div>' +
      '</div>' +
      '<button class="btn btn-primary" id="enroll-btn"><i class="ti ti-route"></i> 登记新路径</button>' +
    '</div>' +

    '<h2 class="mt-24">学习路径进度</h2>' +
    '<div class="flex gap-12 mt-16" style="flex-wrap:wrap;">' +
      (progressCards || '<div class="muted small">尚未登记任何路径</div>') +
    '</div>' +

    '<div class="card card-pad mt-24">' +
      '<h2>已完成项目记录</h2>' +
      '<table class="data-table mt-16"><thead><tr><th>日期</th><th>项目</th><th>讲题</th><th>例会</th></tr></thead>' +
      '<tbody>' + (completionRows || '<tr><td colspan="4" class="muted" style="text-align:center;padding:20px;">尚无完成记录</td></tr>') + '</tbody></table>' +
    '</div>' +

    '<div class="card card-pad mt-24">' +
      '<h2>执委任职历史</h2>' +
      '<table class="data-table mt-16"><thead><tr><th>届次</th><th>职务</th><th>荣衔</th></tr></thead>' +
      '<tbody>' + (excoRows || '<tr><td colspan="3" class="muted" style="text-align:center;padding:20px;">尚未担任执委</td></tr>') + '</tbody></table>' +
    '</div>';

  setContent(html);

  document.getElementById('enroll-btn').addEventListener('click', function () {
    openEnrollModal(id, pathwayOptions);
  });
}

function openEnrollModal(memberId, pathwayOptions) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML =
    '<div class="modal">' +
      '<div class="modal-head"><h3>登记学习路径</h3><button class="modal-close" id="modal-close">&times;</button></div>' +
      '<div class="modal-body">' +
        '<div class="field"><label>路径 Pathway</label><select id="f-pathway">' + pathwayOptions + '</select></div>' +
        '<div class="field"><label>当前级别 Level</label><select id="f-level">' +
          [1,2,3,4,5].map(function (n) { return '<option value="' + n + '">级别 ' + n + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="field"><label><input type="checkbox" id="f-primary" checked style="width:auto;display:inline-block;margin-right:6px;"> 设为主修路径</label></div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn" id="cancel-btn">取消</button><button class="btn btn-primary" id="save-btn"><i class="ti ti-check"></i> 保存</button></div>' +
    '</div>';
  document.body.appendChild(wrap);

  function close() { wrap.remove(); }
  wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);
  document.getElementById('save-btn').addEventListener('click', async function () {
    try {
      await API.post('/members/' + memberId + '/progress', {
        pathway_id: Number(document.getElementById('f-pathway').value),
        current_level: Number(document.getElementById('f-level').value),
        is_primary_pathway: document.getElementById('f-primary').checked ? 1 : 0,
      });
      toast('已登记路径', 'success');
      close();
      renderMemberDetail(memberId);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
