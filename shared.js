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

// ── 頁面導覽定義 ──
const NAV_PAGES = [
  { id:'timeline',   label:'時間軸',         href:'timeline.html',   badge:null },
  { id:'defects',    label:'改善事項追蹤',   href:'defects.html',    badge:'open-count' },
  { id:'quality',    label:'監造查驗',        href:'quality.html',    badge:'qi-fail-count' },
  { id:'doctrack',   label:'文件管理',        href:'doctrack.html',   badge:'doc-overdue-count' },
  { id:'guide',      label:'📘 送審須知',    href:'guide.html',      badge:null },
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
  };

  if (!Array.isArray(result.docs)         || !result.docs.length)         result.docs         = DOCS_PRELOAD.slice();
  if (!Array.isArray(result.qualityItems) || !result.qualityItems.length) result.qualityItems = QI_PRELOAD.slice();
  if (!Array.isArray(result.members)      || !result.members.length)       result.members      = getDefaultMembers();
  if (!Array.isArray(result.docTrack)     || !result.docTrack.length)      result.docTrack     = DOCTRACK_PRELOAD.slice();

  if (!API_URL) return result;

  setSync('載入中…', 'sync-busy');
  try {
    const data = await apiCall({ action:'getAll' });
    const raw  = Array.isArray(data.entries) ? data.entries : [];
    result.entries = raw.map(sanitizeEntry).filter(e => e.date);
    localSave(result.entries);

    const modules = ['defects','docs','qi','att','members','doctrack'];
    const keys    = [DEFECT_KEY, DOCS_KEY, QI_KEY, ATT_KEY, MEMBER_KEY, DOCTRACK_KEY];
    const props   = ['defects','docs','qualityItems','attRecords','members','docTrack'];
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
