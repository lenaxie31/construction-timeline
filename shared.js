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

// ── 頁面導覽定義 ──
const NAV_PAGES = [
  { id:'timeline',   label:'時間軸',         href:'timeline.html',   badge:null },
  { id:'defects',    label:'改善事項追蹤',   href:'defects.html',    badge:'open-count' },
  { id:'quality',    label:'監造查驗',        href:'quality.html',    badge:'qi-fail-count' },
  { id:'doctrack',   label:'文件管理',        href:'doctrack.html',   badge:'doc-overdue-count' },
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
  const openDef  = Array.isArray(defects)      ? defects.filter(d => d.status !== 'closed').length : 0;
  const qiFail   = Array.isArray(qualityItems)  ? qualityItems.filter(q => q.progress !== 'Completed').length : 0;
  const today    = todayStr();
  const docOverdue = Array.isArray(docTrack) ? docTrack.filter(d =>
    d.dueDate && !d.returnDate && d.progress !== 'done' && d.dueDate < today
  ).length : 0;

  const badgeVals = { 'open-count': openDef, 'qi-fail-count': qiFail, 'doc-overdue-count': docOverdue };

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
  };

  if (!Array.isArray(result.docs)         || !result.docs.length)         result.docs         = DOCS_PRELOAD.slice();
  if (!Array.isArray(result.qualityItems) || !result.qualityItems.length) result.qualityItems = QI_PRELOAD.slice();
  if (!Array.isArray(result.members)      || !result.members.length)       result.members      = getDefaultMembers();
  if (!Array.isArray(result.docTrack)     || !result.docTrack.length)      result.docTrack     = DOCTRACK_PRELOAD.slice();
  if (!Array.isArray(result.guideNotes)   || !result.guideNotes.length)    result.guideNotes   = GUIDE_PRELOAD.slice();

  if (!API_URL) return result;

  setSync('載入中…', 'sync-busy');
  try {
    const data = await apiCall({ action:'getAll' });
    const raw  = Array.isArray(data.entries) ? data.entries : [];
    result.entries = raw.map(sanitizeEntry).filter(e => e.date);
    localSave(result.entries);

    const modules = ['defects','docs','qi','att','members','doctrack','guidenotes'];
    const keys    = [DEFECT_KEY, DOCS_KEY, QI_KEY, ATT_KEY, MEMBER_KEY, DOCTRACK_KEY, GUIDE_KEY];
    const props   = ['defects','docs','qualityItems','attRecords','members','docTrack','guideNotes'];
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
