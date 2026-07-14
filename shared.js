/* ══════════════════════════════════════════════════
   shared.js — 減碳A標監造回報系統 共用邏輯
   ══════════════════════════════════════════════════ */
'use strict';

// ── 常數 ──
const API_URL     = 'https://script.google.com/macros/s/AKfycbzsFQEkz4_cVuNfCAMTDDs808uXstWUH0SVAMjIi54sbIRcgEW-atEGEFvdPmRkzXxK/exec';
const LOCAL_KEY   = 'construction_tl_v3';
const DEFECT_KEY  = 'construction_defects_v1';
const DOCS_KEY    = 'construction_docs_v1';
const QI_KEY      = 'construction_qi_v2';
const ATT_KEY     = 'construction_att_v1';
const MEMBER_KEY  = 'construction_members_v1';
const PROGRESS_KEY= 'construction_progress_v1';
const SCHEDULE_KEY= 'construction_schedule_v1';
const CAT_KEY     = 'construction_cats_v1';
const TW_HOLIDAYS_KEY = 'construction_tw_holidays_v1';
const DOCTRACK_KEY = 'construction_doctrack_v1';
const GUIDE_KEY = 'construction_guide_notes_v1';
const CORR_KEY = 'construction_correspond_v1';

// ── 頁面導覽定義 ──
const NAV_PAGES = [
  { id:'timeline',   label:'時間軸',         href:'timeline.html',   badge:null },
  { id:'defects',    label:'改善事項追蹤',   href:'defects.html',    badge:'open-count' },
  { id:'quality',    label:'監造查驗',        href:'quality.html',    badge:'qi-fail-count' },
  { id:'doctrack',   label:'文件管理',        href:'doctrack.html',   badge:'doc-overdue-count' },
  { id:'docs',       label:'文件送審',        href:'docs.html',       badge:'docs-overdue-count' },
  { id:'correspond', label:'收發函文',        href:'correspond.html', badge:'corr-pending-count' },
  { id:'guide',      label:'📘 送審須知筆記', href:'guide.html',      badge:null },
  { id:'attendance', label:'👷 出勤管理',    href:'attendance.html', badge:null },
  { id:'export',     label:'⬇ 匯出',         href:'export.html',     badge:null },
];

// ── 全域錯誤保護 ──
window.onerror = function(msg, src, line, col, err) {
  console.error('App error:', msg, err);
  showErrBanner('發生錯誤：' + msg);
  return true;
};
window.onunhandledrejection = function(e) {
  showErrBanner('非同步錯誤：' + (e.reason && e.reason.message ? e.reason.message : e.reason));
};
function showErrBanner(msg) {
  try {
    let b = document.getElementById('global-err-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'global-err-banner';
      b.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#7f1d1d;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;z-index:9999;display:flex;align-items:center;gap:12px;box-shadow:0 4px 12px rgba(0,0,0,.25);max-width:90vw;';
      b.innerHTML = '<span id="global-err-msg"></span><button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,.2);border:none;color:#fff;padding:4px 10px;border-radius:5px;cursor:pointer;font-size:12px;">×</button>';
      document.body.appendChild(b);
    }
    document.getElementById('global-err-msg').textContent = msg;
  } catch(e2) {}
}

// ── 工具函式 ──
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function addDays(dateStr, days) {
  const parts = dateStr.split('-');
  const dt = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]) + parseInt(days));
  return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
}
function daysDiff(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
function normalizeDate(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) return m[1] + '-' + m[2].padStart(2,'0') + '-' + m[3].padStart(2,'0');
  const roc = s.match(/^(\d{2,3})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (roc) return (parseInt(roc[1])+1911) + '-' + roc[2].padStart(2,'0') + '-' + roc[3].padStart(2,'0');
  try {
    const d = new Date(s);
    if (!isNaN(d)) return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  } catch(e) {}
  return s;
}

// ── 認證 ──
function getToken() { return sessionStorage.getItem('tl_auth') || ''; }
function getTokenExp() { return parseInt(sessionStorage.getItem('tl_auth_exp') || '0'); }
function isLoggedIn() {
  const token = getToken();
  const exp   = getTokenExp();
  return token && token.length > 8 && Date.now() < exp;
}
function requireAuth() {
  if (!isLoggedIn()) {
    sessionStorage.removeItem('tl_auth');
    sessionStorage.removeItem('tl_auth_exp');
    window.location.href = 'index.html';
    return false;
  }
  return true;
}
function lockApp() {
  sessionStorage.removeItem('tl_auth');
  sessionStorage.removeItem('tl_auth_exp');
  window.location.href = 'index.html';
}
async function doLogin(pw) {
  const res  = await fetch(API_URL + '?action=login&pw=' + encodeURIComponent(pw));
  const data = await res.json();
  if (data.token) {
    sessionStorage.setItem('tl_auth', data.token);
    sessionStorage.setItem('tl_auth_exp', data.expires);
    return { ok: true };
  }
  return { ok: false, error: data.error || '密碼錯誤' };
}

// ── API 呼叫 ──
async function apiCall(params) {
  const token = getToken();
  params.token = token;
  const url = API_URL + '?' + new URLSearchParams(params).toString();
  const res  = await fetch(url);
  const json = await res.json();
  if (json.error === 'UNAUTHORIZED') { lockApp(); throw new Error('登入已逾期'); }
  if (json.error) throw new Error(json.error);
  return json;
}
async function cloudSaveAll(module, dataArr) {
  if (!API_URL) return;
  const json    = JSON.stringify(dataArr);
  const encoded = encodeURIComponent(json);
  try {
    const res  = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ module, action:'saveAll', json, token: getToken() })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
  } catch(e) {
    if (encoded.length < 6000) {
      const res2  = await fetch(API_URL + '?module=' + module + '&action=saveAll&json=' + encoded + '&token=' + encodeURIComponent(getToken()));
      const data2 = await res2.json();
      if (data2.error) throw new Error(data2.error);
    }
  }
}
async function cloudLoadAll(module) {
  if (!API_URL) return null;
  const url  = API_URL + '?module=' + module + '&action=getAll&token=' + encodeURIComponent(getToken());
  const res  = await fetch(url);
  const data = await res.json();
  if (data.error === 'UNAUTHORIZED') { lockApp(); throw new Error('登入已逾期'); }
  if (data.error) throw new Error(data.error);
  return Array.isArray(data.data) ? data.data : [];
}

// ── 本機 Storage ──
function localSave(entries) { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(entries)); } catch(e) {} }
function localLoad() {
  try { const r = localStorage.getItem(LOCAL_KEY); if (!r) return null; const p = JSON.parse(r); return Array.isArray(p) ? p : null; }
  catch(e) { return null; }
}
function storageSave(key, data) { try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {} }
function storageLoad(key, fallback) {
  try { const r = localStorage.getItem(key); if (!r) return fallback; const p = JSON.parse(r); return p; }
  catch(e) { return fallback; }
}

// 各模組 save（含雲端防抖）
function makeModuleSave(key, module, getDataFn) {
  let timer = null;
  return function() {
    try { localStorage.setItem(key, JSON.stringify(getDataFn())); } catch(e) {}
    clearTimeout(timer);
    timer = setTimeout(function() { cloudSaveAll(module, getDataFn()).catch(function(){}); }, 500);
  };
}

// ── 同步 Badge ──
function setSync(msg, cls) {
  const b = document.getElementById('sync-badge');
  if (!b) return;
  b.textContent = msg;
  b.className = 'sync-badge ' + cls;
}

// ── Toast Confirm ──
let _toastResolve = null;
function toastConfirm(msg, okLabel) {
  return new Promise(function(resolve) {
    _toastResolve = resolve;
    const el = document.getElementById('toast-confirm');
    document.getElementById('toast-msg').textContent = msg || '確定要刪除？';
    document.getElementById('toast-ok-btn').textContent = okLabel || '刪除';
    el.classList.add('show');
  });
}
function toastResolve(result) {
  document.getElementById('toast-confirm').classList.remove('show');
  if (_toastResolve) { _toastResolve(result); _toastResolve = null; }
}

// ── 導覽選單渲染（漢堡選單內容）──
function renderNav(activePage) {
  const listEl = document.getElementById('nav-list');
  if (!listEl) return;

  // 讀取 badge 計數（從 localStorage）
  const defects = storageLoad(DEFECT_KEY, []);
  const qualityItems = storageLoad(QI_KEY, []);
  const docTrack = storageLoad(DOCTRACK_KEY, []);
  const docsSubmit = storageLoad(DOCS_KEY, []);
  const corrList = storageLoad(CORR_KEY, []);
  const openDef  = Array.isArray(defects)      ? defects.filter(d => d.status !== 'closed').length : 0;
  const qiFail   = Array.isArray(qualityItems)  ? qualityItems.filter(q => q.progress !== 'Completed').length : 0;
  const today    = todayStr();
  const docOverdue = Array.isArray(docTrack) ? docTrack.filter(d =>
    d.dueDate && !d.returnDate && d.progress !== 'done' && d.dueDate < today
  ).length : 0;
  const APPROVED_RESULTS = { approved:1, approved_mod:1, approved_after:1 };
  const docsOverdue = Array.isArray(docsSubmit) ? docsSubmit.filter(d => {
    if (!d.versions || !d.versions.length) return false;
    const last = d.versions[d.versions.length - 1];
    if (APPROVED_RESULTS[last.result] || !last.date) return false;
    if (last.result === 'sent' && !last.replyDate) return today > addDays(last.date, d.reviewDays || 14);
    return false;
  }).length : 0;

  const corrPending = Array.isArray(corrList) ? corrList.filter(c => c.direction === 'in' && !c.receiveDate).length : 0;

  const badgeVals = { 'open-count': openDef, 'qi-fail-count': qiFail, 'doc-overdue-count': docOverdue, 'docs-overdue-count': docsOverdue, 'corr-pending-count': corrPending };

  listEl.innerHTML = NAV_PAGES.map(function(p, i) {
    const isActive = p.id === activePage;
    const bKey = p.badge;
    const bVal = bKey ? (badgeVals[bKey] || 0) : 0;
    const badgeHtml = bKey && bVal > 0 ? `<span class="nav-link-badge">${bVal}</span>` : '';
    const num = String(i + 1).padStart(2, '0');
    const label = p.label.replace(/^[^\u4e00-\u9fa5A-Za-z]+/, ''); // 去除舊版 icon 符號前綴
    return `<li><a href="${p.href}" class="nav-link${isActive?' active':''}">
      <span class="nav-link-num">${num}</span>
      <span class="nav-link-label">${label}</span>
      ${badgeHtml}
    </a></li>`;
  }).join('');
}

// ── 漢堡選單開關 ──
function toggleNavMenu() {
  const overlay = document.getElementById('nav-overlay');
  const btn     = document.getElementById('hamburger-btn');
  if (!overlay) return;
  const willOpen = !overlay.classList.contains('open');
  overlay.classList.toggle('open', willOpen);
  if (btn) btn.classList.toggle('active', willOpen);
}
function closeNavMenu() {
  const overlay = document.getElementById('nav-overlay');
  const btn     = document.getElementById('hamburger-btn');
  if (overlay) overlay.classList.remove('open');
  if (btn) btn.classList.remove('active');
}
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeNavMenu(); });

// ── Sidebar collapse ──
let _sidebarCollapsed = false;
function toggleSidebarCollapse() {
  _sidebarCollapsed = !_sidebarCollapsed;
  const sidebar  = document.getElementById('sidebar');
  const icon     = document.getElementById('collapse-icon');
  const floatBtn = document.getElementById('sidebar-float-btn');
  if (sidebar)  sidebar.classList.toggle('collapsed', _sidebarCollapsed);
  if (icon)     icon.setAttribute('points', _sidebarCollapsed ? '9 18 15 12 9 6' : '15 18 9 12 15 6');
  if (floatBtn) floatBtn.style.display = _sidebarCollapsed ? 'flex' : 'none';
  try { localStorage.setItem('sidebar_collapsed', _sidebarCollapsed ? '1' : '0'); } catch(e) {}
}
function initSidebarState() {
  const isMobile = window.innerWidth <= 767;
  const headerToggle = document.getElementById('header-toggle-btn');
  const mobileBtn    = document.getElementById('mobile-sidebar-btn');
  if (headerToggle) headerToggle.style.display = isMobile ? 'none' : 'flex';
  if (mobileBtn)    mobileBtn.style.display    = isMobile ? 'flex' : 'none';
  if (!isMobile) {
    try { if (localStorage.getItem('sidebar_collapsed') === '1') toggleSidebarCollapse(); } catch(e) {}
  }
}
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay-bg');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('show');
}
function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay-bg');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
}
window.addEventListener('resize', function() {
  const isMobile = window.innerWidth <= 767;
  const headerToggle = document.getElementById('header-toggle-btn');
  const mobileBtn    = document.getElementById('mobile-sidebar-btn');
  if (headerToggle) headerToggle.style.display = isMobile ? 'none' : 'flex';
  if (mobileBtn)    mobileBtn.style.display    = isMobile ? 'flex' : 'none';
});

// ── 入口資料載入（每頁呼叫）──
// 回傳 { entries, defects, docs, qualityItems, attRecords, members }
async function loadAllData() {
  const result = {
    entries:      localLoad() || [],
    defects:      storageLoad(DEFECT_KEY, []),
    docs:         storageLoad(DOCS_KEY, []),
    qualityItems: storageLoad(QI_KEY, []),
    attRecords:   storageLoad(ATT_KEY, []),
    members:      storageLoad(MEMBER_KEY, getDefaultMembers()),
    docTrack:     storageLoad(DOCTRACK_KEY, []),
    guideNotes:   storageLoad(GUIDE_KEY, []),
    correspond:   storageLoad(CORR_KEY, []),
  };

  if (!Array.isArray(result.docs)         || !result.docs.length)         result.docs         = DOCS_PRELOAD.slice();
  if (!Array.isArray(result.qualityItems) || !result.qualityItems.length) result.qualityItems = QI_PRELOAD.slice();
  if (!Array.isArray(result.members)      || !result.members.length)       result.members      = getDefaultMembers();
  if (!Array.isArray(result.docTrack)     || !result.docTrack.length)      result.docTrack     = DOCTRACK_PRELOAD.slice();
  if (!Array.isArray(result.guideNotes)   || !result.guideNotes.length)    result.guideNotes   = GUIDE_PRELOAD.slice();
  if (!Array.isArray(result.correspond)   || !result.correspond.length)    result.correspond   = CORR_PRELOAD.slice();

  if (!API_URL) return result;

  setSync('載入中…', 'sync-busy');
  try {
    const data = await apiCall({ action:'getAll' });
    const raw  = Array.isArray(data.entries) ? data.entries : [];
    result.entries = raw.map(sanitizeEntry).filter(e => e.date);
    localSave(result.entries);

    const modules = ['defects','docs','qi','att','members','doctrack','guidenotes','correspond'];
    const keys    = [DEFECT_KEY, DOCS_KEY, QI_KEY, ATT_KEY, MEMBER_KEY, DOCTRACK_KEY, GUIDE_KEY, CORR_KEY];
    const props   = ['defects','docs','qualityItems','attRecords','members','docTrack','guideNotes','correspond'];
    // att 和 members 本機有資料就用本機（避免雲端舊資料覆蓋剛匯入的內容）
    const localFirst = new Set(['att','members']);

    for (let i = 0; i < modules.length; i++) {
      try {
        const cloud = await cloudLoadAll(modules[i]);
        if (localFirst.has(modules[i])) {
          // 本機有資料 → 用本機，順便推雲端確保一致
          if (result[props[i]].length > 0) {
            await cloudSaveAll(modules[i], result[props[i]]);
          } else if (cloud && cloud.length > 0) {
            // 本機空 → 從雲端拉
            result[props[i]] = cloud;
            storageSave(keys[i], cloud);
          }
        } else {
          if (cloud && cloud.length > 0) {
            result[props[i]] = cloud;
            storageSave(keys[i], cloud);
          } else if (result[props[i]].length > 0) {
            await cloudSaveAll(modules[i], result[props[i]]);
          }
        }
      } catch(e) { console.warn('同步失敗', modules[i], e.message); }
    }

    setSync('已同步 ✓', 'sync-ok');
  } catch(e) {
    setSync('離線，使用本機', 'sync-err');
  }
  return result;
}

function sanitizeEntry(raw) {
  function get(obj, ...keys) {
    for (const k of keys) {
      const found = Object.keys(obj).find(ok => ok.toLowerCase() === k.toLowerCase());
      if (found !== undefined && obj[found] !== undefined && String(obj[found]).trim() !== '') return String(obj[found]).trim();
    }
    return '';
  }
  const status = get(raw, 'status');
  const VALID_STATUS = { normal:1, milestone:1, warn:1, pending:1, issue:1 };
  return {
    id:       get(raw,'id') || uid(),
    date:     normalizeDate(get(raw,'date')),
    weather:  get(raw,'weather') || '☀️ 晴',
    status:   VALID_STATUS[status] ? status : 'normal',
    title:    get(raw,'title') || '（無說明）',
    sub:      get(raw,'sub','workers','people') || '',
    alert:    get(raw,'alert','note','notes','remark') || '',
    defectNo: get(raw,'defectno','defect_no','defectNo') || '',
  };
}

function getDefaultMembers() {
  return [
    { id:'m001', name:'王中平', role:'監造工程師', active:true },
    { id:'m002', name:'劉錦華', role:'監造工程師', active:true },
    { id:'m003', name:'謝庭蓁', role:'監造工程師', active:true },
    { id:'m004', name:'高君銓', role:'監造工程師', active:true },
    { id:'m005', name:'林怡秀', role:'監造工程師', active:true },
    { id:'m006', name:'陳勤傑', role:'監造工程師', active:true },
    { id:'m007', name:'盧鵬宇', role:'監造工程師', active:true },
    { id:'m008', name:'林幸一', role:'監造工程師', active:true },
  ];
}

// ── 台灣國定假日 ──
const TW_HOLIDAYS_DEFAULT = {
  '2025-01-01':'元旦','2025-01-27':'春節','2025-01-28':'春節','2025-01-29':'春節',
  '2025-01-30':'春節','2025-01-31':'春節','2025-02-28':'和平紀念日',
  '2025-04-04':'兒童節/清明節','2025-05-01':'勞動節',
  '2025-05-31':'端午節','2025-10-10':'國慶日',
  '2026-01-01':'元旦','2026-01-16':'春節','2026-01-17':'春節','2026-01-18':'春節',
  '2026-01-19':'春節','2026-01-20':'春節','2026-02-28':'和平紀念日',
  '2026-04-03':'兒童節','2026-04-04':'清明節','2026-05-01':'勞動節',
  '2026-06-19':'端午節','2026-09-26':'中秋節','2026-10-10':'國慶日',
};
function loadHolidays() {
  try {
    const r = localStorage.getItem(TW_HOLIDAYS_KEY);
    return r ? JSON.parse(r) : { holidays: TW_HOLIDAYS_DEFAULT, workdays: {} };
  } catch(e) { return { holidays: TW_HOLIDAYS_DEFAULT, workdays: {} }; }
}
function isHolidayDate(dateStr, holidays, workdays) {
  if (workdays[dateStr]) return false;
  if (holidays[dateStr]) return true;
  const d = new Date(dateStr);
  return d.getDay() === 0 || d.getDay() === 6;
}
function calcWorkdays(y, mo, holidays, workdays) {
  const days = new Date(y, mo, 0).getDate();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const dateStr = y + '-' + String(mo).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    if (!isHolidayDate(dateStr, holidays, workdays)) count++;
  }
  return count;
}

// ── 工項標題解析 ──
function parseTitle(raw) {
  const HDRS = ['一、工程進行情況','二、品質查驗工作項目','三、督導環保及職安衛事項','四、其他重要事項'];
  const result = ['','','',''];
  if (!raw) return result;
  const hasHeaders = HDRS.some(h => raw.indexOf(h) >= 0);
  if (!hasHeaders) { result[0] = raw; return result; }
  HDRS.forEach(function(h, hi) {
    const pos = raw.indexOf(h);
    if (pos < 0) return;
    const afterHeader = raw.indexOf('\n', pos);
    if (afterHeader < 0) return;
    const segStart = afterHeader + 1;
    let segEnd = raw.length;
    for (let ni = hi+1; ni < HDRS.length; ni++) {
      const np = raw.indexOf('\n\n' + HDRS[ni], segStart);
      if (np >= 0 && np < segEnd) segEnd = np;
    }
    result[hi] = raw.slice(segStart, segEnd).trim();
  });
  return result;
}
function formatTitle(raw) {
  if (!raw) return '';
  const fields = parseTitle(raw);
  const parts  = [];
  if (fields[0]) parts.push('<div class="cs-text">'      + esc(fields[0]).replace(/\n/g,'<br>') + '</div>');
  if (fields[1]) parts.push('<div class="cs-text" style="color:var(--dnv-digi-green);">' + esc(fields[1]).replace(/\n/g,'<br>') + '</div>');
  if (fields[2]) parts.push('<div class="cs-text" style="color:var(--c-amber);">' + esc(fields[2]).replace(/\n/g,'<br>') + '</div>');
  if (fields[3]) parts.push('<div class="cs-text" style="color:var(--dnv-energy-red);font-weight:600;">' + esc(fields[3]).replace(/\n/g,'<br>') + '</div>');
  if (parts.length) return '<div class="card-sections">' + parts.join('') + '</div>';
  return '<div class="cs-text">' + esc(raw).replace(/\n/g,'<br>') + '</div>';
}

// ── 出工人數快速填入 ──
function fillWorkers() {
  const labor = parseInt(document.getElementById('wk-labor').value) || 0;
  const mgmt  = parseInt(document.getElementById('wk-mgmt').value)  || 0;
  const total = labor + mgmt;
  const subEl = document.getElementById('f-sub');
  if (!subEl) return;
  if (total > 0) {
    let txt = '出工 ' + total + '人';
    if (labor > 0 && mgmt > 0) txt += '（施工 ' + labor + '、管理 ' + mgmt + '）';
    else if (labor > 0) txt += '（施工 ' + labor + '）';
    else txt += '（管理 ' + mgmt + '）';
    subEl.value = txt;
  } else { subEl.value = ''; }
}

// ── 出勤工時計算 ──
function calcWorkMinutes(timeIn, timeOut) {
  if (!timeIn || !timeOut) return 0;
  const ip = timeIn.split(':');
  const op = timeOut.split(':');
  return Math.max(0, (parseInt(op[0])*60+parseInt(op[1])) - (parseInt(ip[0])*60+parseInt(ip[1])));
}
function fmtMinutes(min) {
  if (!min) return '—';
  return Math.floor(min/60) + 'h' + (min%60 ? String(min%60).padStart(2,'0')+'m' : '');
}

// ── DOCS Preload 資料（文件送審頁面已移除，保留空陣列以維持既有資料相容性）──
const DOCS_PRELOAD = [];
const QI_PRELOAD   = []; // quality.html 自行定義完整 preload

// ── 文件管理 Preload（由使用者原始 Excel 文件正本追蹤表匯入）──
const DOCTRACK_PRELOAD = [
  {id:'seed01',category:'材料抽驗',name:'材料抽驗 甲種圍籬進場',docNo:'MCCT-10490817_001',progress:'done',holder:'',createDate:'2026-01-19',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'簽核後紙本正本在Claire那邊'},
  {id:'seed02',category:'工安管理',name:'工安抽查紀錄表 20260126-20260208',docNo:'',progress:'done',holder:'Lena',createDate:'2026-01-26',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:''},
  {id:'seed03',category:'工安管理',name:'工安抽查紀錄表 20260209-20260222',docNo:'',progress:'done',holder:'Claire',createDate:'2026-02-09',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'簽核後紙本正本在Claire那邊'},
  {id:'seed04',category:'工安管理',name:'工安抽查紀錄表 20260223-20260315',docNo:'',progress:'done',holder:'Lena',createDate:'2026-02-23',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:''},
  {id:'seed05',category:'工安管理',name:'工安抽查紀錄表 20260316-20260531',docNo:'',progress:'done',holder:'Claire',createDate:'2026-03-16',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'簽核後紙本正本在Claire那邊'},
  {id:'seed06',category:'改善事項',name:'減碳A標 督導改善對策及結果表 20260522',docNo:'',progress:'sent',holder:'綜施處',createDate:'2026-05-08',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已發文',efiled:true,notes:''},
  {id:'seed07',category:'人員名冊',name:'承攬商施工人員進廠申請名冊',docNo:'DNV 0516 0518~22 號加班_監造+施工處用印',progress:'done',holder:'綜施處',createDate:'2026-05-12',sentDate:'2026-05-12',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'核定文件給台電了，雲端只有未簽核版本'},
  {id:'seed08',category:'改善事項',name:'工程抽查驗改善事項通知單 沉砂池鋼筋',docNo:'10490817_0004',progress:'done',holder:'Claire',createDate:'2026-05-12',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'第二聯和改善前中後照片已複印給廠商留存'},
  {id:'seed09',category:'材料抽驗',name:'材料抽驗 沉沙池灌漿',docNo:'EA-1150513-1',progress:'done',holder:'Claire',createDate:'2026-05-13',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'已複印給廠商(監造主管簽名後的正本那幾頁在Claire那邊)'},
  {id:'seed10',category:'人員名冊',name:'承攬商施工人員進廠申請名冊',docNo:'監造_1150530加班',progress:'done',holder:'綜施處',createDate:'2026-05-28',sentDate:'2026-05-28',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'核定文件給台電了'},
  {id:'seed11',category:'工安管理',name:'職業安全衛生管理計畫0A版審查意見',docNo:'OPR-10490817_003.1a',progress:'sent',holder:'Claire',createDate:'2026-06-05',sentDate:'2026-06-05',dueDate:'',returnDate:'',paperStatus:'已發文',efiled:true,notes:'已寄抽換紙本'},
  {id:'seed12',category:'審查意見',name:'詳細價目表(0版)審查結果',docNo:'函_DNV-10490817-0137_檢送詳細價目表0版審查結果准予核定_20250605',progress:'sent',holder:'Lena',createDate:'2026-06-05',sentDate:'2026-06-05',dueDate:'',returnDate:'',paperStatus:'已發文',efiled:true,notes:''},
  {id:'seed13',category:'人員名冊',name:'工作人員名冊(美錡林育任、楊月芬2員)',docNo:'MRM-10490817_031.1a',progress:'done',holder:'Lena',createDate:'2026-06-09',sentDate:'2026-06-01',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'准予核定'},
  {id:'seed14',category:'監造報表',name:'0871-0885 監造報表 1150610',docNo:'',progress:'done',holder:'Claire',createDate:'2026-06-10',sentDate:'2026-06-10',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:''},
  {id:'seed15',category:'工安管理',name:'承攬商安全衛生16專卷/現檢員現場工安抽差紀錄抽查表/承攬商作業人員保險投保情形...',docNo:'',progress:'done',holder:'Claire',createDate:'2026-06-10',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'監造主管簽核後的正本在Claire那邊'},
  {id:'seed16',category:'監造報表',name:'0886-0900 監造報表 1150615',docNo:'',progress:'done',holder:'Claire',createDate:'2026-06-15',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'監造主管簽核後的正本在Claire那邊'},
  {id:'seed17',category:'施工抽查',name:'施工抽查 沉沙池模板組立',docNo:'MCCT-10490817_025',progress:'done',holder:'',createDate:'2026-06-24',sentDate:'2026-06-25',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'監造主管簽核後的正本在Claire那邊'},
  {id:'seed18',category:'改善事項',name:'改善通知單 沉砂池外側牆模保護層不足設計值',docNo:'10490817_0006',progress:'processing',holder:'',createDate:'2026-06-24',sentDate:'',dueDate:'',returnDate:'',paperStatus:'',efiled:true,notes:'改善中，第一聯已歸檔'},
  {id:'seed19',category:'材料抽驗',name:'材料抽驗 滅火器',docNo:'EA-1150626',progress:'done',holder:'Claire,Lena',createDate:'2026-06-29',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'監造主管簽核後的正本在Claire那邊'},
  {id:'seed20',category:'改善事項',name:'減碳A標 督導改善對策及結果表 20260522',docNo:'',progress:'sent',holder:'綜施處',createDate:'',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已發文',efiled:true,notes:''},
  {id:'seed21',category:'審查意見',name:'基礎施工計畫B版審查意見/審查重點表',docNo:'SCQPR-10490817_005.2a/SCQPR-10490817_005.2b',progress:'done',holder:'Claire',createDate:'',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'函文跟審查意見電子檔都歸檔了'},
  {id:'seed22',category:'施工抽查',name:'施工抽查 圍籬放樣',docNo:'MCCT-10490817_002',progress:'done',holder:'Claire',createDate:'2026-03-11',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed23',category:'施工抽查',name:'施工抽查 圍籬防溢座尺寸',docNo:'MCCT-10490817_003',progress:'done',holder:'Claire',createDate:'2026-03-11',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed24',category:'施工抽查',name:'施工抽查 洗車台底座模板組立',docNo:'MCCT-10490817_004',progress:'done',holder:'Claire',createDate:'2026-03-27',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed25',category:'材料抽驗',name:'材料抽驗 臨時辦公室材料進場查驗',docNo:'MCCT-10490817_005',progress:'done',holder:'Claire',createDate:'2026-04-20',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed26',category:'施工抽查',name:'施工抽查 工程告示牌尺寸',docNo:'MCCT-10490817_006',progress:'done',holder:'Claire',createDate:'2026-03-25',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed27',category:'材料抽驗',name:'材料抽驗 臨時用水、用電材料',docNo:'MCCT-10490817_007',progress:'done',holder:'Claire',createDate:'2026-04-08',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed28',category:'材料抽驗',name:'材料抽驗 組合屋點焊鋼線網材料',docNo:'MCCT-10490817_008',progress:'done',holder:'Claire',createDate:'2026-04-16',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed29',category:'材料抽驗',name:'材料抽驗 臨時辦公室組合屋C型鋼',docNo:'MCCT-10490817_009',progress:'done',holder:'Claire',createDate:'2026-04-16',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed30',category:'施工抽查',name:'施工抽查 組合屋測量放樣',docNo:'MCCT-10490817_010',progress:'done',holder:'Claire',createDate:'2026-04-10',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed31',category:'材料抽驗',name:'材料抽驗 圍籬大小門',docNo:'MCCT-10490817_011',progress:'done',holder:'Claire',createDate:'2026-03-02',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed32',category:'施工抽查',name:'施工抽查 圍籬柱坑',docNo:'MCCT-10490817_012',progress:'done',holder:'Claire',createDate:'2026-03-02',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed33',category:'施工抽查',name:'施工抽查 工程告示牌挖坑',docNo:'MCCT-10490817_013',progress:'done',holder:'Claire',createDate:'2026-03-03',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed34',category:'材料抽驗',name:'材料抽驗 圍籬防溢座灌漿',docNo:'MCCT-10490817_014',progress:'done',holder:'Claire',createDate:'2026-03-13',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed35',category:'材料抽驗',name:'材料抽驗 圍籬防溢座灌漿',docNo:'MCCT-10490817_015',progress:'done',holder:'Claire',createDate:'2026-03-17',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed36',category:'材料抽驗',name:'材料抽驗 沉砂池鋼筋材料',docNo:'MCCT-10490817_016',progress:'done',holder:'Claire',createDate:'2026-04-08',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed37',category:'施工抽查',name:'施工抽查 混凝土墊層鋪設',docNo:'MCCT-10490817_017',progress:'done',holder:'Claire',createDate:'2026-04-27',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed38',category:'施工抽查',name:'施工抽查 水電系統埋設',docNo:'MCCT-10490817_018',progress:'done',holder:'Claire',createDate:'2026-04-10',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed39',category:'材料抽驗',name:'材料抽驗 告示牌材料',docNo:'MCCT-10490817_019',progress:'done',holder:'Claire',createDate:'2026-04-10',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed40',category:'材料抽驗',name:'材料抽驗 洗車台材料進場查驗',docNo:'MCCT-10490817_020',progress:'done',holder:'Claire',createDate:'2026-04-27',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed41',category:'材料抽驗',name:'材料抽驗 組合屋基礎土台金鋼沙色粉',docNo:'MCCT-10490817_021',progress:'done',holder:'Claire',createDate:'2026-04-17',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed42',category:'施工抽查',name:'施工抽查 沉砂池鋼筋綁紮',docNo:'MCCT-10490817_022',progress:'done',holder:'Claire',createDate:'2026-05-12',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed43',category:'材料抽驗',name:'材料抽驗 沉砂池底板混凝土',docNo:'MCCT-10490817_023',progress:'done',holder:'Claire',createDate:'2026-05-13',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed44',category:'材料抽驗',name:'材料抽驗 甲乙方臨時辦公室天花板、雙面烤漆鋼板',docNo:'MCCT-10490817_024',progress:'done',holder:'Claire',createDate:'2026-05-12',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed45',category:'隨機抽查',name:'隨機抽查 防溢座尺寸',docNo:'RCT-10490817_001',progress:'done',holder:'Claire',createDate:'2026-03-20',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:'電子檔已給廠商'},
  {id:'seed46',category:'審查意見',name:'審查意見表 工廠檢驗及試驗計畫(國內設備-冷卻水系統)A版 signed',docNo:'CPR-10490817_011.1a',progress:'done',holder:'Claire',createDate:'2026-07-07',sentDate:'',dueDate:'',returnDate:'',paperStatus:'已簽核',efiled:true,notes:''},
];

// ── 送審須知筆記 Preload（首次載入的預設筆記內容，使用者可自行編輯/刪除）──
const GUIDE_PRELOAD = [
  {id:'gseed01',title:'① 預定進度表及各項計畫送審期限',content:'工程規範 1.2.1 — 送審期限以甲方簽收日為準，遇假日順延\n\n1. 工作開工報告表 — 甲方指定開工日當天\n2. 設計階段計畫 — 決標日之次日起 30 日曆天內\n3. 設計階段進度表 — 決標日之次日起 30 日曆天內\n4. 總工程預定進度表（含施工網狀圖） — 決標日之次日起 90 日曆天內\n5. 整體施工計畫 — 決標日之次日起 90 日曆天內（依工程會「建築工程施工計畫書製作綱要手冊」編寫）\n6. 整體品質計畫 — 決標日之次日起 90 日曆天內（依工程會「品質計畫製作綱要」編寫）\n7. 環境保護計畫 — 決標日之次日起 90 日曆天內（依工程規範第 01572 章編寫）\n8. 職業安全衛生管理計畫 — 決標日之次日起 90 日曆天內（依工程規範第 01574 章編寫）\n9. 溶劑測試計畫 — 建築許可取得後之次日起 60 日曆天內\n10. 前期評估報告 — 決標日起 90 日曆天內\n11. 模擬平台建立計畫 — 建築許可取得後之次日起 120 日曆天內\n12. 人員訓練計畫 — 試運轉測試前 180 日曆天內\n13. 試運轉及性能測試計畫（含小規模碳捕集廠及其模擬平台） — 試運轉測試前 60 日曆天內',updatedAt:'2026-07-14'},
  {id:'gseed02',title:'② 送審逾期懲罰性違約金',content:'工程規範 1.2.2 — 每件每逾期 1 日曆天，依決標金額層級計算\n\n決標金額　　　　　　　　每日懲罰性違約金\n未達 100 萬元　　　　　　NT$ 500\n100 萬元以上，未達 2,500 萬元　　NT$ 1,500\n2,500 萬元以上，未達 5,000 萬元　　NT$ 3,500\n5,000 萬元以上　　　　　　NT$ 5,000\n\n💡 逾規定期限（含逾再次提送期限者）皆計罰。違約金總額上限為契約詳細價目表「文件、紀錄管制費用」項目金額之 2 倍。',updatedAt:'2026-07-14'},
  {id:'gseed03',title:'③ 審查結果與修正規則',content:'工程規範 1.2.6 — 送審資料經審查後蓋印下列其中一種結果章\n\n✅ 准予核定：乙方接獲後即可據以製造或施工；如有加註處，需依加註內容修正部分後施工。\n\n🟡 修正後核定：同樣可據以施工，但須按審查意見完成加註之修正事項。\n\n🔴 退回修正：須依審查意見修正，於 21 日曆天內依規定份數重新送審；修正處須明顯標出並註明版次、日期。\n\n💡 未經「准予核定」前，乙方如已自行製造或施工，其耗用之工料由乙方自行負責，仍須重新修訂並經核定後方可繼續。\n送審資料如退回修正達 2 次以上，乙方得請求甲方召開會審會議。',updatedAt:'2026-07-14'},
  {id:'gseed04',title:'④ 三類文件審查作業流程',content:'附表 1/3～3/3 — 依文件類型分由不同單位擔任「主審單位」並用印「核定」章\n\n附表(1/3) 設計文件審查流程（細部設計圖說、規範等設計階段文件；主審：營建處）\n乙方送審（正本＋副本） → 主審：營建處審查（副本會辦：綜合施工處／委外監造廠商） → 用印：加蓋「核定」簽章 → 分發：函送各單位＋雲端（綜合施工處／委外監造廠商／台中電廠、綜合研究所視需要）\n・准予核定 → 乙方可據以施工，副本分送相關單位存查。\n・退回修正 → 乙方 21 天內修正後依原份數重新送審。\n\n附表(2/3) 施工文件審查流程（施工計畫書、品質計畫書、詳細價目表、進度表等；主審：綜合施工處）\n乙方送審（正本＋副本） → 主審：綜合施工處審查（副本會辦：委外監造廠商） → 用印：加蓋「核定」簽章 → 分發：函送各單位＋雲端（營建處／綜合研究所／台中電廠視需要）\n・准予核定 → 乙方可據以施工。\n・退回修正 → 乙方 21 天內修正後依原份數重新送審。\n\n附表(3/3) 測試／研究文件審查流程（試運轉、性能測試、訓練計畫等；主審：綜合研究所）\n乙方送審（正本＋副本） → 主審：綜合研究所審查（副本會辦：委外監造廠商／營建處） → 用印：加蓋「核定」簽章 → 分發：函送各單位＋雲端\n・准予核定 → 乙方可據以施工／測試。\n・退回修正 → 乙方 21 天內修正後依原份數重新送審。',updatedAt:'2026-07-14'},
  {id:'gseed05',title:'⑤ 各項資料送交單位及份數',content:'工程規範 1.2.4 — 共 37 項；所有設計階段文件送交時均須另附 PDF 電子檔光碟一份\n\n1. 設計階段計畫\n    送交：營建處 5份(正本)、綜合施工處 3份(副本)、委外監造廠商 1份(副本)、綜合研究所 1份(副本)\n    主審／函覆單位：營建處（合約一）\n\n2. 設計階段進度表\n    送交：營建處 5份(正本)、綜合施工處 3份(副本)、委外監造廠商 1份(副本)、綜合研究所 1份(副本)\n    主審／函覆單位：營建處（合約一）\n\n3. 建築相關設計圖、碳捕集廠細部設計圖面\n    送交：營建處 5份(正本)、綜合施工處 3份(副本)、委外監造廠商 1份(副本)、綜合研究所 1份(副本)\n    主審／函覆單位：營建處（合約一）\n\n4. 結構計算書\n    送交：營建處 3份(正本)、綜合施工處 1份(副本)、委外監造廠商 1份(副本)、綜合研究所 1份(副本)\n    主審／函覆單位：營建處（合約一）\n\n5. 風險評估報告書\n    送交：委外監造廠商 1份(正本)、綜合施工處 3份(副本)、營建處 3份(副本)\n    主審／函覆單位：委外監造廠商（合約一）\n\n6. 地質鑽探施工計畫\n    送交：營建處 3份(正本)、綜合施工處 3份(副本)、委外監造廠商 1份(副本)\n    主審／函覆單位：營建處（合約一）\n\n7. 測量及地質調查（鑽探）報告書\n    送交：營建處 3份(正本)、綜合施工處 3份(副本)、委外監造廠商 1份(副本)\n    主審／函覆單位：營建處（合約一）\n\n8. 地質承載力評估報告書\n    送交：營建處 3份(正本)、綜合施工處 3份(副本)、委外監造廠商 1份(副本)\n    主審／函覆單位：營建處（合約一）\n\n9. 詳細價目表\n    送交：委外監造廠商 1份(正本)、綜合施工處 3份(正本)、營建處 3份(副本)\n    主審／函覆單位：委外監造廠商（合約一）\n\n10. 施工預定進度表（含施工網狀圖）\n    送交：委外監造廠商 1份(正本)、綜合施工處 6份(正本)、綜合研究所 1份(副本)\n    主審／函覆單位：委外監造廠商（合約一）\n\n11. 整體施工計畫\n    送交：委外監造廠商 1份(正本)、綜合施工處 6份(正本)\n    主審／函覆單位：委外監造廠商（合約一）\n\n12. 整體品質計畫\n    送交：委外監造廠商 1份(正本)、綜合施工處 6份(正本)\n    主審／函覆單位：委外監造廠商（合約一）\n\n13. 環境保護計畫\n    送交：委外監造廠商 1份(正本)、綜合施工處 6份(正本)\n    主審／函覆單位：委外監造廠商（合約一）\n\n14. 職業安全衛生管理計畫\n    送交：委外監造廠商 1份(正本)、綜合施工處 6份(正本)\n    主審／函覆單位：委外監造廠商（合約一）\n\n15. 分項施工計畫\n    送交：委外監造廠商 1份(正本)、綜合施工處 6份(正本)\n    主審／函覆單位：委外監造廠商（合約一）\n\n16. 前期評估報告\n    送交：綜合研究所 2份(正本)、綜合施工處 3份(副本)、委外監造廠商 1份(副本)、營建處 1份(副本)\n    主審／函覆單位：綜合研究所（合約一）\n\n17. 材料/設備送審資料\n    送交：委外監造廠商 1份(正本)、綜合研究所 3份(正本)、綜合施工處 2份(副本)、營建處 1份(副本)\n    主審／函覆單位：委外監造廠商（合約一）\n\n18. 工作月報\n    送交：委外監造廠商 1份(正本)、綜合施工處 3份(副本)、營建處 1份(副本)\n    主審／函覆單位：委外監造廠商（合約一、二）\n\n19. 施工日誌\n    送交：委外監造廠商 1份(正本)、綜合施工處 3份(副本)\n    主審／函覆單位：委外監造廠商（合約一、二）\n\n20. 工廠檢驗及試驗計畫\n    送交：委外監造廠商 1份(正本)、綜合施工處 3份(副本)、綜合研究所 2份(副本)、營建處 1份(副本)\n    主審／函覆單位：委外監造廠商（合約一）\n\n21. 營建工地逕流廢水削減計畫\n    送交：委外監造廠商 1份(正本)、綜合施工處 3份(副本)、營建處 3份(副本)、綜合研究所 1份(副本)\n    主審／函覆單位：委外監造廠商（合約一）\n\n22. 吊裝計畫\n    送交：委外監造廠商 1份(正本)、綜合施工處 3份(副本)、營建處 3份(副本)、綜合研究所 1份(副本)\n    主審／函覆單位：委外監造廠商（合約一）\n\n23. 定期（預防性）保養計畫及表單程序書\n    送交：委外監造廠商 1份(正本)、綜合施工處 3份(副本)、營建處 1份(副本)、台中電廠 3份(副本)、綜合研究所 1份(副本)、光碟 9份\n    主審／函覆單位：委外監造廠商（合約二）\n\n24. 色彩計畫\n    送交：營建處 3份(正本)、綜合施工處 3份(副本)、委外監造廠商 1份(副本)、綜合研究所 1份(副本)、台中發電廠 1份(副本)\n    主審／函覆單位：營建處（合約一）\n\n25. 模擬平台建立計畫\n    送交：綜合研究所 1份(正本)、營建處 1份(副本)、綜合施工處 1份(副本)、委外監造廠商 1份(副本)\n    主審／函覆單位：綜合研究所（合約一）\n\n26. 試運轉及性能測試計畫\n    送交：綜合研究所 1份(正本)、營建處 1份(副本)、綜合施工處 5份(副本)、委外監造廠商 1份(副本)、台中電廠 3份(副本)\n    主審／函覆單位：綜合研究所（合約一）\n\n27. 竣工圖（含認可圖面、資料及計算書彙整、運轉操作及維護手冊）\n    送交：委外監造廠商 1份(正本)、綜合施工處 5份(正本)、營建處 1份(副本)、台中電廠 3份(副本)、綜合研究所 1份(副本)、光碟 11份\n    主審／函覆單位：委外監造廠商（合約一、二）\n\n28. 性能測試結果報告\n    送交：綜合研究所 2份(正本)、營建處 1份(副本)、綜合施工處 1份(副本)、委外監造廠商 1份(副本)、台中電廠 2份(副本)\n    主審／函覆單位：綜合研究所（合約一）\n\n29. BIM 工作執行計畫書、BIM 竣工模型、成果報告書及簡報\n    送交：營建處 4份(正本)、綜合施工處 3份(副本)、委外監造廠商 1份(副本)、綜合研究所 1份(副本)、台中發電廠 1份(副本)\n    主審／函覆單位：營建處（合約一）\n\n30. 溶劑測試計畫\n    送交：綜合研究所 3份(正本)、營建處 1份(副本)、綜合施工處 1份(副本)、委外監造廠商 1份(副本)\n    主審／函覆單位：綜合研究所（合約一）\n\n31. 人員訓練計畫\n    送交：綜合研究所 2份(正本)、營建處 1份(副本)、台中電廠 2份(副本)、綜合施工處 1份(副本)、委外監造廠商 1份(副本)\n    主審／函覆單位：綜合研究所（合約一）\n\n32. 各項測試報告（長期溶劑測試、參數測試、溶劑壓力測試、負載跟隨試驗）\n    送交：綜合研究所 3份(正本)\n    主審／函覆單位：綜合研究所（合約二）\n\n33. 第一年度測試結果報告\n    送交：綜合研究所 3份(正本)、營建處 1份(副本)\n    主審／函覆單位：綜合研究所（合約二）\n\n34. 教展中心細部設計圖說（含細部設計圖面、設備規格及多媒體影音設計）\n    送交：綜合研究所 3份(正本)、營建處 1份(副本)、台中電廠 1份(副本)\n    主審／函覆單位：綜合研究所（合約二）\n\n35. 兩年測試結果報告（含測試數據、品保品管紀錄、操作維修手冊、訓練紀錄等）\n    送交：綜合研究所 2份(正本)、營建處 1份(副本)、台中電廠 2份(副本)\n    主審／函覆單位：綜合研究所（合約二）\n\n36. 測試比對報告（與至少 1 個國際同規模碳捕集廠比對）\n    送交：綜合研究所 3份(正本)\n    主審／函覆單位：綜合研究所（合約二）\n\n37. 測試日報／測試月報／測試年報\n    送交：綜合研究所 3份(正本)\n    主審／函覆單位：綜合研究所（合約二）',updatedAt:'2026-07-14'},
  {id:'gseed06',title:'⑥ 送審文件封面標示與版次規則',content:'工程規範 1.2.7、1.3.6、1.3.7\n\n封面應註明：\n・本案名稱\n・資料名稱\n・送審日期\n・送審版次（第 1 次送審為 A 版，核定後為 0 版）\n\n次頁應註明：\n・承攬商名稱\n・技師、工地主任及相關人員簽名欄\n\n💡 版次規則：第一次送審為 A 版；如退回修正，依序編為 B 版、C 版…；審查無需修正者，可核蓋「核定修正為 0 版」直接進版為 0 版（核定版）。\n核定後如仍需配合變更再送審，依序編為 1 版、2 版…，並依原程序辦理審查及核定。',updatedAt:'2026-07-14'},
  {id:'gseed07',title:'⑦ 送審圖資格式規定',content:'工程規範 1.3.5\n\n・圖面尺寸：除甲方另行認可外，須為 A1 及其 A3 縮圖；報告與紀錄文件須為 A4 或 A3。\n・檔案格式：設計圖面為 CAD 檔；計畫書、計算書、操作手冊等為 WORD 可編輯格式；型錄或原廠文件可為 PDF（色彩同原件）。\n・所有文件須以中文提供，特殊技術或材料圖文資料得使用英文。\n・設計圖須由執業技師／建築師本人逐張簽署並加蓋執業圖記。\n・結構計算書須由技師本人於封面或首頁簽署並加蓋執業圖記，全份裝訂成冊、編目錄頁碼並加蓋騎縫章。\n・竣工圖資電子檔（CAD／WORD／PDF）光碟片 9 份送甲方。',updatedAt:'2026-07-14'},
  {id:'gseed08',title:'⑧ 工作月報應載明事項',content:'工程規範 1.3.11 — 自開工日之當月即開始按月填寫至竣工當月止\n\n・本月份工作進度：整體及分項工作進度（%）及累進進度（%）\n・洽辦事項一覽表（含辦理情形、結論及建議）\n・本月份工作說明：設計、備料、加工、製造、試驗及現場施工安裝情形\n・安全衛生及環保工作等事項之管理措施與辦理情形\n・本月份工作會議重要決議事項\n・下個月工作進度：預定項目及進度（%）\n・送審資料進度、情況（含已送審、退回修正、認可）及雙方來往文件一覽表\n・本月份施工及檢（試）驗照片（500 萬像素以上，竣工後 10 日曆天內彙總燒錄光碟）\n・施工階段進度表（以 A3 規格列印，每月更新）\n・本月份檢驗進度、檢驗報告（含不符合部分之因應措施）\n・材料設備送審／檢（試）驗管制總表\n・下個月檢驗進度',updatedAt:'2026-07-14'},
  {id:'gseed09',title:'⑨ 施工日誌填寫重點',content:'工程規範 1.3.13\n\n・自開工日起每日按實填寫至竣工當日止，由工地負責人簽名\n・應於次日送甲方現場檢驗員簽章（假日、休息日得順延），簽章後一份送還乙方\n・應註明進場材料規格與數量、每日完成工作數量，作為估驗付款依據\n・甲方如有不同意見或記載出入，乙方應即澄清或更正並留存正式資料\n・影響工作進度情事須於當日日誌詳載；日誌未送達或未記載者，甲方得拒絕核延工期',updatedAt:'2026-07-14'},
];

// ── 收發函文 Preload（由使用者原始 Excel 收發文登錄一覽表匯入）──
const CORR_PRELOAD = [
{id:'corr001',direction:'in',docNo:'碳集字第112122701號',urgency:'普通件',issueDate:'2023-12-27',receiveDate:'2023-12-27',unit:'碳集應用',subject:'檢送開工報告表及相關資料',signedBy:'高君銓',notes:'含品管人員登錄表等'},
{id:'corr002',direction:'out',docNo:'DNV-86321005-0001',urgency:'普通件',issueDate:'2024-01-02',receiveDate:'',unit:'DNV',subject:'附送監造計畫(草案)',signedBy:'',notes:'依業主建議先行提送草案，以利廠商準備相關計畫文件'},
{id:'corr003',direction:'out',docNo:'DNV-86321005-0002',urgency:'普通件',issueDate:'2024-01-02',receiveDate:'',unit:'DNV',subject:'檢還開工報告表等資料',signedBy:'',notes:'退回修正'},
{id:'corr004',direction:'in',docNo:'碳集字第113011501號',urgency:'普通件',issueDate:'2024-01-15',receiveDate:'2024-01-16',unit:'碳集應用',subject:'檢送設計相關計畫A版',signedBy:'高君銓',notes:'含設計階段計畫、設計簽證執行計畫及設計階段進度表'},
{id:'corr005',direction:'in',docNo:'碳集字第113011801號',urgency:'普通件',issueDate:'2024-01-18',receiveDate:'2024-01-19',unit:'碳集應用',subject:'廠商檢送開工報告表及相關資料修正',signedBy:'高君銓',notes:''},
{id:'corr006',direction:'in',docNo:'碳集字第113012902號',urgency:'普通件',issueDate:'2024-01-29',receiveDate:'2024-01-30',unit:'碳集應用',subject:'廠商檢送地質鑽探施工計畫書',signedBy:'高君銓',notes:''},
{id:'corr007',direction:'in',docNo:'建字第1130540481號',urgency:'普通件',issueDate:'2024-01-30',receiveDate:'2024-01-31',unit:'營建處',subject:'退回修正碳集字第113011501號',signedBy:'',notes:'設計階段計畫A版設計簽證執行計畫A版及設計階段進度表A版'},
{id:'corr008',direction:'out',docNo:'86321005-0016',urgency:'普通件',issueDate:'2024-01-31',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送之開工文件審查結果',signedBy:'',notes:'包含開工報告表及品管人員登錄表，無意見'},
{id:'corr009',direction:'in',docNo:'綜工字第1123190554號',urgency:'普通件',issueDate:'2024-02-05',receiveDate:'2024-02-06',unit:'綜施處',subject:'監造開工報告表准予核定',signedBy:'高君銓',notes:''},
{id:'corr010',direction:'in',docNo:'碳集字第113020601號',urgency:'普通件',issueDate:'2024-02-06',receiveDate:'2024-02-15',unit:'碳集應用',subject:'工作人員名冊',signedBy:'高君銓',notes:''},
{id:'corr011',direction:'in',docNo:'碳集字第113020602號',urgency:'普通件',issueDate:'2024-02-06',receiveDate:'2024-02-15',unit:'碳集應用',subject:'設計簽證執行計畫(B版)',signedBy:'高君銓',notes:''},
{id:'corr012',direction:'in',docNo:'建字第1130540862號',urgency:'普通件',issueDate:'2024-02-16',receiveDate:'',unit:'營建處',subject:'地質鑽探施工計劃書退回修正',signedBy:'',notes:'退回修正'},
{id:'corr013',direction:'in',docNo:'碳集字第113021602號',urgency:'普通件',issueDate:'2024-02-16',receiveDate:'2024-02-19',unit:'碳集應用',subject:'設計階段進度表(B版)',signedBy:'高君銓',notes:''},
{id:'corr014',direction:'in',docNo:'碳集字第113021603號',urgency:'普通件',issueDate:'2024-02-16',receiveDate:'2024-02-19',unit:'碳集應用',subject:'設計階段計畫(B版)',signedBy:'高君銓',notes:''},
{id:'corr015',direction:'out',docNo:'DNV-86321005-0003',urgency:'普通件',issueDate:'2024-02-19',receiveDate:'',unit:'DNV',subject:'檢還工作人員名冊',signedBy:'',notes:'修正後核定'},
{id:'corr016',direction:'in',docNo:'碳集字第113021901號',urgency:'普通件',issueDate:'2024-02-19',receiveDate:'2024-02-20',unit:'碳集應用',subject:'施工日誌',signedBy:'高君銓',notes:'112年12月及113年1月'},
{id:'corr017',direction:'in',docNo:'碳集字第113021902號',urgency:'普通件',issueDate:'2024-02-19',receiveDate:'2024-02-20',unit:'碳集應用',subject:'工作月報',signedBy:'高君銓',notes:'112年12月及113年1月'},
{id:'corr018',direction:'in',docNo:'碳集字第113022201號',urgency:'普通件',issueDate:'2024-02-22',receiveDate:'2024-02-26',unit:'碳集應用',subject:'檢送工作人員名冊(修)',signedBy:'黃品瑄',notes:''},
{id:'corr019',direction:'out',docNo:'86321005-0018',urgency:'普通件',issueDate:'2024-02-26',receiveDate:'',unit:'DNV',subject:'檢送監造人員名冊',signedBy:'',notes:''},
{id:'corr020',direction:'out',docNo:'86321005-0019',urgency:'普通件',issueDate:'2024-02-27',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送之人員名冊審查結果',signedBy:'',notes:''},
{id:'corr021',direction:'out',docNo:'DNV-86321005-0004',urgency:'普通件',issueDate:'2024-02-29',receiveDate:'',unit:'DNV',subject:'函送工作月報審查意見',signedBy:'',notes:''},
{id:'corr022',direction:'in',docNo:'碳集字第113022701號',urgency:'普通件',issueDate:'2024-02-27',receiveDate:'2024-02-29',unit:'碳集應用',subject:'檢送環境保護計畫(A版)',signedBy:'高君銓',notes:''},
{id:'corr023',direction:'in',docNo:'碳集字第113030101號',urgency:'普通件',issueDate:'2024-03-01',receiveDate:'2024-03-04',unit:'碳集應用',subject:'檢送地質鑽探施工計畫書(B版)',signedBy:'高君銓',notes:''},
{id:'corr024',direction:'in',docNo:'碳集字第113030102號',urgency:'普通件',issueDate:'2024-03-01',receiveDate:'2024-03-04',unit:'碳集應用',subject:'檢送整體施工計畫書(A版)',signedBy:'高君銓',notes:''},
{id:'corr025',direction:'in',docNo:'建字第1130542181號',urgency:'普通件',issueDate:'2024-03-01',receiveDate:'2024-03-05',unit:'營建處',subject:'(副本)廠商設計簽證執行計畫准予備查',signedBy:'高君銓',notes:''},
{id:'corr026',direction:'in',docNo:'碳集字第113030401號',urgency:'普通件',issueDate:'2024-03-04',receiveDate:'2024-03-05',unit:'碳集應用',subject:'工作人員名冊',signedBy:'高君銓',notes:''},
{id:'corr027',direction:'in',docNo:'碳集字第113030402號',urgency:'普通件',issueDate:'2024-03-04',receiveDate:'2024-03-05',unit:'碳集應用',subject:'113年2月工作月報',signedBy:'高君銓',notes:''},
{id:'corr028',direction:'out',docNo:'DNV-86321005-0005',urgency:'普通件',issueDate:'2024-03-07',receiveDate:'',unit:'DNV',subject:'檢還工作人員名冊_朝陽科大+瑞川量測',signedBy:'',notes:'退回修正'},
{id:'corr029',direction:'in',docNo:'綜工字第1133181038號',urgency:'普通件',issueDate:'2024-03-06',receiveDate:'2024-03-08',unit:'綜施處',subject:'廠商工作開工報告表准予核定',signedBy:'高君銓',notes:''},
{id:'corr030',direction:'in',docNo:'建字第1130542307號',urgency:'普通件',issueDate:'2024-03-06',receiveDate:'2024-03-08',unit:'營建處',subject:'設計階段進度表(B版)',signedBy:'高君銓',notes:'退回修正'},
{id:'corr031',direction:'in',docNo:'建字第1130542308號',urgency:'普通件',issueDate:'2024-03-06',receiveDate:'2024-03-08',unit:'營建處',subject:'設計階段計畫(B版)',signedBy:'高君銓',notes:'退回修正'},
{id:'corr032',direction:'in',docNo:'碳集字第113030801號',urgency:'普通件',issueDate:'2024-03-08',receiveDate:'2024-03-11',unit:'碳集應用',subject:'職業安全衛生計畫A版',signedBy:'高君銓',notes:''},
{id:'corr033',direction:'in',docNo:'碳集字第113030802號',urgency:'普通件',issueDate:'2024-03-08',receiveDate:'2024-03-11',unit:'碳集應用',subject:'朝陽科大+瑞川量測工作人員名冊修正版',signedBy:'高君銓',notes:''},
{id:'corr034',direction:'in',docNo:'碳集字第113030803號',urgency:'普通件',issueDate:'2024-03-08',receiveDate:'2024-03-11',unit:'碳集應用',subject:'和協工作人員名冊',signedBy:'高君銓',notes:''},
{id:'corr035',direction:'out',docNo:'DNV-86321005-0006',urgency:'普通件',issueDate:'2024-03-11',receiveDate:'',unit:'DNV',subject:'檢還環境保護計畫A版',signedBy:'',notes:'退回修正'},
{id:'corr036',direction:'out',docNo:'DNV-86321005-0008',urgency:'普通件',issueDate:'2024-03-12',receiveDate:'',unit:'DNV',subject:'檢還整體施工計畫A版',signedBy:'',notes:'退回修正'},
{id:'corr037',direction:'in',docNo:'碳集字第113031101號',urgency:'普通件',issueDate:'2024-03-11',receiveDate:'2024-03-13',unit:'碳集應用',subject:'前期評估報告A版',signedBy:'高君銓',notes:''},
{id:'corr038',direction:'in',docNo:'建字第1130542656號',urgency:'普通件',issueDate:'2024-03-14',receiveDate:'2024-03-15',unit:'營建處',subject:'廠商地質鑽探施工計畫B版修正後認可',signedBy:'高君銓',notes:'修正後認可'},
{id:'corr039',direction:'in',docNo:'碳集字第113031401號',urgency:'普通件',issueDate:'2024-03-14',receiveDate:'2024-03-15',unit:'碳集應用',subject:'整體品質計畫A版',signedBy:'高君銓',notes:''},
{id:'corr040',direction:'in',docNo:'碳集字第113031402號',urgency:'普通件',issueDate:'2024-03-14',receiveDate:'2024-03-15',unit:'碳集應用',subject:'總工程預定進度表(含施工網狀圖)A版',signedBy:'高君銓',notes:''},
{id:'corr041',direction:'in',docNo:'綜工字第1138032416號',urgency:'普通件',issueDate:'2024-03-14',receiveDate:'2024-03-15',unit:'綜施處',subject:'第一次工程推動檢討暨工安、環保、政風宣導會議紀錄',signedBy:'高君銓',notes:''},
{id:'corr042',direction:'in',docNo:'綜工字第1138032721號',urgency:'普通件',issueDate:'2024-03-19',receiveDate:'2024-03-20',unit:'綜施處',subject:'第一次工程界面現勘暨共同協議組織會議',signedBy:'高君銓',notes:''},
{id:'corr043',direction:'out',docNo:'DNV-86321005-0009',urgency:'普通件',issueDate:'2024-03-20',receiveDate:'',unit:'DNV',subject:'工作月報審查意見',signedBy:'',notes:''},
{id:'corr044',direction:'in',docNo:'碳集字第113032001號',urgency:'普通件',issueDate:'2024-03-20',receiveDate:'2024-03-21',unit:'碳集應用',subject:'設計階段進度表C版',signedBy:'高君銓',notes:''},
{id:'corr045',direction:'in',docNo:'碳集字第113032002號',urgency:'普通件',issueDate:'2024-03-20',receiveDate:'2024-03-21',unit:'碳集應用',subject:'設計階段計畫C版',signedBy:'高君銓',notes:''},
{id:'corr046',direction:'out',docNo:'DNV-86321005-0010',urgency:'普通件',issueDate:'2024-03-21',receiveDate:'',unit:'DNV',subject:'檢還安衛計畫A版',signedBy:'',notes:'退回修正'},
{id:'corr047',direction:'in',docNo:'碳集字第113032101號',urgency:'普通件',issueDate:'2024-03-21',receiveDate:'2024-03-22',unit:'碳集應用',subject:'承攬廠商例假日施工申請',signedBy:'高君銓',notes:''},
{id:'corr048',direction:'out',docNo:'DNV-86321005-0011',urgency:'普通件',issueDate:'2024-03-22',receiveDate:'',unit:'DNV',subject:'檢還總工程預定進度表',signedBy:'',notes:'修正後核定'},
{id:'corr049',direction:'in',docNo:'碳集字第113032701號',urgency:'普通件',issueDate:'2024-03-27',receiveDate:'2024-03-28',unit:'碳集應用',subject:'環境保護計畫B版',signedBy:'高君銓',notes:''},
{id:'corr050',direction:'in',docNo:'碳集字第113032801號',urgency:'普通件',issueDate:'2024-03-28',receiveDate:'2024-04-01',unit:'碳集應用',subject:'檢送整體施工計畫B版',signedBy:'高君銓',notes:''},
{id:'corr051',direction:'in',docNo:'碳集字第113032803號',urgency:'普通件',issueDate:'2024-03-28',receiveDate:'2024-04-01',unit:'碳集應用',subject:'更換工地負責人',signedBy:'高君銓',notes:''},
{id:'corr052',direction:'in',docNo:'碳集字第113032802號',urgency:'普通件',issueDate:'2024-03-28',receiveDate:'2024-04-01',unit:'碳集應用',subject:'檢送地質鑽探計畫C版',signedBy:'高君銓',notes:''},
{id:'corr053',direction:'out',docNo:'DNV-86321005-0012',urgency:'普通件',issueDate:'2024-03-29',receiveDate:'',unit:'DNV',subject:'檢還整體品質計畫A版',signedBy:'',notes:'退回修正'},
{id:'corr054',direction:'in',docNo:'建字第1130543278號',urgency:'普通件',issueDate:'2024-03-28',receiveDate:'2024-04-01',unit:'營建處',subject:'設計階段進度表C版准予備查',signedBy:'高君銓',notes:''},
{id:'corr055',direction:'out',docNo:'DNV-86321005-0013',urgency:'普通件',issueDate:'2024-04-01',receiveDate:'',unit:'DNV',subject:'總工程預定進度表A版審查意見更新',signedBy:'',notes:'退回修正'},
{id:'corr056',direction:'in',docNo:'建字第1130543567號',urgency:'普通件',issueDate:'2024-04-02',receiveDate:'2024-04-02',unit:'營建處',subject:'地質鑽探施工計畫C版認可',signedBy:'高君銓',notes:'電子公文'},
{id:'corr057',direction:'in',docNo:'建字第1130543276號',urgency:'普通件',issueDate:'2024-04-01',receiveDate:'2024-04-03',unit:'營建處',subject:'設計階段計畫C版准予備查',signedBy:'高君銓',notes:''},
{id:'corr058',direction:'in',docNo:'碳集字第113040201號',urgency:'普通件',issueDate:'2024-04-02',receiveDate:'2024-04-03',unit:'碳集應用',subject:'113年3月工作月報',signedBy:'高君銓',notes:''},
{id:'corr059',direction:'in',docNo:'碳集字第113040301號',urgency:'普通件',issueDate:'2024-04-03',receiveDate:'2024-04-08',unit:'碳集應用',subject:'職安衛管理計畫B版',signedBy:'高君銓',notes:''},
{id:'corr060',direction:'out',docNo:'DNV-86321005-0015',urgency:'普通件',issueDate:'2024-04-11',receiveDate:'',unit:'DNV',subject:'檢還環境保護計畫B版',signedBy:'',notes:'退回修正'},
{id:'corr061',direction:'out',docNo:'DNV-86321005-0016',urgency:'普通件',issueDate:'2024-04-11',receiveDate:'',unit:'DNV',subject:'檢還整體施工計畫B版',signedBy:'',notes:'退回修正'},
{id:'corr062',direction:'in',docNo:'綜工字第1138044924號',urgency:'普通件',issueDate:'2024-04-17',receiveDate:'2024-04-18',unit:'綜施處',subject:'第一次工程界面現勘決議圖資資料',signedBy:'高君銓',notes:''},
{id:'corr063',direction:'in',docNo:'碳集字第113041601號',urgency:'普通件',issueDate:'2024-04-16',receiveDate:'2024-04-18',unit:'碳集應用',subject:'檢送總工程預定進度表B版',signedBy:'高君銓',notes:''},
{id:'corr064',direction:'in',docNo:'碳集字第113041602號',urgency:'普通件',issueDate:'2024-04-16',receiveDate:'2024-04-18',unit:'碳集應用',subject:'檢送整體品質計畫B版',signedBy:'高君銓',notes:''},
{id:'corr065',direction:'in',docNo:'碳集字第113041702號',urgency:'普通件',issueDate:'2024-04-17',receiveDate:'2024-04-19',unit:'碳集應用',subject:'檢送前期評估報告B版',signedBy:'黃惠君',notes:''},
{id:'corr066',direction:'in',docNo:'碳集字第113041902號',urgency:'普通件',issueDate:'2024-04-19',receiveDate:'2024-04-22',unit:'碳集應用',subject:'新增工負2名及工安1名代理人',signedBy:'黃惠君',notes:'副本DNV'},
{id:'corr067',direction:'in',docNo:'綜工字第1133183171號',urgency:'普通件',issueDate:'2024-04-22',receiveDate:'2024-04-23',unit:'綜施處',subject:'新增監造人員2名',signedBy:'黃惠君',notes:'張韋珹及林幸一'},
{id:'corr068',direction:'in',docNo:'碳集字第113042401號',urgency:'普通件',issueDate:'2024-04-24',receiveDate:'2024-04-25',unit:'碳集應用',subject:'檢送環境保護計畫C版',signedBy:'黃惠君',notes:''},
{id:'corr069',direction:'out',docNo:'DNV-86321005-0018',urgency:'普通件',issueDate:'2024-04-24',receiveDate:'',unit:'DNV',subject:'檢還職安衛計畫B版',signedBy:'',notes:'退回修正'},
{id:'corr070',direction:'in',docNo:'碳集字第113042301號',urgency:'普通件',issueDate:'2024-04-23',receiveDate:'2024-04-25',unit:'碳集應用',subject:'工作人員名冊',signedBy:'黃惠君',notes:''},
{id:'corr071',direction:'in',docNo:'碳集字第113042901號',urgency:'普通件',issueDate:'2024-04-29',receiveDate:'2024-04-30',unit:'碳集應用',subject:'檢送整體施工計畫C版',signedBy:'黃惠君',notes:''},
{id:'corr072',direction:'out',docNo:'DNV-86321005-0019',urgency:'普通件',issueDate:'2024-04-29',receiveDate:'',unit:'DNV',subject:'檢還總工程預定進度表B版',signedBy:'',notes:'退回修正'},
{id:'corr073',direction:'in',docNo:'碳集字第113050701號',urgency:'普通件',issueDate:'2024-05-07',receiveDate:'2024-05-08',unit:'碳集應用',subject:'113年4月工作月報',signedBy:'',notes:''},
{id:'corr074',direction:'in',docNo:'綜工字第1133183398號',urgency:'普通件',issueDate:'2024-05-10',receiveDate:'2024-05-13',unit:'綜施處',subject:'同意備查碳集代理人',signedBy:'高君銓',notes:''},
{id:'corr075',direction:'in',docNo:'碳集字第113051001號',urgency:'普通件',issueDate:'2024-05-10',receiveDate:'2024-05-13',unit:'碳集應用',subject:'檢送職安衛管理計畫C版',signedBy:'高君銓',notes:''},
{id:'corr076',direction:'in',docNo:'研字第1138057662號',urgency:'普通件',issueDate:'2024-05-13',receiveDate:'2024-05-15',unit:'碳集應用',subject:'前期評估報告B版審查意見',signedBy:'',notes:'沒副本給DNV'},
{id:'corr077',direction:'out',docNo:'86321005-0025',urgency:'普通件',issueDate:'2024-05-16',receiveDate:'',unit:'DNV',subject:'有關環境保護計畫C版審查結果',signedBy:'',notes:'送施工處核定'},
{id:'corr078',direction:'out',docNo:'86321005-0021',urgency:'普通件',issueDate:'2024-05-16',receiveDate:'',unit:'DNV',subject:'檢還整體品質計畫B版',signedBy:'',notes:'退回修正'},
{id:'corr079',direction:'out',docNo:'86321005-0026',urgency:'普通件',issueDate:'2024-05-17',receiveDate:'',unit:'DNV',subject:'有關整體施工計畫C版審查結果',signedBy:'',notes:'送施工處核定'},
{id:'corr080',direction:'out',docNo:'86321005-0027',urgency:'普通件',issueDate:'2024-05-17',receiveDate:'',unit:'DNV',subject:'5月份第1次定期協調會會議紀錄',signedBy:'',notes:''},
{id:'corr081',direction:'out',docNo:'86321005-0028',urgency:'普通件',issueDate:'2024-05-17',receiveDate:'',unit:'DNV',subject:'有關職安衛計畫C版審查結果',signedBy:'',notes:'送施工處核定'},
{id:'corr082',direction:'in',docNo:'綜工字第1138062901號',urgency:'普通件',issueDate:'2024-05-21',receiveDate:'2024-05-22',unit:'綜施處',subject:'保密協議討論會議紀錄',signedBy:'高君銓',notes:''},
{id:'corr083',direction:'in',docNo:'碳集字第113051601號',urgency:'普通件',issueDate:'2024-05-16',receiveDate:'2024-05-17',unit:'碳集應用',subject:'總工程預定進度表C版',signedBy:'高君銓',notes:''},
{id:'corr084',direction:'out',docNo:'DNV-86321005-0022',urgency:'普通件',issueDate:'2024-05-23',receiveDate:'',unit:'DNV',subject:'檢送113年4月工作月報審查意見',signedBy:'',notes:''},
{id:'corr085',direction:'in',docNo:'碳集字第113052701號',urgency:'普通件',issueDate:'2024-05-27',receiveDate:'2024-05-28',unit:'碳集應用',subject:'檢送前期評估報告C版',signedBy:'高君銓',notes:''},
{id:'corr086',direction:'in',docNo:'碳集字第113052801號',urgency:'普通件',issueDate:'2024-05-28',receiveDate:'2024-05-29',unit:'碳集應用',subject:'檢送工作人員名冊(修)',signedBy:'高君銓',notes:''},
{id:'corr087',direction:'in',docNo:'綜工字第1133184559號',urgency:'普通件',issueDate:'2024-05-29',receiveDate:'2024-05-30',unit:'綜施處',subject:'整體施工計畫0版核定',signedBy:'高君銓',notes:''},
{id:'corr088',direction:'in',docNo:'綜工字第1138067583號',urgency:'普通件',issueDate:'2024-05-29',receiveDate:'2024-05-30',unit:'綜施處',subject:'開會通知-第二次界面現勘討論會議',signedBy:'高君銓',notes:'6/5 10:15 中火'},
{id:'corr089',direction:'in',docNo:'碳集字第113052901號',urgency:'普通件',issueDate:'2024-05-29',receiveDate:'2024-05-30',unit:'碳集應用',subject:'檢送整體品質計畫C版',signedBy:'高君銓',notes:''},
{id:'corr090',direction:'out',docNo:'DNV-86321005-0023',urgency:'普通件',issueDate:'2024-05-30',receiveDate:'',unit:'DNV',subject:'檢還總工程預定進度表C版',signedBy:'',notes:'退回修正'},
{id:'corr091',direction:'in',docNo:'綜工字第1133184510號',urgency:'普通件',issueDate:'2024-05-30',receiveDate:'2024-05-31',unit:'綜施處',subject:'環境保護計畫0版核定',signedBy:'高君銓',notes:''},
{id:'corr092',direction:'in',docNo:'綜工字第1133184561號',urgency:'普通件',issueDate:'2024-05-30',receiveDate:'2024-05-31',unit:'綜施處',subject:'職業安全衛生管理計畫0版核定',signedBy:'高君銓',notes:''},
{id:'corr093',direction:'in',docNo:'碳集字第113060501號',urgency:'普通件',issueDate:'2024-06-05',receiveDate:'2024-06-06',unit:'碳集應用',subject:'113年5月工作月報',signedBy:'高君銓',notes:''},
{id:'corr094',direction:'in',docNo:'綜工字第1138070381號',urgency:'普通件',issueDate:'2024-06-05',receiveDate:'2024-06-06',unit:'綜施處',subject:'第二次工程推動會議 會議紀錄',signedBy:'高君銓',notes:''},
{id:'corr095',direction:'in',docNo:'綜工字第1138070605號',urgency:'普通件',issueDate:'2024-06-05',receiveDate:'2024-06-06',unit:'綜施處',subject:'第三次工程推動會議 開會通知',signedBy:'高君銓',notes:''},
{id:'corr096',direction:'out',docNo:'DNV-86321005-0024',urgency:'普通件',issueDate:'2024-06-13',receiveDate:'',unit:'DNV',subject:'檢送113年5月工作月報審查意見',signedBy:'',notes:''},
{id:'corr097',direction:'in',docNo:'綜工字第1133185307號',urgency:'普通件',issueDate:'2024-06-14',receiveDate:'2024-06-17',unit:'綜施處',subject:'整體品質計畫0版核定',signedBy:'高君銓',notes:''},
{id:'corr098',direction:'in',docNo:'綜工字第1138074818號',urgency:'普通件',issueDate:'2024-06-14',receiveDate:'2024-06-17',unit:'綜施處',subject:'第二次工程界面現勘會議紀錄',signedBy:'高君銓',notes:''},
{id:'corr099',direction:'in',docNo:'碳集字第113061701號',urgency:'普通件',issueDate:'2024-06-17',receiveDate:'2024-06-18',unit:'碳集應用',subject:'檢送總工程預定進度表D版',signedBy:'高君銓',notes:''},
{id:'corr100',direction:'out',docNo:'86321005-0033',urgency:'普通件',issueDate:'2024-06-21',receiveDate:'',unit:'DNV',subject:'總工程預定進度表(含施工網狀圖)D版審查結果',signedBy:'',notes:''},
{id:'corr101',direction:'in',docNo:'研字第1138079691號',urgency:'普通件',issueDate:'2024-06-25',receiveDate:'2024-06-25',unit:'綜研所',subject:'施工用地協調討論會議',signedBy:'黃惠君',notes:'電子公文系統'},
{id:'corr102',direction:'out',docNo:'86321005-0034',urgency:'普通件',issueDate:'2024-06-27',receiveDate:'',unit:'DNV',subject:'檢送6月份第1次協調會會議紀錄',signedBy:'',notes:''},
{id:'corr103',direction:'in',docNo:'綜工字第1133185039號',urgency:'普通件',issueDate:'2024-07-01',receiveDate:'2024-07-02',unit:'綜施處',subject:'復碳集公司所提細設問題',signedBy:'高君銓',notes:''},
{id:'corr104',direction:'in',docNo:'綜工字第1133185289號',urgency:'普通件',issueDate:'2024-07-01',receiveDate:'2024-07-02',unit:'綜施處',subject:'復碳集公司所提煙氣問題',signedBy:'高君銓',notes:''},
{id:'corr105',direction:'in',docNo:'綜工字第1133185740號',urgency:'普通件',issueDate:'2024-07-01',receiveDate:'2024-07-02',unit:'綜施處',subject:'總工程預定進度表(含施工網狀圖)0版核定',signedBy:'高君銓',notes:''},
{id:'corr106',direction:'in',docNo:'綜工字第1138083257號',urgency:'普通件',issueDate:'2024-07-01',receiveDate:'2024-07-02',unit:'綜施處',subject:'第三次工作推動會議會議紀錄',signedBy:'高君銓',notes:''},
{id:'corr107',direction:'out',docNo:'86321005-0035',urgency:'普通件',issueDate:'2024-07-01',receiveDate:'',unit:'DNV',subject:'檢送113年6月月報',signedBy:'',notes:''},
{id:'corr108',direction:'in',docNo:'碳集字第113070201號',urgency:'普通件',issueDate:'2024-07-02',receiveDate:'2024-07-08',unit:'碳集應用',subject:'檢送細部設計圖面分類分項表',signedBy:'高君銓',notes:''},
{id:'corr109',direction:'in',docNo:'研字第1138085012號',urgency:'普通件',issueDate:'2024-07-04',receiveDate:'',unit:'綜研所',subject:'前期評估報告C版准予核定',signedBy:'',notes:'沒副本給DNV'},
{id:'corr110',direction:'in',docNo:'碳集字第113070501號',urgency:'普通件',issueDate:'2024-07-05',receiveDate:'2024-07-08',unit:'碳集應用',subject:'113年6月工作月報',signedBy:'高君銓',notes:''},
{id:'corr111',direction:'in',docNo:'碳集字第113070502號',urgency:'普通件',issueDate:'2024-07-05',receiveDate:'2024-07-08',unit:'碳集應用',subject:'細部設計 - 建築設計圖(A版)',signedBy:'高君銓',notes:''},
{id:'corr112',direction:'in',docNo:'綜工字第1138087359號',urgency:'普通件',issueDate:'2024-07-09',receiveDate:'2024-07-10',unit:'綜施處',subject:'第四次工程推動會議 會議通知',signedBy:'黃惠君',notes:''},
{id:'corr113',direction:'in',docNo:'碳集字第113070901號',urgency:'普通件',issueDate:'2024-07-09',receiveDate:'2024-07-10',unit:'碳集應用',subject:'細部設計 - 機械類(一)A版',signedBy:'黃惠君',notes:''},
{id:'corr114',direction:'out',docNo:'86321005-0036',urgency:'普通件',issueDate:'2024-07-12',receiveDate:'',unit:'DNV',subject:'檢送7月份第1次協調會會議紀錄',signedBy:'',notes:''},
{id:'corr115',direction:'out',docNo:'DNV-86321005-0025',urgency:'普通件',issueDate:'2024-07-16',receiveDate:'',unit:'DNV',subject:'檢送113年6月工作月報審查意見',signedBy:'',notes:''},
{id:'corr116',direction:'in',docNo:'碳集字第113071701號',urgency:'普通件',issueDate:'2024-07-17',receiveDate:'2024-07-18',unit:'碳集應用',subject:'檢送消防(A版)、給排水(A版)、弱電(A版)、電氣(A版)及送審目錄',signedBy:'高君銓',notes:''},
{id:'corr117',direction:'in',docNo:'碳集字第113071901號',urgency:'普通件',issueDate:'2024-07-19',receiveDate:'2024-07-23',unit:'碳集應用',subject:'檢送測量及地質調查(鑽探)報告書(A版)',signedBy:'高君銓',notes:''},
{id:'corr118',direction:'in',docNo:'碳集字第113071902號',urgency:'普通件',issueDate:'2024-07-19',receiveDate:'2024-07-23',unit:'碳集應用',subject:'檢送地質承載力評估報告書(A版)',signedBy:'高君銓',notes:''},
{id:'corr119',direction:'in',docNo:'碳集字第113071903號',urgency:'普通件',issueDate:'2024-07-19',receiveDate:'2024-07-23',unit:'碳集應用',subject:'檢送建築相關設計圖消防圖(A版)',signedBy:'高君銓',notes:''},
{id:'corr120',direction:'in',docNo:'碳集字第113071904號',urgency:'普通件',issueDate:'2024-07-19',receiveDate:'2024-07-23',unit:'碳集應用',subject:'檢送建築相關設計圖幾排水圖(A版)',signedBy:'高君銓',notes:''},
{id:'corr121',direction:'in',docNo:'碳集字第113071905號',urgency:'普通件',issueDate:'2024-07-19',receiveDate:'2024-07-23',unit:'碳集應用',subject:'檢送建築相關設計圖弱電圖(A版)',signedBy:'高君銓',notes:''},
{id:'corr122',direction:'in',docNo:'碳集字第113071906號',urgency:'普通件',issueDate:'2024-07-19',receiveDate:'2024-07-23',unit:'碳集應用',subject:'檢送建築相關設計圖電氣圖(A版)',signedBy:'高君銓',notes:''},
{id:'corr123',direction:'in',docNo:'碳集字第113072601號',urgency:'普通件',issueDate:'2024-07-26',receiveDate:'2024-07-29',unit:'碳集應用',subject:'檢送設備規格計算書(A版)',signedBy:'高君銓',notes:''},
{id:'corr124',direction:'in',docNo:'碳集字第113073001號',urgency:'普通件',issueDate:'2024-07-30',receiveDate:'2024-07-31',unit:'碳集應用',subject:'檢送結構計算書(A版)',signedBy:'高君銓',notes:''},
{id:'corr125',direction:'in',docNo:'碳集字第113080101號',urgency:'普通件',issueDate:'2024-08-01',receiveDate:'2024-08-02',unit:'碳集應用',subject:'檢送BIM工作執行計畫書(A版)',signedBy:'高君銓',notes:''},
{id:'corr126',direction:'in',docNo:'碳集字第113080201號',urgency:'普通件',issueDate:'2024-08-02',receiveDate:'2024-08-05',unit:'碳集應用',subject:'113年7月工作月報',signedBy:'高君銓',notes:''},
{id:'corr127',direction:'in',docNo:'綜工字第1138095936號',urgency:'普通件',issueDate:'2024-08-01',receiveDate:'2024-08-05',unit:'綜施處',subject:'第四次工程推動會議 會議通知',signedBy:'高君銓',notes:''},
{id:'corr128',direction:'in',docNo:'碳集字第113080203號',urgency:'普通件',issueDate:'2024-08-02',receiveDate:'2024-08-05',unit:'碳集應用',subject:'工程延期申請',signedBy:'高君銓',notes:''},
{id:'corr129',direction:'in',docNo:'建字第1130546713號',urgency:'普通件',issueDate:'2024-08-06',receiveDate:'2024-08-08',unit:'營建處',subject:'碳捕集廠細設機械類(一)A版審查結果',signedBy:'高君銓',notes:'退回修正'},
{id:'corr130',direction:'in',docNo:'碳集字第113080701號',urgency:'普通件',issueDate:'2024-08-07',receiveDate:'2024-08-08',unit:'碳集應用',subject:'檢送建築設計一般類(A版)',signedBy:'高君銓',notes:''},
{id:'corr131',direction:'in',docNo:'碳集字第113080702號',urgency:'普通件',issueDate:'2024-08-07',receiveDate:'2024-08-08',unit:'碳集應用',subject:'檢送碳捕集廠細設電氣類-T01(A版)',signedBy:'高君銓',notes:''},
{id:'corr132',direction:'in',docNo:'碳集字第113080703號',urgency:'普通件',issueDate:'2024-08-07',receiveDate:'2024-08-08',unit:'碳集應用',subject:'檢送碳捕集廠儀控類-T01(A版)',signedBy:'高君銓',notes:''},
{id:'corr133',direction:'out',docNo:'86321005-0038',urgency:'普通件',issueDate:'2024-08-07',receiveDate:'',unit:'DNV',subject:'檢送工作標廠商工程延期申請審查結果',signedBy:'',notes:''},
{id:'corr134',direction:'in',docNo:'建字第1130547136號',urgency:'普通件',issueDate:'2024-08-12',receiveDate:'2024-08-13',unit:'營建處',subject:'「地質承載力評估報告書」(A版)審查結果',signedBy:'高君銓',notes:'退回修正'},
{id:'corr135',direction:'in',docNo:'建字第1130547137號',urgency:'普通件',issueDate:'2024-08-12',receiveDate:'2024-08-13',unit:'營建處',subject:'「測量及地質調查(鑽探)報告書」（A版）審查結果',signedBy:'高君銓',notes:'退回修正'},
{id:'corr136',direction:'in',docNo:'建字第1130847132號',urgency:'普通件',issueDate:'2024-08-09',receiveDate:'2024-08-13',unit:'營建處',subject:'建築相關設計圖消防圖(A版)審查結果',signedBy:'高君銓',notes:'退回修正'},
{id:'corr137',direction:'in',docNo:'碳集字第113081201號',urgency:'普通件',issueDate:'2024-08-12',receiveDate:'2024-08-13',unit:'碳集應用',subject:'檢送建築相關設計圖結構類(A版)',signedBy:'高君銓',notes:''},
{id:'corr138',direction:'in',docNo:'碳集字第113081202號',urgency:'普通件',issueDate:'2024-08-12',receiveDate:'2024-08-13',unit:'碳集應用',subject:'檢送建築相關設計圖分析實驗室(A版)',signedBy:'高君銓',notes:''},
{id:'corr139',direction:'in',docNo:'碳集字第113081203號',urgency:'普通件',issueDate:'2024-08-12',receiveDate:'2024-08-13',unit:'碳集應用',subject:'檢送建築相關設計圖樹林實驗室(A版)',signedBy:'高君銓',notes:''},
{id:'corr140',direction:'in',docNo:'建字第1130547133號',urgency:'普通件',issueDate:'2024-08-12',receiveDate:'2024-08-14',unit:'營建處',subject:'建築相關設計圖給排水圖(A版)審查結果',signedBy:'高君銓',notes:'退回修正'},
{id:'corr141',direction:'in',docNo:'碳集字第113081301號',urgency:'普通件',issueDate:'2024-08-13',receiveDate:'2024-08-14',unit:'碳集應用',subject:'碳捕集廠細部設計圖機械圖(二)(A版)',signedBy:'高君銓',notes:''},
{id:'corr142',direction:'in',docNo:'碳集字第113081302號',urgency:'普通件',issueDate:'2024-08-13',receiveDate:'2024-08-14',unit:'碳集應用',subject:'建築相關設計圖建築裝修圖(A版)',signedBy:'高君銓',notes:''},
{id:'corr143',direction:'in',docNo:'建字第1130547135號',urgency:'普通件',issueDate:'2024-08-19',receiveDate:'2024-08-19',unit:'營建處',subject:'建築相關設計圖電氣圖(A版)',signedBy:'高君銓',notes:'退回修正'},
{id:'corr144',direction:'in',docNo:'建字第1130547134號',urgency:'普通件',issueDate:'2024-08-20',receiveDate:'2024-08-20',unit:'營建處',subject:'建築相關設計圖弱電圖(A版)',signedBy:'高君銓',notes:'退回修正'},
{id:'corr145',direction:'in',docNo:'建字第1130547420號',urgency:'普通件',issueDate:'2024-08-20',receiveDate:'2024-08-21',unit:'營建處',subject:'BIM工作執行計畫書(A版)',signedBy:'高君銓',notes:'退回修正'},
{id:'corr146',direction:'in',docNo:'綜工字第1138106209號',urgency:'普通件',issueDate:'2024-08-20',receiveDate:'2024-08-21',unit:'綜施處',subject:'第三次工程界面現勘討論會議 開會通知',signedBy:'高君銓',notes:''},
{id:'corr147',direction:'in',docNo:'綜工字第1138105388號',urgency:'普通件',issueDate:'2024-08-20',receiveDate:'2024-08-21',unit:'綜施處',subject:'第五次工程推動會議 開會通知',signedBy:'高君銓',notes:''},
{id:'corr148',direction:'in',docNo:'碳集字第113082102號',urgency:'普通件',issueDate:'2024-08-21',receiveDate:'2024-08-22',unit:'碳集應用',subject:'B標介面接點討論',signedBy:'高君銓',notes:''},
{id:'corr149',direction:'in',docNo:'碳集字第113082101號',urgency:'普通件',issueDate:'2024-08-21',receiveDate:'',unit:'碳集應用',subject:'預付款請款',signedBy:'',notes:'沒副本給DNV'},
{id:'corr150',direction:'out',docNo:'86321005-0040',urgency:'普通件',issueDate:'2024-08-21',receiveDate:'',unit:'DNV',subject:'八月份第二次協調會會議紀錄',signedBy:'',notes:''},
{id:'corr151',direction:'in',docNo:'碳集字第113082201號',urgency:'普通件',issueDate:'2024-08-22',receiveDate:'2024-08-23',unit:'碳集應用',subject:'檢送建築相關設計圖消防圖(B版)',signedBy:'高君銓',notes:''},
{id:'corr152',direction:'in',docNo:'碳集字第113082202號',urgency:'普通件',issueDate:'2024-08-22',receiveDate:'2024-08-23',unit:'碳集應用',subject:'檢送建築相關設計圖給排水圖(B版)',signedBy:'高君銓',notes:''},
{id:'corr153',direction:'in',docNo:'建字第1130547334號',urgency:'普通件',issueDate:'2024-08-23',receiveDate:'2024-08-23',unit:'營建處',subject:'結構計算書A版',signedBy:'高君銓',notes:'退回修正'},
{id:'corr154',direction:'in',docNo:'碳集字第113082301號',urgency:'普通件',issueDate:'2024-08-23',receiveDate:'2024-08-23',unit:'碳集應用',subject:'機械類(一)(B版)',signedBy:'高君銓',notes:''},
{id:'corr155',direction:'in',docNo:'碳集字第113082701號',urgency:'普通件',issueDate:'2024-08-27',receiveDate:'2024-08-28',unit:'碳集應用',subject:'檢送建築設計圖B版',signedBy:'黃惠君',notes:''},
{id:'corr156',direction:'in',docNo:'碳集字第113082702號',urgency:'普通件',issueDate:'2024-08-27',receiveDate:'2024-08-28',unit:'碳集應用',subject:'檢送計畫書及細部設計送審管制總表',signedBy:'黃惠君',notes:''},
{id:'corr157',direction:'in',docNo:'建字第1130547644號',urgency:'普通件',issueDate:'2024-08-27',receiveDate:'2024-08-30',unit:'營建處',subject:'檢還電氣類-T01(A版)',signedBy:'高君銓',notes:'退回修正'},
{id:'corr158',direction:'in',docNo:'碳集字第113082901號',urgency:'普通件',issueDate:'2024-08-29',receiveDate:'2024-08-30',unit:'碳集應用',subject:'檢送地質承載力評估報告書(B版)',signedBy:'高君銓',notes:''},
{id:'corr159',direction:'in',docNo:'碳集字第113082902號',urgency:'普通件',issueDate:'2024-08-29',receiveDate:'2024-08-30',unit:'碳集應用',subject:'檢送測量及地質調查(鑽探)報告書（B版）',signedBy:'高君銓',notes:''},
{id:'corr160',direction:'in',docNo:'碳集字第113093001號',urgency:'普通件',issueDate:'2024-08-30',receiveDate:'2024-09-02',unit:'碳集應用',subject:'檢送設備規格計算書(B版)',signedBy:'高君銓',notes:''},
{id:'corr161',direction:'in',docNo:'碳集字第113090301號',urgency:'普通件',issueDate:'2024-09-03',receiveDate:'2024-09-04',unit:'碳集應用',subject:'檢送BIM工作執行計畫書(B版)',signedBy:'高君銓',notes:''},
{id:'corr162',direction:'in',docNo:'碳集字第113090302號',urgency:'普通件',issueDate:'2024-09-03',receiveDate:'2024-09-04',unit:'碳集應用',subject:'檢送建築電氣圖(B版)',signedBy:'高君銓',notes:''},
{id:'corr163',direction:'in',docNo:'碳集字第113090303號',urgency:'普通件',issueDate:'2024-09-03',receiveDate:'2024-09-04',unit:'碳集應用',subject:'檢送建築弱電圖(B版)',signedBy:'高君銓',notes:''},
{id:'corr164',direction:'in',docNo:'碳集字第113090501號',urgency:'普通件',issueDate:'2024-09-05',receiveDate:'2024-09-06',unit:'碳集應用',subject:'檢送113年8月工作月報',signedBy:'高君銓',notes:''},
{id:'corr165',direction:'in',docNo:'建字第1130547775號',urgency:'普通件',issueDate:'2024-09-05',receiveDate:'2024-09-05',unit:'營建處',subject:'檢還結構類(A版)',signedBy:'高君銓',notes:'退回修正'},
{id:'corr166',direction:'in',docNo:'碳集字第113090601號',urgency:'普通件',issueDate:'2024-09-06',receiveDate:'2024-09-09',unit:'碳集應用',subject:'檢送結構計算書(B版)',signedBy:'高君銓',notes:''},
{id:'corr167',direction:'in',docNo:'碳集字第113090602號',urgency:'普通件',issueDate:'2024-09-06',receiveDate:'2024-09-09',unit:'碳集應用',subject:'檢送儀控圖(一)(A版)',signedBy:'高君銓',notes:''},
{id:'corr168',direction:'in',docNo:'碳集字第113090901號',urgency:'普通件',issueDate:'2024-09-09',receiveDate:'2024-09-10',unit:'碳集應用',subject:'檢送計畫書及細設圖說送審管制總表',signedBy:'黃惠君',notes:''},
{id:'corr169',direction:'in',docNo:'建字第1138116715號',urgency:'普通件',issueDate:'2024-09-10',receiveDate:'2024-09-11',unit:'營建處',subject:'請碳集加速辦理設計圖說工作',signedBy:'',notes:''},
{id:'corr170',direction:'in',docNo:'建字第1130548110號',urgency:'普通件',issueDate:'2024-09-11',receiveDate:'2024-09-12',unit:'營建處',subject:'復碳捕集細設圖A版審查意見疑義',signedBy:'高君銓',notes:''},
{id:'corr171',direction:'in',docNo:'碳集字第113091301號',urgency:'普通件',issueDate:'2024-09-13',receiveDate:'2024-09-18',unit:'碳集應用',subject:'檢送電氣圖(一)B版',signedBy:'高君銓',notes:''},
{id:'corr172',direction:'in',docNo:'建字第1130548334號',urgency:'普通件',issueDate:'2024-09-13',receiveDate:'2024-09-18',unit:'營建處',subject:'測量及地質鑽探報告書(B版)認可',signedBy:'高君銓',notes:''},
{id:'corr173',direction:'in',docNo:'建字第1130548333號',urgency:'普通件',issueDate:'2024-09-13',receiveDate:'2024-09-18',unit:'營建處',subject:'地質承載力評估報告書(B版)',signedBy:'高君銓',notes:'退回修正'},
{id:'corr174',direction:'in',docNo:'碳集字第113091801號',urgency:'普通件',issueDate:'2024-09-18',receiveDate:'2024-09-19',unit:'碳集應用',subject:'檢送碳捕集廠公共區域管線(OSBL)',signedBy:'高君銓',notes:''},
{id:'corr175',direction:'in',docNo:'綜工字第1138120767號',urgency:'普通件',issueDate:'2024-09-18',receiveDate:'2024-09-19',unit:'綜施處',subject:'第五次工程推動會議 會議記錄',signedBy:'高君銓',notes:''},
{id:'corr176',direction:'in',docNo:'綜工字第1138119758號',urgency:'普通件',issueDate:'2024-09-18',receiveDate:'2024-09-19',unit:'綜施處',subject:'第六次工程推動會議 會議通知',signedBy:'高君銓',notes:'2024-10-14 00:00:00'},
{id:'corr177',direction:'in',docNo:'綜工字第1138119722號',urgency:'普通件',issueDate:'2024-09-18',receiveDate:'2024-09-19',unit:'綜施處',subject:'第三次工程界面現勘討論會議 會議記錄',signedBy:'高君銓',notes:''},
{id:'corr178',direction:'out',docNo:'86321005-0042',urgency:'普通件',issueDate:'2024-09-19',receiveDate:'',unit:'DNV',subject:'九月份第一次協調會會議紀錄',signedBy:'',notes:''},
{id:'corr179',direction:'in',docNo:'',urgency:'普通件',issueDate:'2024-09-20',receiveDate:'',unit:'營建處',subject:'BIM工作執行計畫書B版 審查認可，有修正處',signedBy:'',notes:''},
{id:'corr180',direction:'in',docNo:'綜工字第1138121636號',urgency:'普通件',issueDate:'2024-09-20',receiveDate:'2024-09-22',unit:'綜施處',subject:'第一分期期限將至，請碳集公司積極趲趕工進',signedBy:'高君銓',notes:''},
{id:'corr181',direction:'in',docNo:'碳集字第113092001號',urgency:'普通件',issueDate:'2024-09-20',receiveDate:'2024-09-22',unit:'碳集應用',subject:'提送建築相關設計圖建築裝修圖B版',signedBy:'高君銓',notes:''},
{id:'corr182',direction:'in',docNo:'碳集字第113092401號',urgency:'普通件',issueDate:'2024-09-24',receiveDate:'2024-09-25',unit:'碳集應用',subject:'檢送結構細部設計圖(B版)',signedBy:'高君銓',notes:''},
{id:'corr183',direction:'in',docNo:'碳集字第113092402號',urgency:'普通件',issueDate:'2024-09-24',receiveDate:'2024-09-25',unit:'碳集應用',subject:'檢送碳捕集廠電氣圖(二)A版',signedBy:'高君銓',notes:''},
{id:'corr184',direction:'out',docNo:'DNV-86321005-0028',urgency:'普通件',issueDate:'2024-09-26',receiveDate:'',unit:'DNV',subject:'催告第1分期細部設計工作進度',signedBy:'',notes:''},
{id:'corr185',direction:'in',docNo:'碳集字第113092501號',urgency:'普通件',issueDate:'2024-09-25',receiveDate:'2024-09-27',unit:'碳集應用',subject:'檢送BIM工作執行計畫書0版',signedBy:'高君銓',notes:''},
{id:'corr186',direction:'in',docNo:'碳集字第113092502號',urgency:'普通件',issueDate:'2024-09-25',receiveDate:'2024-09-27',unit:'碳集應用',subject:'更換工地負責人',signedBy:'高君銓',notes:''},
{id:'corr187',direction:'in',docNo:'碳集字第113092601號',urgency:'普通件',issueDate:'2024-09-26',receiveDate:'2024-09-27',unit:'碳集應用',subject:'檢送建築相關消防圖(C版)',signedBy:'高君銓',notes:''},
{id:'corr188',direction:'in',docNo:'碳集字第113092602號',urgency:'普通件',issueDate:'2024-09-26',receiveDate:'2024-09-27',unit:'碳集應用',subject:'檢送建築相關排水圖(C版)',signedBy:'高君銓',notes:''},
{id:'corr189',direction:'in',docNo:'碳集字第113092603號',urgency:'普通件',issueDate:'2024-09-26',receiveDate:'2024-09-27',unit:'碳集應用',subject:'檢送碳捕集廠機械圖(二)(B版)',signedBy:'高君銓',notes:''},
{id:'corr190',direction:'in',docNo:'碳集字第11392701號',urgency:'普通件',issueDate:'2024-09-27',receiveDate:'2024-09-30',unit:'碳集應用',subject:'檢送地質乘載力評估報告書(C版)',signedBy:'高君銓',notes:''},
{id:'corr191',direction:'in',docNo:'碳集字第113093001號',urgency:'普通件',issueDate:'2024-09-30',receiveDate:'2024-10-07',unit:'碳集應用',subject:'檢送設備規格計算書(C版)',signedBy:'高君銓',notes:''},
{id:'corr192',direction:'in',docNo:'碳集字第113093002號',urgency:'普通件',issueDate:'2024-09-30',receiveDate:'2024-10-07',unit:'碳集應用',subject:'檢送碳捕集廠細設電氣類(三)(A版)',signedBy:'高君銓',notes:''},
{id:'corr193',direction:'in',docNo:'碳集字第113100101號',urgency:'普通件',issueDate:'2024-10-01',receiveDate:'2024-10-07',unit:'碳集應用',subject:'檢送碳捕集廠細設ISBL(A版)',signedBy:'高君銓',notes:''},
{id:'corr194',direction:'in',docNo:'建字第1130549232號',urgency:'普通件',issueDate:'2024-10-01',receiveDate:'2024-10-07',unit:'營建處',subject:'建築相關設計消防圖(C版)准予備查',signedBy:'高君銓',notes:''},
{id:'corr195',direction:'in',docNo:'建字第1130549233號',urgency:'普通件',issueDate:'2024-10-01',receiveDate:'2024-10-07',unit:'營建處',subject:'建築相關設計給排水圖(C版)審查認可(有修正處)',signedBy:'高君銓',notes:''},
{id:'corr196',direction:'in',docNo:'碳集字第113100401號',urgency:'普通件',issueDate:'2024-10-04',receiveDate:'2024-10-07',unit:'碳集應用',subject:'工期展延2日申請',signedBy:'高君銓',notes:''},
{id:'corr197',direction:'in',docNo:'碳集字第113100403號',urgency:'普通件',issueDate:'2024-10-04',receiveDate:'2024-10-07',unit:'碳集應用',subject:'部分設計圖尚未收到審查結果',signedBy:'高君銓',notes:''},
{id:'corr198',direction:'in',docNo:'碳集字第113100404號',urgency:'普通件',issueDate:'2024-10-04',receiveDate:'2024-10-07',unit:'碳集應用',subject:'檢送碳捕集廠細設機械圖(一)(C版)',signedBy:'高君銓',notes:''},
{id:'corr199',direction:'in',docNo:'碳集字第113100405號',urgency:'普通件',issueDate:'2024-10-04',receiveDate:'2024-10-07',unit:'碳集應用',subject:'檢送結構計算書(C版)',signedBy:'高君銓',notes:''},
{id:'corr200',direction:'in',docNo:'碳集字第113100406號',urgency:'普通件',issueDate:'2024-10-04',receiveDate:'2024-10-07',unit:'碳集應用',subject:'檢送建築設計給排水圖(0版)',signedBy:'高君銓',notes:''},
{id:'corr201',direction:'in',docNo:'碳集字第113100407號',urgency:'普通件',issueDate:'2024-10-04',receiveDate:'2024-10-07',unit:'碳集應用',subject:'檢送碳捕集廠細設儀控類(B版)',signedBy:'高君銓',notes:''},
{id:'corr202',direction:'in',docNo:'碳集字第113100408號',urgency:'普通件',issueDate:'2024-10-04',receiveDate:'2024-10-07',unit:'碳集應用',subject:'檢送建築設計圖(C版)',signedBy:'高君銓',notes:''},
{id:'corr203',direction:'in',docNo:'建字第1130548490號',urgency:'普通件',issueDate:'2024-10-04',receiveDate:'2024-10-07',unit:'營建處',subject:'建築弱電圖B版退回修正',signedBy:'高君銓',notes:''},
{id:'corr204',direction:'in',docNo:'建字第1130548628號',urgency:'普通件',issueDate:'2024-10-04',receiveDate:'2024-10-07',unit:'營建處',subject:'儀控類(一)A版退回修正',signedBy:'高君銓',notes:''},
{id:'corr205',direction:'in',docNo:'建字第1130548491號',urgency:'普通件',issueDate:'2024-10-04',receiveDate:'2024-10-07',unit:'營建處',subject:'電氣圖B版退回修正',signedBy:'高君銓',notes:''},
{id:'corr206',direction:'in',docNo:'碳集字第113100402號',urgency:'普通件',issueDate:'2024-10-04',receiveDate:'2024-10-09',unit:'碳集應用',subject:'113年9月工作月報',signedBy:'高君銓',notes:''},
{id:'corr207',direction:'in',docNo:'建字第1130548921號',urgency:'普通件',issueDate:'2024-10-07',receiveDate:'2024-10-09',unit:'營建處',subject:'碳捕集廠公共區域管線(OSBL)(A版)審查意見',signedBy:'高君銓',notes:'退回修正'},
{id:'corr208',direction:'in',docNo:'碳集字第113100901號',urgency:'普通件',issueDate:'2024-10-09',receiveDate:'2024-10-11',unit:'碳集應用',subject:'檢送建築電氣圖(C版)',signedBy:'高君銓',notes:''},
{id:'corr209',direction:'in',docNo:'綜工字第1133189423號',urgency:'普通件',issueDate:'2024-10-09',receiveDate:'2024-10-11',unit:'綜施處',subject:'不同意更換工地負責人',signedBy:'高君銓',notes:''},
{id:'corr210',direction:'in',docNo:'綜工字第1138127839號',urgency:'普通件',issueDate:'2024-10-09',receiveDate:'2024-10-11',unit:'綜施處',subject:'請碳集公司積極趕辦保密協議事宜',signedBy:'高君銓',notes:''},
{id:'corr211',direction:'in',docNo:'建字第1130549231號',urgency:'普通件',issueDate:'2024-10-09',receiveDate:'2024-10-11',unit:'營建處',subject:'碳捕集廠機械圖(二)B版審查意見',signedBy:'高君銓',notes:'退回修正'},
{id:'corr212',direction:'in',docNo:'建字第1130549466號',urgency:'普通件',issueDate:'2024-10-09',receiveDate:'2024-10-11',unit:'營建處',subject:'建築給排水(0版)准予備查',signedBy:'高君銓',notes:''},
{id:'corr213',direction:'in',docNo:'碳集字第113101102號',urgency:'普通件',issueDate:'2024-10-11',receiveDate:'2024-10-15',unit:'碳集應用',subject:'檢送建築弱電圖(C版)',signedBy:'高君銓',notes:''},
{id:'corr214',direction:'in',docNo:'碳集字第113101401號',urgency:'普通件',issueDate:'2024-10-14',receiveDate:'2024-10-15',unit:'碳集應用',subject:'檢送地質承載力評估報告書(D版)',signedBy:'高君銓',notes:''},
{id:'corr215',direction:'in',docNo:'建字第1130549442號',urgency:'普通件',issueDate:'2024-10-17',receiveDate:'2024-10-18',unit:'營建處',subject:'捕集廠機械類(一)(C版)審查意見',signedBy:'高君銓',notes:'退回修正'},
{id:'corr216',direction:'in',docNo:'碳集字第113101802號',urgency:'普通件',issueDate:'2024-10-18',receiveDate:'2024-10-21',unit:'碳集應用',subject:'檢送捕集廠公共區域管線(OSBL)(B版)',signedBy:'高君銓',notes:''},
{id:'corr217',direction:'in',docNo:'建字第1130541461號',urgency:'普通件',issueDate:'2024-10-22',receiveDate:'2024-10-22',unit:'營建處',subject:'地質承載力評估報告書(D版)審查意見',signedBy:'黃惠君',notes:'審查認可'},
{id:'corr218',direction:'in',docNo:'建字第1130549131號',urgency:'普通件',issueDate:'2024-10-22',receiveDate:'2024-10-22',unit:'營建處',subject:'捕集廠電氣(二)(A版)審查意見',signedBy:'黃惠君',notes:'退回修正'},
{id:'corr219',direction:'in',docNo:'綜工字第1133189985號',urgency:'普通件',issueDate:'2024-10-23',receiveDate:'2024-10-24',unit:'綜施處',subject:'A標第一分期期限同意展延至113年10月7日',signedBy:'黃惠君',notes:''},
{id:'corr220',direction:'in',docNo:'碳集字第113102301號',urgency:'普通件',issueDate:'2024-10-23',receiveDate:'2024-10-24',unit:'碳集應用',subject:'檢送捕集廠電氣(一)(C版)',signedBy:'黃惠君',notes:''},
{id:'corr221',direction:'in',docNo:'碳集字第113102501號',urgency:'普通件',issueDate:'2024-10-25',receiveDate:'2024-10-28',unit:'碳集應用',subject:'檢送捕集廠機械類(二)(C版)',signedBy:'高君銓',notes:''},
{id:'corr222',direction:'in',docNo:'建字第1130549674號',urgency:'普通件',issueDate:'2024-10-28',receiveDate:'2024-10-28',unit:'營建處',subject:'檢還建築電氣圖(C版)',signedBy:'高君銓',notes:'准予備查(有修正處)'},
{id:'corr223',direction:'in',docNo:'建字第1130549465號',urgency:'普通件',issueDate:'2024-10-28',receiveDate:'2024-10-28',unit:'營建處',subject:'檢還捕集廠儀控類(B版)',signedBy:'高君銓',notes:'退回修正'},
{id:'corr224',direction:'in',docNo:'綜工字第1138137095號',urgency:'普通件',issueDate:'2024-10-28',receiveDate:'2024-10-29',unit:'綜施處',subject:'第六次工程推動會議會議紀錄',signedBy:'高君銓',notes:''},
{id:'corr225',direction:'in',docNo:'碳集字第113102801號',urgency:'普通件',issueDate:'2024-10-28',receiveDate:'2024-10-29',unit:'碳集應用',subject:'檢送碳捕集廠ISBL(B版)',signedBy:'高君銓',notes:''},
{id:'corr226',direction:'in',docNo:'建字第1130549726號',urgency:'普通件',issueDate:'2024-10-30',receiveDate:'2024-11-04',unit:'營建處',subject:'捕集廠OSBL(B版)審查意見',signedBy:'高君銓',notes:'退回修正'},
{id:'corr227',direction:'in',docNo:'建字第1130549464號',urgency:'普通件',issueDate:'2024-10-30',receiveDate:'',unit:'營建處',subject:'結構計算書C版退回修正',signedBy:'',notes:''},
{id:'corr228',direction:'in',docNo:'碳集字第113110402號',urgency:'普通件',issueDate:'2024-11-04',receiveDate:'2024-11-05',unit:'碳集應用',subject:'檢送建築電氣圖0版',signedBy:'高君銓',notes:''},
{id:'corr229',direction:'in',docNo:'碳集字第113110403號',urgency:'普通件',issueDate:'2024-11-04',receiveDate:'2024-11-05',unit:'碳集應用',subject:'檢送結構細設圖C版',signedBy:'高君銓',notes:''},
{id:'corr230',direction:'in',docNo:'碳集字第113110601號',urgency:'普通件',issueDate:'2024-11-06',receiveDate:'2024-11-07',unit:'碳集應用',subject:'檢送建築弱電圖0版',signedBy:'高君銓',notes:''},
{id:'corr231',direction:'in',docNo:'碳集字第113110801號',urgency:'普通件',issueDate:'2024-11-08',receiveDate:'2024-11-12',unit:'碳集應用',subject:'檢送設備規格計算書D版',signedBy:'高君銓',notes:''},
{id:'corr232',direction:'in',docNo:'碳集字第113110802號',urgency:'普通件',issueDate:'2024-11-08',receiveDate:'2024-11-12',unit:'碳集應用',subject:'檢送捕集廠機械類(一)D版',signedBy:'高君銓',notes:''},
{id:'corr233',direction:'in',docNo:'碳集字第113110803號',urgency:'普通件',issueDate:'2024-11-08',receiveDate:'2024-11-12',unit:'碳集應用',subject:'檢送113年10月工作月報',signedBy:'高君銓',notes:''},
{id:'corr234',direction:'in',docNo:'建字第1130549974號',urgency:'普通件',issueDate:'2024-11-11',receiveDate:'2024-11-11',unit:'營建處',subject:'機械類(二)(C版)',signedBy:'高君銓',notes:'退回修正'},
{id:'corr235',direction:'in',docNo:'碳集字第113111401號',urgency:'普通件',issueDate:'2024-11-14',receiveDate:'2024-11-15',unit:'碳集應用',subject:'檢送結構計算書D版',signedBy:'高君銓',notes:''},
{id:'corr236',direction:'in',docNo:'建字第1130549847號',urgency:'普通件',issueDate:'2024-11-18',receiveDate:'2024-11-18',unit:'營建處',subject:'碳捕集廠電氣圖C版_准予備查(有修正處)',signedBy:'高君銓',notes:''},
{id:'corr237',direction:'in',docNo:'建字第1130549991號',urgency:'普通件',issueDate:'2024-11-18',receiveDate:'2024-11-20',unit:'營建處',subject:'碳捕集廠管線ISBL(B版)審查結果',signedBy:'高君銓',notes:'退回修正'},
{id:'corr238',direction:'in',docNo:'綜工字第1138148989號',urgency:'普通件',issueDate:'2024-11-19',receiveDate:'2024-11-20',unit:'綜施處',subject:'第一次工程進度落後檢討會議紀錄',signedBy:'高君銓',notes:''},
{id:'corr239',direction:'in',docNo:'碳集字第113111901號',urgency:'普通件',issueDate:'2024-11-19',receiveDate:'2024-11-22',unit:'碳集應用',subject:'計畫書送審管制總表及細部設計圖送審管制總表(修正)',signedBy:'黃惠君',notes:''},
{id:'corr240',direction:'in',docNo:'碳集字第113111902號',urgency:'普通件',issueDate:'2024-11-19',receiveDate:'2024-11-22',unit:'碳集應用',subject:'碳捕集廠儀控類(C版)',signedBy:'黃惠君',notes:''},
{id:'corr241',direction:'in',docNo:'碳集字第113112001號',urgency:'普通件',issueDate:'2024-11-20',receiveDate:'2024-11-22',unit:'碳集應用',subject:'OSBL(C版)',signedBy:'黃惠君',notes:''},
{id:'corr242',direction:'in',docNo:'建字第1130550885號',urgency:'普通件',issueDate:'2024-11-22',receiveDate:'2024-11-22',unit:'營建處',subject:'結構細部設計圖C版',signedBy:'高君銓',notes:'修正後核定'},
{id:'corr243',direction:'in',docNo:'建字第1130551643號',urgency:'普通件',issueDate:'2024-11-25',receiveDate:'2024-11-25',unit:'營建處',subject:'機械類(一)(D版)',signedBy:'高君銓',notes:'退回修正'},
{id:'corr244',direction:'in',docNo:'建字第1130550886號',urgency:'普通件',issueDate:'2024-11-28',receiveDate:'2024-11-28',unit:'營建處',subject:'建築電氣圖0版准予備查',signedBy:'高君銓',notes:''},
{id:'corr245',direction:'in',docNo:'建字第1130551540號',urgency:'普通件',issueDate:'2024-11-28',receiveDate:'2024-11-28',unit:'營建處',subject:'建築弱電圖0版准予備查但有修正處',signedBy:'高君銓',notes:''},
{id:'corr246',direction:'in',docNo:'碳集字第113112601號',urgency:'普通件',issueDate:'2024-11-26',receiveDate:'2024-11-28',unit:'碳集應用',subject:'建築裝修圖(C版)',signedBy:'高君銓',notes:''},
{id:'corr247',direction:'in',docNo:'碳集字第1130551644號',urgency:'普通件',issueDate:'2024-11-29',receiveDate:'2024-11-29',unit:'營建處',subject:'設備規格計算書(D版)',signedBy:'高君銓',notes:'退回修正'},
{id:'corr248',direction:'in',docNo:'建字第1130551662號',urgency:'普通件',issueDate:'2024-12-02',receiveDate:'2024-12-02',unit:'營建處',subject:'捕集廠電氣類(二)(B版)准予備查',signedBy:'高君銓',notes:''},
{id:'corr249',direction:'in',docNo:'碳集字第113120201號',urgency:'普通件',issueDate:'2024-12-02',receiveDate:'2024-12-03',unit:'碳集應用',subject:'碳捕集廠電氣圖(一)0版',signedBy:'高君銓',notes:''},
{id:'corr250',direction:'in',docNo:'碳集字第113120202號',urgency:'普通件',issueDate:'2024-12-02',receiveDate:'2024-12-03',unit:'碳集應用',subject:'碳捕集廠機械類(二)D版',signedBy:'高君銓',notes:''},
{id:'corr251',direction:'in',docNo:'綜工字第1138154606號',urgency:'普通件',issueDate:'2024-12-03',receiveDate:'2024-12-03',unit:'綜施處',subject:'細設送審落後及保密協議一事',signedBy:'高君銓',notes:''},
{id:'corr252',direction:'in',docNo:'綜工字第1138155770號',urgency:'普通件',issueDate:'2024-12-03',receiveDate:'2024-12-03',unit:'綜施處',subject:'第七次工程推動會議會議紀錄',signedBy:'高君銓',notes:''},
{id:'corr253',direction:'in',docNo:'建字第1130551745號',urgency:'普通件',issueDate:'2024-12-03',receiveDate:'2024-12-03',unit:'營建處',subject:'結構計算書D版',signedBy:'高君銓',notes:'修正後核定'},
{id:'corr254',direction:'in',docNo:'碳集字第113120401號',urgency:'普通件',issueDate:'2024-12-04',receiveDate:'2024-12-05',unit:'碳集應用',subject:'更換工地負責人',signedBy:'高君銓',notes:'有抽換'},
{id:'corr255',direction:'in',docNo:'碳集字第113120402號',urgency:'普通件',issueDate:'2024-12-04',receiveDate:'2024-12-05',unit:'碳集應用',subject:'ISBL(C版)',signedBy:'高君銓',notes:''},
{id:'corr256',direction:'in',docNo:'碳集字第113120403號',urgency:'普通件',issueDate:'2024-12-04',receiveDate:'2024-12-05',unit:'碳集應用',subject:'工負代理人更換',signedBy:'高君銓',notes:'有抽換'},
{id:'corr257',direction:'in',docNo:'建字第1130551860號',urgency:'普通件',issueDate:'2024-12-04',receiveDate:'2024-12-06',unit:'營建處',subject:'審退OSBL(C版)',signedBy:'高君銓',notes:'退回修正'},
{id:'corr258',direction:'in',docNo:'碳集字第113120501號',urgency:'普通件',issueDate:'2024-12-05',receiveDate:'2024-12-06',unit:'碳集應用',subject:'檢送113年11月工作月報',signedBy:'高君銓',notes:''},
{id:'corr259',direction:'in',docNo:'建字第1130551661號',urgency:'普通件',issueDate:'2024-12-05',receiveDate:'2024-12-05',unit:'營建處',subject:'碳捕集廠電氣類(三) 准予備查(有修正處)',signedBy:'高君銓',notes:''},
{id:'corr260',direction:'in',docNo:'碳集字第113120901號',urgency:'普通件',issueDate:'2024-12-09',receiveDate:'2024-12-11',unit:'碳集應用',subject:'檢送建築弱電圖0A版',signedBy:'高君銓',notes:''},
{id:'corr261',direction:'in',docNo:'綜工字第1138161259號',urgency:'普通件',issueDate:'2024-12-11',receiveDate:'2024-12-12',unit:'綜施處',subject:'第八次工程推動檢討暨工安、環保、政風宣導會議通知',signedBy:'黃品瑄',notes:''},
{id:'corr262',direction:'in',docNo:'建字第1130552035號',urgency:'普通件',issueDate:'2024-12-19',receiveDate:'2024-12-19',unit:'營建處',subject:'建築裝修圖C版 退回修正',signedBy:'黃惠君',notes:'退回修正'},
{id:'corr263',direction:'in',docNo:'碳集字第113121801號',urgency:'普通件',issueDate:'2024-12-18',receiveDate:'2024-12-20',unit:'碳集應用',subject:'細部設計送審進度落後、工期逾期罰款及保密協議一事',signedBy:'黃惠君',notes:''},
{id:'corr264',direction:'in',docNo:'碳集字第113121802號',urgency:'普通件',issueDate:'2024-12-18',receiveDate:'2024-12-20',unit:'碳集應用',subject:'提送色彩計畫A版',signedBy:'黃惠君',notes:''},
{id:'corr265',direction:'in',docNo:'建字第1130551859號',urgency:'普通件',issueDate:'2024-12-20',receiveDate:'2024-12-20',unit:'營建處',subject:'儀控類C版 退回修正',signedBy:'黃惠君',notes:''},
{id:'corr266',direction:'in',docNo:'建字第1130552292號',urgency:'普通件',issueDate:'2024-12-20',receiveDate:'2024-12-20',unit:'營建處',subject:'機械類(二)D版 退回修正',signedBy:'高君銓',notes:''},
{id:'corr267',direction:'in',docNo:'建字第1130552333號',urgency:'普通件',issueDate:'2024-12-23',receiveDate:'2024-12-25',unit:'營建處',subject:'管線類(C版) 退回修正',signedBy:'高君銓',notes:''},
{id:'corr268',direction:'in',docNo:'綜工字第1138171273號',urgency:'普通件',issueDate:'2024-12-31',receiveDate:'2025-01-02',unit:'綜施處',subject:'第九次工程推動會議',signedBy:'高君銓',notes:''},
{id:'corr269',direction:'in',docNo:'碳集字第113123001號',urgency:'普通件',issueDate:'2024-12-30',receiveDate:'2025-01-02',unit:'碳集應用',subject:'送審管制總表(113年12月30日版)',signedBy:'高君銓',notes:''},
{id:'corr270',direction:'in',docNo:'碳集字第113123002號',urgency:'普通件',issueDate:'2024-12-30',receiveDate:'2025-01-02',unit:'碳集應用',subject:'提送工負代理人(賴仲彥)',signedBy:'高君銓',notes:''},
{id:'corr271',direction:'in',docNo:'碳集字第113123003號',urgency:'普通件',issueDate:'2024-12-30',receiveDate:'2025-01-02',unit:'碳集應用',subject:'更換工負(邱建興)',signedBy:'高君銓',notes:''},
{id:'corr272',direction:'in',docNo:'建字第1130552687號',urgency:'普通件',issueDate:'2025-01-02',receiveDate:'2025-01-02',unit:'營建處',subject:'建築給排水圖1版審查認可(有修正處)',signedBy:'高君銓',notes:''},
{id:'corr273',direction:'in',docNo:'碳集字第111010301號',urgency:'普通件',issueDate:'2025-01-03',receiveDate:'2025-01-06',unit:'碳集應用',subject:'提送建築裝修圖樹林實驗室(D版)',signedBy:'高君銓',notes:''},
{id:'corr274',direction:'in',docNo:'碳集字第114010302號',urgency:'普通件',issueDate:'2025-01-03',receiveDate:'2025-01-06',unit:'碳集應用',subject:'提送建築設計圖建築裝修圖(D版)',signedBy:'高君銓',notes:''},
{id:'corr275',direction:'in',docNo:'碳集字第114010303號',urgency:'普通件',issueDate:'2025-01-03',receiveDate:'2025-01-06',unit:'碳集應用',subject:'提送113年12月工作月報',signedBy:'高君銓',notes:''},
{id:'corr276',direction:'in',docNo:'建字第1130552576號',urgency:'普通件',issueDate:'2025-01-06',receiveDate:'2025-01-06',unit:'營建處',subject:'建築弱電圖(0A版)審查結果',signedBy:'高君銓',notes:'准予備查(有修正處)'},
{id:'corr277',direction:'in',docNo:'建字第1130552939號',urgency:'普通件',issueDate:'2025-01-09',receiveDate:'2025-01-09',unit:'營建處',subject:'色彩計畫A版審查意見',signedBy:'高君銓',notes:'退回修正'},
{id:'corr278',direction:'in',docNo:'碳集字第114011002號',urgency:'普通件',issueDate:'2025-01-10',receiveDate:'2025-01-13',unit:'碳集應用',subject:'檢送建築弱電圖(1版)',signedBy:'高君銓',notes:''},
{id:'corr279',direction:'in',docNo:'碳集字第114011001號',urgency:'普通件',issueDate:'2025-01-10',receiveDate:'2025-01-13',unit:'碳集應用',subject:'檢送建築給排水圖(2版)',signedBy:'高君銓',notes:''},
{id:'corr280',direction:'in',docNo:'建字第1140540179號',urgency:'普通件',issueDate:'2025-01-10',receiveDate:'2025-01-13',unit:'營建處',subject:'建築裝修圖-樹林實驗室(D版) 審查結果',signedBy:'高君銓',notes:'准予備查'},
{id:'corr281',direction:'in',docNo:'綜工字第1143180315號',urgency:'普通件',issueDate:'2025-01-13',receiveDate:'2025-01-13',unit:'綜施處',subject:'更換工地負責人為邱建興',signedBy:'高君銓',notes:'准予核定'},
{id:'corr282',direction:'in',docNo:'綜工字第1143180316號',urgency:'普通件',issueDate:'2025-01-15',receiveDate:'2025-01-16',unit:'綜施處',subject:'尚難同意賴仲彥擔任工負代理',signedBy:'高君銓',notes:''},
{id:'corr283',direction:'in',docNo:'建字第1140540520號',urgency:'普通件',issueDate:'2025-01-16',receiveDate:'2025-01-16',unit:'營建處',subject:'建築給排水圖(2版)審查結果',signedBy:'高君銓',notes:'准予備查'},
{id:'corr284',direction:'in',docNo:'碳集字第114012001號',urgency:'普通件',issueDate:'2025-01-20',receiveDate:'2025-01-21',unit:'碳集應用',subject:'檢送捕集廠細設電氣(三)(0版)',signedBy:'高君銓',notes:''},
{id:'corr285',direction:'in',docNo:'碳集字第114012002號',urgency:'普通件',issueDate:'2025-01-20',receiveDate:'2025-01-21',unit:'碳集應用',subject:'檢送色彩計畫(B版)',signedBy:'高君銓',notes:''},
{id:'corr286',direction:'in',docNo:'碳集字第114012101號',urgency:'普通件',issueDate:'2025-01-21',receiveDate:'2025-01-22',unit:'碳集應用',subject:'檢送捕集廠OSBL(D版)',signedBy:'高君銓',notes:''},
{id:'corr287',direction:'in',docNo:'建字第1140540178號',urgency:'普通件',issueDate:'2025-01-23',receiveDate:'2025-01-23',unit:'營建處',subject:'建築裝修圖(D版)',signedBy:'高君銓',notes:'審查認可'},
{id:'corr288',direction:'in',docNo:'綜工字第1133193164號',urgency:'普通件',issueDate:'2025-01-24',receiveDate:'2025-01-24',unit:'綜施處',subject:'分析實驗室一次電規劃資料',signedBy:'高君銓',notes:'退回修正'},
{id:'corr289',direction:'in',docNo:'碳集字第114020401號',urgency:'普通件',issueDate:'2025-02-04',receiveDate:'2025-02-05',unit:'碳集應用',subject:'檢送建築裝修分析實驗室(D版)',signedBy:'高君銓',notes:''},
{id:'corr290',direction:'in',docNo:'碳集字第114020501號',urgency:'普通件',issueDate:'2025-02-05',receiveDate:'2025-02-06',unit:'碳集應用',subject:'檢送114年1月工作月報',signedBy:'高君銓',notes:''},
{id:'corr291',direction:'in',docNo:'綜工字第1148013722號',urgency:'普通件',issueDate:'2025-02-05',receiveDate:'2025-02-05',unit:'綜施處',subject:'第九次工程推動會議 會議記錄',signedBy:'高君銓',notes:''},
{id:'corr292',direction:'in',docNo:'建字第1140540521號',urgency:'普通件',issueDate:'2025-02-08',receiveDate:'2025-02-10',unit:'營建處',subject:'建築弱電圖(1版)審查結果',signedBy:'高君銓',notes:'准予備查'},
{id:'corr293',direction:'in',docNo:'碳集字第114020701號',urgency:'普通件',issueDate:'2025-02-07',receiveDate:'2025-02-10',unit:'碳集應用',subject:'檢送建築裝修圖(0版)',signedBy:'高君銓',notes:''},
{id:'corr294',direction:'in',docNo:'建字第1140540887號',urgency:'普通件',issueDate:'2025-02-08',receiveDate:'2025-02-11',unit:'營建處',subject:'OSBL(D版)審查結果',signedBy:'高君銓',notes:'准予備查'},
{id:'corr295',direction:'in',docNo:'碳集字第114021001號',urgency:'普通件',issueDate:'2025-02-10',receiveDate:'2025-02-11',unit:'碳集應用',subject:'檢送分析實驗室一次電契變資料(修正)',signedBy:'高君銓',notes:''},
{id:'corr296',direction:'in',docNo:'碳集字第114021002號',urgency:'普通件',issueDate:'2025-02-10',receiveDate:'2025-02-11',unit:'碳集應用',subject:'檢送工作人員名冊',signedBy:'高君銓',notes:''},
{id:'corr297',direction:'in',docNo:'建字第1140541630號',urgency:'普通件',issueDate:'2025-02-11',receiveDate:'2025-02-11',unit:'營建處',subject:'分析實驗室(D版)審查結果',signedBy:'高君銓',notes:'准予備查'},
{id:'corr298',direction:'in',docNo:'建字第1140541791號',urgency:'普通件',issueDate:'2025-02-14',receiveDate:'2025-02-14',unit:'營建處',subject:'建築裝修圖(0版)審查結果',signedBy:'高君銓',notes:'准予備查'},
{id:'corr299',direction:'out',docNo:'DNV-86321005-0036',urgency:'普通件',issueDate:'2025-02-19',receiveDate:'',unit:'DNV',subject:'檢送114年01月工作月報審查意見',signedBy:'',notes:''},
{id:'corr300',direction:'in',docNo:'建字第1140540840號',urgency:'普通件',issueDate:'2025-02-21',receiveDate:'2025-02-21',unit:'營建處',subject:'色彩計畫(B版)審查結果',signedBy:'黃惠君',notes:'退回修正'},
{id:'corr301',direction:'out',docNo:'86321005-0061',urgency:'普通件',issueDate:'2025-02-24',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送之人員名冊審查結果',signedBy:'',notes:''},
{id:'corr302',direction:'in',docNo:'碳集字第114030501號',urgency:'普通件',issueDate:'2025-03-05',receiveDate:'2025-03-07',unit:'碳集應用',subject:'提送114年2月工作月報',signedBy:'高君銓',notes:''},
{id:'corr303',direction:'in',docNo:'綜工字第1148028776號',urgency:'普通件',issueDate:'2025-03-07',receiveDate:'2025-03-07',unit:'綜施處',subject:'第十次工程推動會議紀錄',signedBy:'高君銓',notes:''},
{id:'corr304',direction:'in',docNo:'碳集字第114031101號',urgency:'普通件',issueDate:'2025-03-11',receiveDate:'2025-03-12',unit:'碳集應用',subject:'提送色彩計畫(C版)',signedBy:'高君銓',notes:''},
{id:'corr305',direction:'in',docNo:'綜工字第1143181480號',urgency:'普通件',issueDate:'2025-03-18',receiveDate:'2025-03-18',unit:'綜施處',subject:'分析實驗室一次電規劃第一次修正資料',signedBy:'高君銓',notes:'退回修正'},
{id:'corr306',direction:'in',docNo:'建字第1140541125號',urgency:'普通件',issueDate:'2025-03-26',receiveDate:'2025-03-27',unit:'營建處',subject:'色彩計畫(C版)審查結果',signedBy:'黃惠君',notes:'審查認可'},
{id:'corr307',direction:'in',docNo:'碳集字第114032601號',urgency:'普通件',issueDate:'2025-03-26',receiveDate:'2025-03-27',unit:'碳集應用',subject:'分析實驗室一次電規劃第二次修正設計圖',signedBy:'高君銓',notes:''},
{id:'corr308',direction:'in',docNo:'碳集字第114032602號',urgency:'普通件',issueDate:'2025-03-26',receiveDate:'2025-03-27',unit:'碳集應用',subject:'分析實驗室一次電規劃第二次修正報價單',signedBy:'高君銓',notes:''},
{id:'corr309',direction:'out',docNo:'86321005-0065',urgency:'普通件',issueDate:'2025-04-02',receiveDate:'',unit:'DNV',subject:'檢送114年3月監造工作月報',signedBy:'',notes:''},
{id:'corr310',direction:'in',docNo:'碳集字第114040801號',urgency:'普通件',issueDate:'2025-04-08',receiveDate:'2025-04-10',unit:'碳集應用',subject:'提送色彩計畫(0版)',signedBy:'高君銓',notes:''},
{id:'corr311',direction:'in',docNo:'碳集字第114040901號',urgency:'普通件',issueDate:'2025-04-09',receiveDate:'2025-04-11',unit:'碳集應用',subject:'提送114年3月工作月報',signedBy:'高君銓',notes:''},
{id:'corr312',direction:'in',docNo:'建字第1140541261號',urgency:'普通件',issueDate:'2025-04-15',receiveDate:'2025-04-15',unit:'營建處',subject:'色彩計畫0版准予備查',signedBy:'黃惠君',notes:'准予備查'},
{id:'corr313',direction:'out',docNo:'86321005-0066',urgency:'普通件',issueDate:'2025-04-16',receiveDate:'',unit:'DNV',subject:'114年4月份第1次協調會議紀錄',signedBy:'',notes:''},
{id:'corr314',direction:'in',docNo:'碳集字第114041601號',urgency:'普通件',issueDate:'2025-04-16',receiveDate:'2025-04-18',unit:'碳集應用',subject:'提送設備規格計算書(E版)',signedBy:'高君銓',notes:''},
{id:'corr315',direction:'in',docNo:'碳集字第114041602號',urgency:'普通件',issueDate:'2025-04-16',receiveDate:'2025-04-18',unit:'碳集應用',subject:'提送碳捕集廠細部設計圖機械類(一)(E版)',signedBy:'高君銓',notes:''},
{id:'corr316',direction:'in',docNo:'綜工字第1148044667號',urgency:'普通件',issueDate:'2025-04-17',receiveDate:'2025-04-18',unit:'綜施處',subject:'第十一次工程推動會議紀錄',signedBy:'高君銓',notes:''},
{id:'corr317',direction:'in',docNo:'建字第1140543651號',urgency:'普通件',issueDate:'2025-04-18',receiveDate:'2025-04-18',unit:'營建處',subject:'分析實驗室一次電規劃第二次修正設計圖說',signedBy:'高君銓',notes:'准予備查'},
{id:'corr318',direction:'out',docNo:'DNV-86321005-0038',urgency:'普通件',issueDate:'2025-04-18',receiveDate:'',unit:'DNV',subject:'114年3月工作月報審查意見',signedBy:'',notes:''},
{id:'corr319',direction:'in',docNo:'建字第1148051538號',urgency:'普通件',issueDate:'2025-04-23',receiveDate:'2025-04-23',unit:'營建處',subject:'細部設計圖說討論會議',signedBy:'高君銓',notes:''},
{id:'corr320',direction:'in',docNo:'碳集字第114042501號',urgency:'普通件',issueDate:'2025-04-25',receiveDate:'2025-04-30',unit:'碳集應用',subject:'更換工地負責人為蔡正偉',signedBy:'高君銓',notes:''},
{id:'corr321',direction:'out',docNo:'86321005-0067',urgency:'普通件',issueDate:'2025-04-30',receiveDate:'',unit:'DNV',subject:'更換工地負責人為蔡正偉之審查結果',signedBy:'',notes:''},
{id:'corr322',direction:'in',docNo:'碳集字第114050601號',urgency:'普通件',issueDate:'2025-05-06',receiveDate:'2025-05-07',unit:'碳集應用',subject:'檢送114年4月工作月報',signedBy:'黃惠君',notes:''},
{id:'corr323',direction:'in',docNo:'碳集字第114050602號',urgency:'普通件',issueDate:'2025-05-06',receiveDate:'2025-05-07',unit:'碳集應用',subject:'提送假設工程施工計畫(A版)',signedBy:'黃惠君',notes:''},
{id:'corr324',direction:'in',docNo:'碳集字第114050603號',urgency:'普通件',issueDate:'2025-05-06',receiveDate:'2025-05-07',unit:'碳集應用',subject:'提送擋土支撐、土方開挖及回填施工計畫(A版)',signedBy:'黃惠君',notes:''},
{id:'corr325',direction:'out',docNo:'86321005-0069',urgency:'普通件',issueDate:'2025-05-14',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送三員人員名冊審查結果',signedBy:'',notes:''},
{id:'corr326',direction:'out',docNo:'DNV-86321005-0039',urgency:'普通件',issueDate:'2025-05-14',receiveDate:'',unit:'DNV',subject:'114年4月工作月報審查意見',signedBy:'',notes:''},
{id:'corr327',direction:'in',docNo:'建字第1140544747號',urgency:'普通件',issueDate:'2025-05-14',receiveDate:'2025-05-14',unit:'營建處',subject:'設備規格計算書(E版)審查結果',signedBy:'高君銓',notes:'退回修正'},
{id:'corr328',direction:'in',docNo:'建字第1140544748號',urgency:'普通件',issueDate:'2025-05-14',receiveDate:'2025-05-14',unit:'營建處',subject:'機械類(一)(E版)審查結果',signedBy:'高君銓',notes:'退回修正'},
{id:'corr329',direction:'out',docNo:'DNV-86321005-0040',urgency:'普通件',issueDate:'2025-05-27',receiveDate:'',unit:'DNV',subject:'檢還假設工程施工計畫A版',signedBy:'',notes:'退回修正'},
{id:'corr330',direction:'out',docNo:'DNV-86321005-0041',urgency:'普通件',issueDate:'2025-05-27',receiveDate:'',unit:'DNV',subject:'檢還擋土支撐、土方開挖及回填施工計畫A版',signedBy:'',notes:'退回修正'},
{id:'corr331',direction:'in',docNo:'碳集字第114052301號',urgency:'普通件',issueDate:'2025-05-23',receiveDate:'2025-05-28',unit:'碳集應用',subject:'檢送第2分期工作竣工報告表等竣工文件',signedBy:'高君銓',notes:''},
{id:'corr332',direction:'in',docNo:'碳集字第114052701號',urgency:'普通件',issueDate:'2025-05-27',receiveDate:'2025-05-28',unit:'碳集應用',subject:'檢送剩餘土石方處理施工計畫(A版)',signedBy:'高君銓',notes:''},
{id:'corr333',direction:'out',docNo:'86321005-0070',urgency:'普通件',issueDate:'2025-06-03',receiveDate:'',unit:'DNV',subject:'檢送114年5月監造月報',signedBy:'',notes:''},
{id:'corr334',direction:'out',docNo:'86321005-0071',urgency:'普通件',issueDate:'2025-06-03',receiveDate:'',unit:'DNV',subject:'114年5月份第1次協調會會議紀錄',signedBy:'',notes:''},
{id:'corr335',direction:'out',docNo:'DNV-86321005-0042',urgency:'普通件',issueDate:'2025-06-03',receiveDate:'',unit:'DNV',subject:'檢還第2分期工作竣工報告表',signedBy:'',notes:''},
{id:'corr336',direction:'in',docNo:'碳集字第114060501號',urgency:'普通件',issueDate:'2025-06-05',receiveDate:'2025-06-10',unit:'碳集應用',subject:'檢送114年5月工作月報',signedBy:'高君銓',notes:''},
{id:'corr337',direction:'in',docNo:'碳集字第114060601號',urgency:'普通件',issueDate:'2025-06-06',receiveDate:'2025-06-10',unit:'碳集應用',subject:'檢送結構設計圖(0版)',signedBy:'高君銓',notes:''},
{id:'corr338',direction:'in',docNo:'綜工字第1148073109號',urgency:'普通件',issueDate:'2025-06-06',receiveDate:'2025-06-06',unit:'綜施處',subject:'第十三次工程推動會議 會議紀錄',signedBy:'高君銓',notes:''},
{id:'corr339',direction:'out',docNo:'DNV-86321005-0043',urgency:'普通件',issueDate:'2025-06-09',receiveDate:'',unit:'DNV',subject:'有關建築執照之相關設計圖面申請文件未經甲方審查核准',signedBy:'',notes:''},
{id:'corr340',direction:'out',docNo:'DNV-86321005-0044',urgency:'普通件',issueDate:'2025-06-09',receiveDate:'',unit:'DNV',subject:'檢還剩餘土石方施工計畫A版',signedBy:'',notes:'退回修正'},
{id:'corr341',direction:'in',docNo:'碳集字第114061101號',urgency:'普通件',issueDate:'2025-06-11',receiveDate:'2025-06-13',unit:'碳集應用',subject:'檢送結構計算書(0版)',signedBy:'高君銓',notes:''},
{id:'corr342',direction:'out',docNo:'DNV-86321005-0045',urgency:'普通件',issueDate:'2025-06-16',receiveDate:'',unit:'DNV',subject:'檢送114年05月工作月報審查意見',signedBy:'',notes:''},
{id:'corr343',direction:'out',docNo:'86321005-0072',urgency:'普通件',issueDate:'2025-06-17',receiveDate:'',unit:'DNV',subject:'114年6月份第1次協調會會議紀錄',signedBy:'',notes:''},
{id:'corr344',direction:'in',docNo:'碳集字第1140618001號',urgency:'普通件',issueDate:'2025-06-18',receiveDate:'2025-06-20',unit:'碳集應用',subject:'分析實驗室一次電第二次報價單說明',signedBy:'高君銓',notes:''},
{id:'corr345',direction:'in',docNo:'綜工字第1148082187號',urgency:'普通件',issueDate:'2025-06-24',receiveDate:'2025-06-24',unit:'綜施處',subject:'第十四次推動會議通知',signedBy:'高君銓',notes:''},
{id:'corr346',direction:'in',docNo:'碳集字第114062301號',urgency:'普通件',issueDate:'2025-06-23',receiveDate:'2025-06-27',unit:'碳集應用',subject:'檢送建築設計圖(1版)',signedBy:'高君銓',notes:''},
{id:'corr347',direction:'in',docNo:'碳集字第114062601號',urgency:'普通件',issueDate:'2025-06-26',receiveDate:'2025-06-27',unit:'碳集應用',subject:'檢送設備規格計算書(F版)',signedBy:'高君銓',notes:''},
{id:'corr348',direction:'in',docNo:'碳集字第114062701號',urgency:'普通件',issueDate:'2025-06-27',receiveDate:'2025-06-30',unit:'碳集應用',subject:'檢送機械(一)(F版)',signedBy:'黃惠君',notes:''},
{id:'corr349',direction:'in',docNo:'碳集字第114070101號',urgency:'普通件',issueDate:'2025-07-01',receiveDate:'2025-07-02',unit:'碳集應用',subject:'檢送工作人員名冊兩員',signedBy:'高君銓',notes:''},
{id:'corr350',direction:'in',docNo:'綜工字第1148086169號',urgency:'普通件',issueDate:'2025-07-03',receiveDate:'2025-07-04',unit:'綜施處',subject:'114年7月4日工務所設置位置討論會議通知',signedBy:'高君銓',notes:''},
{id:'corr351',direction:'in',docNo:'建字第1140546653號',urgency:'普通件',issueDate:'2025-07-09',receiveDate:'2025-07-11',unit:'營建處',subject:'設備規格計算書(F版)審查結果',signedBy:'高君銓',notes:'准予備查(有修正處)'},
{id:'corr352',direction:'in',docNo:'建字第1140546676號',urgency:'普通件',issueDate:'2025-07-09',receiveDate:'2025-07-11',unit:'營建處',subject:'機械類(一)(F版)審查結果',signedBy:'高君銓',notes:'准予備查(有修正處)'},
{id:'corr353',direction:'in',docNo:'碳集字第114070901號',urgency:'普通件',issueDate:'2025-07-09',receiveDate:'2025-07-11',unit:'碳集應用',subject:'檢送114年6月工作月報',signedBy:'高君銓',notes:''},
{id:'corr354',direction:'in',docNo:'建字第1148091327號',urgency:'普通件',issueDate:'2025-07-10',receiveDate:'2025-07-14',unit:'營建處',subject:'114年7月21日機械類設計圖審查及討論會議通知',signedBy:'高君銓',notes:''},
{id:'corr355',direction:'in',docNo:'綜工字第1148090141號',urgency:'普通件',issueDate:'2025-07-10',receiveDate:'2025-07-14',unit:'綜施處',subject:'第十四次推動會議紀錄',signedBy:'高君銓',notes:''},
{id:'corr356',direction:'in',docNo:'碳集字第1140546234號',urgency:'普通件',issueDate:'2025-07-14',receiveDate:'',unit:'營建處',subject:'結構細部設計圖0A版審查結果',signedBy:'',notes:'退回修正'},
{id:'corr357',direction:'in',docNo:'碳集字第1140546350號',urgency:'普通件',issueDate:'2025-07-14',receiveDate:'',unit:'營建處',subject:'結構計算書0A版審查結果',signedBy:'',notes:'退回修正'},
{id:'corr358',direction:'in',docNo:'碳集字第114071601號',urgency:'普通件',issueDate:'2025-07-16',receiveDate:'2025-07-17',unit:'碳集應用',subject:'提送分析實驗室(0版)',signedBy:'高君銓',notes:''},
{id:'corr359',direction:'in',docNo:'建字第1140546652號',urgency:'普通件',issueDate:'2025-07-17',receiveDate:'2025-07-17',unit:'營建處',subject:'建築設計圖(1版)審查結果',signedBy:'高君銓',notes:'退回修正'},
{id:'corr360',direction:'in',docNo:'綜工字第1143186051號',urgency:'普通件',issueDate:'2025-07-17',receiveDate:'2025-07-18',unit:'綜施處',subject:'分析實驗室一次電規劃暨第二次修正報價單事宜',signedBy:'高君銓',notes:'再送報價單'},
{id:'corr361',direction:'in',docNo:'碳集字第114071601號',urgency:'普通件',issueDate:'2025-07-17',receiveDate:'2025-07-18',unit:'碳集應用',subject:'有關中火發電廠用地乙節',signedBy:'高君銓',notes:''},
{id:'corr362',direction:'in',docNo:'傳真',urgency:'普通件',issueDate:'2025-07-21',receiveDate:'',unit:'營建處',subject:'建議版次修改結構設計圖下次以E版送審/計算書以F版送審',signedBy:'',notes:''},
{id:'corr363',direction:'in',docNo:'綜工字第1148096964號',urgency:'普通件',issueDate:'2025-07-23',receiveDate:'2025-07-23',unit:'綜施處',subject:'第十五次工程推動會議通知',signedBy:'高君銓',notes:''},
{id:'corr364',direction:'in',docNo:'綜工字第1148097235號',urgency:'普通件',issueDate:'2025-07-28',receiveDate:'2025-07-30',unit:'綜施處',subject:'有關細部設計圖面送審進度落後及逾期罰款一事',signedBy:'高君銓',notes:''},
{id:'corr365',direction:'in',docNo:'碳集字第114072801號',urgency:'普通件',issueDate:'2025-07-28',receiveDate:'2025-07-30',unit:'碳集應用',subject:'提送機械類(二)E版',signedBy:'高君銓',notes:''},
{id:'corr366',direction:'in',docNo:'碳集字第114073001號',urgency:'普通件',issueDate:'2025-07-30',receiveDate:'2025-08-04',unit:'碳集應用',subject:'分析實驗室一次電第三次修正報價',signedBy:'高君銓',notes:''},
{id:'corr367',direction:'in',docNo:'碳集字第114080101號',urgency:'普通件',issueDate:'2025-08-01',receiveDate:'2025-08-04',unit:'碳集應用',subject:'提送吊裝計畫A版',signedBy:'高君銓',notes:''},
{id:'corr368',direction:'in',docNo:'碳集字第114080102號',urgency:'普通件',issueDate:'2025-08-01',receiveDate:'2025-08-04',unit:'碳集應用',subject:'提送風險評估報告(製程設計)A版',signedBy:'高君銓',notes:''},
{id:'corr369',direction:'in',docNo:'碳集字第114080103號',urgency:'普通件',issueDate:'2025-08-01',receiveDate:'2025-08-04',unit:'碳集應用',subject:'提送營建工地逕流廢水削減計畫A版',signedBy:'高君銓',notes:''},
{id:'corr370',direction:'in',docNo:'綜工字第1143188059號',urgency:'普通件',issueDate:'2025-08-04',receiveDate:'2025-08-05',unit:'綜施處',subject:'有關碳集提請甲方協助事項回復',signedBy:'高君銓',notes:''},
{id:'corr371',direction:'in',docNo:'建字第1140555188號',urgency:'普通件',issueDate:'2025-08-06',receiveDate:'2025-08-08',unit:'營建處',subject:'建築裝修圖分析實驗室(0版)審查結果',signedBy:'高君銓',notes:'准予備查'},
{id:'corr372',direction:'in',docNo:'綜工字第1148103462號',urgency:'普通件',issueDate:'2025-08-07',receiveDate:'2025-08-08',unit:'綜施處',subject:'第十五次工程推動會議紀錄',signedBy:'高君銓',notes:''},
{id:'corr373',direction:'in',docNo:'碳集字第114080701號',urgency:'普通件',issueDate:'2025-08-07',receiveDate:'2025-08-11',unit:'碳集應用',subject:'檢送114年7月工作月報',signedBy:'高君銓',notes:''},
{id:'corr374',direction:'in',docNo:'綜工字第1148105453號',urgency:'普通件',issueDate:'2025-08-11',receiveDate:'2025-08-12',unit:'綜施處',subject:'第十六次工程推動會議通知',signedBy:'高君銓',notes:''},
{id:'corr375',direction:'out',docNo:'10490817-0079',urgency:'普通件',issueDate:'2025-08-11',receiveDate:'',unit:'DNV',subject:'有關營建工地逕流廢水削減計畫A版審查結果',signedBy:'',notes:''},
{id:'corr376',direction:'in',docNo:'綜工字第1143188524號',urgency:'普通件',issueDate:'2025-08-13',receiveDate:'2025-08-15',unit:'綜施處',subject:'分析實驗室一次電第三次修正報價不予審查',signedBy:'黃惠君',notes:''},
{id:'corr377',direction:'in',docNo:'碳集字第114081401號',urgency:'普通件',issueDate:'2025-08-14',receiveDate:'2025-08-15',unit:'碳集應用',subject:'檢送假設工程施工計畫B版',signedBy:'黃惠君',notes:''},
{id:'corr378',direction:'in',docNo:'綜工字第1148108939號',urgency:'普通件',issueDate:'2025-08-15',receiveDate:'2025-08-15',unit:'綜施處',subject:'基層工安座談會',signedBy:'高君銓',notes:''},
{id:'corr379',direction:'in',docNo:'碳集字第114082001號',urgency:'普通件',issueDate:'2025-08-20',receiveDate:'2025-08-22',unit:'碳集應用',subject:'檢送結構計算書(F版)',signedBy:'高君銓',notes:''},
{id:'corr380',direction:'in',docNo:'碳集字第114082002號',urgency:'普通件',issueDate:'2025-08-20',receiveDate:'2025-08-22',unit:'碳集應用',subject:'檢送建築設計圖(2版)',signedBy:'高君銓',notes:''},
{id:'corr381',direction:'in',docNo:'研字第1148110205號',urgency:'普通件',issueDate:'2025-08-22',receiveDate:'2025-08-22',unit:'綜研所',subject:'貨櫃安置現勘會議',signedBy:'高君銓',notes:''},
{id:'corr382',direction:'in',docNo:'碳集字第114082101號',urgency:'普通件',issueDate:'2025-08-21',receiveDate:'2025-08-25',unit:'碳集應用',subject:'檢送結構細設圖(E版)',signedBy:'高君銓',notes:''},
{id:'corr383',direction:'in',docNo:'綜工字第1148113666號',urgency:'普通件',issueDate:'2025-08-28',receiveDate:'2025-09-01',unit:'綜施處',subject:'第十六次工程推動會議紀錄',signedBy:'高君銓',notes:''},
{id:'corr384',direction:'in',docNo:'建字第1140555550號',urgency:'普通件',issueDate:'2025-08-28',receiveDate:'2025-09-01',unit:'營建處',subject:'有關機械類(二)(E版)審查結果',signedBy:'高君銓',notes:'准予備查(有修正處)'},
{id:'corr385',direction:'out',docNo:'10490817-0080',urgency:'普通件',issueDate:'2025-09-01',receiveDate:'',unit:'DNV',subject:'114年8月份第2次協調會議紀錄',signedBy:'',notes:''},
{id:'corr386',direction:'out',docNo:'DNV-10490817-0051',urgency:'普通件',issueDate:'2025-09-01',receiveDate:'',unit:'DNV',subject:'假設工程施工計畫B版審查結果',signedBy:'',notes:'退回修正'},
{id:'corr387',direction:'out',docNo:'10490817-0081',urgency:'普通件',issueDate:'2025-09-03',receiveDate:'',unit:'DNV',subject:'提送114年8月監造月報',signedBy:'',notes:''},
{id:'corr388',direction:'in',docNo:'綜工字第1143188814號',urgency:'普通件',issueDate:'2025-09-04',receiveDate:'2025-09-05',unit:'綜施處',subject:'逕流廢水削減計畫A版審查結果',signedBy:'高君銓',notes:'退回修正'},
{id:'corr389',direction:'in',docNo:'研字第1148118589號',urgency:'普通件',issueDate:'2025-09-05',receiveDate:'2025-09-05',unit:'綜研所',subject:'貨櫃屋安置現勘會議紀錄',signedBy:'高君銓',notes:''},
{id:'corr390',direction:'out',docNo:'DNV-10490817-0052',urgency:'普通件',issueDate:'2025-09-05',receiveDate:'',unit:'DNV',subject:'逕流廢水削減計畫A版審查結果',signedBy:'',notes:'退回修正'},
{id:'corr391',direction:'in',docNo:'建字第1140556355號',urgency:'普通件',issueDate:'2025-09-08',receiveDate:'2025-09-08',unit:'營建處',subject:'建築設計圖(2版)',signedBy:'高君銓',notes:'准予備查'},
{id:'corr392',direction:'out',docNo:'10490817-0082',urgency:'普通件',issueDate:'2025-09-08',receiveDate:'',unit:'DNV',subject:'檢送114年9月份第1次協調會議紀錄',signedBy:'',notes:''},
{id:'corr393',direction:'in',docNo:'碳集字第114090901號',urgency:'普通件',issueDate:'2025-09-09',receiveDate:'2025-09-10',unit:'碳集應用',subject:'檢送114年8月工作月報',signedBy:'高君銓',notes:''},
{id:'corr394',direction:'in',docNo:'碳集字第114090902號',urgency:'普通件',issueDate:'2025-09-09',receiveDate:'2025-09-10',unit:'碳集應用',subject:'檢送風險評估報告(施工建造)',signedBy:'高君銓',notes:''},
{id:'corr395',direction:'in',docNo:'碳集字第114091201號',urgency:'普通件',issueDate:'2025-09-12',receiveDate:'2025-09-15',unit:'碳集應用',subject:'第二次檢送第二分期竣工報告表',signedBy:'高君銓',notes:'作廢'},
{id:'corr396',direction:'in',docNo:'碳集字第114091202號',urgency:'普通件',issueDate:'2025-09-12',receiveDate:'2025-09-15',unit:'碳集應用',subject:'檢送ISBL(D版)',signedBy:'高君銓',notes:''},
{id:'corr397',direction:'out',docNo:'10490817-0083',urgency:'普通件',issueDate:'2025-09-18',receiveDate:'',unit:'DNV',subject:'檢送114年9月份第2次協調會議紀錄',signedBy:'',notes:''},
{id:'corr398',direction:'in',docNo:'碳集字第114091701號',urgency:'普通件',issueDate:'2025-09-17',receiveDate:'2025-09-22',unit:'碳集應用',subject:'第二次檢送第2分期工作竣工報告表等竣工文件',signedBy:'高君銓',notes:'收文期間有抽換'},
{id:'corr399',direction:'in',docNo:'綜工字第1148127077號',urgency:'普通件',issueDate:'2025-09-19',receiveDate:'2025-09-22',unit:'綜施處',subject:'第十七次工程推動會議通知',signedBy:'高君銓',notes:''},
{id:'corr400',direction:'in',docNo:'建字第1140556351號',urgency:'普通件',issueDate:'2025-09-19',receiveDate:'2025-09-24',unit:'營建處',subject:'結構計算書F版審查結果',signedBy:'黃惠君',notes:'准予備查(有修正處)'},
{id:'corr401',direction:'in',docNo:'建字第1140556389號',urgency:'普通件',issueDate:'2025-09-22',receiveDate:'2025-09-24',unit:'營建處',subject:'結構細部設計圖E版審查結果',signedBy:'黃惠君',notes:'准予備查(有修正處)'},
{id:'corr402',direction:'out',docNo:'10490817-0084',urgency:'普通件',issueDate:'2025-09-22',receiveDate:'',unit:'DNV',subject:'檢送廠商第2分期竣工報告表審查結果',signedBy:'',notes:''},
{id:'corr403',direction:'out',docNo:'DNV-10490817-0053',urgency:'普通件',issueDate:'2025-09-22',receiveDate:'',unit:'DNV',subject:'檢送114年08月工作月報審查意見',signedBy:'',notes:''},
{id:'corr404',direction:'out',docNo:'DNV-10490817-0054',urgency:'普通件',issueDate:'2025-09-25',receiveDate:'',unit:'DNV',subject:'檢還風險評估報告(施工建造)A版',signedBy:'',notes:'退回修正'},
{id:'corr405',direction:'in',docNo:'碳集字第114092301號',urgency:'普通件',issueDate:'2025-09-23',receiveDate:'2025-09-26',unit:'碳集應用',subject:'檢送儀控類(D版)',signedBy:'高君銓',notes:''},
{id:'corr406',direction:'in',docNo:'碳集字第114092501號',urgency:'普通件',issueDate:'2025-09-25',receiveDate:'2025-09-30',unit:'碳集應用',subject:'檢送假設工程施工計畫C版',signedBy:'高君銓',notes:''},
{id:'corr407',direction:'in',docNo:'建字第1140556829號',urgency:'普通件',issueDate:'2025-09-26',receiveDate:'2025-10-01',unit:'營建處',subject:'ISBL(D版)審查結果',signedBy:'高君銓',notes:'准予備查(有修正處)'},
{id:'corr408',direction:'in',docNo:'綜工字第1148131047號',urgency:'普通件',issueDate:'2025-09-30',receiveDate:'2025-10-01',unit:'綜施處',subject:'第十七次工程推動會議紀錄',signedBy:'高君銓',notes:''},
{id:'corr409',direction:'in',docNo:'綜工字第1143191005號',urgency:'普通件',issueDate:'2025-10-08',receiveDate:'2025-10-09',unit:'綜施處',subject:'第二分期竣工報告表(核准)',signedBy:'高君銓',notes:''},
{id:'corr410',direction:'in',docNo:'碳集字第114100901號',urgency:'普通件',issueDate:'2025-10-09',receiveDate:'2025-10-13',unit:'碳集應用',subject:'檢送114年9月工作月報',signedBy:'高君銓',notes:''},
{id:'corr411',direction:'out',docNo:'DNV-10490817-0055',urgency:'普通件',issueDate:'2025-10-14',receiveDate:'',unit:'DNV',subject:'第三次催告碳集趲趕工進',signedBy:'',notes:''},
{id:'corr412',direction:'out',docNo:'DNV-10490817-0056',urgency:'普通件',issueDate:'2025-10-14',receiveDate:'',unit:'DNV',subject:'檢還假設工程計畫C版',signedBy:'',notes:'退回修正'},
{id:'corr413',direction:'in',docNo:'碳集字第114101601號',urgency:'普通件',issueDate:'2025-10-16',receiveDate:'2025-10-20',unit:'碳集應用',subject:'檢送第一次估驗請款資料',signedBy:'高君銓',notes:''},
{id:'corr414',direction:'out',docNo:'10490817-0087',urgency:'普通件',issueDate:'2025-10-20',receiveDate:'',unit:'DNV',subject:'114年10月份第1次協調會會議紀錄',signedBy:'',notes:''},
{id:'corr415',direction:'in',docNo:'建字第1140557183號',urgency:'普通件',issueDate:'2025-10-20',receiveDate:'2025-10-23',unit:'營建處',subject:'儀控類(D版)審查結果',signedBy:'高君銓',notes:'准予備查(有修正處)'},
{id:'corr416',direction:'in',docNo:'綜工字第1148140850號',urgency:'普通件',issueDate:'2025-10-22',receiveDate:'2025-10-23',unit:'綜施處',subject:'第十八次工程推動會議通知',signedBy:'高君銓',notes:''},
{id:'corr417',direction:'in',docNo:'碳集字第114102201號',urgency:'普通件',issueDate:'2025-10-22',receiveDate:'2025-10-27',unit:'碳集應用',subject:'假設工程施工114年第1次共同作業協議組織會議',signedBy:'高君銓',notes:''},
{id:'corr418',direction:'in',docNo:'碳集字第114102202號',urgency:'普通件',issueDate:'2025-10-22',receiveDate:'2025-10-27',unit:'碳集應用',subject:'檢送第1分期竣工文件',signedBy:'高君銓',notes:'因廠商缺失，未附到相關附件，且發函日期與實際寄送日期不符，故要求此封函文作廢。'},
{id:'corr419',direction:'out',docNo:'DNV-10490817-0057',urgency:'普通件',issueDate:'2025-10-23',receiveDate:'',unit:'DNV',subject:'檢送第一次估驗計價單審查意見',signedBy:'',notes:'退回修正'},
{id:'corr420',direction:'out',docNo:'DNV-10490817-0058',urgency:'普通件',issueDate:'2025-10-27',receiveDate:'',unit:'DNV',subject:'檢送114年09月工作月報審查意見',signedBy:'',notes:''},
{id:'corr421',direction:'out',docNo:'DNV-10490817-0059',urgency:'普通件',issueDate:'2025-10-28',receiveDate:'',unit:'DNV',subject:'第四次催告碳集趲趕工進',signedBy:'',notes:'10/21開始進度落後2%'},
{id:'corr422',direction:'in',docNo:'碳集字第114102801號',urgency:'普通件',issueDate:'2025-10-28',receiveDate:'2025-10-29',unit:'碳集應用',subject:'第1分期工作竣工報告表',signedBy:'高君銓',notes:'30號讓廠商抽換'},
{id:'corr423',direction:'in',docNo:'碳集字第114102802號',urgency:'普通件',issueDate:'2025-10-28',receiveDate:'2025-10-29',unit:'碳集應用',subject:'HAZOP開會通知單',signedBy:'高君銓',notes:''},
{id:'corr424',direction:'out',docNo:'10490817-0088',urgency:'普通件',issueDate:'2025-10-31',receiveDate:'',unit:'DNV',subject:'檢送廠商第1分期竣工報告表審查結果',signedBy:'',notes:''},
{id:'corr425',direction:'in',docNo:'碳集字第114102901號',urgency:'普通件',issueDate:'2025-10-29',receiveDate:'2025-10-31',unit:'碳集應用',subject:'檢送前期評估報告1版',signedBy:'高君銓',notes:''},
{id:'corr426',direction:'in',docNo:'碳集字第114102902號',urgency:'普通件',issueDate:'2025-10-29',receiveDate:'2025-10-31',unit:'碳集應用',subject:'檢送工程專用章申請',signedBy:'高君銓',notes:''},
{id:'corr427',direction:'in',docNo:'碳集字第114102903號',urgency:'普通件',issueDate:'2025-10-29',receiveDate:'2025-10-31',unit:'碳集應用',subject:'第一次估驗請款修正資料',signedBy:'高君銓',notes:''},
{id:'corr428',direction:'in',docNo:'碳集字第114103001號',urgency:'普通件',issueDate:'2025-10-30',receiveDate:'2025-10-31',unit:'碳集應用',subject:'工作人員名冊(假設工程施工人員)',signedBy:'高君銓',notes:''},
{id:'corr429',direction:'out',docNo:'10490817-0089',urgency:'普通件',issueDate:'2025-10-31',receiveDate:'',unit:'DNV',subject:'檢送廠商第1次估驗請款計價單審查結果',signedBy:'',notes:''},
{id:'corr430',direction:'out',docNo:'DNV-10490817-0060',urgency:'普通件',issueDate:'2025-11-07',receiveDate:'',unit:'DNV',subject:'檢送工作人員名冊(假設工程施工人員)10名審查意見',signedBy:'',notes:''},
{id:'corr431',direction:'in',docNo:'碳集字第114110701號',urgency:'普通件',issueDate:'2025-11-07',receiveDate:'2025-11-10',unit:'碳集應用',subject:'檢送假設工程施工計畫(D版)',signedBy:'高君銓',notes:''},
{id:'corr432',direction:'in',docNo:'碳集字第114110702號',urgency:'普通件',issueDate:'2025-11-07',receiveDate:'2025-11-10',unit:'碳集應用',subject:'檢送剩餘土石方處理施工計畫(B版)',signedBy:'高君銓',notes:''},
{id:'corr433',direction:'in',docNo:'碳集字第114110703號',urgency:'普通件',issueDate:'2025-11-07',receiveDate:'2025-11-10',unit:'碳集應用',subject:'檢送擋土支撐、土方開挖及回填施工計畫(B版)',signedBy:'高君銓',notes:''},
{id:'corr434',direction:'in',docNo:'碳集字第114110704號',urgency:'普通件',issueDate:'2025-11-07',receiveDate:'2025-11-10',unit:'碳集應用',subject:'檢送114年10月工作月報',signedBy:'高君銓',notes:''},
{id:'corr435',direction:'in',docNo:'碳集字第114111001號',urgency:'普通件',issueDate:'2025-11-10',receiveDate:'2025-11-11',unit:'碳集應用',subject:'檢送逕流廢水削減計畫B版',signedBy:'高君銓',notes:''},
{id:'corr436',direction:'in',docNo:'碳集字第114111001號',urgency:'普通件',issueDate:'2025-11-10',receiveDate:'2025-11-11',unit:'碳集應用',subject:'檢送114年第1次共同作業協議組織會議(假設工程)會議紀錄',signedBy:'高君銓',notes:''},
{id:'corr437',direction:'in',docNo:'綜工字第1148150939號',urgency:'普通件',issueDate:'2025-11-11',receiveDate:'2025-11-13',unit:'綜施處',subject:'檢送第十八次工程推動會議紀錄',signedBy:'高君銓',notes:''},
{id:'corr438',direction:'in',docNo:'碳集字第114111101號',urgency:'普通件',issueDate:'2025-11-11',receiveDate:'2025-11-12',unit:'碳集應用',subject:'更換職業安全衛生人員紀佑達為周睿昇',signedBy:'高君銓',notes:''},
{id:'corr439',direction:'in',docNo:'綜工字第1143192313號',urgency:'普通件',issueDate:'2025-11-12',receiveDate:'2025-11-13',unit:'綜施處',subject:'檢送第一分項竣工報告表',signedBy:'高君銓',notes:''},
{id:'corr440',direction:'in',docNo:'綜工字第1148152196號',urgency:'普通件',issueDate:'2025-11-13',receiveDate:'2025-11-14',unit:'綜施處',subject:'第十九次工程推動會議通知',signedBy:'高君銓',notes:''},
{id:'corr441',direction:'in',docNo:'碳集字第114111401號',urgency:'普通件',issueDate:'2025-11-14',receiveDate:'2025-11-17',unit:'碳集應用',subject:'更換品管人員黃雍傑為林益興',signedBy:'高君銓',notes:''},
{id:'corr442',direction:'in',docNo:'碳集字第114111402號',urgency:'普通件',issueDate:'2025-11-14',receiveDate:'2025-11-17',unit:'碳集應用',subject:'更換工地即時影像監看人員張哲維為陳吉南',signedBy:'高君銓',notes:''},
{id:'corr443',direction:'in',docNo:'碳集字第114111403號',urgency:'普通件',issueDate:'2025-11-14',receiveDate:'2025-11-17',unit:'碳集應用',subject:'檢送分析實驗室一次電契變資料(第四次修正圖說及報價)',signedBy:'高君銓',notes:''},
{id:'corr444',direction:'out',docNo:'10490817-0097',urgency:'普通件',issueDate:'2025-11-19',receiveDate:'',unit:'DNV',subject:'有關碳集品管人員黃雍傑更換為林益興審查結果',signedBy:'',notes:'符合契約規定'},
{id:'corr445',direction:'out',docNo:'10490817-0098',urgency:'普通件',issueDate:'2025-11-19',receiveDate:'',unit:'DNV',subject:'有關CCTV人員張哲維更換為陳吉南審查結果',signedBy:'',notes:'符合契約規定'},
{id:'corr446',direction:'out',docNo:'DNV-10490817-0062',urgency:'普通件',issueDate:'2025-11-19',receiveDate:'',unit:'DNV',subject:'檢還假設工程施工計畫D版',signedBy:'',notes:'退回修正'},
{id:'corr447',direction:'out',docNo:'DNV-10490817-0063',urgency:'普通件',issueDate:'2025-11-19',receiveDate:'',unit:'DNV',subject:'檢還擋土支撐、土方開挖及回填施工計畫B版',signedBy:'',notes:'不予進版'},
{id:'corr448',direction:'out',docNo:'DNV-10490817-0064',urgency:'普通件',issueDate:'2025-11-19',receiveDate:'',unit:'DNV',subject:'檢還剩餘土石方施工計畫B版',signedBy:'',notes:'不予進版'},
{id:'corr449',direction:'in',docNo:'碳集字第114111801號',urgency:'普通件',issueDate:'2025-11-18',receiveDate:'2025-11-19',unit:'碳集應用',subject:'檢送第二次估驗請款資料',signedBy:'高君銓',notes:''},
{id:'corr450',direction:'in',docNo:'碳集字第114111802號',urgency:'普通件',issueDate:'2025-11-18',receiveDate:'2025-11-19',unit:'碳集應用',subject:'檢送工作人員名冊(假設工程9員)修正資料',signedBy:'高君銓',notes:''},
{id:'corr451',direction:'in',docNo:'綜工字第1143192819號',urgency:'普通件',issueDate:'2025-11-19',receiveDate:'2025-11-20',unit:'綜施處',subject:'工安人員同意更換為周睿昇',signedBy:'高君銓',notes:''},
{id:'corr452',direction:'out',docNo:'10490817-0099',urgency:'普通件',issueDate:'2022-11-20',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送之人員名冊(假設工程9員)審查結果',signedBy:'',notes:''},
{id:'corr453',direction:'out',docNo:'10490817-0100',urgency:'普通件',issueDate:'2025-11-21',receiveDate:'',unit:'DNV',subject:'檢送廠商第2次估驗請款計價單審查結果',signedBy:'',notes:''},
{id:'corr454',direction:'in',docNo:'碳集字第114112001號',urgency:'普通件',issueDate:'2025-11-20',receiveDate:'2025-11-21',unit:'碳集應用',subject:'檢送施工圍籬材料(A版)',signedBy:'高君銓',notes:''},
{id:'corr455',direction:'in',docNo:'碳集字第114112002號',urgency:'普通件',issueDate:'2025-11-20',receiveDate:'2025-11-21',unit:'碳集應用',subject:'詳細價目表(A版)',signedBy:'高君銓',notes:''},
{id:'corr456',direction:'in',docNo:'碳集字第114112003號',urgency:'普通件',issueDate:'2025-11-20',receiveDate:'2025-11-21',unit:'碳集應用',subject:'檢送工作人員名冊(圍籬、怪手)8名',signedBy:'高君銓',notes:''},
{id:'corr457',direction:'in',docNo:'綜工字第1143192253號',urgency:'普通件',issueDate:'2025-11-17',receiveDate:'2025-11-21',unit:'綜施處',subject:'碳集公司工程專用章履約事宜礙難同意',signedBy:'高君銓',notes:''},
{id:'corr458',direction:'in',docNo:'綜工字第1143192818號',urgency:'普通件',issueDate:'2025-11-21',receiveDate:'2025-11-24',unit:'綜施處',subject:'有關更換監造人員事宜',signedBy:'高君銓',notes:'全部同意'},
{id:'corr459',direction:'out',docNo:'DNV-10490817-0065',urgency:'普通件',issueDate:'2025-11-24',receiveDate:'',unit:'DNV',subject:'檢還圍籬怪手工作人員名冊8名',signedBy:'',notes:''},
{id:'corr460',direction:'out',docNo:'DNV-10490817-0066',urgency:'普通件',issueDate:'2025-11-24',receiveDate:'',unit:'DNV',subject:'有關營建工地逕流廢水削減計畫',signedBy:'',notes:''},
{id:'corr461',direction:'in',docNo:'碳集字第114112101號',urgency:'普通件',issueDate:'2025-11-21',receiveDate:'2025-11-24',unit:'碳集應用',subject:'檢送京承營造下包商契約',signedBy:'高君銓',notes:''},
{id:'corr462',direction:'in',docNo:'碳集字第1141121002號',urgency:'普通件',issueDate:'2025-11-21',receiveDate:'2025-11-24',unit:'碳集應用',subject:'檢送工作人員名冊(水電、PC樁)',signedBy:'高君銓',notes:''},
{id:'corr463',direction:'in',docNo:'碳集字第114112501號',urgency:'普通件',issueDate:'2025-11-25',receiveDate:'2025-11-27',unit:'碳集應用',subject:'檢送鋼筋、模板、混凝土分項施工計劃(A版)',signedBy:'高君銓',notes:''},
{id:'corr464',direction:'out',docNo:'DNV-10490817-0067',urgency:'普通件',issueDate:'2025-11-25',receiveDate:'',unit:'DNV',subject:'檢送分包商京城營造契約審查意見',signedBy:'',notes:''},
{id:'corr465',direction:'out',docNo:'DNV-10490817-0068',urgency:'普通件',issueDate:'2025-11-27',receiveDate:'',unit:'DNV',subject:'檢送工作人員名冊 - 水電、PC樁及工程師15名審查意見',signedBy:'',notes:''},
{id:'corr466',direction:'in',docNo:'綜工字第1143193019號',urgency:'普通件',issueDate:'2025-11-26',receiveDate:'2025-11-27',unit:'綜施處',subject:'品管人員黃雍傑同意更換為林益興',signedBy:'高君銓',notes:''},
{id:'corr467',direction:'in',docNo:'綜工字第1143193020號',urgency:'普通件',issueDate:'2025-11-26',receiveDate:'2025-11-27',unit:'綜施處',subject:'CCTV人員張哲維同意更換為陳吉南',signedBy:'高君銓',notes:''},
{id:'corr468',direction:'in',docNo:'碳集字第114112701號',urgency:'普通件',issueDate:'2025-11-27',receiveDate:'2025-11-28',unit:'碳集應用',subject:'再次檢送分包商京城營造契約',signedBy:'高君銓',notes:''},
{id:'corr469',direction:'in',docNo:'碳集字第114112702號',urgency:'普通件',issueDate:'2025-11-27',receiveDate:'2025-11-28',unit:'碳集應用',subject:'再次檢送工程專用章',signedBy:'高君銓',notes:''},
{id:'corr470',direction:'out',docNo:'10490817-0101',urgency:'普通件',issueDate:'2025-11-28',receiveDate:'',unit:'DNV',subject:'檢送監造人員名冊(114年11月新增2人)',signedBy:'',notes:''},
{id:'corr471',direction:'out',docNo:'DNV-10490817-0069',urgency:'普通件',issueDate:'2025-11-28',receiveDate:'',unit:'DNV',subject:'檢送詳細價目表(A版)審查意見',signedBy:'',notes:'退回修正'},
{id:'corr472',direction:'out',docNo:'DNV-10490817-0070',urgency:'普通件',issueDate:'2025-11-28',receiveDate:'',unit:'DNV',subject:'檢送施工圍籬材料送審資料(A版)審查意見',signedBy:'',notes:'退回修正'},
{id:'corr473',direction:'in',docNo:'碳集字第114112801號',urgency:'普通件',issueDate:'2025-11-28',receiveDate:'2025-12-01',unit:'碳集應用',subject:'檢送基礎施工計畫(A版)',signedBy:'高君銓',notes:''},
{id:'corr474',direction:'in',docNo:'碳集字第114112802號',urgency:'普通件',issueDate:'2025-11-28',receiveDate:'2025-12-01',unit:'碳集應用',subject:'檢送營建機具進場申請(移動式起重機3台)',signedBy:'高君銓',notes:''},
{id:'corr475',direction:'out',docNo:'10490817-0103',urgency:'普通件',issueDate:'2025-12-01',receiveDate:'',unit:'DNV',subject:'檢送114年11月月報',signedBy:'',notes:''},
{id:'corr476',direction:'in',docNo:'碳集字第114120301號',urgency:'普通件',issueDate:'2025-12-03',receiveDate:'2025-12-04',unit:'碳集應用',subject:'檢送控制性低強度回填材料CLSM材料送審(A版)',signedBy:'高君銓',notes:''},
{id:'corr477',direction:'in',docNo:'碳集字第114120302號',urgency:'普通件',issueDate:'2025-12-03',receiveDate:'2025-12-04',unit:'碳集應用',subject:'檢送混凝土材料送審資料(A版)',signedBy:'高君銓',notes:''},
{id:'corr478',direction:'in',docNo:'碳集字第114120303號',urgency:'普通件',issueDate:'2025-12-03',receiveDate:'2025-12-04',unit:'碳集應用',subject:'檢送工作人員名冊(圍籬、怪手)8名修正資料',signedBy:'高君銓',notes:''},
{id:'corr479',direction:'in',docNo:'碳集字第114120304號',urgency:'普通件',issueDate:'2025-12-03',receiveDate:'2025-12-04',unit:'碳集應用',subject:'檢送工作人員名冊(朱健誠、胡書豪)',signedBy:'高君銓',notes:''},
{id:'corr480',direction:'in',docNo:'碳集字第114120305號',urgency:'普通件',issueDate:'2025-12-03',receiveDate:'2025-12-04',unit:'碳集應用',subject:'更換環境保護人員周俊德為胡書豪',signedBy:'高君銓',notes:''},
{id:'corr481',direction:'out',docNo:'10490817-0105',urgency:'普通件',issueDate:'2025-12-05',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送之人員名冊(圍籬及怪手8員)審查結果',signedBy:'',notes:''},
{id:'corr482',direction:'in',docNo:'碳集字第114120501號',urgency:'普通件',issueDate:'2025-12-05',receiveDate:'2025-12-08',unit:'碳集應用',subject:'檢送設備規格計算書(0版)',signedBy:'高君銓',notes:''},
{id:'corr483',direction:'in',docNo:'碳集字第1141120502號',urgency:'普通件',issueDate:'2025-12-05',receiveDate:'2025-12-08',unit:'碳集應用',subject:'檢送工作人員名冊補正資料(水電、PC樁及工程師15名)',signedBy:'高君銓',notes:''},
{id:'corr484',direction:'out',docNo:'DNV-10490817-0071',urgency:'普通件',issueDate:'2025-12-08',receiveDate:'',unit:'DNV',subject:'檢送移動式起重機3台送審資料(A版)',signedBy:'',notes:'退回修正'},
{id:'corr485',direction:'out',docNo:'10490817-0106',urgency:'普通件',issueDate:'2025-12-08',receiveDate:'',unit:'DNV',subject:'有關碳集更換環保人員為胡書豪審查結果',signedBy:'',notes:''},
{id:'corr486',direction:'out',docNo:'10490817-0107',urgency:'普通件',issueDate:'2025-12-08',receiveDate:'',unit:'DNV',subject:'有關碳集檢送下包商京承營造審查結果',signedBy:'',notes:''},
{id:'corr487',direction:'out',docNo:'10490817-0108',urgency:'普通件',issueDate:'2025-12-08',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送之人員名冊(朱健誠及胡書豪)審查結果',signedBy:'',notes:''},
{id:'corr488',direction:'in',docNo:'綜工字第1143193310號',urgency:'普通件',issueDate:'2025-12-08',receiveDate:'2025-12-09',unit:'綜施處',subject:'同意廠商工程專用章',signedBy:'高君銓',notes:''},
{id:'corr489',direction:'in',docNo:'碳集字第114120801號',urgency:'普通件',issueDate:'2025-12-08',receiveDate:'2025-12-09',unit:'碳集應用',subject:'檢送114年11月工作月報',signedBy:'高君銓',notes:''},
{id:'corr490',direction:'in',docNo:'綜工字第1143193365號',urgency:'普通件',issueDate:'2025-12-10',receiveDate:'2025-12-11',unit:'綜施處',subject:'檢還施工圍籬材料送審資料A版',signedBy:'黃惠君',notes:''},
{id:'corr491',direction:'in',docNo:'綜工字第1148165003號',urgency:'普通件',issueDate:'2025-12-10',receiveDate:'2025-12-11',unit:'綜施處',subject:'檢送第十九次工作推動會議會議紀錄',signedBy:'黃惠君',notes:''},
{id:'corr492',direction:'in',docNo:'綜工字第1148166941號',urgency:'普通件',issueDate:'2025-12-11',receiveDate:'2025-12-12',unit:'綜施處',subject:'電梯設置討論會議',signedBy:'高君銓',notes:''},
{id:'corr493',direction:'in',docNo:'碳集字第114121101號',urgency:'普通件',issueDate:'2025-12-11',receiveDate:'2025-12-12',unit:'碳集應用',subject:'檢送施工照相及攝錄影計畫A版',signedBy:'高君銓',notes:''},
{id:'corr494',direction:'out',docNo:'10490817-0109',urgency:'普通件',issueDate:'2025-12-12',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送水電、PC樁及工程師人員名冊(15員)審查結果',signedBy:'',notes:''},
{id:'corr495',direction:'out',docNo:'DNV-10490817-0072',urgency:'普通件',issueDate:'2025-12-15',receiveDate:'',unit:'DNV',subject:'檢還鋼筋模板混凝土施工計畫(A版)',signedBy:'',notes:'退回修正'},
{id:'corr496',direction:'out',docNo:'DNV-10490817-0073',urgency:'普通件',issueDate:'2025-12-15',receiveDate:'',unit:'DNV',subject:'檢還基礎施工計畫(A版)',signedBy:'',notes:'退回修正'},
{id:'corr497',direction:'in',docNo:'碳集字第114121501號',urgency:'普通件',issueDate:'2025-12-15',receiveDate:'2025-12-16',unit:'碳集應用',subject:'檢送假設工程施工計畫E版',signedBy:'高君銓',notes:''},
{id:'corr498',direction:'in',docNo:'碳集字第114121502號',urgency:'普通件',issueDate:'2025-12-15',receiveDate:'2025-12-16',unit:'碳集應用',subject:'檢送機械類(二)0版',signedBy:'高君銓',notes:''},
{id:'corr499',direction:'in',docNo:'碳集字第114121503號',urgency:'普通件',issueDate:'2025-12-15',receiveDate:'2025-12-16',unit:'碳集應用',subject:'檢送基樁施工計畫(A版)',signedBy:'高君銓',notes:''},
{id:'corr500',direction:'in',docNo:'碳集字第114121504號',urgency:'普通件',issueDate:'2025-12-15',receiveDate:'2025-12-16',unit:'碳集應用',subject:'檢送基樁載重試驗計畫(A版)',signedBy:'高君銓',notes:''},
{id:'corr501',direction:'in',docNo:'綜工字第1148167499號',urgency:'普通件',issueDate:'2025-12-15',receiveDate:'2025-12-16',unit:'綜施處',subject:'第二十次工作推動會議通知',signedBy:'高君銓',notes:''},
{id:'corr502',direction:'out',docNo:'10490817-0110',urgency:'普通件',issueDate:'2025-12-16',receiveDate:'',unit:'DNV',subject:'114年12月份第1次協調會會議紀錄',signedBy:'',notes:''},
{id:'corr503',direction:'out',docNo:'10490817-0111',urgency:'普通件',issueDate:'2025-12-17',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送營建機具進場申請(移動式起重機3台)審查結果',signedBy:'',notes:''},
{id:'corr504',direction:'in',docNo:'綜工字第1143193787號',urgency:'普通件',issueDate:'2025-12-17',receiveDate:'2025-12-18',unit:'綜施處',subject:'更換環境保護管理人員事宜(同意備查)',signedBy:'黃品瑄',notes:''},
{id:'corr505',direction:'in',docNo:'碳集字第114121801號',urgency:'普通件',issueDate:'2025-12-18',receiveDate:'2025-12-19',unit:'碳集應用',subject:'檢送營建機具進場申請(小貨車、挖土機3台)',signedBy:'黃品瑄',notes:''},
{id:'corr506',direction:'out',docNo:'10490817-0112',urgency:'普通件',issueDate:'2025-12-19',receiveDate:'',unit:'DNV',subject:'檢送監造計畫(0A版)',signedBy:'',notes:''},
{id:'corr507',direction:'in',docNo:'碳集字第114121901號',urgency:'普通件',issueDate:'2025-12-19',receiveDate:'2025-12-22',unit:'碳集應用',subject:'檢送營建機具進場申請(大貨車共3台、貨櫃曳引車共2台)',signedBy:'黃品瑄',notes:''},
{id:'corr508',direction:'out',docNo:'DNV-10490817-0074',urgency:'普通件',issueDate:'2025-12-22',receiveDate:'',unit:'DNV',subject:'檢送114年11月工作月報審查意見',signedBy:'',notes:''},
{id:'corr509',direction:'in',docNo:'碳集字第114122201號',urgency:'普通件',issueDate:'2025-12-22',receiveDate:'2025-12-23',unit:'碳集應用',subject:'檢送營建機具進場申請(挖土機共2台)',signedBy:'黃品瑄',notes:''},
{id:'corr510',direction:'out',docNo:'DNV-10490817-0075',urgency:'普通件',issueDate:'2025-12-23',receiveDate:'',unit:'DNV',subject:'檢送假設工程CLSM材料送審資料(A版)審查意見',signedBy:'',notes:'准予核定'},
{id:'corr511',direction:'out',docNo:'DNV-10490817-0076',urgency:'普通件',issueDate:'2025-12-23',receiveDate:'',unit:'DNV',subject:'檢送假設工程混凝土材料送審資料(A版)審查意見',signedBy:'',notes:'退回修正'},
{id:'corr512',direction:'in',docNo:'碳集字第114122301號',urgency:'普通件',issueDate:'2025-12-23',receiveDate:'2025-12-24',unit:'碳集應用',subject:'檢送施工圍籬材料送審資料(B版)',signedBy:'黃品瑄',notes:''},
{id:'corr513',direction:'in',docNo:'碳集字第114122302號',urgency:'普通件',issueDate:'2025-12-23',receiveDate:'2025-12-24',unit:'碳集應用',subject:'檢送營建工地逕流廢水汙染削減計畫網路申請',signedBy:'黃品瑄',notes:''},
{id:'corr514',direction:'in',docNo:'碳集字第114122303號',urgency:'普通件',issueDate:'2025-12-23',receiveDate:'2025-12-24',unit:'碳集應用',subject:'檢送營建機具進場申請(小貨車)',signedBy:'黃品瑄',notes:''},
{id:'corr515',direction:'in',docNo:'碳集字第114122401號',urgency:'普通件',issueDate:'2025-12-24',receiveDate:'2025-12-29',unit:'碳集應用',subject:'檢送工地負責人之代理人資料及相關證明文件',signedBy:'黃品瑄',notes:''},
{id:'corr516',direction:'in',docNo:'碳集字第114122402號',urgency:'普通件',issueDate:'2025-12-24',receiveDate:'2025-12-29',unit:'碳集應用',subject:'檢送職業安全衛生管理人員之代理人資料及相關證明文件',signedBy:'黃品瑄',notes:''},
{id:'corr517',direction:'in',docNo:'碳集字第114122403號',urgency:'普通件',issueDate:'2025-12-24',receiveDate:'2025-12-29',unit:'碳集應用',subject:'檢送115年度工作人員名冊(劉瑋仁、廖茂州、顏文謙、顏奕巽)',signedBy:'黃品瑄',notes:''},
{id:'corr518',direction:'in',docNo:'碳集字第114122404號',urgency:'普通件',issueDate:'2025-12-24',receiveDate:'2025-12-29',unit:'碳集應用',subject:'檢送風險評估報告書(施工建造)(B版)',signedBy:'黃品瑄',notes:''},
{id:'corr519',direction:'in',docNo:'碳集字第114122405號',urgency:'普通件',issueDate:'2025-12-24',receiveDate:'2025-12-29',unit:'碳集應用',subject:'檢送營建機具進場申請(大貨車共2台)',signedBy:'黃品瑄',notes:''},
{id:'corr520',direction:'out',docNo:'DNV-10490817-0077',urgency:'普通件',issueDate:'2025-12-24',receiveDate:'',unit:'DNV',subject:'檢還假設工程計畫E版',signedBy:'',notes:'退回修正'},
{id:'corr521',direction:'in',docNo:'碳集字第114122601號',urgency:'普通件',issueDate:'2025-12-26',receiveDate:'2025-12-29',unit:'碳集應用',subject:'檢送115年度工作人員名冊',signedBy:'黃品瑄',notes:''},
{id:'corr522',direction:'out',docNo:'10490817-0113',urgency:'普通件',issueDate:'2025-12-26',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送營建機具進場申請(8台)審查結果',signedBy:'',notes:'退回修正'},
{id:'corr523',direction:'out',docNo:'DNV-10490817-0078',urgency:'普通件',issueDate:'2025-12-26',receiveDate:'',unit:'DNV',subject:'檢送曳引機2台進場申請審查意見',signedBy:'',notes:''},
{id:'corr524',direction:'in',docNo:'綜工字第1148174271號',urgency:'普通件',issueDate:'2025-12-30',receiveDate:'2025-12-31',unit:'綜施處',subject:'檢送電梯設置討論會議紀錄',signedBy:'高君銓',notes:''},
{id:'corr525',direction:'in',docNo:'碳集字第114123001號',urgency:'普通件',issueDate:'2025-12-30',receiveDate:'2025-12-31',unit:'碳集應用',subject:'檢送假設工程鋼筋材料送審資料',signedBy:'高君銓',notes:''},
{id:'corr526',direction:'in',docNo:'碳集字第114123002號',urgency:'普通件',issueDate:'2025-12-30',receiveDate:'2025-12-31',unit:'碳集應用',subject:'檢送115年度工作人員名冊-2',signedBy:'高君銓',notes:''},
{id:'corr527',direction:'in',docNo:'碳集字第114123101號',urgency:'普通件',issueDate:'2025-12-31',receiveDate:'2026-01-02',unit:'碳集應用',subject:'檢送臨時辦公室(含甲乙方)材料送審資料(A版)',signedBy:'黃品瑄',notes:''},
{id:'corr528',direction:'in',docNo:'碳集字第114123102號',urgency:'普通件',issueDate:'2025-12-31',receiveDate:'2026-01-02',unit:'碳集應用',subject:'檢送工地專用章申請',signedBy:'黃品瑄',notes:''},
{id:'corr529',direction:'in',docNo:'碳集字第114123103號',urgency:'普通件',issueDate:'2025-12-31',receiveDate:'2026-01-02',unit:'碳集應用',subject:'檢送115年度工作人員名冊(唐志銘)',signedBy:'黃品瑄',notes:''},
{id:'corr530',direction:'in',docNo:'碳集字第114123104號',urgency:'普通件',issueDate:'2025-12-31',receiveDate:'2026-01-02',unit:'碳集應用',subject:'檢送營建機具進場申請(曳引車共4台、移動式卡車起重機共2台)',signedBy:'黃品瑄',notes:''},
{id:'corr531',direction:'in',docNo:'建字第1140559174號',urgency:'普通件',issueDate:'2025-12-31',receiveDate:'2026-01-06',unit:'營建處',subject:'有關設備規格計算書(0版)之審查結果',signedBy:'黃品瑄',notes:'營建處准予備查'},
{id:'corr532',direction:'out',docNo:'DNV-10490817-0079',urgency:'普通件',issueDate:'2025-12-31',receiveDate:'',unit:'DNV',subject:'檢送施工圍籬材料送審資料B版審查意見',signedBy:'',notes:''},
{id:'corr533',direction:'out',docNo:'DNV-10490817-0080',urgency:'普通件',issueDate:'2025-12-31',receiveDate:'',unit:'DNV',subject:'檢送假設工程計畫E版補充審查意見',signedBy:'',notes:''},
{id:'corr534',direction:'in',docNo:'碳集字第115010201號',urgency:'普通件',issueDate:'2026-01-02',receiveDate:'2026-01-06',unit:'碳集應用',subject:'檢送貨櫃屋區域整地、地坪施作及貨櫃屋吊裝施工計畫(A版)',signedBy:'黃品瑄',notes:''},
{id:'corr535',direction:'in',docNo:'碳集字第115010202號',urgency:'普通件',issueDate:'2026-01-02',receiveDate:'2026-01-06',unit:'碳集應用',subject:'檢送擋土支撐、土方開挖及回填施工計畫(B版)',signedBy:'黃品瑄',notes:''},
{id:'corr536',direction:'in',docNo:'碳集字第115010203號',urgency:'普通件',issueDate:'2026-01-02',receiveDate:'2026-01-06',unit:'碳集應用',subject:'檢送風險評估報告書(製程設計)(B版)',signedBy:'黃品瑄',notes:''},
{id:'corr537',direction:'out',docNo:'DNV-10490817-0081',urgency:'普通件',issueDate:'2026-01-02',receiveDate:'',unit:'DNV',subject:'檢送基樁施工及基樁載重試驗計畫(A版)',signedBy:'',notes:''},
{id:'corr538',direction:'in',docNo:'碳集字第115010501號',urgency:'普通件',issueDate:'2026-01-05',receiveDate:'2026-01-07',unit:'碳集應用',subject:'檢送115年度工作人員名冊(盧珮妮、莊勝雄)',signedBy:'黃品瑄',notes:''},
{id:'corr539',direction:'in',docNo:'碳集字第115010601號',urgency:'普通件',issueDate:'2026-01-06',receiveDate:'2026-01-07',unit:'碳集應用',subject:'檢送施工圍籬材料送審資料(C版)',signedBy:'黃品瑄',notes:''},
{id:'corr540',direction:'in',docNo:'綜工字第1153180026號',urgency:'普通件',issueDate:'2026-01-06',receiveDate:'2026-01-07',unit:'綜施處',subject:'提出相關文件以工地專用章授權行使部分契約約定權力事宜(同意備查)',signedBy:'黃品瑄',notes:'綜施處同意備查'},
{id:'corr541',direction:'in',docNo:'綜工字第1143190471號',urgency:'普通件',issueDate:'2026-01-06',receiveDate:'2026-01-07',unit:'綜施處',subject:'檢送監造計畫0A版1份(含審查意見表)',signedBy:'黃品瑄',notes:'綜施處退回修正'},
{id:'corr542',direction:'in',docNo:'綜工字第1158001208號',urgency:'普通件',issueDate:'2026-01-06',receiveDate:'2026-01-07',unit:'綜施處',subject:'檢送第二十次工程推動檢討暨工安、環保、政風宣導會議紀錄',signedBy:'黃品瑄',notes:''},
{id:'corr543',direction:'in',docNo:'建字第1140559450號',urgency:'普通件',issueDate:'2026-01-06',receiveDate:'2026-01-08',unit:'營建處',subject:'碳捕集廠細部設計圖機械類(二)(0版)審查結果(准予備查 有修正處)',signedBy:'黃品瑄',notes:'營建處准予備查(有修正)'},
{id:'corr544',direction:'in',docNo:'碳集字第115010701號',urgency:'普通件',issueDate:'2026-01-07',receiveDate:'2026-01-08',unit:'碳集應用',subject:'檢送混凝土材料送審資料(B版)',signedBy:'黃品瑄',notes:''},
{id:'corr545',direction:'out',docNo:'DNV-10490817-0082',urgency:'普通件',issueDate:'2026-01-07',receiveDate:'',unit:'DNV',subject:'檢還施工照相及攝(錄)影計畫(A版)',signedBy:'',notes:'退回修正'},
{id:'corr546',direction:'out',docNo:'10490817-0119',urgency:'普通件',issueDate:'2026-01-07',receiveDate:'',unit:'DNV',subject:'擬辦理監造人員第二次異動',signedBy:'',notes:''},
{id:'corr547',direction:'in',docNo:'綜工字第1158003146號',urgency:'普通件',issueDate:'2026-01-08',receiveDate:'2026-01-09',unit:'綜施處',subject:'第二十一次工程推動檢討暨工安、環保、政風宣導會議通知',signedBy:'高君銓',notes:''},
{id:'corr548',direction:'in',docNo:'碳集字第115010901號',urgency:'普通件',issueDate:'2026-01-09',receiveDate:'2026-01-12',unit:'碳集應用',subject:'檢送115年工作人員名冊(劉瑋仁、廖茂州、顏文謙、顏奕巽)',signedBy:'高君銓',notes:''},
{id:'corr549',direction:'in',docNo:'碳集字第115010902號',urgency:'普通件',issueDate:'2026-01-09',receiveDate:'2026-01-12',unit:'碳集應用',subject:'營建工地逕流廢水削減計畫經台中市環保局同意核備',signedBy:'高君銓',notes:''},
{id:'corr550',direction:'in',docNo:'碳集字第115010903號',urgency:'普通件',issueDate:'2026-01-09',receiveDate:'2026-01-12',unit:'碳集應用',subject:'檢送114年12月工作月報',signedBy:'高君銓',notes:''},
{id:'corr551',direction:'out',docNo:'DNV-10490817-0083',urgency:'普通件',issueDate:'2026-01-09',receiveDate:'',unit:'DNV',subject:'檢送工作人員名冊(劉瑋仁、廖茂州、顏文謙、顏奕巽)審查意見',signedBy:'',notes:'退回修正'},
{id:'corr552',direction:'out',docNo:'DNV-10490817-0084',urgency:'普通件',issueDate:'2026-01-09',receiveDate:'',unit:'DNV',subject:'檢送大貨車(KEJ-7885及KLK-1692)2台送審資料審查意見',signedBy:'',notes:'退回修正'},
{id:'corr553',direction:'out',docNo:'DNV-10490817-0085',urgency:'普通件',issueDate:'2026-01-09',receiveDate:'',unit:'DNV',subject:'檢還風險評估報告(施工建造)B版',signedBy:'',notes:'退回修正'},
{id:'corr554',direction:'out',docNo:'10490817-0120',urgency:'普通件',issueDate:'2026-01-09',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送115年人員名冊(39員)審查結果',signedBy:'',notes:''},
{id:'corr555',direction:'out',docNo:'10490817-0121',urgency:'普通件',issueDate:'2026-01-12',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送水車司機唐志銘審查結果',signedBy:'',notes:''},
{id:'corr556',direction:'out',docNo:'10490817-0122',urgency:'普通件',issueDate:'2026-01-12',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送營建機具進場申請(曳引車4台、移動式卡車起重機2台)審查結果',signedBy:'',notes:''},
{id:'corr557',direction:'in',docNo:'碳集字第115011301號',urgency:'普通件',issueDate:'2026-01-13',receiveDate:'2026-01-15',unit:'碳集應用',subject:'檢送電焊機及發電機各一台進場申請',signedBy:'高君銓',notes:''},
{id:'corr558',direction:'out',docNo:'DNV-10490817-0086',urgency:'普通件',issueDate:'2026-01-13',receiveDate:'',unit:'DNV',subject:'檢送假設工程鋼筋材料送審資料(A版)審查意見',signedBy:'',notes:'退回修正'},
{id:'corr559',direction:'out',docNo:'DNV-10490817-0087',urgency:'普通件',issueDate:'2026-01-14',receiveDate:'',unit:'DNV',subject:'有關本案承攬關係尚不明且仍未提出相關分包商或再分包商契約一事',signedBy:'',notes:''},
{id:'corr560',direction:'out',docNo:'10490817-0123',urgency:'普通件',issueDate:'2026-01-14',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送施工圍籬材料送審資料(C版)審查結果',signedBy:'',notes:''},
{id:'corr561',direction:'in',docNo:'碳集字第115011501號',urgency:'普通件',issueDate:'2026-01-15',receiveDate:'2026-01-20',unit:'碳集應用',subject:'檢送營建機具進場申請(吊卡NQ-72、KR-15、NP-78共3台)',signedBy:'高君銓',notes:''},
{id:'corr562',direction:'out',docNo:'DNV-10490817-0088',urgency:'普通件',issueDate:'2026-01-15',receiveDate:'',unit:'DNV',subject:'檢送臨時辦公室(含甲乙方)材料送審資料(A版)審查意見',signedBy:'',notes:'退回修正'},
{id:'corr563',direction:'in',docNo:'綜工字第1153180291號',urgency:'普通件',issueDate:'2026-01-16',receiveDate:'2026-01-19',unit:'綜施處',subject:'提報職業安全衛生管理人員代理人事宜',signedBy:'高君銓',notes:'綜施處同意備查'},
{id:'corr564',direction:'in',docNo:'碳集字第115011602號',urgency:'普通件',issueDate:'2026-01-16',receiveDate:'2026-01-20',unit:'碳集應用',subject:'檢送115年度工作人員名冊(葉偉豪)',signedBy:'高君銓',notes:''},
{id:'corr565',direction:'in',docNo:'碳集字第115011603號',urgency:'普通件',issueDate:'2026-01-16',receiveDate:'2026-01-20',unit:'碳集應用',subject:'檢送碳捕集廠細部設計圖機械類(一)(0版)',signedBy:'高君銓',notes:''},
{id:'corr566',direction:'in',docNo:'碳集字第115011901號',urgency:'普通件',issueDate:'2026-01-19',receiveDate:'2026-01-20',unit:'碳集應用',subject:'檢送營建機具進場申請(灑水車KEP-5216、KEK-9006共2台)',signedBy:'高君銓',notes:''},
{id:'corr567',direction:'in',docNo:'碳集字第115011902號',urgency:'普通件',issueDate:'2026-01-19',receiveDate:'2026-01-20',unit:'碳集應用',subject:'檢送115年度工作人員名冊(唐晨浩)',signedBy:'高君銓',notes:''},
{id:'corr568',direction:'out',docNo:'DNV-10490817-0089',urgency:'普通件',issueDate:'2026-01-19',receiveDate:'',unit:'DNV',subject:'檢送貨櫃屋區域整地、地坪施作及貨櫃屋吊裝施工計畫A版審查意見',signedBy:'',notes:'退回修正'},
{id:'corr569',direction:'out',docNo:'DNV-10490817-0090',urgency:'普通件',issueDate:'2026-01-19',receiveDate:'',unit:'DNV',subject:'檢送擋土支撐、土方開挖及回填施工計畫B版審查意見',signedBy:'',notes:'退回修正'},
{id:'corr570',direction:'out',docNo:'DNV-10490817-0091',urgency:'普通件',issueDate:'2026-01-19',receiveDate:'',unit:'DNV',subject:'有關更換環境保護管理人員廖堃佑更換為廖茂周審查結果',signedBy:'',notes:'退回修正'},
{id:'corr571',direction:'out',docNo:'DNV-10490817-0092',urgency:'普通件',issueDate:'2026-01-19',receiveDate:'',unit:'DNV',subject:'檢還風險評估報告(製程設計)B版',signedBy:'',notes:'退回修正'},
{id:'corr572',direction:'out',docNo:'10490817-0124',urgency:'普通件',issueDate:'2026-01-19',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送盧珮妮及莊勝雄審查結果',signedBy:'',notes:''},
{id:'corr573',direction:'out',docNo:'10490817-0125',urgency:'普通件',issueDate:'2026-01-19',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送115年度工作人員名冊(劉瑋仁、廖茂州、顏文謙、顏奕巽)審查結果',signedBy:'',notes:''},
{id:'corr574',direction:'out',docNo:'10490817-0126',urgency:'普通件',issueDate:'2026-01-19',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送營建機具進場申請(電銲機1台、發電機1台)審查結果',signedBy:'',notes:''},
{id:'corr575',direction:'in',docNo:'碳集字第115012101號',urgency:'普通件',issueDate:'2026-01-21',receiveDate:'2026-01-22',unit:'碳集應用',subject:'檢送分析實驗室一次電設計變更B版',signedBy:'高君銓',notes:''},
{id:'corr576',direction:'in',docNo:'綜工字第1153180290號',urgency:'普通件',issueDate:'2026-01-21',receiveDate:'2026-01-22',unit:'綜施處',subject:'工地負責人代理賴仲彥',signedBy:'高君銓',notes:'同意備查'},
{id:'corr577',direction:'in',docNo:'綜工字第1153180292號',urgency:'普通件',issueDate:'2026-01-21',receiveDate:'2026-01-22',unit:'綜施處',subject:'有關更換監造人員事宜，劉錦華、謝庭蓁同意, 林怡秀、高君銓不同意',signedBy:'高君銓',notes:''},
{id:'corr578',direction:'out',docNo:'DNV-10490817-0093',urgency:'普通件',issueDate:'2026-01-21',receiveDate:'',unit:'DNV',subject:'檢送混凝土材料送審資料B版審查意見',signedBy:'',notes:'退回修正'},
{id:'corr579',direction:'out',docNo:'10490817-0127',urgency:'普通件',issueDate:'2026-01-22',receiveDate:'',unit:'DNV',subject:'檢送監造計畫0B版',signedBy:'',notes:''},
{id:'corr580',direction:'out',docNo:'DNV-10490817-0094',urgency:'普通件',issueDate:'2026-01-22',receiveDate:'',unit:'DNV',subject:'檢送114年12月工作月報審查意見',signedBy:'',notes:'退回修正'},
{id:'corr581',direction:'in',docNo:'綜工字第1153180626號',urgency:'普通件',issueDate:'2026-01-22',receiveDate:'2026-01-23',unit:'綜施處',subject:'施工圍籬材料C版',signedBy:'高君銓',notes:'准予核定'},
{id:'corr582',direction:'out',docNo:'10490817-0128',urgency:'普通件',issueDate:'2026-01-23',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送營建機具進場申請(灑水車共2台)審查結果',signedBy:'',notes:''},
{id:'corr583',direction:'out',docNo:'10490817-0129',urgency:'普通件',issueDate:'2026-01-23',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送115年度工作人員名冊(唐晨浩)審查結果',signedBy:'',notes:''},
{id:'corr584',direction:'out',docNo:'10490817-0131',urgency:'普通件',issueDate:'2026-01-23',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送營建機具進場申請(伸臂伸縮卡車起重機共3台)審查結果',signedBy:'',notes:''},
{id:'corr585',direction:'out',docNo:'10490817-0130',urgency:'普通件',issueDate:'2026-01-26',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送115年度工作人員名冊(葉偉豪)審查結果',signedBy:'',notes:''},
{id:'corr586',direction:'out',docNo:'10490817-0132',urgency:'普通件',issueDate:'2026-01-26',receiveDate:'',unit:'DNV',subject:'115年1月份第1次協調會會議紀錄',signedBy:'',notes:''},
{id:'corr587',direction:'out',docNo:'DNV-10490817-0095',urgency:'普通件',issueDate:'2026-01-26',receiveDate:'',unit:'DNV',subject:'檢還工程師葉偉豪人員名冊',signedBy:'',notes:'退回修正'},
{id:'corr588',direction:'in',docNo:'碳集字第115012801號',urgency:'普通件',issueDate:'2026-01-28',receiveDate:'2026-01-30',unit:'碳集應用',subject:'檢送營建機具進場申請(大貨車共2台、貨櫃曳引車共1台)',signedBy:'黃品瑄',notes:''},
{id:'corr589',direction:'in',docNo:'碳集字第115012901號',urgency:'普通件',issueDate:'2026-01-29',receiveDate:'2026-01-30',unit:'碳集應用',subject:'有關碳集公司提送115年度工作人員名冊(葉偉豪)申請人員工作證說明',signedBy:'黃品瑄',notes:''},
{id:'corr590',direction:'in',docNo:'碳集字第115012902號',urgency:'普通件',issueDate:'2026-01-29',receiveDate:'2026-01-30',unit:'碳集應用',subject:'檢送115年度工作人員名冊(楊人豪)',signedBy:'黃品瑄',notes:''},
{id:'corr591',direction:'in',docNo:'碳集字第115013002號',urgency:'普通件',issueDate:'2026-01-30',receiveDate:'2026-02-02',unit:'碳集應用',subject:'檢送115年度工作人員名冊(陳仲豪)',signedBy:'',notes:''},
{id:'corr592',direction:'in',docNo:'碳集字第115013003號',urgency:'普通件',issueDate:'2026-01-30',receiveDate:'2026-02-02',unit:'碳集應用',subject:'檢送115年度工作人員名冊(露天開挖主管、混凝土廠商、壓送機人員)共18位',signedBy:'',notes:''},
{id:'corr593',direction:'in',docNo:'碳集字第115013001號',urgency:'普通件',issueDate:'2026-01-30',receiveDate:'2026-02-02',unit:'碳集應用',subject:'檢送施工照相及攝(錄)影計畫B版',signedBy:'高君銓',notes:''},
{id:'corr594',direction:'out',docNo:'10490817-0133',urgency:'普通件',issueDate:'2026-01-30',receiveDate:'',unit:'DNV',subject:'檢送罰款建議',signedBy:'',notes:''},
{id:'corr595',direction:'out',docNo:'10490817-0134',urgency:'普通件',issueDate:'2026-02-03',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送115年度工作人員名冊(謝其洋、謝松洺、賴滄棋、詹勝男)審查結果',signedBy:'',notes:''},
{id:'corr596',direction:'out',docNo:'10490817-0135',urgency:'普通件',issueDate:'2026-02-03',receiveDate:'',unit:'DNV',subject:'擬辦理監造人員第三次異動',signedBy:'',notes:''},
{id:'corr597',direction:'in',docNo:'碳集字第115020301號',urgency:'普通件',issueDate:'2026-02-03',receiveDate:'2026-02-05',unit:'碳集應用',subject:'檢送營建機具進場申請(積載型起重機共1台、伸臂伸縮卡車起重機共1台)',signedBy:'黃品瑄',notes:''},
{id:'corr598',direction:'in',docNo:'碳集字第115020302號',urgency:'普通件',issueDate:'2026-02-03',receiveDate:'2026-02-05',unit:'碳集應用',subject:'檢送115年度工作人員名冊(陳克綸、張恩綺、張祐爵、陳毅瑋)',signedBy:'黃品瑄',notes:''},
{id:'corr599',direction:'in',docNo:'碳集字第115020401號',urgency:'普通件',issueDate:'2026-02-04',receiveDate:'2026-02-05',unit:'碳集應用',subject:'檢送115年度工作人員名冊臨時證(曾榮恩、陳重凱、朱凱鴻、顏瑞彤、梁育得、張修玟)',signedBy:'黃品瑄',notes:''},
{id:'corr600',direction:'in',docNo:'碳集字第115020402號',urgency:'普通件',issueDate:'2026-02-04',receiveDate:'2026-02-05',unit:'碳集應用',subject:'檢送京承營造下包商分包契約共7家',signedBy:'黃品瑄',notes:''},
{id:'corr601',direction:'out',docNo:'10490817-0136',urgency:'普通件',issueDate:'2026-02-05',receiveDate:'',unit:'DNV',subject:'檢送監造人員名冊(新增2名)',signedBy:'',notes:''},
{id:'corr602',direction:'in',docNo:'碳集字第11020501號',urgency:'普通件',issueDate:'2026-02-05',receiveDate:'2026-02-06',unit:'碳集應用',subject:'檢送115年度工作人員名冊(楊庠如)',signedBy:'黃品瑄',notes:''},
{id:'corr603',direction:'in',docNo:'建字第1150560558號',urgency:'普通件',issueDate:'2026-02-05',receiveDate:'2026-02-09',unit:'營建處',subject:'有關細部設計圖機械類(一)(0版)之審查結果',signedBy:'黃品瑄',notes:'退回修正'},
{id:'corr604',direction:'out',docNo:'10490817-0137',urgency:'普通件',issueDate:'2026-02-06',receiveDate:'',unit:'DNV',subject:'檢送115年1月月報',signedBy:'',notes:''},
{id:'corr605',direction:'out',docNo:'10490817-0138',urgency:'普通件',issueDate:'2026-02-06',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送營建機具進場申請(積載型起重機KEL9919共1台、伸臂伸縮卡車起重機KER-0799共1台)審查結果',signedBy:'',notes:''},
{id:'corr606',direction:'out',docNo:'10490817-0139',urgency:'普通件',issueDate:'2026-02-06',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送115年度工作人員名冊葉偉豪審查結果',signedBy:'',notes:''},
{id:'corr607',direction:'out',docNo:'10490817-0141',urgency:'普通件',issueDate:'2026-02-06',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送營建機具進場申請(KLA-7808、KEJ-7885、KLK-1692)審查結果',signedBy:'',notes:''},
{id:'corr608',direction:'out',docNo:'DNV-10490817-0096',urgency:'普通件',issueDate:'2026-02-06',receiveDate:'',unit:'DNV',subject:'檢送臨時給排水材料送審資料(A版)審查意見',signedBy:'',notes:'退回修正'},
{id:'corr609',direction:'out',docNo:'10490817-0140',urgency:'普通件',issueDate:'2026-02-09',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送115年度工作人員名冊(劉祐昌、陳靜芸、宋梵銘、楊人豪)審查結果',signedBy:'',notes:''},
{id:'corr610',direction:'out',docNo:'DNV-10490817-0097',urgency:'普通件',issueDate:'2026-02-09',receiveDate:'',unit:'DNV',subject:'檢送臨時用電材料送審資料(A版)審查意見',signedBy:'',notes:'退回修正'},
{id:'corr611',direction:'in',docNo:'碳集字第115020901號',urgency:'普通件',issueDate:'2026-02-09',receiveDate:'2026-02-10',unit:'碳集應用',subject:'檢送營建機具進場申請(伸臂伸縮卡車起重機共5台)',signedBy:'黃品瑄',notes:''},
{id:'corr612',direction:'in',docNo:'碳集字第115020902號',urgency:'普通件',issueDate:'2026-02-09',receiveDate:'2026-02-10',unit:'碳集應用',subject:'檢送115年1月工作月報',signedBy:'黃品瑄',notes:''},
{id:'corr613',direction:'in',docNo:'碳集字第115020903號',urgency:'普通件',issueDate:'2026-02-09',receiveDate:'2026-02-10',unit:'碳集應用',subject:'檢送115年度工作人員名冊(臨時證：蕎勝園藝)',signedBy:'黃品瑄',notes:''},
{id:'corr614',direction:'in',docNo:'碳集字第115020904號',urgency:'普通件',issueDate:'2026-02-09',receiveDate:'2026-02-10',unit:'碳集應用',subject:'檢送115年度工作人員名冊(京承營造、資本起重工程)',signedBy:'黃品瑄',notes:''},
{id:'corr615',direction:'out',docNo:'10490817-0142',urgency:'普通件',issueDate:'2026-02-10',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送115年度工作人員名冊(陳仲豪、露天開挖作業主管、混凝土廠商及壓送車人員共19位)審查結果',signedBy:'',notes:''},
{id:'corr616',direction:'out',docNo:'DNV-10490817-0098',urgency:'普通件',issueDate:'2026-02-10',receiveDate:'',unit:'DNV',subject:'檢送分包商契約審查意見',signedBy:'',notes:'退回修正'},
{id:'corr617',direction:'out',docNo:'10490817-0143',urgency:'普通件',issueDate:'2026-02-12',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送1150302至1150307臨時工作證(共10位)審查結果',signedBy:'',notes:''},
{id:'corr618',direction:'out',docNo:'10490817-0144',urgency:'普通件',issueDate:'2026-02-12',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送混凝土材料送審資料(C版)審查結果',signedBy:'',notes:''},
{id:'corr619',direction:'out',docNo:'10490817-0145',urgency:'普通件',issueDate:'2026-02-12',receiveDate:'',unit:'DNV',subject:'檢送115年工作證年度換發',signedBy:'',notes:''},
{id:'corr620',direction:'out',docNo:'10490817-0146',urgency:'普通件',issueDate:'2026-02-12',receiveDate:'',unit:'DNV',subject:'擬辦理監造人員第四次異動',signedBy:'',notes:''},
{id:'corr621',direction:'out',docNo:'10490817-0147',urgency:'普通件',issueDate:'2026-02-13',receiveDate:'',unit:'DNV',subject:'115年2月份第1次協調會會議紀錄',signedBy:'',notes:''},
{id:'corr622',direction:'in',docNo:'綜工字第1153181432號',urgency:'普通件',issueDate:'2026-02-13',receiveDate:'2026-02-23',unit:'綜施處',subject:'提報監造人員事宜(由高君銓擔任專業技術支援及界面協調人員)',signedBy:'黃品瑄',notes:'准予核定'},
{id:'corr623',direction:'in',docNo:'碳集字第115021301號',urgency:'普通件',issueDate:'2026-02-13',receiveDate:'2026-02-23',unit:'碳集應用',subject:'檢送115年度工作人員名冊(曾榮恩、陳重凱、朱凱鴻、陳克綸、張恩綺、楊祐爵、陳毅瑋、蔡宗樺)',signedBy:'黃品瑄',notes:''},
{id:'corr624',direction:'out',docNo:'10490817-0148',urgency:'普通件',issueDate:'2026-02-23',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送115年度工作人員名冊楊庠和審查結果',signedBy:'',notes:''},
{id:'corr625',direction:'out',docNo:'DNV-10490817-0099',urgency:'普通件',issueDate:'2026-02-23',receiveDate:'',unit:'DNV',subject:'檢送115年1月工作月報審查意見',signedBy:'',notes:'退回修正'},
{id:'corr626',direction:'out',docNo:'DNV-10490817-0100',urgency:'普通件',issueDate:'2026-02-23',receiveDate:'',unit:'DNV',subject:'檢送115年2月11日假設工程工進協調會議紀錄',signedBy:'',notes:''},
{id:'corr627',direction:'in',docNo:'綜工字第1158021065號',urgency:'普通件',issueDate:'2026-02-23',receiveDate:'2026-02-23',unit:'綜施處',subject:'第二十一次工作推動會議紀錄',signedBy:'黃品瑄',notes:''},
{id:'corr628',direction:'out',docNo:'10490817-0149',urgency:'普通件',issueDate:'2026-02-24',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送營建機具進場申請(NN-18、KX-65、ZP-27、ZP-28、KEV-0198)審查結果',signedBy:'',notes:''},
{id:'corr629',direction:'out',docNo:'10490817-0150',urgency:'普通件',issueDate:'2026-02-24',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送115年度工作人員名冊(共23位)審查結果',signedBy:'',notes:''},
{id:'corr630',direction:'out',docNo:'DNV-10490817-0101',urgency:'普通件',issueDate:'2026-02-24',receiveDate:'',unit:'DNV',subject:'檢送工作人員名冊臨時證 – 蕎勝園藝(共9位)審查意見',signedBy:'',notes:'退回修正'},
{id:'corr631',direction:'out',docNo:'DNV-10490817-0102',urgency:'普通件',issueDate:'2026-02-24',receiveDate:'',unit:'DNV',subject:'檢送工作人員名冊(游秉鑫、黃奕昇、蘇榮凱)審查意見',signedBy:'',notes:'退回修正'},
{id:'corr632',direction:'in',docNo:'碳集字第115022401號',urgency:'普通件',issueDate:'2026-02-24',receiveDate:'2026-02-25',unit:'碳集應用',subject:'檢送鋼筋材料送審資料(B版)',signedBy:'黃品瑄',notes:''},
{id:'corr633',direction:'in',docNo:'碳集字第115022402號',urgency:'普通件',issueDate:'2026-02-24',receiveDate:'2026-02-25',unit:'碳集應用',subject:'檢送假設工程施工計畫(0版)',signedBy:'黃品瑄',notes:''},
{id:'corr634',direction:'in',docNo:'碳集字第115022403號',urgency:'普通件',issueDate:'2026-02-24',receiveDate:'2026-02-25',unit:'碳集應用',subject:'檢送115年度工作人員名冊(梁育德、顏瑞彤、張修玟、顏裕淵、莊維植、李大嶺、張碧惠)',signedBy:'黃品瑄',notes:''},
{id:'corr635',direction:'in',docNo:'碳集字第115022404號',urgency:'普通件',issueDate:'2026-02-24',receiveDate:'2026-02-25',unit:'碳集應用',subject:'檢送營建機具進場申請展延(伸臂伸縮卡車起重機共3台)',signedBy:'黃品瑄',notes:''},
{id:'corr636',direction:'in',docNo:'碳集字第115022405號',urgency:'普通件',issueDate:'2026-02-24',receiveDate:'2026-02-25',unit:'碳集應用',subject:'檢送營建機具進場申請(伸臂伸縮卡車起重機共1台)',signedBy:'黃品瑄',notes:''},
{id:'corr637',direction:'in',docNo:'碳集字第115022406號',urgency:'普通件',issueDate:'2026-02-24',receiveDate:'2026-02-25',unit:'碳集應用',subject:'更換環境保護管理人員',signedBy:'黃品瑄',notes:''},
{id:'corr638',direction:'in',docNo:'碳集字第115022407號',urgency:'普通件',issueDate:'2026-02-24',receiveDate:'2026-02-25',unit:'碳集應用',subject:'更換職業安全衛生管理人員',signedBy:'黃品瑄',notes:'作廢'},
{id:'corr639',direction:'out',docNo:'10490817-0151',urgency:'普通件',issueDate:'2026-02-25',receiveDate:'',unit:'DNV',subject:'擬辦理第二次契約價金變更',signedBy:'',notes:''},
{id:'corr640',direction:'out',docNo:'DNV-10490817-0103',urgency:'普通件',issueDate:'2026-02-25',receiveDate:'',unit:'DNV',subject:'115年3月第1次協調會會議通知',signedBy:'',notes:''},
{id:'corr641',direction:'out',docNo:'DNV-10490817-0104',urgency:'普通件',issueDate:'2026-02-25',receiveDate:'',unit:'DNV',subject:'檢送施工照相及攝(錄)影計畫B版審查結果',signedBy:'',notes:'准予核定'},
{id:'corr642',direction:'in',docNo:'碳集字第115022501號',urgency:'普通件',issueDate:'2026-02-25',receiveDate:'2026-02-26',unit:'碳集應用',subject:'檢送溶劑測試計畫(A版)',signedBy:'黃品瑄',notes:''},
{id:'corr643',direction:'in',docNo:'碳集字第115022502號',urgency:'普通件',issueDate:'2026-02-25',receiveDate:'2026-02-26',unit:'碳集應用',subject:'更換職業安全衛生管理人員',signedBy:'黃品瑄',notes:''},
{id:'corr644',direction:'in',docNo:'碳集字第115022503號',urgency:'普通件',issueDate:'2026-02-25',receiveDate:'2026-02-26',unit:'碳集應用',subject:'檢送115年度工作人員名冊(臨時證 蕎勝園藝有限公司)修正資料',signedBy:'黃品瑄',notes:''},
{id:'corr645',direction:'in',docNo:'碳集字第115022504號',urgency:'普通件',issueDate:'2026-02-25',receiveDate:'2026-02-26',unit:'碳集應用',subject:'檢送115年度工作人員名冊(謝其賢)',signedBy:'黃品瑄',notes:''},
{id:'corr646',direction:'out',docNo:'DNV-10490817-0105',urgency:'普通件',issueDate:'2026-02-26',receiveDate:'',unit:'DNV',subject:'檢送假設工程分項施工計畫0版審查結果',signedBy:'',notes:'准予核定'},
{id:'corr647',direction:'in',docNo:'碳集字第115022601號',urgency:'普通件',issueDate:'2026-02-25',receiveDate:'2026-03-02',unit:'碳集應用',subject:'檢送臨時辦公室(含甲乙方)材料送審資料(B版)',signedBy:'高君銓',notes:''},
{id:'corr648',direction:'out',docNo:'10490817-0152',urgency:'普通件',issueDate:'2026-03-03',receiveDate:'',unit:'DNV',subject:'檢送115年2月月報',signedBy:'',notes:''},
{id:'corr649',direction:'in',docNo:'碳集字第115030401號',urgency:'普通件',issueDate:'2026-03-04',receiveDate:'2026-03-05',unit:'碳集應用',subject:'檢送臨時給排水系統材料送審(B版)',signedBy:'高君銓',notes:''},
{id:'corr650',direction:'out',docNo:'10490817-0153',urgency:'普通件',issueDate:'2026-03-05',receiveDate:'',unit:'DNV',subject:'有關碳集公司本次更換職安及環保人員為陳靜芸及葉偉豪審查結果',signedBy:'',notes:''},
{id:'corr651',direction:'out',docNo:'10490817-0154',urgency:'普通件',issueDate:'2026-03-05',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送115年度工作人員名冊李大嶺及張碧惠審查結果',signedBy:'',notes:''},
{id:'corr652',direction:'out',docNo:'10490817-0155',urgency:'普通件',issueDate:'2026-03-05',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送營建機具進場申請(吊卡NQ-12)審查結果',signedBy:'',notes:''},
{id:'corr653',direction:'out',docNo:'DNV-10490817-0106',urgency:'普通件',issueDate:'2026-03-05',receiveDate:'',unit:'DNV',subject:'檢送115年度工作人員名冊(臨時證 蕎勝園藝有限公司)修正資料審查意見',signedBy:'',notes:'退回修正'},
{id:'corr654',direction:'out',docNo:'DNV-10490817-0107',urgency:'普通件',issueDate:'2026-03-05',receiveDate:'',unit:'DNV',subject:'檢送115年度工作人員名冊(冠呈工程莊維植、宇鴻工程謝其賢、廷唯工程梁育得、顏瑞彤、張修玟、顏裕淵，共6位)審查意見',signedBy:'',notes:'退回修正'},
{id:'corr655',direction:'out',docNo:'10490817-0156',urgency:'普通件',issueDate:'2026-03-09',receiveDate:'',unit:'DNV',subject:'檢送監造計畫0C版',signedBy:'',notes:''},
{id:'corr656',direction:'out',docNo:'10490817-0157',urgency:'普通件',issueDate:'2026-03-09',receiveDate:'',unit:'DNV',subject:'檢送115年3月份第1次協調會會議紀錄',signedBy:'',notes:''},
{id:'corr657',direction:'out',docNo:'10490817-0158',urgency:'普通件',issueDate:'2026-03-09',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送鋼筋材料送審資料(B版)審查結果',signedBy:'',notes:''},
{id:'corr658',direction:'out',docNo:'10490817-0159',urgency:'普通件',issueDate:'2026-03-10',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送臨時辦公室材料送審資料(B版)審查結果',signedBy:'',notes:''},
{id:'corr659',direction:'out',docNo:'DNV-10490817-0108',urgency:'普通件',issueDate:'2026-03-10',receiveDate:'',unit:'DNV',subject:'第二次催告承商有關本案承攬關係尚不明且仍未提出相關分包商或再分包商契約一事',signedBy:'',notes:''},
{id:'corr660',direction:'in',docNo:'碳集字第115031001號',urgency:'普通件',issueDate:'2026-03-10',receiveDate:'2026-03-11',unit:'碳集應用',subject:'檢送環境保護計畫(1版)',signedBy:'黃品瑄',notes:'應為0A版'},
{id:'corr661',direction:'in',docNo:'碳集字第115031002號',urgency:'普通件',issueDate:'2026-03-10',receiveDate:'2026-03-11',unit:'碳集應用',subject:'檢送蕎勝園藝有限公司分包契約',signedBy:'黃品瑄',notes:''},
{id:'corr662',direction:'in',docNo:'碳集字第115031003號',urgency:'普通件',issueDate:'2026-03-10',receiveDate:'2026-03-11',unit:'碳集應用',subject:'檢送115年度工作人員名冊(臨時證 蕎勝園藝有限公司)審查意見回覆',signedBy:'黃品瑄',notes:''},
{id:'corr663',direction:'in',docNo:'碳集字第115031004號',urgency:'普通件',issueDate:'2026-03-10',receiveDate:'2026-03-11',unit:'碳集應用',subject:'檢送115年度工作人員名冊(游秉鑫、黃奕昇、蘇榮凱)修正資料',signedBy:'黃品瑄',notes:''},
{id:'corr664',direction:'in',docNo:'碳集字第115031005號',urgency:'普通件',issueDate:'2026-03-10',receiveDate:'2026-03-11',unit:'碳集應用',subject:'更換機電品管人員',signedBy:'黃品瑄',notes:''},
{id:'corr665',direction:'out',docNo:'10490817-0160',urgency:'普通件',issueDate:'2026-03-11',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送臨時給排水系統材料送審資料(B版)審查結果',signedBy:'',notes:''},
{id:'corr666',direction:'out',docNo:'DNV-10490817-0109',urgency:'普通件',issueDate:'2026-03-11',receiveDate:'',unit:'DNV',subject:'有關本次提送國外設備第三者(立案之公證公司)審查結果',signedBy:'',notes:''},
{id:'corr667',direction:'in',docNo:'碳集字第115031101號',urgency:'普通件',issueDate:'2026-03-11',receiveDate:'2026-03-12',unit:'碳集應用',subject:'檢送京承營造股份有限公司下包商分包契約共5家',signedBy:'黃品瑄',notes:''},
{id:'corr668',direction:'in',docNo:'碳集字第115031102號',urgency:'普通件',issueDate:'2026-03-11',receiveDate:'2026-03-12',unit:'碳集應用',subject:'檢送工廠檢驗及試驗計畫(國外設備)(A版)',signedBy:'黃品瑄',notes:''},
{id:'corr669',direction:'out',docNo:'10490817-0161',urgency:'普通件',issueDate:'2026-03-12',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送之下包商蕎勝園藝契約審查結果',signedBy:'',notes:''},
{id:'corr670',direction:'out',docNo:'10490817-0162',urgency:'普通件',issueDate:'2026-03-12',receiveDate:'',unit:'DNV',subject:'有關碳集公司本次更換機電品管人員為李大嶺審查結果',signedBy:'',notes:''},
{id:'corr671',direction:'in',docNo:'綜工字第1158028298號',urgency:'普通件',issueDate:'2026-03-12',receiveDate:'2026-03-13',unit:'綜施處',subject:'第二十三次工程推動檢討暨工安、環保、政風宣導會議開會通知單',signedBy:'黃品瑄',notes:''},
{id:'corr672',direction:'in',docNo:'綜工字第1153182432號',urgency:'普通件',issueDate:'2026-03-12',receiveDate:'2026-03-13',unit:'綜施處',subject:'更換職業安全衛生人員為陳靜芸及環境保護管理人員為葉偉豪事宜',signedBy:'黃品瑄',notes:'准予核定'},
{id:'corr673',direction:'in',docNo:'碳集字第115031201號',urgency:'普通件',issueDate:'2026-03-12',receiveDate:'2026-03-13',unit:'碳集應用',subject:'更換職業安全衛生管理人員陳靜芸為蔡宗樺',signedBy:'黃品瑄',notes:''},
{id:'corr674',direction:'in',docNo:'碳集字第115031202號',urgency:'普通件',issueDate:'2026-03-12',receiveDate:'2026-03-13',unit:'碳集應用',subject:'檢送土木實驗室(正泰檢驗科技股份有限公司)廠商送審資料',signedBy:'黃品瑄',notes:''},
{id:'corr675',direction:'out',docNo:'10490817-0163',urgency:'普通件',issueDate:'2026-03-13',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送之野馬企業、野馬預伴、建信、晨興、資本起重5家再分包商契約審查結果',signedBy:'',notes:''},
{id:'corr676',direction:'in',docNo:'綜工字第1158030224號',urgency:'普通件',issueDate:'2026-03-13',receiveDate:'2026-03-16',unit:'綜施處',subject:'第二十一二次工作推動會議紀錄',signedBy:'高君銓',notes:''},
{id:'corr677',direction:'in',docNo:'碳集字第115031301號',urgency:'普通件',issueDate:'2026-03-13',receiveDate:'2026-03-16',unit:'碳集應用',subject:'檢送臨時用電系統材料送審資料(B版)',signedBy:'高君銓',notes:''},
{id:'corr678',direction:'in',docNo:'碳集字第115031302號',urgency:'普通件',issueDate:'2026-03-13',receiveDate:'2026-03-16',unit:'碳集應用',subject:'新增環保人員張靖瑜君',signedBy:'高君銓',notes:''},
{id:'corr679',direction:'in',docNo:'碳集字第115031601號',urgency:'普通件',issueDate:'2026-03-16',receiveDate:'2026-03-17',unit:'碳集應用',subject:'檢送115年2月工作月報',signedBy:'高君銓',notes:''},
{id:'corr680',direction:'in',docNo:'碳集字第115031603號',urgency:'普通件',issueDate:'2026-03-16',receiveDate:'2026-03-17',unit:'碳集應用',subject:'更換工地即時影像監看人員陳吉南為張碧惠',signedBy:'高君銓',notes:''},
{id:'corr681',direction:'in',docNo:'碳集字第115031604號',urgency:'普通件',issueDate:'2026-03-16',receiveDate:'2026-03-17',unit:'碳集應用',subject:'檢送黑麋影視文化分包契約',signedBy:'高君銓',notes:''},
{id:'corr682',direction:'in',docNo:'綜工字第1153182557號',urgency:'普通件',issueDate:'2026-03-16',receiveDate:'2026-03-17',unit:'綜施處',subject:'鋼筋材料送審B版准予核定',signedBy:'高君銓',notes:''},
{id:'corr683',direction:'out',docNo:'10490817-0164',urgency:'普通件',issueDate:'2026-03-17',receiveDate:'',unit:'DNV',subject:'監造工地專用章申請',signedBy:'',notes:''},
{id:'corr684',direction:'out',docNo:'10490817-0165',urgency:'普通件',issueDate:'2026-03-17',receiveDate:'',unit:'DNV',subject:'有關碳集公司本次更換職安人員為蔡宗樺審查結果',signedBy:'',notes:''},
{id:'corr685',direction:'out',docNo:'DNV-10490817-0110',urgency:'普通件',issueDate:'2026-03-17',receiveDate:'',unit:'DNV',subject:'有關本次提送環境保護計畫0A版審查結果',signedBy:'',notes:'退回修正'},
{id:'corr686',direction:'in',docNo:'綜工字第1153182555號',urgency:'普通件',issueDate:'2026-03-18',receiveDate:'2026-03-19',unit:'綜施處',subject:'監造計畫准予核定為1版',signedBy:'高君銓',notes:''},
{id:'corr687',direction:'in',docNo:'綜工字第1153182754號',urgency:'普通件',issueDate:'2026-03-18',receiveDate:'2026-03-19',unit:'綜施處',subject:'臨時給排水材料送審B版准予核定',signedBy:'高君銓',notes:''},
{id:'corr688',direction:'out',docNo:'10490817-0166',urgency:'普通件',issueDate:'2026-03-19',receiveDate:'',unit:'DNV',subject:'有關碳集公司本次更換CCTV監看員陳吉南為張碧惠審查結果',signedBy:'',notes:''},
{id:'corr689',direction:'out',docNo:'10490817-0167',urgency:'普通件',issueDate:'2026-03-19',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送之下包商黑麋影視契約審查結果',signedBy:'',notes:''},
{id:'corr690',direction:'out',docNo:'10490817-0168',urgency:'普通件',issueDate:'2026-03-19',receiveDate:'',unit:'DNV',subject:'有關碳集公司本次新增環保人員張靖瑜審查結果',signedBy:'',notes:''},
{id:'corr691',direction:'in',docNo:'綜工字第1153182756號',urgency:'普通件',issueDate:'2026-03-19',receiveDate:'2026-03-20',unit:'綜施處',subject:'更換機電品管人員為李大嶺事宜',signedBy:'高君銓',notes:'准予核定'},
{id:'corr692',direction:'in',docNo:'碳集字第115031901號',urgency:'普通件',issueDate:'2026-03-19',receiveDate:'2026-03-20',unit:'碳集應用',subject:'檢送再分包商宥辰、家呈、廷唯、宇鴻、禾泰豐、冠呈、藍圖、聯旺8家契約資料',signedBy:'高君銓',notes:''},
{id:'corr693',direction:'out',docNo:'DNV-10490817-0111',urgency:'普通件',issueDate:'2026-03-20',receiveDate:'',unit:'DNV',subject:'有關本次提送工廠檢驗及試驗計畫0版審查結果',signedBy:'',notes:'退回修正'},
{id:'corr694',direction:'out',docNo:'DNV-10490817-0112',urgency:'普通件',issueDate:'2026-03-20',receiveDate:'',unit:'DNV',subject:'檢送115年2月工作月報審查意見',signedBy:'',notes:''},
{id:'corr695',direction:'in',docNo:'綜工字第1153182612號',urgency:'普通件',issueDate:'2026-03-20',receiveDate:'2026-03-23',unit:'綜施處',subject:'臨時辦公室(含甲乙方)材料送審資料核定為0版',signedBy:'高君銓',notes:'准予核定'},
{id:'corr696',direction:'in',docNo:'綜工字第1158033149號',urgency:'普通件',issueDate:'2026-03-20',receiveDate:'2026-03-23',unit:'綜施處',subject:'第二十三次工程推動檢討暨工安、環保、政風宣導會議開會通知單_改到4/2',signedBy:'高君銓',notes:''},
{id:'corr697',direction:'in',docNo:'碳集字第115032001號',urgency:'普通件',issueDate:'2026-03-20',receiveDate:'2026-03-23',unit:'碳集應用',subject:'檢送職安人員代理楊庠和',signedBy:'高君銓',notes:''},
{id:'corr698',direction:'in',docNo:'碳集字第115032002號',urgency:'普通件',issueDate:'2026-03-20',receiveDate:'2026-03-23',unit:'碳集應用',subject:'有關地坪墊高以保護既有管線議題函文作廢',signedBy:'高君銓',notes:''},
{id:'corr699',direction:'out',docNo:'10490817-0169',urgency:'普通件',issueDate:'2026-03-23',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送之再分包商宥辰、家呈、廷唯、宇鴻、禾泰豐、冠呈、藍圖、聯旺8家契約審查結果',signedBy:'',notes:''},
{id:'corr700',direction:'out',docNo:'DNV-10490817-0113',urgency:'普通件',issueDate:'2026-03-23',receiveDate:'',unit:'DNV',subject:'有關本次提送土木實驗室(正泰)A版審查結果',signedBy:'',notes:'退回修正'},
{id:'corr701',direction:'in',docNo:'綜工字第1153182961號',urgency:'普通件',issueDate:'2026-03-23',receiveDate:'2026-03-24',unit:'綜施處',subject:'監造工地專用章同意備查',signedBy:'高君銓',notes:''},
{id:'corr702',direction:'in',docNo:'綜工字第1158033262號',urgency:'普通件',issueDate:'2026-03-23',receiveDate:'2026-03-24',unit:'綜施處',subject:'第二次監造業務討論會議',signedBy:'高君銓',notes:''},
{id:'corr703',direction:'in',docNo:'碳集字第115032301號',urgency:'普通件',issueDate:'2026-03-23',receiveDate:'2026-03-24',unit:'碳集應用',subject:'檢送模擬平台建立計畫(A版)',signedBy:'高君銓',notes:''},
{id:'corr704',direction:'out',docNo:'10490817-0170',urgency:'普通件',issueDate:'2026-03-24',receiveDate:'',unit:'DNV',subject:'有關碳集公司本次新增職安人員代理楊庠和審查結果',signedBy:'',notes:''},
{id:'corr705',direction:'in',docNo:'綜工字第1153183084號',urgency:'普通件',issueDate:'2026-03-24',receiveDate:'2026-03-25',unit:'綜施處',subject:'同意更換CCTV監看員為張碧惠',signedBy:'高君銓',notes:''},
{id:'corr706',direction:'in',docNo:'綜工字第1153182138號',urgency:'普通件',issueDate:'2026-03-24',receiveDate:'2026-03-25',unit:'綜施處',subject:'復監造第二次價金變更',signedBy:'高君銓',notes:''},
{id:'corr707',direction:'in',docNo:'綜工字第1158033831號',urgency:'普通件',issueDate:'2026-03-24',receiveDate:'2026-03-25',unit:'綜施處',subject:'承商五大管線送審緩慢催告',signedBy:'高君銓',notes:''},
{id:'corr708',direction:'in',docNo:'碳集字第115032401號',urgency:'普通件',issueDate:'2026-03-24',receiveDate:'2026-03-25',unit:'碳集應用',subject:'檢送基樁施工及基樁載重試驗計畫(B版)',signedBy:'高君銓',notes:''},
{id:'corr709',direction:'in',docNo:'研字第1158034754號',urgency:'普通件',issueDate:'2026-03-25',receiveDate:'2026-03-26',unit:'綜研所',subject:'溶劑測試計畫(A版)退回修正',signedBy:'黃惠君',notes:''},
{id:'corr710',direction:'in',docNo:'綜工字第1153182962號',urgency:'普通件',issueDate:'2026-03-25',receiveDate:'2026-03-26',unit:'綜施處',subject:'更換職安人員為蔡宗樺不同意',signedBy:'高君銓',notes:''},
{id:'corr711',direction:'in',docNo:'綜工字第1153183086號',urgency:'普通件',issueDate:'2026-03-25',receiveDate:'2026-03-26',unit:'綜施處',subject:'新增環保人員為張靖瑜',signedBy:'高君銓',notes:'准予核定'},
{id:'corr712',direction:'out',docNo:'10490817-0171',urgency:'普通件',issueDate:'2026-03-26',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送臨時用電材料送審資料(B版)審查結果',signedBy:'',notes:''},
{id:'corr713',direction:'in',docNo:'碳集字第115032601號',urgency:'普通件',issueDate:'2026-03-26',receiveDate:'2026-03-30',unit:'碳集應用',subject:'檢送假設工程分項施工計畫0A版',signedBy:'高君銓',notes:''},
{id:'corr714',direction:'in',docNo:'碳集字第115032602號',urgency:'普通件',issueDate:'2026-03-26',receiveDate:'2026-03-30',unit:'碳集應用',subject:'檢送鋼筋模板混凝土分項施工計畫B版',signedBy:'高君銓',notes:''},
{id:'corr715',direction:'in',docNo:'碳集字第115032701號',urgency:'普通件',issueDate:'2026-03-27',receiveDate:'2026-03-30',unit:'碳集應用',subject:'檢送土木實驗室(詠禾檢驗有限公司台中港實驗室)廠商送審資料(A版)',signedBy:'黃品瑄',notes:''},
{id:'corr716',direction:'in',docNo:'碳集字第115032702號',urgency:'普通件',issueDate:'2026-03-27',receiveDate:'2026-03-30',unit:'碳集應用',subject:'檢送土木實驗室(正泰檢驗科技股份有限公司)廠商送審資料(B版)',signedBy:'黃品瑄',notes:''},
{id:'corr717',direction:'in',docNo:'碳集字第115032703號',urgency:'普通件',issueDate:'2026-03-27',receiveDate:'2026-03-30',unit:'碳集應用',subject:'檢送碳捕集廠細部設計圖機械類(一)(0A版)',signedBy:'黃品瑄',notes:''},
{id:'corr718',direction:'in',docNo:'碳集字第115032704號',urgency:'普通件',issueDate:'2026-03-27',receiveDate:'2026-03-30',unit:'碳集應用',subject:'檢送環境保護管理人員之代理人(黃彥翔)',signedBy:'黃品瑄',notes:''},
{id:'corr719',direction:'in',docNo:'碳集字第115033101號',urgency:'普通件',issueDate:'2026-03-31',receiveDate:'2026-04-01',unit:'碳集應用',subject:'檢送避雷及接地施工計畫(A版)',signedBy:'黃品瑄',notes:''},
{id:'corr720',direction:'in',docNo:'碳集字第115033102號',urgency:'普通件',issueDate:'2026-03-31',receiveDate:'2026-04-01',unit:'碳集應用',subject:'更換環境保護管理人員',signedBy:'黃品瑄',notes:''},
{id:'corr721',direction:'in',docNo:'碳集字第115033103號',urgency:'普通件',issueDate:'2026-03-31',receiveDate:'2026-04-01',unit:'碳集應用',subject:'檢送京承營造股份有限公司下包商分包契約共2家',signedBy:'黃品瑄',notes:''},
{id:'corr722',direction:'in',docNo:'碳集字第115033104號',urgency:'普通件',issueDate:'2026-03-31',receiveDate:'2026-04-01',unit:'碳集應用',subject:'檢送環境保護計畫(0B版)',signedBy:'黃品瑄',notes:''},
{id:'corr723',direction:'out',docNo:'10490817-0172',urgency:'普通件',issueDate:'2026-04-01',receiveDate:'',unit:'DNV',subject:'檢送115年3月月報',signedBy:'',notes:''},
{id:'corr724',direction:'out',docNo:'10490817-0173',urgency:'普通件',issueDate:'2026-04-01',receiveDate:'',unit:'DNV',subject:'有關碳集公司本次新增環保人員代理黃彥翔審查結果',signedBy:'',notes:''},
{id:'corr725',direction:'out',docNo:'DNV-10490817-0114',urgency:'普通件',issueDate:'2026-04-01',receiveDate:'',unit:'DNV',subject:'115年4月協調會會議通知',signedBy:'',notes:''},
{id:'corr726',direction:'in',docNo:'碳集字第115040101號',urgency:'普通件',issueDate:'2026-04-01',receiveDate:'2026-04-02',unit:'碳集應用',subject:'檢送基樁材料送審資料(A版)',signedBy:'黃品瑄',notes:''},
{id:'corr727',direction:'in',docNo:'碳集字第115040201號',urgency:'普通件',issueDate:'2026-04-02',receiveDate:'2026-04-07',unit:'碳集應用',subject:'檢送分析實驗室一次電設計變更(C版)',signedBy:'黃品瑄',notes:''},
{id:'corr728',direction:'out',docNo:'DNV-10490817-0115',urgency:'普通件',issueDate:'2026-04-07',receiveDate:'',unit:'DNV',subject:'檢還基樁施工及基樁載重試驗計畫B版',signedBy:'',notes:'退回修正'},
{id:'corr729',direction:'out',docNo:'10490817-0174',urgency:'普通件',issueDate:'2026-04-08',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送之再分包商尹森及鋒頌家契約審查結果',signedBy:'',notes:''},
{id:'corr730',direction:'out',docNo:'10490817-0175',urgency:'普通件',issueDate:'2026-04-08',receiveDate:'',unit:'DNV',subject:'有關碳集公司本次新增環保人員呂京錞並更換葉偉豪為代理審查結果',signedBy:'',notes:''},
{id:'corr731',direction:'out',docNo:'10490817-0176',urgency:'普通件',issueDate:'2026-04-08',receiveDate:'',unit:'DNV',subject:'檢送罰款建議',signedBy:'',notes:''},
{id:'corr732',direction:'out',docNo:'DNV-10490817-0116',urgency:'普通件',issueDate:'2026-04-08',receiveDate:'',unit:'DNV',subject:'有關本次提送土木實驗室(詠禾檢驗有限公司台中港實驗室及正泰檢驗科技股份有限公司)審查結果',signedBy:'',notes:''},
{id:'corr733',direction:'out',docNo:'DNV-10490817-0117',urgency:'普通件',issueDate:'2026-04-08',receiveDate:'',unit:'DNV',subject:'檢送假設工程分項施工計畫0A版審查結果',signedBy:'',notes:'准予核定'},
{id:'corr734',direction:'out',docNo:'10490817-0177',urgency:'普通件',issueDate:'2026-04-09',receiveDate:'',unit:'DNV',subject:'檢送罰款建議',signedBy:'',notes:''},
{id:'corr735',direction:'in',docNo:'綜工字第1153183651號',urgency:'普通件',issueDate:'2026-04-09',receiveDate:'2026-04-10',unit:'綜施處',subject:'提報環境保護管理人事宜',signedBy:'黃品瑄',notes:'同意備查'},
{id:'corr736',direction:'in',docNo:'碳集字第115040901號',urgency:'普通件',issueDate:'2026-04-09',receiveDate:'2026-04-10',unit:'碳集應用',subject:'檢送職業安全衛生管理人員之代理人(李淮翎)資料及相關證明文件',signedBy:'黃品瑄',notes:''},
{id:'corr737',direction:'in',docNo:'碳集字第115040902號',urgency:'普通件',issueDate:'2026-04-09',receiveDate:'2026-04-10',unit:'碳集應用',subject:'提送機電品管人員(李一龍)',signedBy:'黃品瑄',notes:''},
{id:'corr738',direction:'in',docNo:'碳集字第115040903號',urgency:'普通件',issueDate:'2026-04-09',receiveDate:'2026-04-10',unit:'碳集應用',subject:'檢送京承營造股份有限公司下包商分包契約共1家(永歆機電工程有限公司)',signedBy:'黃品瑄',notes:''},
{id:'corr739',direction:'out',docNo:'10490817-0178',urgency:'普通件',issueDate:'2026-04-10',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送之環境保護計畫0B版審查結果',signedBy:'',notes:''},
{id:'corr740',direction:'out',docNo:'10490817-0179',urgency:'普通件',issueDate:'2026-04-10',receiveDate:'',unit:'DNV',subject:'檢送罰款建議',signedBy:'',notes:''},
{id:'corr741',direction:'out',docNo:'10490817-0180',urgency:'普通件',issueDate:'2026-04-13',receiveDate:'',unit:'DNV',subject:'有關碳集公司提送之再分包商永歆機電契約審查結果',signedBy:'',notes:''},
{id:'corr742',direction:'in',docNo:'碳集字第115041001號',urgency:'普通件',issueDate:'2026-04-10',receiveDate:'2026-04-13',unit:'碳集應用',subject:'檢送土木實驗室禾洋科技A版',signedBy:'高君銓',notes:''},
{id:'corr743',direction:'in',docNo:'碳集字第115041002號',urgency:'普通件',issueDate:'2026-04-10',receiveDate:'2026-04-13',unit:'碳集應用',subject:'檢送115年3月工作月報',signedBy:'高君銓',notes:''},
{id:'corr744',direction:'in',docNo:'綜工字第1158042181號',urgency:'普通件',issueDate:'2026-04-10',receiveDate:'',unit:'綜施處',subject:'115年工安宣導會議通知',signedBy:'高君銓',notes:''},
{id:'corr745',direction:'out',docNo:'DNV-10490817-0118',urgency:'普通件',issueDate:'2026-04-13',receiveDate:'',unit:'DNV',subject:'有關本次提送鋼筋、模板、混凝土分項施工B版審查結果',signedBy:'',notes:'退回修正'},
{id:'corr746',direction:'out',docNo:'10490817-0181',urgency:'普通件',issueDate:'2026-04-16',receiveDate:'',unit:'DNV',subject:'有關碳集公司本次新增職安代理李淮翎審查結果',signedBy:'',notes:''},
{id:'corr747',direction:'out',docNo:'10490817-0182',urgency:'普通件',issueDate:'2026-04-16',receiveDate:'',unit:'DNV',subject:'有關碳集公司本次新增機電品管李一龍審查結果',signedBy:'',notes:''},
{id:'corr748',direction:'out',docNo:'10490817-0183',urgency:'普通件',issueDate:'2026-04-16',receiveDate:'',unit:'DNV',subject:'檢送罰款建議',signedBy:'',notes:''},
{id:'corr749',direction:'out',docNo:'DNV-10490817-0119',urgency:'普通件',issueDate:'2026-04-16',receiveDate:'',unit:'DNV',subject:'檢還避雷及接地施工品質計畫A版',signedBy:'',notes:'退回修正'},
{id:'corr750',direction:'out',docNo:'DNV-10490817-0120',urgency:'普通件',issueDate:'2026-04-16',receiveDate:'',unit:'DNV',subject:'檢還基樁材料送審資料A版',signedBy:'',notes:'退回修正'},
{id:'corr751',direction:'out',docNo:'DNV-10490817-0121',urgency:'普通件',issueDate:'2026-04-16',receiveDate:'',unit:'DNV',subject:'有關本次提送土木實驗室(禾洋科技)審查結果',signedBy:'',notes:'退回修正'},
{id:'corr752',direction:'in',docNo:'綜工字第1153183901號',urgency:'普通件',issueDate:'2026-04-16',receiveDate:'2026-04-17',unit:'綜施處',subject:'更換環境保護管理人員事宜(准予核定&同意備查)',signedBy:'黃品瑄',notes:'准予核定&同意備查'},
{id:'corr753',direction:'in',docNo:'碳集字第115041601號',urgency:'普通件',issueDate:'2026-04-16',receiveDate:'2026-04-17',unit:'碳集應用',subject:'檢送營建工地逕流廢水汙染削減計畫(變更)網路申請',signedBy:'黃品瑄',notes:''},
{id:'corr754',direction:'in',docNo:'碳集字第115041602號',urgency:'普通件',issueDate:'2026-04-16',receiveDate:'2026-04-17',unit:'碳集應用',subject:'檢送自主管理辦法(A版)',signedBy:'黃品瑄',notes:''},
{id:'corr755',direction:'out',docNo:'10490817-0184',urgency:'普通件',issueDate:'2026-04-17',receiveDate:'',unit:'DNV',subject:'115年4月份第1次協調會會議紀錄',signedBy:'',notes:''},
{id:'corr756',direction:'in',docNo:'綜工字第1153183956號',urgency:'普通件',issueDate:'2026-04-17',receiveDate:'2026-04-21',unit:'綜施處',subject:'檢送違反契約安全衛生規定罰款通知單(編號：0171000003-工安-003)',signedBy:'黃品瑄',notes:''},
{id:'corr757',direction:'in',docNo:'碳集字第115041701號',urgency:'普通件',issueDate:'2026-04-17',receiveDate:'2026-04-21',unit:'碳集應用',subject:'檢送碳捕集廠細部設計圖電氣類(三)(0A版)',signedBy:'黃品瑄',notes:''},
{id:'corr758',direction:'in',docNo:'綜工字第1153183902號',urgency:'普通件',issueDate:'2026-04-21',receiveDate:'2026-04-22',unit:'綜施處',subject:'有關施工廠商違反契約規定一案(復DNV 10490817-0176號函)',signedBy:'黃品瑄',notes:''},
{id:'corr759',direction:'in',docNo:'綜工字第1153184034號',urgency:'普通件',issueDate:'2026-04-21',receiveDate:'2026-04-22',unit:'綜施處',subject:'環境保護計畫1版(准予核定)',signedBy:'黃品瑄',notes:'核定修正為1版'},
{id:'corr760',direction:'in',docNo:'綜工字第1153184035號',urgency:'普通件',issueDate:'2026-04-21',receiveDate:'2026-04-22',unit:'綜施處',subject:'檢送違反契約安全衛生規定罰款通知單(編號：0171000003-工安-004)',signedBy:'黃品瑄',notes:''},
{id:'corr761',direction:'in',docNo:'綜工字第1158046605號',urgency:'普通件',issueDate:'2026-04-21',receiveDate:'2026-04-22',unit:'綜施處',subject:'檢送115年4月15日_115年工安宣導會議紀錄',signedBy:'黃品瑄',notes:''},
{id:'corr762',direction:'in',docNo:'碳集字第115042101號',urgency:'普通件',issueDate:'2026-04-21',receiveDate:'2026-04-23',unit:'碳集應用',subject:'檢送風險評估報告書(製程設計)(C版)',signedBy:'黃品瑄',notes:''},
{id:'corr763',direction:'out',docNo:'DNV-10490817-0122',urgency:'普通件',issueDate:'2026-04-22',receiveDate:'',unit:'DNV',subject:'檢還自主管理辦法A版',signedBy:'',notes:'退回修正'},
{id:'corr764',direction:'out',docNo:'DNV-10490817-0123',urgency:'普通件',issueDate:'2026-04-22',receiveDate:'',unit:'DNV',subject:'檢送115年3月工作月報審查意見',signedBy:'',notes:''},
{id:'corr765',direction:'in',docNo:'綜工字第1153184332號',urgency:'普通件',issueDate:'2026-04-22',receiveDate:'2026-04-24',unit:'綜施處',subject:'提報機電品質管理人員事宜(准予核定)',signedBy:'黃品瑄',notes:'准予核定'},
{id:'corr766',direction:'in',docNo:'綜工字第1158047454號',urgency:'普通件',issueDate:'2026-04-22',receiveDate:'2026-04-24',unit:'綜施處',subject:'第二十四次工程推動檢討暨工安、環保、政風宣導會議開會通知單',signedBy:'黃品瑄',notes:''},
{id:'corr767',direction:'in',docNo:'綜工字第1158047959號',urgency:'普通件',issueDate:'2026-04-22',receiveDate:'2026-04-24',unit:'綜施處',subject:'工地管理研討會議開會通知單',signedBy:'黃品瑄',notes:''},
{id:'corr768',direction:'in',docNo:'綜工字第1158047689號',urgency:'普通件',issueDate:'2026-04-24',receiveDate:'2026-04-27',unit:'綜施處',subject:'通知自115年5月1日起依契約監造技術服務工作服務範圍安排監造人力進駐工地',signedBy:'黃品瑄',notes:''},
{id:'corr769',direction:'in',docNo:'綜工字第1158049650號',urgency:'普通件',issueDate:'2026-04-27',receiveDate:'2026-04-28',unit:'綜施處',subject:'檢送第二十三次工程推動檢討暨工安、環保、政風宣導會議紀錄',signedBy:'黃品瑄',notes:''},
{id:'corr770',direction:'in',docNo:'碳集字第115042701號',urgency:'普通件',issueDate:'2026-04-27',receiveDate:'2026-04-28',unit:'碳集應用',subject:'檢送115年第一次品管執行說明會會議紀錄',signedBy:'黃品瑄',notes:''},
{id:'corr771',direction:'in',docNo:'碳集字第115042702號',urgency:'普通件',issueDate:'2026-04-27',receiveDate:'2026-04-28',unit:'碳集應用',subject:'取消提送職業安全衛生管理人員之代理人(李淮翎)資料及相關證明文件',signedBy:'黃品瑄',notes:''},
{id:'corr772',direction:'in',docNo:'碳集字第115042703號',urgency:'普通件',issueDate:'2026-04-27',receiveDate:'2026-04-28',unit:'碳集應用',subject:'更換環境保護管理人員',signedBy:'黃品瑄',notes:''},
{id:'corr773',direction:'in',docNo:'綜工字第1153184333號',urgency:'普通件',issueDate:'2026-04-28',receiveDate:'2026-04-29',unit:'綜施處',subject:'檢送違反契約安全衛生規定罰款通知單(編號：0171000003-工安-005)',signedBy:'黃品瑄',notes:''},
{id:'corr774',direction:'in',docNo:'碳集字第115042801號',urgency:'普通件',issueDate:'2026-04-28',receiveDate:'2026-04-29',unit:'碳集應用',subject:'檢送貨櫃屋區域整地、地坪施作及貨櫃屋吊裝施工計畫(B版)',signedBy:'黃品瑄',notes:''},
{id:'corr775',direction:'in',docNo:'10490817-0185',urgency:'普通件',issueDate:'2026-05-04',receiveDate:'',unit:'',subject:'檢送115年4月月報',signedBy:'',notes:''},
{id:'corr776',direction:'in',docNo:'10490817-0186',urgency:'普通件',issueDate:'2026-05-04',receiveDate:'',unit:'',subject:'有關碳集公司專職環保人員呂京錞更換為葉偉豪審查結果',signedBy:'',notes:''},
{id:'corr777',direction:'in',docNo:'碳集字第115050401號',urgency:'普通件',issueDate:'2026-05-04',receiveDate:'2026-05-05',unit:'碳集應用',subject:'檢送再分包商勝達工程行契約',signedBy:'高君銓',notes:''},
{id:'corr778',direction:'in',docNo:'DNV-10490817-0124',urgency:'普通件',issueDate:'2026-05-04',receiveDate:'',unit:'',subject:'115年5月協調會會議通知',signedBy:'',notes:''},
{id:'corr779',direction:'in',docNo:'10490817-0187',urgency:'普通件',issueDate:'2026-05-05',receiveDate:'',unit:'',subject:'有關碳集公司提送之再分包商勝達工程行契約審查結果',signedBy:'',notes:''},
{id:'corr780',direction:'in',docNo:'碳集字第115050501號',urgency:'普通件',issueDate:'2026-05-05',receiveDate:'2026-05-05',unit:'碳集應用',subject:'檢送品管人員之代理人(陳怡君)資料及相關證明文件',signedBy:'高君銓',notes:''},
{id:'corr781',direction:'in',docNo:'10490817-0188',urgency:'普通件',issueDate:'2026-05-06',receiveDate:'',unit:'',subject:'有關碳集公司本次新增土木品管人員代理陳怡君審查結果',signedBy:'',notes:''},
{id:'corr782',direction:'in',docNo:'建字第1150564425號',urgency:'普通件',issueDate:'2026-05-05',receiveDate:'2026-05-07',unit:'營建處',subject:'檢還審查結果為准予備查之碳捕集廠細部設計圖電氣類(三)(0A版)',signedBy:'黃品瑄',notes:'准予備查'},
{id:'corr783',direction:'in',docNo:'碳集字第115050601號',urgency:'普通件',issueDate:'2026-05-06',receiveDate:'2026-05-07',unit:'碳集應用',subject:'檢送自主管理辦法B版',signedBy:'謝庭蓁',notes:''},
{id:'corr784',direction:'in',docNo:'碳集字第115050602號',urgency:'普通件',issueDate:'2026-05-06',receiveDate:'2026-05-07',unit:'碳集應用',subject:'檢送基樁材料送審資料B版',signedBy:'謝庭蓁',notes:''},
{id:'corr785',direction:'in',docNo:'碳集字第115050603號',urgency:'普通件',issueDate:'2026-05-06',receiveDate:'2026-05-07',unit:'碳集應用',subject:'檢送工廠檢驗及試驗計畫(國內設備-空壓系統)A版',signedBy:'謝庭蓁',notes:''},
{id:'corr786',direction:'in',docNo:'碳集字第115050604號',urgency:'普通件',issueDate:'2026-05-06',receiveDate:'2026-05-07',unit:'碳集應用',subject:'檢送工廠檢驗及試驗計畫(國內設備-去礦水系統)A版',signedBy:'謝庭蓁',notes:''},
{id:'corr787',direction:'in',docNo:'碳集字第115050605號',urgency:'普通件',issueDate:'2026-05-06',receiveDate:'2026-05-07',unit:'碳集應用',subject:'檢送工廠檢驗及試驗計畫(國內設備-蒸氣系統)A版',signedBy:'謝庭蓁',notes:''},
{id:'corr788',direction:'in',docNo:'碳集字第115050606號',urgency:'普通件',issueDate:'2026-05-06',receiveDate:'2026-05-07',unit:'碳集應用',subject:'檢送營建工地逕流廢水削減計畫(0A版)',signedBy:'謝庭蓁',notes:''},
{id:'corr789',direction:'in',docNo:'碳集字第115050701號',urgency:'普通件',issueDate:'2026-05-07',receiveDate:'2026-05-11',unit:'碳集應用',subject:'檢送詳細價目表B版',signedBy:'謝庭蓁',notes:''},
{id:'corr790',direction:'in',docNo:'綜工字第1153185095號',urgency:'普通件',issueDate:'2026-05-11',receiveDate:'2026-05-13',unit:'綜施處',subject:'更換環境保護管理人員事宜',signedBy:'黃品瑄',notes:'同意備查'},
{id:'corr791',direction:'in',docNo:'DNV-10490817-0125',urgency:'普通件',issueDate:'2026-05-11',receiveDate:'',unit:'',subject:'有關本次提送風險評估報告書(製程設計)C版審查結果',signedBy:'',notes:'准予備查'},
{id:'corr792',direction:'in',docNo:'DNV-10490817-0126',urgency:'普通件',issueDate:'2026-05-12',receiveDate:'',unit:'',subject:'有關本次提送貨櫃屋區域整地、地坪施作及貨櫃屋吊裝計畫(B版)審查意見',signedBy:'',notes:'退回修正'},
{id:'corr793',direction:'in',docNo:'碳集字第115051201號',urgency:'普通件',issueDate:'2026-05-12',receiveDate:'2026-05-13',unit:'碳集應用',subject:'檢送擋土支撐、土方開挖及回填施工計畫C版',signedBy:'謝庭蓁',notes:''},
{id:'corr794',direction:'in',docNo:'DNV-10490817-0127',urgency:'普通件',issueDate:'2026-05-13',receiveDate:'',unit:'',subject:'有關營建工地逕流廢水削減計畫0A版審查結果',signedBy:'',notes:'核定修正為1版'},
{id:'corr795',direction:'in',docNo:'碳集字第115051301號',urgency:'普通件',issueDate:'2026-05-13',receiveDate:'2026-05-14',unit:'碳集應用',subject:'檢送115年4月工作月報',signedBy:'謝庭蓁',notes:''},
{id:'corr796',direction:'in',docNo:'綜工字第1158057100號',urgency:'普通件',issueDate:'2026-05-13',receiveDate:'2026-05-14',unit:'綜施處',subject:'檢送第二十四次工程推動檢討暨工安、環保、政風宣導會議紀錄',signedBy:'黃品瑄',notes:''},
{id:'corr797',direction:'in',docNo:'DNV-10490817-0128',urgency:'普通件',issueDate:'2026-05-14',receiveDate:'',unit:'',subject:'檢還工廠檢驗及試驗計畫(國內設備-去礦水、蒸氣及空壓系統)A版',signedBy:'',notes:'退回修正'},
{id:'corr798',direction:'in',docNo:'DNV-10490817-0129',urgency:'普通件',issueDate:'2026-05-14',receiveDate:'',unit:'',subject:'檢還自主管理辦法(B版)',signedBy:'',notes:'退回修正'},
{id:'corr799',direction:'in',docNo:'碳集字第115051401號',urgency:'普通件',issueDate:'2026-05-14',receiveDate:'2026-05-15',unit:'碳集應用',subject:'檢送自主管理辦法(0版)',signedBy:'謝庭蓁',notes:''},
{id:'corr800',direction:'in',docNo:'10490817-0189',urgency:'普通件',issueDate:'2026-05-15',receiveDate:'',unit:'',subject:'有關碳集公司提送基樁材料送審資料(B版)審查結果',signedBy:'',notes:'無意見'},
{id:'corr801',direction:'in',docNo:'綜工字第1153185095號',urgency:'普通件',issueDate:'2026-05-14',receiveDate:'2026-05-18',unit:'綜施處',subject:'提報土建品質管理人員代理人(陳怡君)事宜同意備查',signedBy:'黃品瑄',notes:'同意備查'},
{id:'corr802',direction:'in',docNo:'綜工字第1158058547號',urgency:'普通件',issueDate:'2026-05-14',receiveDate:'2026-05-18',unit:'綜施處',subject:'工程施工前開挖評估會議開會通知單',signedBy:'黃品瑄',notes:''},
{id:'corr803',direction:'in',docNo:'綜工字第1158058575號',urgency:'普通件',issueDate:'2026-05-15',receiveDate:'2026-05-18',unit:'綜施處',subject:'第二十五次工程推動檢討暨工安、環保、政風宣導會議開會通知單',signedBy:'黃品瑄',notes:''},
{id:'corr804',direction:'in',docNo:'10490817-0190',urgency:'普通件',issueDate:'2026-05-18',receiveDate:'',unit:'',subject:'115年5月份定期協調會會議紀錄',signedBy:'',notes:''},
{id:'corr805',direction:'in',docNo:'DNV-10490817-0130',urgency:'普通件',issueDate:'2026-05-18',receiveDate:'',unit:'',subject:'有關承商常駐專職人員一事',signedBy:'',notes:''},
{id:'corr806',direction:'in',docNo:'DNV-10490817-0131',urgency:'普通件',issueDate:'2026-05-18',receiveDate:'',unit:'',subject:'有關自主管理辦法0版審查結果',signedBy:'',notes:'准予備查'},
{id:'corr807',direction:'in',docNo:'碳集字第115051801號',urgency:'普通件',issueDate:'2026-05-18',receiveDate:'2026-05-19',unit:'碳集應用',subject:'檢送剩餘土石方處理計畫(B版)',signedBy:'謝庭蓁',notes:''},
{id:'corr808',direction:'in',docNo:'DNV-10490817-0132',urgency:'普通件',issueDate:'2026-05-19',receiveDate:'',unit:'',subject:'檢送4月工作月報審查意見',signedBy:'',notes:''},
{id:'corr809',direction:'in',docNo:'碳集字第115051901號',urgency:'普通件',issueDate:'2026-05-19',receiveDate:'2026-05-20',unit:'碳集應用',subject:'檢送機電品管人員代理人(彭正忠)資料及相關證明文件',signedBy:'謝庭蓁',notes:''},
{id:'corr810',direction:'in',docNo:'碳集字第115051902號',urgency:'普通件',issueDate:'2026-05-19',receiveDate:'2026-05-20',unit:'碳集應用',subject:'檢送職業安全衛生管理人員之代理人(杜庭萱)資料及相關證明文件',signedBy:'謝庭蓁',notes:''},
{id:'corr811',direction:'in',docNo:'綜工字第1158060079號',urgency:'普通件',issueDate:'2026-05-19',receiveDate:'2026-05-20',unit:'綜施處',subject:'第3分期工作開工事宜',signedBy:'黃品瑄',notes:''},
{id:'corr812',direction:'in',docNo:'10490817-0191',urgency:'普通件',issueDate:'2026-05-20',receiveDate:'',unit:'',subject:'有關碳集公司本次新增機電品管人員代理彭正忠審查結果',signedBy:'',notes:''},
{id:'corr813',direction:'in',docNo:'10490817-0192',urgency:'普通件',issueDate:'2026-05-20',receiveDate:'',unit:'',subject:'有關碳集公司本次新增職安人員代理杜庭萱審查結果',signedBy:'',notes:''},
{id:'corr814',direction:'in',docNo:'碳集字第115052001號',urgency:'普通件',issueDate:'2026-05-20',receiveDate:'2026-05-21',unit:'碳集應用',subject:'更換職業安全衛生管理人員陳靜芸為蔡宗樺',signedBy:'謝庭蓁',notes:''},
{id:'corr815',direction:'in',docNo:'10490817-0193',urgency:'普通件',issueDate:'2026-05-21',receiveDate:'',unit:'',subject:'有關碳集公司本次更換職安人員陳靜芸為蔡宗樺審查結果',signedBy:'',notes:''},
{id:'corr816',direction:'in',docNo:'DNV-10490817-0133',urgency:'普通件',issueDate:'2026-05-22',receiveDate:'',unit:'',subject:'檢送詳細價目表B版審查意見',signedBy:'',notes:''},
{id:'corr817',direction:'in',docNo:'DNV-10490817-0134',urgency:'普通件',issueDate:'2026-05-22',receiveDate:'',unit:'',subject:'檢送擋土支撐、土方開挖及回填施工計畫C版審查意見',signedBy:'',notes:''},
{id:'corr818',direction:'in',docNo:'綜工字第1158061350號',urgency:'普通件',issueDate:'2026-05-22',receiveDate:'2026-05-26',unit:'綜施處',subject:'第四次監造業務討論會議開會通知單',signedBy:'黃品瑄',notes:''},
{id:'corr819',direction:'in',docNo:'綜工字第1158058785號',urgency:'普通件',issueDate:'2026-05-25',receiveDate:'2026-05-27',unit:'綜施處',subject:'工地管理研討會議紀錄',signedBy:'黃品瑄',notes:''},
{id:'corr820',direction:'in',docNo:'碳集字第115052501號',urgency:'普通件',issueDate:'2026-05-25',receiveDate:'2026-05-26',unit:'碳集應用',subject:'檢送土建品質管理人員陳怡君、代理人周泰安資料及相關證明文件',signedBy:'謝庭蓁',notes:''},
{id:'corr821',direction:'in',docNo:'碳集字第115052502號',urgency:'普通件',issueDate:'2026-05-25',receiveDate:'2026-05-26',unit:'碳集應用',subject:'檢送碳捕集廠細部設計圖機械類(一)0B版',signedBy:'謝庭蓁',notes:''},
{id:'corr822',direction:'in',docNo:'10490817-0194',urgency:'普通件',issueDate:'2026-05-26',receiveDate:'',unit:'',subject:'有關碳集公司本次更換土木品管代理陳怡君為專職新增周泰安為代理審查結果',signedBy:'',notes:''},
{id:'corr823',direction:'in',docNo:'碳集字第115052701號',urgency:'普通件',issueDate:'2026-05-27',receiveDate:'2026-05-28',unit:'碳集應用',subject:'檢送職業安全衛生管理計畫0A版',signedBy:'謝庭蓁',notes:''},
{id:'corr824',direction:'in',docNo:'綜工字第1153185560號',urgency:'普通件',issueDate:'2026-05-26',receiveDate:'2026-05-28',unit:'綜施處',subject:'基樁材料送審資料B版准予核定',signedBy:'黃品瑄',notes:'准予核定'},
{id:'corr825',direction:'in',docNo:'建字第1150563988號',urgency:'普通件',issueDate:'2026-05-25',receiveDate:'2026-05-28',unit:'營建處',subject:'同意分析實驗室一次電設計變更C版(DCN-減碳A標-E001)',signedBy:'黃品瑄',notes:'同意'},
{id:'corr826',direction:'in',docNo:'DNV-10490817-0135',urgency:'普通件',issueDate:'2026-05-28',receiveDate:'',unit:'',subject:'檢送剩餘土石方處理施工計畫B版審查意見',signedBy:'',notes:''},
{id:'corr827',direction:'in',docNo:'10490817-0195',urgency:'普通件',issueDate:'2026-05-28',receiveDate:'',unit:'',subject:'擬辦理監造主管異動為林怡秀',signedBy:'',notes:''},
{id:'corr828',direction:'in',docNo:'碳集字第115052801號',urgency:'普通件',issueDate:'2026-05-28',receiveDate:'2026-05-29',unit:'碳集應用',subject:'檢送詳細價目表0版',signedBy:'謝庭蓁',notes:''},
{id:'corr829',direction:'in',docNo:'綜工字第1153185778號',urgency:'普通件',issueDate:'2026-05-27',receiveDate:'2025-05-29',unit:'綜施處',subject:'更換職業安全衛生人員事宜(陳靜芸更換為蔡宗樺)准予核定',signedBy:'黃品瑄',notes:'准予核定'},
{id:'corr830',direction:'in',docNo:'綜工字第1153185716號',urgency:'普通件',issueDate:'2026-05-27',receiveDate:'2025-05-29',unit:'綜施處',subject:'提報機電品質管理人員代理人事宜(彭正忠)同意備查',signedBy:'黃品瑄',notes:'同意備查'},
{id:'corr831',direction:'in',docNo:'綜工字第1153185717號',urgency:'普通件',issueDate:'2026-05-27',receiveDate:'2026-05-29',unit:'綜施處',subject:'提報職業安全衛生管理人員代理人事宜(杜庭萱)同意備查',signedBy:'黃品瑄',notes:'同意備查'},
{id:'corr832',direction:'in',docNo:'綜工字第1158065347號',urgency:'普通件',issueDate:'2026-05-29',receiveDate:'2026-06-02',unit:'綜施處',subject:'工地施工前開挖評估會議紀錄',signedBy:'黃品瑄',notes:''},
{id:'corr833',direction:'in',docNo:'10490817-0196',urgency:'普通件',issueDate:'2026-06-01',receiveDate:'',unit:'',subject:'檢送第三次契約變更說明與檢附具體事證',signedBy:'',notes:''},
{id:'corr834',direction:'in',docNo:'碳集字第115060201號',urgency:'普通件',issueDate:'2026-06-02',receiveDate:'2026-06-02',unit:'碳集應用',subject:'檢送工廠檢驗及試驗計畫(國內設備-去礦水系統)B版',signedBy:'謝庭蓁',notes:''},
{id:'corr835',direction:'in',docNo:'碳集字第115060202號',urgency:'普通件',issueDate:'2026-06-02',receiveDate:'2026-06-02',unit:'碳集應用',subject:'檢送工廠檢驗及試驗計畫(國內設備-空壓系統)B版',signedBy:'謝庭蓁',notes:''},
{id:'corr836',direction:'in',docNo:'碳集字第115060203號',urgency:'普通件',issueDate:'2026-06-02',receiveDate:'2026-06-02',unit:'碳集應用',subject:'提送工地即時影像監看人員代理人周泰安',signedBy:'謝庭蓁',notes:''},
{id:'corr837',direction:'in',docNo:'10490817-0197',urgency:'普通件',issueDate:'2026-06-03',receiveDate:'',unit:'',subject:'檢送115年5月月報',signedBy:'',notes:''},
{id:'corr838',direction:'in',docNo:'碳集字第115060301號',urgency:'普通件',issueDate:'2026-06-03',receiveDate:'2026-06-04',unit:'碳集應用',subject:'檢送總工程預定進度表(0A版)',signedBy:'謝庭蓁',notes:''},
{id:'corr839',direction:'in',docNo:'10490817-0198',urgency:'普通件',issueDate:'2026-06-03',receiveDate:'',unit:'',subject:'有關碳集公司本次新增CCTV監看員代理周泰安審查結果',signedBy:'',notes:''},
{id:'corr840',direction:'in',docNo:'碳集字第115060401號',urgency:'普通件',issueDate:'2026-06-04',receiveDate:'2026-06-05',unit:'碳集應用',subject:'檢送基礎施工計畫(B版)',signedBy:'謝庭蓁',notes:''},
{id:'corr841',direction:'in',docNo:'DNV-10490817-0136',urgency:'普通件',issueDate:'2026-06-05',receiveDate:'',unit:'',subject:'檢送職安衛管理計畫0A版審查意見',signedBy:'',notes:''},
{id:'corr842',direction:'in',docNo:'DNV-10490817-0137',urgency:'普通件',issueDate:'2026-06-05',receiveDate:'',unit:'',subject:'檢送詳細價目表0版審查結果准予核定',signedBy:'',notes:''},
{id:'corr843',direction:'in',docNo:'綜工字第1153185979號',urgency:'普通件',issueDate:'2026-06-08',receiveDate:'2026-06-09',unit:'綜施處',subject:'調整土木品質管理人事宜(陳怡君_准予核定)(周泰安_同意備查)',signedBy:'黃品瑄',notes:'土木品質管理人員代理人更換為土木品質管理人員(陳怡君_准予核定)、土木品質管理人員代理人(周泰安_同意備查)'},
{id:'corr844',direction:'in',docNo:'綜工字第1153186076號',urgency:'普通件',issueDate:'2026-06-08',receiveDate:'2026-06-09',unit:'綜施處',subject:'提報監造主管事宜(林怡秀_准予核定)',signedBy:'黃品瑄',notes:'准予核定'},
{id:'corr845',direction:'in',docNo:'綜工字第1158069970號',urgency:'普通件',issueDate:'2026-06-08',receiveDate:'2026-06-09',unit:'綜施處',subject:'第二十五次工程推動檢討暨工安、環保、政風宣導會議紀錄',signedBy:'黃品瑄',notes:''},
{id:'corr846',direction:'in',docNo:'碳集字第115060901號',urgency:'普通件',issueDate:'2026-06-09',receiveDate:'2026-06-10',unit:'碳集應用',subject:'檢送115年5月工作月報',signedBy:'謝庭蓁',notes:''},
{id:'corr847',direction:'in',docNo:'DNV-10490817-0138',urgency:'普通件',issueDate:'2026-06-10',receiveDate:'',unit:'',subject:'115年6月定期協調會會議通知',signedBy:'',notes:''},
{id:'corr848',direction:'in',docNo:'碳集字第115061001號',urgency:'普通件',issueDate:'2026-06-10',receiveDate:'2026-06-11',unit:'碳集應用',subject:'檢送擋土支撐、土方開挖及回填施工計畫(D版)',signedBy:'謝庭蓁',notes:''},
{id:'corr849',direction:'in',docNo:'綜工字第1153186437號',urgency:'普通件',issueDate:'2026-06-10',receiveDate:'2026-06-12',unit:'綜施處',subject:'提報工地即時影像監看人員代理人事宜(周泰安_同意備查)',signedBy:'黃品瑄',notes:'同意備查'},
{id:'corr850',direction:'in',docNo:'綜工字第1153186243號',urgency:'普通件',issueDate:'2026-06-10',receiveDate:'2026-06-12',unit:'綜施處',subject:'第三次契約價金變更事宜(請釐清本次所提物價調整費用之契約依據)',signedBy:'黃品瑄',notes:''},
{id:'corr851',direction:'in',docNo:'10490817-0199',urgency:'普通件',issueDate:'2026-06-11',receiveDate:'',unit:'',subject:'有關碳集公司提送總工程預定進度表(0A版)審查結果',signedBy:'',notes:''},
{id:'corr852',direction:'in',docNo:'碳集字第115061101號',urgency:'普通件',issueDate:'2026-06-11',receiveDate:'2026-06-12',unit:'碳集應用',subject:'貨櫃地坪施工及吊運115年第1次共同作業協議組織會議',signedBy:'謝庭蓁',notes:''},
{id:'corr853',direction:'in',docNo:'綜工字第1158069888號',urgency:'普通件',issueDate:'2026-06-12',receiveDate:'2026-06-17',unit:'綜施處',subject:'115年度第1次北部工地、中部工地及南部工地安全衛生宣導會暨與承攬商面對面溝通座談會開會通知單',signedBy:'黃品瑄',notes:''},
{id:'corr854',direction:'in',docNo:'建字第1150565645號',urgency:'普通件',issueDate:'2026-06-12',receiveDate:'2026-06-17',unit:'營建處',subject:'碳捕集細部設計圖機械類(一)(0B版)審查結果(准予備查)',signedBy:'黃品瑄',notes:'准予備查'},
{id:'corr855',direction:'in',docNo:'碳集字第115061501號',urgency:'普通件',issueDate:'2026-06-15',receiveDate:'2026-06-17',unit:'碳集應用',subject:'檢送職業安全衛生管理計畫(0B版)',signedBy:'謝庭蓁',notes:''},
{id:'corr856',direction:'in',docNo:'碳集字第115061502號',urgency:'普通件',issueDate:'2026-06-15',receiveDate:'2026-06-17',unit:'碳集應用',subject:'檢送貨櫃屋區域整地、地坪施作及貨櫃屋吊裝施工計畫(C版)',signedBy:'謝庭蓁',notes:''},
{id:'corr857',direction:'in',docNo:'碳集字第115061503號',urgency:'普通件',issueDate:'2026-06-15',receiveDate:'2026-06-17',unit:'碳集應用',subject:'更換工地即時影像監看人員為陳威',signedBy:'謝庭蓁',notes:''},
{id:'corr858',direction:'in',docNo:'碳集字第115061504號',urgency:'普通件',issueDate:'2026-06-15',receiveDate:'2026-06-17',unit:'碳集應用',subject:'更換機電品管人員戚冏彰',signedBy:'謝庭蓁',notes:''},
{id:'corr859',direction:'in',docNo:'DNV-10490817-0139',urgency:'普通件',issueDate:'2026-06-16',receiveDate:'',unit:'',subject:'檢還工廠檢驗及試驗計畫(國內設備-去礦水、空壓系統)B版',signedBy:'',notes:''},
{id:'corr860',direction:'in',docNo:'碳集字第115061601號',urgency:'普通件',issueDate:'2026-06-16',receiveDate:'2026-06-17',unit:'碳集應用',subject:'檢送鋼筋、模板、混凝土分項施工計畫(C版)',signedBy:'謝庭蓁',notes:''},
{id:'corr861',direction:'in',docNo:'碳集字第115061701號',urgency:'普通件',issueDate:'2026-06-17',receiveDate:'2026-06-18',unit:'碳集應用',subject:'檢送風險評估報告書(施工建造)C版',signedBy:'謝庭蓁',notes:''},
{id:'corr862',direction:'in',docNo:'綜工字第1158073395號',urgency:'普通件',issueDate:'2026-06-16',receiveDate:'2026-06-18',unit:'綜施處',subject:'第二十六次工程推動檢討暨工安、環保、政風宣導會議開會通知',signedBy:'黃品瑄',notes:''},
{id:'corr863',direction:'in',docNo:'綜工字第1158073596號',urgency:'普通件',issueDate:'2026-06-16',receiveDate:'2026-06-18',unit:'綜施處',subject:'第五次監造業務討論會議開會通知單',signedBy:'黃品瑄',notes:''},
{id:'corr864',direction:'in',docNo:'綜工字第1153186677號',urgency:'普通件',issueDate:'2026-06-16',receiveDate:'2026-06-18',unit:'綜施處',subject:'總工程預定進度表(含施工網狀圖)1版(准予核定)',signedBy:'黃品瑄',notes:''},
{id:'corr865',direction:'in',docNo:'10490817-0200',urgency:'普通件',issueDate:'2026-06-18',receiveDate:'',unit:'',subject:'有關碳集公司本次更換CCTV監看員張碧惠為陳威審查結果',signedBy:'',notes:''},
{id:'corr866',direction:'in',docNo:'10490817-0201',urgency:'普通件',issueDate:'2026-06-18',receiveDate:'',unit:'',subject:'有關碳集公司本次更換機電品管人員李大嶺為戚冏彰審查結果',signedBy:'',notes:''},
{id:'corr867',direction:'in',docNo:'DNV-10490817-0140',urgency:'普通件',issueDate:'2026-06-22',receiveDate:'',unit:'',subject:'檢還基礎施工計畫B版',signedBy:'',notes:'退回修正'},
{id:'corr868',direction:'in',docNo:'DNV-10490817-0141',urgency:'普通件',issueDate:'2026-06-22',receiveDate:'',unit:'',subject:'檢送115年5月工作月報審查意見',signedBy:'',notes:'退回修正'},
{id:'corr869',direction:'in',docNo:'碳集字第115062201號',urgency:'普通件',issueDate:'2026-06-22',receiveDate:'2026-06-23',unit:'碳集應用',subject:'檢送工地即時影像監視系統(CCTV)設備送審資料(A版)',signedBy:'謝庭蓁',notes:''},
{id:'corr870',direction:'in',docNo:'碳集字第115062202號',urgency:'普通件',issueDate:'2026-06-22',receiveDate:'2026-06-23',unit:'碳集應用',subject:'施工風險評估會議通知',signedBy:'謝庭蓁',notes:''},
{id:'corr871',direction:'in',docNo:'碳集字第115062301號',urgency:'普通件',issueDate:'2026-06-23',receiveDate:'2026-06-24',unit:'碳集應用',subject:'檢送工廠檢驗及試驗計畫(國內設備-冷卻水系統)A版',signedBy:'謝庭蓁',notes:''},
{id:'corr872',direction:'in',docNo:'碳集字第115062302號',urgency:'普通件',issueDate:'2026-06-23',receiveDate:'2026-06-24',unit:'碳集應用',subject:'檢送黑糜影視文化事業有限公司CCTV監視系統設備採購暨安裝維護分包契約',signedBy:'謝庭蓁',notes:''},
{id:'corr873',direction:'in',docNo:'碳集字第115062401號',urgency:'普通件',issueDate:'2026-06-24',receiveDate:'2026-06-25',unit:'碳集應用',subject:'檢送細部設計圖機械類(二)0A版',signedBy:'謝庭蓁',notes:''},
{id:'corr874',direction:'in',docNo:'碳集字第115062402號',urgency:'普通件',issueDate:'2026-06-24',receiveDate:'2026-06-25',unit:'碳集應用',subject:'檢送富鉉營造、連驫工程、亞慶工程、建沅電機、蕎勝園藝5間廠商分包契約',signedBy:'謝庭蓁',notes:''},
{id:'corr875',direction:'in',docNo:'碳集字第115062403號',urgency:'普通件',issueDate:'2026-06-24',receiveDate:'2026-06-25',unit:'碳集應用',subject:'檢送模擬平台建立計畫B版',signedBy:'謝庭蓁',notes:''},
{id:'corr876',direction:'in',docNo:'DNV-10490817-0142',urgency:'普通件',issueDate:'2026-06-25',receiveDate:'',unit:'',subject:'檢送擋土支撐、土方開挖及回填施工計畫D版審查意見',signedBy:'',notes:''},
{id:'corr877',direction:'in',docNo:'碳集字第115062601號',urgency:'普通件',issueDate:'2026-06-26',receiveDate:'2026-06-29',unit:'碳集應用',subject:'檢送115年第1次共同作業協議組織會議紀錄',signedBy:'謝庭蓁',notes:''},
{id:'corr878',direction:'in',docNo:'碳集字第115062602號',urgency:'普通件',issueDate:'2026-06-26',receiveDate:'2026-06-29',unit:'碳集應用',subject:'檢送冠呈工程、建晁企業、禾泰豐工程廠商分包契約',signedBy:'謝庭蓁',notes:''},
{id:'corr879',direction:'in',docNo:'10490817-0202',urgency:'普通件',issueDate:'2026-06-29',receiveDate:'',unit:'',subject:'115年6月份定期協調會會議紀錄',signedBy:'',notes:''},
{id:'corr880',direction:'in',docNo:'10490817-0203',urgency:'普通件',issueDate:'2026-06-29',receiveDate:'',unit:'',subject:'有關碳集公司提送之黑糜、富鉉、連驫、亞慶、建沅、蕎勝6家分包契約審查結果',signedBy:'',notes:''},
{id:'corr881',direction:'in',docNo:'DNV-10490817-0143',urgency:'普通件',issueDate:'2026-06-30',receiveDate:'',unit:'',subject:'檢送鋼筋、模板、混凝土C版審查意見',signedBy:'',notes:'退回修正'},
{id:'corr882',direction:'in',docNo:'DNV-10490817-0144',urgency:'普通件',issueDate:'2026-06-30',receiveDate:'',unit:'',subject:'檢送職安衛管理計畫0B版審查意見',signedBy:'',notes:'退回修正'},
{id:'corr883',direction:'in',docNo:'碳集字第115063001號',urgency:'普通件',issueDate:'2026-06-30',receiveDate:'2026-06-30',unit:'碳集應用',subject:'檢送黑糜影視CCTV監視系統設備採購暨安裝維護及下包商鉅禾科技分包契約',signedBy:'謝庭蓁',notes:''},
{id:'corr884',direction:'in',docNo:'綜工字第1153187001號',urgency:'普通件',issueDate:'2026-06-25',receiveDate:'2026-07-01',unit:'綜施處',subject:'更換工地即時影像監看人員事宜(張碧惠更換為陳威_同意備查)',signedBy:'黃品瑄',notes:'同意備查'},
{id:'corr885',direction:'in',docNo:'綜工字第1153187002號',urgency:'普通件',issueDate:'2026-06-25',receiveDate:'2026-07-01',unit:'綜施處',subject:'更換機電品質管理人員事宜(李大嶺更換為戚冏彰_准予核定)',signedBy:'黃品瑄',notes:'准予核定'},
{id:'corr886',direction:'in',docNo:'碳集字第115070101號',urgency:'普通件',issueDate:'2026-07-01',receiveDate:'2026-07-01',unit:'碳集應用',subject:'檢送宇鴻工程有限公司鋼筋綁紮工程分包契約',signedBy:'謝庭蓁',notes:''},
{id:'corr887',direction:'in',docNo:'碳集字第115070201號',urgency:'普通件',issueDate:'2026-07-02',receiveDate:'2026-07-03',unit:'碳集應用',subject:'檢送職業安全衛生管理人員之代理人劉祐昌',signedBy:'謝庭蓁',notes:''},
{id:'corr888',direction:'in',docNo:'DNV-10490817-0145',urgency:'普通件',issueDate:'2026-07-02',receiveDate:'',unit:'',subject:'檢送風險評估報告書(施工建造)C版審查意見',signedBy:'',notes:'退回修正'},
{id:'corr889',direction:'in',docNo:'10490817-0204',urgency:'普通件',issueDate:'2026-07-02',receiveDate:'',unit:'',subject:'檢送115年6月月報',signedBy:'',notes:''},
{id:'corr890',direction:'in',docNo:'碳集字第115070301號',urgency:'普通件',issueDate:'2026-07-03',receiveDate:'2026-07-06',unit:'碳集應用',subject:'重新檢送貨櫃屋區域整地、地坪施作及貨櫃屋吊裝施工計畫(C版)',signedBy:'謝庭蓁',notes:''},
{id:'corr891',direction:'in',docNo:'碳集字第115070302號',urgency:'普通件',issueDate:'2026-07-03',receiveDate:'2026-07-06',unit:'碳集應用',subject:'檢送更換工地負責人為羅仁助',signedBy:'謝庭蓁',notes:''},
{id:'corr892',direction:'in',docNo:'碳集字第115070303號',urgency:'普通件',issueDate:'2026-07-03',receiveDate:'2026-07-06',unit:'碳集應用',subject:'檢送豪慶工程行地坪及整體粉光工程分包契約',signedBy:'謝庭蓁',notes:''},
{id:'corr893',direction:'in',docNo:'DNV-10490817-0146',urgency:'普通件',issueDate:'2026-07-06',receiveDate:'',unit:'',subject:'檢送工地即時影像監視系統(CCTV)(A版)審查意見',signedBy:'',notes:'退回修正'},
{id:'corr894',direction:'in',docNo:'10490817-0205',urgency:'普通件',issueDate:'2026-07-06',receiveDate:'',unit:'',subject:'有關碳集公司提送之冠呈、建晁、禾泰豐、鉅禾及宇鴻5家分包再分包契約審查結果',signedBy:'',notes:''},
{id:'corr895',direction:'in',docNo:'10490817-0206',urgency:'普通件',issueDate:'2026-07-06',receiveDate:'',unit:'',subject:'有關碳集公司本次新增職安人員代理劉祐昌審查結果',signedBy:'',notes:''},
{id:'corr896',direction:'in',docNo:'DNV-10490817-0147',urgency:'普通件',issueDate:'2026-07-07',receiveDate:'',unit:'',subject:'檢送工廠檢驗及試驗計畫(國內設備-冷卻水系統)A版審查意見',signedBy:'',notes:'退回修正'},
{id:'corr897',direction:'in',docNo:'10490817-0207',urgency:'普通件',issueDate:'2026-07-07',receiveDate:'',unit:'',subject:'有關碳集更換工負蔡正偉為羅仁助並轉代理審查結果',signedBy:'',notes:''},
{id:'corr898',direction:'in',docNo:'綜工字第1158082311號',urgency:'普通件',issueDate:'2026-07-08',receiveDate:'2026-07-09',unit:'綜施處',subject:'有關施工進度落後一事',signedBy:'黃品瑄',notes:''},
{id:'corr899',direction:'in',docNo:'碳集字第115070801號',urgency:'普通件',issueDate:'2026-07-08',receiveDate:'2026-07-09',unit:'碳集應用',subject:'檢送貨櫃地坪檢核計算書(A版)',signedBy:'謝庭蓁',notes:''},
{id:'corr900',direction:'in',docNo:'碳集字第115070901號',urgency:'普通件',issueDate:'2026-07-09',receiveDate:'2026-07-09',unit:'碳集應用',subject:'檢送廣興儀器材料有限公司研發貨櫃設備拆裝與復歸工程分包契約',signedBy:'謝庭蓁',notes:''},
{id:'corr901',direction:'in',docNo:'碳集字第115070902號',urgency:'普通件',issueDate:'2026-07-09',receiveDate:'2026-07-10',unit:'碳集應用',subject:'檢送鋼筋材料送審資料(0A版)',signedBy:'謝庭蓁',notes:''},
{id:'corr902',direction:'in',docNo:'碳集字第115070903號',urgency:'普通件',issueDate:'2026-07-09',receiveDate:'2026-07-10',unit:'碳集應用',subject:'檢送有關碳集公司第三分期開工說明',signedBy:'謝庭蓁',notes:''},
{id:'corr903',direction:'in',docNo:'碳集字第115071001號',urgency:'普通件',issueDate:'2026-07-10',receiveDate:'2026-07-13',unit:'碳集應用',subject:'檢送工地即時影像監視系統(CCTV)設備送審資料(B版)',signedBy:'謝庭蓁',notes:''},
];

// ── 通用 Header HTML ──
function buildHeader(pageTitle) {
  return `
  <div class="header">
    <button class="hamburger-btn" id="hamburger-btn" onclick="toggleNavMenu()" title="選單" aria-label="選單">
      <span class="hamburger-icon"><span></span><span></span><span></span></span>
      <span class="hamburger-label">MENU</span>
    </button>
    <div class="header-logo">
      <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    </div>
    <div class="header-title">
      <h1>${esc(pageTitle || '施工及監造工作回報')}</h1>
      <p>減碳A標</p>
    </div>
    <div class="header-actions">
      <span class="sync-badge sync-local" id="sync-badge">本機模式</span>
      <button class="btn-icon" id="header-toggle-btn" onclick="toggleSidebarCollapse()" title="展開/收起側欄">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="18"/><line x1="14" y1="9" x2="21" y2="9"/><line x1="14" y1="15" x2="21" y2="15"/></svg>
      </button>
      <button class="btn-icon sidebar-toggle" id="mobile-sidebar-btn" onclick="toggleSidebar()" title="新增">
        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <button class="btn-icon" onclick="lockApp()" title="登出">
        <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </button>
    </div>
  </div>
  <nav class="tabs" id="main-tabs"></nav>
  <div class="nav-overlay" id="nav-overlay">
    <div class="nav-overlay-bg" onclick="closeNavMenu()"></div>
    <div class="nav-overlay-panel">
      <div class="nav-overlay-head">
        <span>MENU</span>
        <button class="nav-overlay-close" onclick="closeNavMenu()" aria-label="關閉選單"></button>
      </div>
      <ul class="nav-list" id="nav-list"></ul>
      <div class="nav-overlay-foot">DNV AS　減碳A標施工監造回報系統</div>
    </div>
  </div>
  <div class="overlay-bg" id="overlay-bg" onclick="closeSidebar()"></div>`;
}

// ── Toast HTML ──
function buildToast() {
  return `
  <div class="toast-confirm" id="toast-confirm">
    <span id="toast-msg">確定要刪除？</span>
    <div style="display:flex;gap:8px;">
      <button class="toast-btn-cancel" onclick="toastResolve(false)">取消</button>
      <button class="toast-btn-ok" id="toast-ok-btn" onclick="toastResolve(true)">刪除</button>
    </div>
  </div>`;
}
