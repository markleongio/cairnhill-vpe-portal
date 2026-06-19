// db/seed.js
// Run with: npm run seed
// Populates reference tables (pathways, exco roles, agenda item types) and
// demo data modelled on the uploaded 经禧华语讲演会 meeting sheet, so the
// portal is immediately recognizable and testable.

const { run, get, all } = require('./db');
const bcrypt = require('bcryptjs');

console.log('Seeding Cairnhill VPE Portal database...');

// ---------------------------------------------------------------------------
// 1. Pathways (11 paths, per the legend at the bottom of the sheet)
// ---------------------------------------------------------------------------
const pathways = [
  ['PM', '精通演说', 'Presentation Mastery', 1],
  ['EH', '运用幽默', 'Engaging Humor', 2],
  ['PI', '劝说影响', 'Persuasive Influence', 3],
  ['DL', '动态领导', 'Dynamic Leadership', 4],
  ['VC', '愿景沟通', 'Visionary Communication', 5],
  ['MS', '激励策略', 'Motivational Strategies', 6],
  ['IP', '创新规划', 'Innovative Planning', 7],
  ['SR', '策略关系', 'Strategic Relationships', 8],
  ['EC', '有效教练', 'Effective Coaching', 9],
  ['LD', '发展领导', 'Leadership Development', 10],
  ['TC', '团队协作', 'Team Collaboration', 11],
];

const pathwayIds = {};
for (const [code, zh, en, order] of pathways) {
  const exists = get('SELECT id FROM pathways WHERE code = ?', [code]);
  if (!exists) {
    const res = run(
      'INSERT INTO pathways (code, name_zh, name_en, sort_order) VALUES (?,?,?,?)',
      [code, zh, en, order]
    );
    pathwayIds[code] = res.lastInsertRowid;
  } else {
    pathwayIds[code] = exists.id;
  }
}

// ---------------------------------------------------------------------------
// 2. Pathway levels + a starter project list for Presentation Mastery (PM)
//    and Innovative Planning (IP), matching the two speeches in the sample
//    sheet. Other pathways get 5 generic levels VPE can fill project names
//    into later via the admin UI.
// ---------------------------------------------------------------------------
function ensureLevels(pathwayId, levelLabels) {
  const ids = [];
  levelLabels.forEach((label, idx) => {
    const levelNo = idx + 1;
    let lvl = get('SELECT id FROM pathway_levels WHERE pathway_id=? AND level_no=?', [pathwayId, levelNo]);
    if (!lvl) {
      const res = run(
        'INSERT INTO pathway_levels (pathway_id, level_no, level_label) VALUES (?,?,?)',
        [pathwayId, levelNo, label]
      );
      ids.push(res.lastInsertRowid);
    } else {
      ids.push(lvl.id);
    }
  });
  return ids;
}

const levelLabelsZh = ['级别：一', '级别：二', '级别：三', '级别：四', '级别：五'];

for (const code of Object.keys(pathwayIds)) {
  ensureLevels(pathwayIds[code], levelLabelsZh);
}

// Projects for PM Level 1 (单元一 to 单元五, typical Presentation Mastery L1)
const pmLevel1 = get('SELECT id FROM pathway_levels WHERE pathway_id=? AND level_no=1', [pathwayIds['PM']]);
const pmProjects = [
  [1, '了解你的沟通风格'],
  [2, '如切如磋：从反馈中学习'],
  [3, '第一次演讲：冰水破裂'],
  [4, '第二次演讲'],
  [5, '第三次演讲'],
];
for (const [no, name] of pmProjects) {
  const exists = get('SELECT id FROM pathway_projects WHERE level_id=? AND project_no=?', [pmLevel1.id, no]);
  if (!exists) {
    run(
      `INSERT INTO pathway_projects (level_id, project_no, project_name_zh, default_time_min, default_time_max, evaluation_form_url)
       VALUES (?,?,?,?,?,?)`,
      [pmLevel1.id, no, name, 5, 7, 'https://www.toastmasters.org/-/media/files/department-documents/pathways-program-documents/evaluation-forms']
    );
  }
}

// Projects for IP Level 2 (了解你的领导风格 — matches the sheet's 备稿2)
const ipLevel2 = get('SELECT id FROM pathway_levels WHERE pathway_id=? AND level_no=2', [pathwayIds['IP']]);
const ipExists = get('SELECT id FROM pathway_projects WHERE level_id=? AND project_no=1', [ipLevel2.id]);
if (!ipExists) {
  run(
    `INSERT INTO pathway_projects (level_id, project_no, project_name_zh, default_time_min, default_time_max, evaluation_form_url)
     VALUES (?,?,?,?,?,?)`,
    [ipLevel2.id, 1, '了解你的领导风格', 5, 7, 'https://www.toastmasters.org/-/media/files/department-documents/pathways-program-documents/evaluation-forms']
  );
}

// ---------------------------------------------------------------------------
// 3. Exco roles (left-hand panel of the sheet, in order)
// ---------------------------------------------------------------------------
const roles = [
  ['会长', 'President'],
  ['文教副会长', 'VP Education'],
  ['会员副会长', 'VP Membership'],
  ['公关副会长', 'VP Public Relations'],
  ['秘书', 'Secretary'],
  ['财政', 'Treasurer'],
  ['礼宾司', 'Sergeant at Arms'],
  ['前会长', 'Immediate Past President'],
  ['创会赞助', 'Founding Sponsor'],
  ['创会辅导', 'Founding Mentor'],
];
const roleIds = {};
roles.forEach(([zh, en], idx) => {
  let r = get('SELECT id FROM exco_roles WHERE role_name_zh=?', [zh]);
  if (!r) {
    const res = run('INSERT INTO exco_roles (role_name_zh, role_name_en, sort_order) VALUES (?,?,?)', [zh, en, idx]);
    roleIds[zh] = res.lastInsertRowid;
  } else {
    roleIds[zh] = r.id;
  }
});

// ---------------------------------------------------------------------------
// 4. Agenda item types (drives which fields the agenda builder shows)
// ---------------------------------------------------------------------------
const itemTypes = [
  ['admin', '行政环节', 0, 0],            // 登记交流, 茶点时间 etc.
  ['role_task', '职务环节', 0, 0],         // 礼宾司欢迎来宾, 司仪开场
  ['agm', '会员大会环节', 0, 0],
  ['prepared_speech', '备稿演讲', 1, 1],   // needs pathway dropdown + evaluator
  ['evaluation', '演讲评论', 0, 1],
  ['table_topics', '即席演讲', 0, 0],
  ['closing', '闭会环节', 0, 0],
];
const itemTypeIds = {};
for (const [key, label, reqPath, reqEval] of itemTypes) {
  let t = get('SELECT id FROM agenda_item_types WHERE type_key=?', [key]);
  if (!t) {
    const res = run(
      'INSERT INTO agenda_item_types (type_key, label_zh, requires_pathway, requires_evaluator) VALUES (?,?,?,?)',
      [key, label, reqPath, reqEval]
    );
    itemTypeIds[key] = res.lastInsertRowid;
  } else {
    itemTypeIds[key] = t.id;
  }
}

// ---------------------------------------------------------------------------
// 5. Demo members (matching names visible in the uploaded sheet)
// ---------------------------------------------------------------------------
const members = [
  ['陈国炎', 'LD2', '93875388'],
  ['何昀龙', 'DTM/PM5', '94874083'],
  ['林宝莲', 'PM3', '96339480'],
  ['杨以蓉', 'CTM/CL/PM1', '98385873'],
  ['陈鸣骐', 'DTM', '90607825'],
  ['周伟荣', 'EH5/PI3', '96380886'],
  ['Jose Mari H. Rubi-Cruz', '', '93875388'],
  ['郑映屏', 'DTM', '96221803'],
  ['郑添登', 'DTM', '96752928'],
  ['胡善音', 'ACS, ALB', '96459637'],
  ['张宝财', 'DTM', '90030138'],
  ['甘翠妙', 'DTM', ''],
  ['蔡顺喜', 'DTM', ''],
  ['林伶岣', 'PM5/LD5', ''],
  ['周芷彤', '', ''],
  ['陈晶晶', '', ''],
  ['梁树发', 'PM2', ''],
  ['郑嗣才', 'TC2', ''],
  ['陈人颉', 'DTM', ''],
  ['黄语瑱', '', ''],
];
const memberIds = {};
for (const [name, designation, memberNo] of members) {
  let m = get('SELECT id FROM members WHERE full_name=?', [name]);
  if (!m) {
    const res = run(
      `INSERT INTO members (full_name, chinese_name, member_no, membership_type, status)
       VALUES (?,?,?,?,?)`,
      [name, name, memberNo || null, 'member', 'active']
    );
    memberIds[name] = res.lastInsertRowid;
  } else {
    memberIds[name] = m.id;
  }
}

// ---------------------------------------------------------------------------
// 6. Exco term assignment — condition (c): match members with exco roles
// ---------------------------------------------------------------------------
const termLabel = '2024-2025年度经禧执委';
const assignments = [
  ['会长', '陈国炎', 'LD2'],
  ['文教副会长', '何昀龙', 'DTM/PM5'],
  ['会员副会长', '林宝莲', 'PM3'],
  ['公关副会长', '杨以蓉', 'CTM/CL/PM1'],
  ['秘书', '陈鸣骐', 'DTM'],
  ['财政', '周伟荣', 'EH5/PI3'],
  ['礼宾司', 'Jose Mari H. Rubi-Cruz', ''],
  ['前会长', '郑映屏', 'DTM'],
  ['创会赞助', '郑添登', 'DTM'],
  ['创会辅导', '胡善音', 'ACS, ALB'],
];
for (const [roleZh, memberName, designation] of assignments) {
  const exists = get('SELECT id FROM exco_terms WHERE term_label=? AND role_id=?', [termLabel, roleIds[roleZh]]);
  if (!exists) {
    run(
      `INSERT INTO exco_terms (term_label, role_id, member_id, designation, start_date)
       VALUES (?,?,?,?,date('now'))`,
      [termLabel, roleIds[roleZh], memberIds[memberName], designation]
    );
  }
}

// ---------------------------------------------------------------------------
// 7. Resource library — condition (d): evaluation forms etc.
// ---------------------------------------------------------------------------
const resources = [
  ['备稿演讲评估表 (Prepared Speech Evaluation Form)', 'evaluation', 'https://www.toastmasters.org/-/media/files/department-documents/pathways-program-documents/evaluation-forms', itemTypeIds['prepared_speech']],
  ['即席演讲评估表 (Table Topics Evaluation)', 'evaluation', 'https://www.toastmasters.org/resources/table-topics-evaluation', itemTypeIds['table_topics']],
  ['计时员记录表 (Timer Log)', 'guide', 'https://www.toastmasters.org/resources/timer', null],
  ['文法纠察记录表 (Grammarian Log)', 'guide', 'https://www.toastmasters.org/resources/grammarian', null],
  ['最佳讲员/评论员投票表', 'ballot', 'https://www.toastmasters.org/resources/ballot', null],
];
for (const [label, cat, url, typeId] of resources) {
  const exists = get('SELECT id FROM resource_library WHERE label_zh=?', [label]);
  if (!exists) {
    run('INSERT INTO resource_library (label_zh, category, url, applies_to_type_id) VALUES (?,?,?,?)', [label, cat, url, typeId]);
  }
}

// ---------------------------------------------------------------------------
// 8. Member progress — pathway enrollment for a couple of demo members
// ---------------------------------------------------------------------------
function enroll(memberName, pathwayCode, level) {
  const mId = memberIds[memberName];
  const pId = pathwayIds[pathwayCode];
  if (!mId || !pId) return;
  const exists = get('SELECT id FROM member_progress WHERE member_id=? AND pathway_id=?', [mId, pId]);
  if (!exists) {
    run(
      `INSERT INTO member_progress (member_id, pathway_id, current_level, started_date) VALUES (?,?,?,date('now'))`,
      [mId, pId, level]
    );
  }
}
enroll('周芷彤', 'PM', 1);
enroll('陈晶晶', 'IP', 2);
enroll('梁树发', 'PM', 2);
enroll('郑嗣才', 'TC', 2);

// ---------------------------------------------------------------------------
// 9. One full demo meeting record — matches the uploaded sheet closely
// ---------------------------------------------------------------------------
const existingMeeting = get('SELECT id FROM meetings WHERE meeting_no=?', ['第十六届第十二次例会']);
let meetingId;
if (!existingMeeting) {
  const res = run(
    `INSERT INTO meetings (meeting_no, meeting_date, meeting_time, theme, term_label, status, dress_code)
     VALUES (?,?,?,?,?,?,?)`,
    [
      '第十六届第十二次例会',
      '2026-06-08',
      '19:00',
      '万众一心，携手前进',
      termLabel,
      'published',
      '女士服装端庄大方，男士衬衫长裤。欢迎公众人士观摩',
    ]
  );
  meetingId = res.lastInsertRowid;

  const pmProjectRow = get(
    `SELECT pp.id FROM pathway_projects pp
     JOIN pathway_levels pl ON pp.level_id = pl.id
     WHERE pl.pathway_id=? AND pl.level_no=1 AND pp.project_no=4`,
    [pathwayIds['PM']]
  );
  const ipProjectRow = get(
    `SELECT pp.id FROM pathway_projects pp
     JOIN pathway_levels pl ON pp.level_id = pl.id
     WHERE pl.pathway_id=? AND pl.level_no=2 AND pp.project_no=1`,
    [pathwayIds['IP']]
  );

  const evalFormUrl = 'https://www.toastmasters.org/-/media/files/department-documents/pathways-program-documents/evaluation-forms';

  // Columns, in order:
  // sort, time, typeKey, section, summary, tmin, tmax,
  // pathwayId, projectId, title, speakerId, isGuest, guestName,
  // responsibleId, respLabel, resLabel, resUrl
  const agendaRows = [
    [0, '7:00pm', 'admin', null, '登记交流', 15, null, null, null, null, null, 0, null, null, null, null, null],
    [1, '7:15pm', 'role_task', null, '礼宾司欢迎来宾', 15, null, null, null, null, null, 0, null, memberIds['郑嗣才'], null, null, null],
    [2, '7:30pm', 'role_task', null, '司仪开场', 5, null, null, null, null, null, 0, null, memberIds['梁树发'], null, null, null],
    [3, '7:35pm', 'agm', '会员大会', '2025-2026各执委汇报', null, null, null, null, null, null, 0, null, memberIds['陈国炎'], null, null, null],
    [4, null, 'agm', '会员大会', '前会长选举官 — 宣布新执委选举名单', null, null, null, null, null, null, 0, null, memberIds['郑映屏'], null, null, null],
    [5, null, 'agm', '会员大会', '会员投选新执委 2026-2027', null, null, null, null, null, null, 0, null, memberIds['陈国炎'], null, null, null],
    [6, '8:35pm', 'admin', null, '茶点时间 / 大合照', 15, null, null, null, null, null, 0, null, memberIds['杨以蓉'], null, null, null],
    [7, '8:50pm', 'prepared_speech', '备稿演讲', '备稿1：单元四 第二次演讲', 5, 7, pathwayIds['PM'], pmProjectRow ? pmProjectRow.id : null, '被打抢后的感觉', memberIds['周芷彤'], 0, null, memberIds['周芷彤'], null, '评估表', evalFormUrl],
    [8, null, 'prepared_speech', '备稿演讲', '备稿2：了解你的领导风格', 5, 7, pathwayIds['IP'], ipProjectRow ? ipProjectRow.id : null, '多元职理', memberIds['陈晶晶'], 0, null, memberIds['陈晶晶'], null, '评估表', evalFormUrl],
    [9, null, 'admin', null, '计时报告 及 投选最佳评论讲员', 5, null, null, null, null, null, 0, null, memberIds['周伟荣'], null, null, null],
    [10, '9:10pm', 'evaluation', '作业评论', '评论备稿1：周芷彤', 2, 3, null, null, null, null, 0, null, memberIds['陈鸣骐'], null, null, null],
    [11, null, 'evaluation', '作业评论', '评论备稿2：陈晶晶', 2, 3, null, null, null, null, 0, null, memberIds['郑映屏'], null, null, null],
    [12, null, 'admin', null, '计时报告 及 投选最佳评论讲员', 5, null, null, null, null, null, 0, null, memberIds['周伟荣'], null, null, null],
    [13, null, 'admin', null, '尾音赘语', 5, null, null, null, null, null, 0, null, memberIds['黄语瑱'], null, null, null],
    [14, '9:30pm', 'closing', null, '会长颁发彩带及致闭会词', 10, null, null, null, null, null, 0, null, memberIds['陈国炎'], null, null, null],
  ];

  let order = 0;
  for (const row of agendaRows) {
    const [
      sort, time, typeKey, section, summary, tmin, tmax,
      pathwayId, projectId, title, speakerId, isGuest, guestName,
      responsibleId, respLabel, resLabel, resUrl,
    ] = row;
    run(
      `INSERT INTO meeting_agenda
        (meeting_id, sort_order, scheduled_time, item_type_id, section_label, summary_zh,
         time_limit_min, time_limit_max, speaker_member_id, speaker_guest_name, speaker_is_guest,
         pathway_id, pathway_project_id, speech_title, responsible_member_id, responsible_label,
         resource_label, resource_url)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        meetingId, order++, time, itemTypeIds[typeKey], section, summary,
        tmin, tmax, speakerId || null, guestName || null, isGuest || 0,
        pathwayId || null, projectId || null, title || null, responsibleId || null, respLabel || null,
        resLabel || null, resUrl || null,
      ]
    );
  }

  // Best speaker/evaluator results, matching the sheet's "11/5/2026 例会成绩"
  run(
    `UPDATE meetings SET best_speaker_id=?, best_evaluator_id=? WHERE id=?`,
    [memberIds['杨以蓉'], memberIds['陈人颉'], meetingId]
  );

  console.log(`Created demo meeting #${meetingId}`);
} else {
  console.log('Demo meeting already exists, skipping.');
}

// ---------------------------------------------------------------------------
// 10. Admin user (VP-Education login)
// ---------------------------------------------------------------------------
const adminUsername = 'vpe.heyunlong';
const existingUser = get('SELECT id FROM users WHERE username=?', [adminUsername]);
if (!existingUser) {
  const hash = bcrypt.hashSync('ChangeMe!2026', 10);
  run(
    `INSERT INTO users (username, password_hash, member_id, role) VALUES (?,?,?,?)`,
    [adminUsername, hash, memberIds['何昀龙'], 'admin']
  );
  console.log(`Created admin user '${adminUsername}' with temp password 'ChangeMe!2026' — change this immediately.`);
} else {
  console.log('Admin user already exists, skipping.');
}

console.log('Seed complete.');
