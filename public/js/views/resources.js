// public/js/views/resources.js

async function renderResources() {
  renderShell('/resources', '<div class="empty-state">加载中…</div>');
  await loadResourcesList();
}

async function loadResourcesList() {
  const resources = await API.get('/resources');

  const categoryLabels = { evaluation: '评估表', ballot: '投票表', guide: '指引', other: '其他' };

  const rows = resources.map(function (r) {
    return '<tr>' +
      '<td>' + escapeHtml(r.label_zh) + '</td>' +
      '<td><span class="badge badge-navy">' + (categoryLabels[r.category] || r.category) + '</span></td>' +
      '<td><a href="' + escapeHtml(r.url) + '" target="_blank" class="small"><i class="ti ti-external-link"></i> 打开链接</a></td>' +
      '<td class="no-print"><button class="btn btn-sm btn-danger del-btn" data-id="' + r.id + '"><i class="ti ti-trash"></i></button></td>' +
    '</tr>';
  }).join('');

  const html =
    '<div class="page-head">' +
      '<div><div class="eyebrow">资源管理</div><h1>资源链接</h1><p class="small muted mt-8">在此管理评估表等资源，可在议程编辑中附加到任一环节（条件 d）</p></div>' +
      '<button class="btn btn-primary" id="add-resource-btn"><i class="ti ti-plus"></i> 新增资源</button>' +
    '</div>' +
    '<div class="card card-pad">' +
      '<table class="data-table">' +
        '<thead><tr><th>名称</th><th>分类</th><th>链接</th><th></th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="4" class="muted" style="text-align:center;padding:24px;">尚无资源</td></tr>') + '</tbody>' +
      '</table>' +
    '</div>';

  setContent(html);

  document.getElementById('add-resource-btn').addEventListener('click', openAddResourceModal);
  document.querySelectorAll('.del-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (!confirm('确定删除此资源？')) return;
      await API.del('/resources/' + btn.dataset.id);
      toast('已删除', 'success');
      loadResourcesList();
    });
  });
}

function openAddResourceModal() {
  const typeOptions = Store.itemTypes.map(function (t) {
    return '<option value="' + t.id + '">' + escapeHtml(t.label_zh) + '</option>';
  }).join('');

  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML =
    '<div class="modal">' +
      '<div class="modal-head"><h3>新增资源</h3><button class="modal-close" id="modal-close">&times;</button></div>' +
      '<div class="modal-body">' +
        '<div class="field"><label>名称 *</label><input type="text" id="f-label" placeholder="例：备稿演讲评估表"></div>' +
        '<div class="field"><label>分类</label><select id="f-category">' +
          '<option value="evaluation">评估表</option><option value="ballot">投票表</option><option value="guide">指引</option><option value="other">其他</option>' +
        '</select></div>' +
        '<div class="field"><label>链接 URL *</label><input type="text" id="f-url" placeholder="https://..."></div>' +
        '<div class="field"><label>适用环节类型（可选）</label><select id="f-type"><option value="">— 不限 —</option>' + typeOptions + '</select></div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn" id="cancel-btn">取消</button><button class="btn btn-primary" id="save-btn"><i class="ti ti-check"></i> 保存</button></div>' +
    '</div>';
  document.body.appendChild(wrap);

  function close() { wrap.remove(); }
  wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);
  document.getElementById('save-btn').addEventListener('click', async function () {
    const label_zh = document.getElementById('f-label').value.trim();
    const url = document.getElementById('f-url').value.trim();
    if (!label_zh || !url) { toast('请填写名称与链接', 'error'); return; }
    try {
      await API.post('/resources', {
        label_zh: label_zh,
        category: document.getElementById('f-category').value,
        url: url,
        applies_to_type_id: document.getElementById('f-type').value || null,
      });
      toast('已新增资源', 'success');
      close();
      loadResourcesList();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
