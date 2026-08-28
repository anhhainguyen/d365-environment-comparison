(function() {
'use strict';

/* ── Application State ── */
var STATE={allRows:[],filteredRows:[],lblA:'Source',lblB:'Target',entitiesA:[],entitiesB:[],entityMapA:{},entityMapB:{},activeModule:'',moduleDetailRows:[],visibleModuleDetailRows:[],entityBrowserPage:1,entityBrowserPageSize:30,entityBrowserSearch:'',entityBrowserStatusFilter:'',activeEntityName:'',activeEntityLoading:false,activeWorkspaceTab:'entities'};

/* ── Helpers ── */
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function shorten(u){try{return new URL(u).hostname}catch{return u}}
function initials(n){return(n||'?').split(/\s+/).map(function(w){return w[0]}).join('').toUpperCase().slice(0,2)||'?'}
function getVal(id){var el=document.getElementById(id);return el?el.value.trim():''}
function setVal(id,v){var el=document.getElementById(id);if(el)el.value=v}

var _tt;
function toast(msg){
  var el=document.getElementById('toast');
  if(!el){return;}
  el.textContent=msg;
  el.classList.add('show');
  clearTimeout(_tt);
  _tt=setTimeout(function(){el.classList.remove('show')},3600);
}

function setSt(id,type,text){
  var el=document.getElementById(id);
  if(!el){return;}
  var cls={ok:'s-ok',error:'s-error',loading:'s-loading',idle:'s-idle'};
  var dot={ok:'d-ok',error:'d-error',loading:'d-loading',idle:'d-idle'};
  el.className='sbox '+(cls[type]||'s-idle');
  el.innerHTML='<div class="sdot '+(dot[type]||'d-idle')+'"></div><span>'+text+'</span>';
  // Promote the Diagnose button when either status slot has an error, reset otherwise
  var stA = document.getElementById('stA');
  var stB = document.getElementById('stB');
  var diagBtn = document.getElementById('btnDiag');
  if(diagBtn){
    var hasError = (stA && stA.classList.contains('s-error')) || (stB && stB.classList.contains('s-error'));
    diagBtn.classList.toggle('prominent', hasError);
  }
}

var _progressHideTimer;
function showProgress(label,text,pct){
  var panel=document.getElementById('progressPanel');
  if(!panel){return;}
  document.getElementById('progressLabel').textContent=label||'Working...';
  document.getElementById('progressText').textContent=text||'';
  var safePct=Math.max(0,Math.min(100,Math.round(pct||0)));
  document.getElementById('progressPct').textContent=safePct+'%';
  document.getElementById('progressFill').style.width=safePct+'%';
  clearTimeout(_progressHideTimer);
  panel.style.display='block';
}

function hideProgress(delay){
  clearTimeout(_progressHideTimer);
  var run=function(){
    var panel=document.getElementById('progressPanel');
    if(panel)panel.style.display='none';
  };
  if(delay)_progressHideTimer=setTimeout(run,delay);
  else run();
}

function setSetupCardCollapsed(collapsed){
  var body=document.getElementById('setupCardBody');
  var btn=document.getElementById('btnToggleSetup');
  if(!body||!btn){return;}
  body.style.display=collapsed?'none':'block';
  btn.textContent=collapsed?'Expand':'Collapse';
  btn.setAttribute('aria-expanded',collapsed?'false':'true');
}

function focusModuleFiltersCard(){
  var card=document.getElementById('moduleFiltersCard');
  var focusTarget=STATE.activeWorkspaceTab==='module'?document.getElementById('modSel'):document.getElementById('entitySearch');
  if(card&&card.scrollIntoView){
    card.scrollIntoView({behavior:'smooth',block:'start'});
  }
  if(focusTarget&&focusTarget.focus){
    setTimeout(function(){focusTarget.focus();},150);
  }
}

function updateWorkspaceTabs(){
  var active=STATE.activeWorkspaceTab==='module'?'module':'entities';
  STATE.activeWorkspaceTab=active;
  var tabEntities=document.getElementById('tabEntities');
  var tabModule=document.getElementById('tabModule');
  var entityNote=document.getElementById('entityPaneNote');
  var moduleNote=document.getElementById('modulePaneNote');
  var entityPanel=document.getElementById('entityBrowserPanel');
  var moduleControls=document.getElementById('moduleControls');
  var sampleNotice=document.getElementById('sampleNotice');
  var moduleProgress=document.getElementById('moduleProgressPanel');
  var moduleDetail=document.getElementById('modDetailPanel');
  var showEntities=active==='entities';
  var hasRows=Array.isArray(STATE.allRows)&&STATE.allRows.length>0;

  document.body.classList.toggle('workspace-module',!showEntities);
  if(tabEntities){tabEntities.classList.toggle('active',showEntities);tabEntities.setAttribute('aria-selected',showEntities?'true':'false');}
  if(tabModule){tabModule.classList.toggle('active',!showEntities);tabModule.setAttribute('aria-selected',showEntities?'false':'true');}
  if(entityNote)entityNote.style.display=showEntities?'block':'none';
  if(moduleNote)moduleNote.style.display=showEntities?'none':'block';
  if(entityPanel)entityPanel.style.display=showEntities&&hasRows?'block':'none';
  if(moduleControls)moduleControls.style.display=showEntities?'none':'flex';
  if(sampleNotice)sampleNotice.style.display=showEntities?'none':'flex';
  if(moduleProgress){
    moduleProgress.hidden=showEntities;
    if(showEntities)moduleProgress.style.display='none';
  }
  if(moduleDetail){
    moduleDetail.hidden=showEntities;
    if(showEntities)moduleDetail.style.display='none';
    else if(STATE.moduleDetailRows.length||STATE.activeModule)moduleDetail.style.display='block';
  }
}

function setWorkspaceTab(tab){
  STATE.activeWorkspaceTab=tab==='module'?'module':'entities';
  updateWorkspaceTabs();
  renderEntityBrowser();
  saveComparisonSnapshot();
}

function resetWorkspaceFilters(defaultTab){
  STATE.entityBrowserSearch='';
  STATE.entityBrowserPage=1;
  STATE.activeModule='';
  STATE.activeEntityName='';
  STATE.activeEntityLoading=false;
  STATE.moduleDetailRows=[];
  STATE.visibleModuleDetailRows=[];
  if(defaultTab)STATE.activeWorkspaceTab='entities';

  var entitySearch=document.getElementById('entitySearch');
  var modSel=document.getElementById('modSel');
  var modDetailFilter=document.getElementById('modDetailFilter');
  var modDetailStatusFilter=document.getElementById('modDetailStatusFilter');
  var modDetailSummary=document.getElementById('modDetailSummary');
  var modDetailPanel=document.getElementById('modDetailPanel');
  var entityDiffPanel=document.getElementById('entityDiffPanel');
  if(entitySearch)entitySearch.value='';
  if(modSel)modSel.value='';
  if(modDetailFilter)modDetailFilter.value='';
  if(modDetailStatusFilter)modDetailStatusFilter.value='';
  if(modDetailSummary)modDetailSummary.innerHTML='';
  if(modDetailPanel)modDetailPanel.style.display='none';
  if(entityDiffPanel)entityDiffPanel.style.display='none';
}

var _moduleProgressHideTimer;
var _detailCompareRunId = 0;
var _entitySearchSaveTimer;

function startDetailCompareRun(){
  _detailCompareRunId += 1;
  return _detailCompareRunId;
}

function isCurrentDetailCompareRun(runId){
  return runId === _detailCompareRunId;
}

function showModuleProgress(label,text,pct){
  var panel=document.getElementById('moduleProgressPanel');
  if(!panel){return;}
  document.getElementById('moduleProgressLabel').textContent=label||'Working...';
  document.getElementById('moduleProgressText').textContent=text||'';
  var safePct=Math.max(0,Math.min(100,Math.round(pct||0)));
  document.getElementById('moduleProgressPct').textContent=safePct+'%';
  document.getElementById('moduleProgressFill').style.width=safePct+'%';
  clearTimeout(_moduleProgressHideTimer);
  panel.style.display='block';
}

function hideModuleProgress(delay){
  clearTimeout(_moduleProgressHideTimer);
  var run=function(){
    var panel=document.getElementById('moduleProgressPanel');
    if(panel)panel.style.display='none';
  };
  if(delay)_moduleProgressHideTimer=setTimeout(run,delay);
  else run();
}

function generateId(){
  if(typeof crypto!=='undefined'&&crypto.randomUUID)return crypto.randomUUID();
  return 'id-'+Date.now()+'-'+Math.random().toString(36).slice(2);
}

var ROOT_SCOPE = typeof window !== 'undefined' ? window : globalThis;
ROOT_SCOPE.esc = esc;
ROOT_SCOPE.toast = toast;
ROOT_SCOPE.setSt = setSt;
ROOT_SCOPE.showProgress = showProgress;
ROOT_SCOPE.hideProgress = hideProgress;
ROOT_SCOPE.showModuleProgress = showModuleProgress;
ROOT_SCOPE.hideModuleProgress = hideModuleProgress;

/* ── Mode detection ── */
var IS_EXT = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;

(function(){
  var el = document.getElementById('modeNote');
  if (!el) return;
  el.innerHTML = '<span><strong>Extension mode</strong> &mdash; data is fetched through your open D365 tabs. Open both environments in this same Chrome profile and log in before validating.</span>';
  el.className = 'note note-blue';
  el.style.display = 'flex';
})();

function normUrl(url){
  return String(url || '').trim().replace(/\/+$/, '');
}

function isHttps(url){
  return /^https:\/\//i.test(String(url || '').trim());
}

function getSlotTitle(slot) {
  return slot === 'A' ? 'Source' : 'Target';
}

/* ── Storage helpers — chrome.storage.local ── */
function _store(){
  return (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local)
    ? chrome.storage.local
    : null;
}

/* ── Profile helpers ── */
function getProfiles(){
  try{return JSON.parse(localStorage.getItem('d365_profiles')||'[]')}
  catch(e){return []}
}

function putProfiles(list){
  var json = JSON.stringify(list);
  localStorage.setItem('d365_profiles', json);
  var s = _store();
  if(!s) return Promise.resolve();
  return new Promise(function(resolve, reject){
    try{
      s.set({'d365_profiles': json}, function(){
        var err = chrome.runtime && chrome.runtime.lastError;
        if(err) reject(new Error(err.message || 'Failed to save profiles.'));
        else resolve();
      });
    }catch(e){
      reject(e);
    }
  });
}

// Load profiles from chrome.storage into localStorage then re-render.
// Returns a Promise that resolves when done.
function syncProfilesFromStorage(){
  var s = _store();
  if(!s) return Promise.resolve();
  return new Promise(function(resolve){
    s.get(['d365_profiles','d365_pick'], function(result){
      if(result.d365_profiles){
        localStorage.setItem('d365_profiles', result.d365_profiles);
      }
      if(result.d365_pick){
        localStorage.setItem('d365_pick', result.d365_pick);
      }
      resolve();
    });
  });
}

function renderProfileList(){
  var el = document.getElementById('pfList');
  if (!el) return;
  var list = getProfiles();
  if (!list.length) {
    el.innerHTML = '<div class="pf-empty">No profiles saved yet. Add one above.</div>';
    return;
  }
  el.innerHTML = list.map(function(p) {
    return '' +
      '<div class="pf-item">' +
        '<div class="pf-meta">' +
          '<div class="pf-name">' + esc(p.name) + '</div>' +
          '<div class="pf-url">' + esc(p.url) + '</div>' +
        '</div>' +
        '<div class="pf-actions">' +
          '<button class="pf-edit-btn" data-id="' + esc(p.id) + '">Edit</button>' +
          '<button class="pf-del-btn" data-id="' + esc(p.id) + '">Delete</button>' +
        '</div>' +
      '</div>';
  }).join('');
}

function refreshPickers(){
  var list = getProfiles();
  ['A','B'].forEach(function(slot){
    var sel = document.getElementById('picker' + slot);
    if (!sel) return;
    var current = slot === 'A' ? _selA : _selB;
    var html = '<option value="">— Select a saved profile —</option>' +
      list.map(function(p){
        return '<option value="' + esc(p.id) + '">' + esc(p.name + ' — ' + shorten(p.url)) + '</option>';
      }).join('');
    sel.innerHTML = html;
    if (current) sel.value = current;
  });
}

/* NOTE: Stub for legal entity filter hydration.
   Intentionally no-op for now; future implementation can populate
   company options from a legal entities endpoint. */
function refreshLegalEntityFilters(){
  return Promise.resolve();
}

async function addOrUpdateProfile(){
  var name=getVal('pfName').trim();
  var url=normUrl(getVal('pfUrl'));
  var eid=getVal('pfEditId');
  if(!name||!url){toast('⚠️ Enter both profile name and URL.');return}
  if(!isHttps(url)){toast('⚠️ URL must start with https://');return}
  var list=getProfiles();
  if(eid){
    var it=list.find(function(p){return p.id===eid});
    if(it){it.name=name;it.url=url}
    setVal('pfEditId','');
    document.getElementById('btnAddProfile').textContent='➕ Add Profile';
    toast('✅ Profile "'+name+'" updated.');
  } else {
    var ex=list.find(function(p){return p.url===url});
    if(ex){ex.name=name;toast('💾 Updated existing profile for this URL.');}
    else{list.push({id:generateId(),name:name,url:url});toast('✅ Profile "'+name+'" saved.');}
  }
  await putProfiles(list);
  setVal('pfName','');
  setVal('pfUrl','');
  var settings = document.getElementById('profileSettings');
  if (settings) settings.open = false;
  renderProfileList();
  refreshPickers();
}

function openProfileSettings(){
  var settings = document.getElementById('profileSettings');
  if (settings) settings.open = true;
}

function editProfile(id){
  var p=getProfiles().find(function(x){return x.id===id});
  if(!p)return;
  openProfileSettings();
  setVal('pfName',p.name);
  setVal('pfUrl',p.url);
  setVal('pfEditId',p.id);
  document.getElementById('btnAddProfile').textContent='💾 Update Profile';
  document.getElementById('pfName').focus();
}

async function deleteProfile(id){
  await putProfiles(getProfiles().filter(function(p){return p.id!==id}));
  if(_selA===id)clearSlot('A');
  if(_selB===id)clearSlot('B');
  renderProfileList();
  refreshPickers();
  toast('🗑️ Profile deleted.');
}

/* ── Slot selection ── */
var _selA=null,_selB=null;

function loadSlot(slot){
  var id=getVal('picker'+slot);
  if(!id){clearSlot(slot);return}
  var p=getProfiles().find(function(x){return x.id===id});
  if(!p)return;
  if(slot==='A')_selA=id;else _selB=id;
  setSt('st'+slot,'idle',(slot==='A'?'Source':'Target')+' — not connected');
  persist();
  toast('✅ "'+p.name+'" selected as '+getSlotTitle(slot));
}

function clearSlot(slot){
  if(slot==='A')_selA=null;else _selB=null;
  setVal('picker'+slot,'');
  setSt('st'+slot,'idle',(slot==='A'?'Source':'Target')+' — not connected');
  persist();
}

/* ── Get active URL/label for a slot ── */
function getEnvUrl(slot){
  var id=slot==='A'?_selA:_selB;
  if(!id)return'';
  var p=getProfiles().find(function(x){return x.id===id});
  return p?p.url:'';
}

function getEnvLabel(slot){
  var id=slot==='A'?_selA:_selB;
  if(!id)return getSlotTitle(slot);
  var p=getProfiles().find(function(x){return x.id===id});
  return p?p.name:getSlotTitle(slot);
}

function getCompany(){
  var companyEl = document.getElementById('company');
  if(!companyEl) return '';
  var value = companyEl.value || '';
  if(value === '__custom__') {
    var customEl = document.getElementById('companyCustom');
    return customEl ? customEl.value.trim().toUpperCase() : '';
  }
  return value;
}

function getRowLimit(){
  var el = document.getElementById('rowLimit');
  if(!el) return 0;
  var value = Number(el.value);
  if(!isFinite(value) || value < 0) value = 0;
  return Math.floor(value);
}

function getRowLimitLabel(){
  var limit = getRowLimit();
  return limit === 0 ? 'all rows' : 'up to ' + limit + ' rows';
}

function updateRowLimitNotice(){
  var el = document.getElementById('sampleNotice');
  if(!el) return;
  var limit = getRowLimit();
  var icon = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#d97706" stroke-width="1.5" style="flex-shrink:0"><path d="M8 2L1.5 13.5h13L8 2z"/><path d="M8 6.5v3M8 11v.5"/></svg>';
  el.innerHTML = icon + (limit === 0
    ? 'Rows checked is <strong>0</strong>: comparisons read <strong>all rows</strong> per entity. This can be slow on large tables.'
    : 'Rows checked is <strong>' + limit + '</strong>: comparisons read <strong>up to ' + limit + ' rows</strong> per entity. Set <strong>0</strong> to compare all rows.');
}

function onCompanySelectChange(){
  var companyEl = document.getElementById('company');
  var customEl = document.getElementById('companyCustom');
  if(!companyEl || !customEl) return;
  var isCustom = companyEl.value === '__custom__';
  customEl.style.display = isCustom ? 'block' : 'none';
  if(isCustom) customEl.focus();
  else customEl.value = '';
}

/* ── Persist / restore last picks ── */
function persist(){
  var companyEl = document.getElementById('company');
  var companyCustomEl = document.getElementById('companyCustom');
  var data = JSON.stringify({selA:_selA,selB:_selB,
    company: companyEl ? companyEl.value : '',
    companyCustom: companyCustomEl ? companyCustomEl.value : '',
    rowLimit:getRowLimit()
  });
  localStorage.setItem('d365_pick', data);
  var s = _store();
  if(s) s.set({'d365_pick': data});
}

function restore(){
  try{
    var d=JSON.parse(localStorage.getItem('d365_pick')||'{}');
    if(d.selA){_selA=d.selA;}
    if(d.selB){_selB=d.selB;}
    refreshPickers();
    var companyEl=document.getElementById('company');
    if(d.company && companyEl){companyEl.value=d.company;}
    var companyCustomEl=document.getElementById('companyCustom');
    if(d.companyCustom && companyCustomEl)companyCustomEl.value=d.companyCustom;
    if(d.rowLimit != null){
      var rowLimitEl = document.getElementById('rowLimit');
      if(rowLimitEl) rowLimitEl.value = Math.max(0, Math.floor(Number(d.rowLimit) || 0));
    }
    onCompanySelectChange();
    updateRowLimitNotice();
  }catch(e){}
}

var COMPARE_SNAPSHOT_KEY = 'd365_compare_snapshot';

function trimEntityForSnapshot(e) {
  return {
    name: e.name || '',
    label: e.label || '',
    aotName: e.aotName || '',
    dmfName: e.dmfName || '',
    module: e.module || '',
    moduleExact: !!e.moduleExact,
    moduleSource: e.moduleSource || '',
    collection: e.collection || '',
    odataEnabled: !!e.odataEnabled,
    category: e.category || '',
    dmEnabled: !!e.dmEnabled,
    serviceDoc: !!e.serviceDoc
  };
}

function trimModuleDetailForSnapshot(r) {
  return {
    name: r.name || '',
    label: r.label || '',
    module: r.module || '',
    aotName: r.aotName || '',
    dmfName: r.dmfName || '',
    publicCollectionName: r.publicCollectionName || '',
    idx: r.idx || 0,
    countA: r.countA,
    countB: r.countB,
    srcOnly: r.srcOnly || 0,
    tgtOnly: r.tgtOnly || 0,
    status: r.status || '',
    detail: r.detail || ''
  };
}

function hydrateModuleDetailRow(r) {
  return Object.assign({}, r, {
    metaA: STATE.entityMapA[r.name] || null,
    metaB: STATE.entityMapB[r.name] || null
  });
}

function saveComparisonSnapshot() {
  if (!STATE.allRows.length) return Promise.resolve();
  var snapshot = {
    version: 1,
    savedAt: Date.now(),
    selA: _selA,
    selB: _selB,
    lblA: STATE.lblA,
    lblB: STATE.lblB,
    rowLimit: getRowLimit(),
    activeModule: STATE.activeModule || '',
    activeWorkspaceTab: STATE.activeWorkspaceTab || 'entities',
    entityBrowserSearch: STATE.entityBrowserSearch || '',
    entityBrowserPage: STATE.entityBrowserPage || 1,
    entityBrowserPageSize: STATE.entityBrowserPageSize || 30,
    entitiesA: STATE.entitiesA.map(trimEntityForSnapshot),
    entitiesB: STATE.entitiesB.map(trimEntityForSnapshot),
    moduleDetailRows: STATE.moduleDetailRows.map(trimModuleDetailForSnapshot)
  };
  var json = JSON.stringify(snapshot);
  var s = _store();
  if (s) {
    // Always write to chrome.storage.local — it is shared across all extension pages (popup + full-page tab)
    return new Promise(function(resolve) {
      try {
        s.set({ [COMPARE_SNAPSHOT_KEY]: json }, function() {
          resolve();
        });
      } catch(e) { resolve(); }
    });
  }
  // Fallback (non-extension/localhost mode)
  try { localStorage.setItem(COMPARE_SNAPSHOT_KEY, json); } catch(e) {}
  return Promise.resolve();
}

function readComparisonSnapshotFromStorage() {
  var s = _store();
  if (s) {
    // Read from chrome.storage.local — the only store shared between extension pages
    return new Promise(function(resolve) {
      try {
        s.get([COMPARE_SNAPSHOT_KEY], function(result) {
          resolve(result && result[COMPARE_SNAPSHOT_KEY] ? result[COMPARE_SNAPSHOT_KEY] : '');
        });
      } catch(e) { resolve(''); }
    });
  }
  // Fallback (non-extension mode)
  var localValue = '';
  try { localValue = localStorage.getItem(COMPARE_SNAPSHOT_KEY) || ''; } catch(e) {}
  return Promise.resolve(localValue);
}

function restoreComparisonSnapshot() {
  return readComparisonSnapshotFromStorage().then(function(json) {
    if (!json) return false;
    var snapshot;
    try { snapshot = JSON.parse(json); } catch(e) { return false; }
    if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.entitiesA) || !Array.isArray(snapshot.entitiesB)) return false;

    STATE.entitiesA = snapshot.entitiesA;
    STATE.entitiesB = snapshot.entitiesB;
    STATE.entityMapA = indexEntitiesByName(STATE.entitiesA);
    STATE.entityMapB = indexEntitiesByName(STATE.entitiesB);
    STATE.allRows = buildRows(STATE.entitiesA, STATE.entitiesB);
    STATE.lblA = snapshot.lblA || getEnvLabel('A');
    STATE.lblB = snapshot.lblB || getEnvLabel('B');
    STATE.entityBrowserSearch = '';
    STATE.entityBrowserPage = 1;
    STATE.entityBrowserPageSize = Math.max(1, Math.floor(Number(snapshot.entityBrowserPageSize) || 30));
    var entitySearchEl = document.getElementById('entitySearch');
    var entityPageSizeEl = document.getElementById('entityPageSize');
    if (entitySearchEl) entitySearchEl.value = '';
    if (entityPageSizeEl) entityPageSizeEl.value = String(STATE.entityBrowserPageSize);
    if (snapshot.rowLimit != null) {
      var rowLimitEl = document.getElementById('rowLimit');
      if (rowLimitEl) rowLimitEl.value = Math.max(0, Math.floor(Number(snapshot.rowLimit) || 0));
      updateRowLimitNotice();
    }
    STATE.activeWorkspaceTab = 'entities';
    resetWorkspaceFilters(false);

    rebuildModuleFilter(STATE.allRows);
    renderEntityBrowser();
    updateReportButtonState();
    updateWorkspaceTabs();
    if (STATE.allRows.length) {
      setSetupCardCollapsed(true);
      setSt('stA','ok',(STATE.lblA || 'Source')+' — restored '+STATE.entitiesA.length+' entities');
      setSt('stB','ok',(STATE.lblB || 'Target')+' — restored '+STATE.entitiesB.length+' entities');
    }
    return true;
  });
}

/* ── Normalise raw entity records from either endpoint into {name, module, category} ── */
function getEntityAotName(e) {
  return (e && (e.aotName || e.AotName || e.DataEntityAOTName || e.dataEntityAOTName || e.Name || e.TargetName)) || '';
}

function getEntityDmfName(e) {
  return (e && (e.dmfName || e.DmfName || e.EntityName || e.entityName)) || '';
}

function getEntityJoinKey(e) {
  return getEntityAotName(e) || (e && (e.Name || e.TargetName || e.PublicEntityName || e.name || e.url)) || '';
}

function normaliseEntities(raw) {
  var list = Array.isArray(raw) ? raw : (raw && raw.value ? raw.value : []);
  return list.map(function(e) {
    var serviceDoc = isServiceDocumentEntity(e);
    var aotName = getEntityAotName(e);
    var dmfName = getEntityDmfName(e);
    var name = aotName || dmfName || e.PublicEntityName || e.name || e.url || '';
    if (!name) return null;
    var moduleInfo = getModuleInfo(e);
    var category = e.EntityCategory || e.entityCategory || (serviceDoc ? 'serviceRoot' : '');
    var collection = e.PublicCollectionName || e.publicCollectionName || e.PublicCollection || e.publicCollection || '';
    if (!collection && serviceDoc) collection = e.url || e.name || '';
    return {
      name:     name,
      label:    e.PublicEntityName || e.EntityLabel || e.title || dmfName || name,
      aotName:  aotName || name,
      dmfName:  dmfName || '',
      module:   moduleInfo.name,
      moduleExact: moduleInfo.exact,
      moduleSource: moduleInfo.source,
      collection: collection,
      odataEnabled: typeof e.DataServiceEnabled === 'boolean' ? e.DataServiceEnabled : (typeof e.ODataEnabled === 'boolean' ? e.ODataEnabled : !!(collection || serviceDoc)),
      category: category,
      dmEnabled: !!(e.DataManagementEnabled || e.IsDataManagementEnabled),
      serviceDoc: serviceDoc
    };
  }).filter(Boolean).filter(function(e) {
    return isIncludedEntityCategory(e.category) || e.dmEnabled || e.serviceDoc;
  });
}

function isServiceDocumentEntity(e) {
  return !!(e && e.kind === 'EntitySet' && (e.name || e.url));
}

var INCLUDED_ENTITY_CATEGORIES = {
  master: true,
  reference: true,
  parameter: true,
  parameters: true
};

function isIncludedEntityCategory(category) {
  return !!INCLUDED_ENTITY_CATEGORIES[String(category || '').trim().toLowerCase()];
}

var MODULE_GROUP_UNCLASSIFIED = 'Unclassified';
var MODULE_GROUP_RAW = 'Raw Entity Sets';

function normaliseModuleToken(s) {
  return String(s || '').replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

function splitModuleTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map(function(t) { return String(t || '').trim(); }).filter(Boolean);
  }
  return String(tags || '').split(/[;,|]+/).map(function(t) {
    return t.trim();
  }).filter(Boolean);
}

function findExactModuleFromTags(tags) {
  var parts = splitModuleTags(tags);
  for (var i = 0; i < parts.length; i++) {
    var token = humanizeModuleToken(parts[i]);
    if (normaliseModuleToken(token)) return token;
  }
  return '';
}

function humanizeModuleToken(token) {
  var text = String(token || '').trim();
  if (!text) return '';
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeModuleName(token) {
  var raw = String(token || '').trim();
  if (!raw) return '';
  return humanizeModuleToken(raw);
}

var HEURISTIC_MODULE_RULES = [
  // ── Warehouse & Inventory ──
  { re:/^WHS/i,                                                                                     m:'Warehouse Management' },
  { re:/^(Invent|InventSite|InventTable|InventTrans|InventDim|InventLocation|InventSerial|InventBatch|InventJournal|InventOnhand|InventQuality|InventTransfer|InventCount)/i, m:'Inventory Management' },
  { re:/^(ItemArrival|TransportRoute|ReturnOrder)/i,                                                m:'Inventory Management' },

  // ── Product Information ──
  { re:/^(EcoRes|ReleasedProduct|DistinctProduct|UnitOfMeasure|ProductCategory|ProductMaster|ProductVariant|ProductAttribute|ProductDefault|ProductGroup|ItemGroup|BOMVersion|BOMCalc|ConfigLine)/i, m:'Product Information' },
  { re:/^(PdsBatch|PdsItem|PdsRebate|PdsCumulativeItem)/i,                                         m:'Product Information' },

  // ── Accounts Payable ──
  { re:/^(Vend|Vendor|VendorInvoice|VendorPayment|VendTable|VendTrans|VendInvoice|VendGroup|VendSettlement|VendParameters|VendAccount)/i, m:'Accounts Payable' },
  { re:/^(Paym|Payment|Tax1099|BankVend|VendorPortal)/i,                                            m:'Accounts Payable' },
  { re:/^(PurchLineDisc|PurchPrice|PurchAutoCharges|PurchOrderPool)/i,                              m:'Accounts Payable' },

  // ── Accounts Receivable ──
  { re:/^(Cust|Customer|CustTable|CustTrans|CustGroup|CustAccount|CustInvoice|CustPayment|CustSettlement|CustParameters|CustPosting|CustBalance|CustAgingReport|CustCollect)/i, m:'Accounts Receivable' },
  { re:/^(CollectionLetter|FreeTextInvoice|InterestNote)/i,                                        m:'Accounts Receivable' },

  // ── Sales & Marketing ──
  { re:/^(Sales|SalesOrder|SalesLine|SalesQuotation|SalesDelivery|SalesTable|SalesTrans|SalesGroup|SalesPolicy|SalesReturn)/i, m:'Sales & Marketing' },
  { re:/^(SalesOrderPool|SalesAutoCharges|SalesLineDisc|SalesPrice|SalesCampaign|SalesTarget|SalesTerrit)/i, m:'Sales & Marketing' },
  { re:/^(MCRSales|MCRCust|MCROrder|MCRReturn|MCRContinuity|MCRBroker|MCRInstallment|MCRPayment|MCRSourceCode|MCRCatalog)/i, m:'Call Center' },
  { re:/^(smmActivity|smmBusRel|smmCampaign|smmContact|smmLeads|smmOpportunity|smmQuotation|smmSales)/i, m:'Sales & Marketing' },

  // ── Procurement & Sourcing ──
  { re:/^(Purch|PurchOrder|PurchLine|PurchTable|PurchGroup|PurchReq|PurchRFQ|PurchRebate|PurchContract|PurchPolicy)/i, m:'Procurement' },
  { re:/^(Agreement|TradeAgreement|PriceDisc)/i,                                                   m:'Procurement' },

  // ── General Ledger ──
  { re:/^(Ledger|LedgerJournal|LedgerTrans|LedgerEntry|LedgerPeriod|LedgerAlloc|LedgerTrialBal)/i, m:'General Ledger' },
  { re:/^(MainAccount|Dimension|FiscalCalendar|FiscalYear|FiscalPeriod|ExchangeRate|CurrencyExchange|Currency)/i, m:'General Ledger' },
  { re:/^(Fiscal|Consol|Consolidat|LedgerFinancial|FinancialReport|FinancialStatement)/i,          m:'General Ledger' },
  { re:/^(Voucher|GeneralJournal|PeriodicJournal)/i,                                               m:'General Ledger' },

  // ── Finance (general) ──
  { re:/^(Financial|Finance|Subledger|AccountingDistrib|AccountingEvent|AccountEntry|FundAccounting)/i, m:'Finance' },

  // ── Tax ──
  { re:/^(Tax|TaxGroup|TaxCode|TaxTrans|TaxAdjust|TaxReport|TaxTable|TaxLedger|TaxWithhold|TaxDeclar|Excise|CustomsDuty|TaxRegistration)/i, m:'Tax' },

  // ── Cash & Bank ──
  { re:/^(Bank|BankAccount|BankTrans|BankJournal|BankReconcile|BankStatement|BankGroup|BankDeposit|BankCheck|BankLetter)/i, m:'Cash & Bank' },
  { re:/^(CashDisc|CashFlow|Cheque)/i,                                                             m:'Cash & Bank' },

  // ── Fixed Assets ──
  { re:/^(Asset|FixedAsset|AssetBook|AssetTrans|AssetGroup|AssetDepreciation|AssetDisposal|AssetAcquisition|AssetLease)/i, m:'Fixed Assets' },
  { re:/^(RAsset|ROU)/i,                                                                            m:'Fixed Assets' },

  // ── Budgeting ──
  { re:/^(Budget|BudgetCycle|BudgetPlan|BudgetControl|BudgetRegister|BudgetAlloc|BudgetReservation|BudgetForecast|Forecast)/i, m:'Budgeting' },

  // ── Project Management & Accounting ──
  { re:/^(Proj|Project|ProjTable|ProjTrans|ProjGroup|ProjForecast|ProjContract|ProjInvoice|ProjCategory|ProjBudget|ProjLine|ProjWorker|ProjPosting|ProjCost|ProjRevenue|ProjResource|ProjTimesheet)/i, m:'Project Management' },
  { re:/^(PSAContractLine|PSAProject)/i,                                                           m:'Project Management' },

  // ── Human Resources ──
  { re:/^(HRM|Hcm|HcmWorker|HcmPosition|HcmDepartment|HcmJob|HcmSkill|HcmLeave|HcmBenefit|HcmCompensation|HcmPerformance|HcmEmployment|HcmTraining|HcmCourse|HcmAbsence)/i, m:'Human Resources' },
  { re:/^(Worker|Employee|Applicant|Recruitment)/i,                                                 m:'Human Resources' },

  // ── Payroll ──
  { re:/^(Payroll|PayStatement|PayPeriod|PayCycle|EarningCode|EarningLine|BenefitAccrual|PayrollTax|PayrollWorker|PayrollDeduction)/i, m:'Payroll' },

  // ── Production Control ──
  { re:/^(Prod|ProdOrder|ProdTable|ProdBOM|ProdRoute|ProdJournal|ProdCostEstimation|ProdSubContract)/i, m:'Production Control' },
  { re:/^(BOM|Route|Kanban|WrkCtr|ProdCalc|ProdParameter|JobCard|ProdPickingList|ProductionFlow)/i, m:'Production Control' },
  { re:/^(LeanProductionFlow|LeanSchedule|KanbanJob)/i,                                            m:'Production Control' },

  // ── Master Planning ──
  { re:/^(Req|ReqPlan|ReqTrans|ReqForecast|ReqBOM|MRP|Coverage|CovPlan|IntercompanyPlanning)/i,   m:'Master Planning' },
  { re:/^(ForecastSupply|ForecastDemand|DemandForecast)/i,                                         m:'Master Planning' },

  // ── Retail & Commerce ──
  { re:/^(Retail|RetailStore|RetailChannel|RetailPos|RetailTerminal|RetailTransaction|RetailProduct|RetailCategory|RetailCatalog|RetailCust|RetailDiscount|RetailEmployee|RetailGift|RetailInventory|RetailLoyalty|RetailPricing|RetailShipping|RetailTender|RetailComm|RetailConnDist)/i, m:'Retail & Commerce' },

  // ── Transportation & Logistics ──
  { re:/^(TMSRoute|TMSLoad|TMSShipment|TMSCarrier|TMSFreight|TMSHub|TMSTransport|TMSEngine|TransportRoute)/i, m:'Transportation Management' },
  { re:/^(WHSShip|WHSLoad|WHSWork)/i,                                                              m:'Warehouse Management' },

  // ── Service Management ──
  { re:/^(SMAService|SMAContract|SMAObject|SMAOrder|SMAAgreement|SMASubscription|SMATemplate|SMARepair)/i, m:'Service Management' },

  // ── Global Address Book ──
  { re:/^(Dir|DirParty|DirPerson|DirOrg|Logistics|Address|CountryRegion|ZipCode|State|City|County|ContactPerson|Party)/i, m:'Global Address Book' },

  // ── Organization Administration ──
  { re:/^(OM|CompanyInfo|LegalEntity|DataArea|NumberSeq|ReasonCode|Organization|OrgUnit|OperatingUnit|Hierarchy|DimensionHierarchy)/i, m:'Organization Administration' },
  { re:/^(Sys|SystemParam|SysEmail|SysWorkflow|SysUser|BatchJob|BatchGroup|DocuType|Note)/i,       m:'System Administration' },
  { re:/^(UserGroup|SecurityRole|SecurityDuty|SecurityPrivilege|AccessRight)/i,                   m:'System Administration' },

  // ── Cost Management ──
  { re:/^(Cost|CostCategory|CostGroup|CostSheet|CostSharing|CostAdjust|CostInventory|InventCost)/i, m:'Cost Management' },

  // ── Credit & Collections ──
  { re:/^(Credit|CreditLimit|CreditHold|Aging|Collect)/i,                                         m:'Credit & Collections' },

  // ── Expense Management ──
  { re:/^(TrvExpense|TrvAdv|TrvPolicy|TrvMileage|TrvCash|TrvUnsettled|TrvParameters|Travel)/i,    m:'Expense Management' },

  // ── Asset Leasing ──
  { re:/^(AssetLease|ROU|IFRS16|LeaseBook|LeaseJournal)/i,                                        m:'Asset Leasing' },

  // ── Public Sector ──
  { re:/^(PsaPublic|PsaGrant|PsaFund|PublicSector|PSA)/i,                                         m:'Public Sector' },

  // ── Fleet Management ──
  { re:/^(FMVehicle|FMCustomer|FMRental|FMReservation|FMFacility|Fleet)/i,                        m:'Fleet Management' },

  // ── Intercompany ──
  { re:/^(Intercompany|ICust|IVend|InterComp)/i,                                                   m:'Intercompany' },

  // ── Electronic Reporting / Regulatory ──
  { re:/^(ERFormat|ERModel|ERConfig|ERSolution|ElectronicReport)/i,                                m:'Electronic Reporting' },
  { re:/^(Regulatory|RCS|GlobalizationStudio)/i,                                                   m:'Regulatory' },

  // ── Subscription Billing / Revenue Recognition ──
  { re:/^(SubBilling|SubscriptionBilling|RevRec|RevenueRecognition|RevenueSplit)/i,                m:'Subscription Billing' },

  // ── Rebate Management ──
  { re:/^(Rebate|RebateProg|PdsRebateProg|TAMRebate)/i,                                            m:'Rebate Management' },

  // ── Credit Management ──
  { re:/^(CreditMgmt|CreditManagement)/i,                                                          m:'Credit Management' },

  //── Landed Cost ──
  { re:/^(ITM|LandedCost|ItmVoyage|ItmContainer|ItmShipment|ItmFolio)/i,                          m:'Landed Cost' },

  // ── Advanced Bank Reconciliation ──
  { re:/^(BankStmtIso|BankReconcAdv|BankStmtFormat)/i,                                            m:'Cash & Bank' },

  // ── Questionnaire / Survey ──
  { re:/^(KM|KMQuestionnaire|KMQuestion|KMAnswer|KMForm|KMKnowledge)/i,                           m:'Questionnaire' },

  // ── Case Management ──
  { re:/^(Case|CaseDetail|CaseLog|CaseCategory|CaseAssociation)/i,                                 m:'Case Management' },

  // ── Vendor Portal / Collaboration ──
  { re:/^(VendorPortal|VendCollaboration|VendorCollab|PurchVendorPortal)/i,                       m:'Vendor Collaboration' },

  // ── Customer Portal ──
  { re:/^(CustPortal|CustomerPortal)/i,                                                             m:'Customer Collaboration' },

  // ── Compliance & Audit ──
  { re:/^(Audit|AuditPolicy|Compliance|PolicyViolation|PolicyRule)/i,                              m:'Compliance' },

  // ── Workflow ──
  { re:/^(Workflow|WFTracking|WFApproval|WorkflowElement|WorkflowTable)/i,                        m:'Workflow' },

  // ── Interoperability / Integration ──
  { re:/^(CDSVirtual|CDS|DualWrite|DualWriteMap|MicrosoftDataverse)/i,                             m:'Dual-Write / Dataverse' }

  // NOTE: ISV-specific prefixes (e.g. A365*, custom partner namespaces) are intentionally
  // NOT included here — they must come from the OData Module field returned by the D365
  // environment itself. If Module is blank for an ISV entity, it shows as Unclassified.
];


function inferModuleFromEntityName(name) {
  var value = String(name || '').trim();
  if (!value) return '';
  for (var i = 0; i < HEURISTIC_MODULE_RULES.length; i++) {
    if (HEURISTIC_MODULE_RULES[i].re.test(value)) return HEURISTIC_MODULE_RULES[i].m;
  }
  return '';
}

function hasExactModuleMetadata(e) {
  return !!(e.Modules || e.modules || e.AppModule || e.appModule || e.ApplicationModule || e.applicationModule || e.Module || e.module || e.ModuleName);
}

function getModuleInfo(e) {
  var serviceDoc = isServiceDocumentEntity(e);
  var entityName = e.EntityName || e.Name || e.PublicEntityName || e.name || e.url || '';
  var direct = e.Modules || e.modules || e.AppModule || e.appModule || e.ApplicationModule || e.Module || e.module || e.ModuleName || '';
  if (String(direct || '').trim()) {
    return { name: normalizeModuleName(direct), source: 'field', exact: true };
  }

  var fromTags = findExactModuleFromTags(e.Tags || e.tags || e.Tag || e.tag || '');
  if (String(fromTags || '').trim()) {
    return { name: normalizeModuleName(fromTags), source: 'tags', exact: false };
  }

  var inferred = inferModuleFromEntityName(entityName);
  if (String(inferred || '').trim()) {
    return { name: inferred, source: 'heuristic', exact: false };
  }

  // No more "Derived / Xyz" fragmentation — anything unrecognised goes to Unclassified.
  // This keeps the module dropdown clean with real module names only.
  return {
    name: serviceDoc ? MODULE_GROUP_RAW : MODULE_GROUP_UNCLASSIFIED,
    source: 'none',
    exact: false
  };
}

/* ── Rebuild module filter dropdown — grouped by first letter bucket or explicit group ── */
function rebuildModuleFilter(rows) {
  var modules = {};
  rows.forEach(function(r) {
    var moduleName = r.module || MODULE_GROUP_UNCLASSIFIED;
    if (!modules[moduleName]) modules[moduleName] = 0;
    modules[moduleName]++;
  });
  var sorted = Object.keys(modules).sort();
  var sel = document.getElementById('modSel');
  var prev = sel.value;
  var html = '<option value="">All Module Groups (' + rows.length + ' entities)</option>';

  sorted.forEach(function(m) {
    html += '<option value="' + esc(m) + '">' + esc(m) + ' (' + modules[m] + ')</option>';
  });

  sel.innerHTML = html;
  if (prev && modules[prev]) sel.value = prev;
  updateReportButtonState();
}

function updateReportButtonState() {
  var btn = document.getElementById('btnReport');
  var compareBtn = document.getElementById('btnCompareModule');
  var sel = document.getElementById('modSel');
  if (!sel) return;

  var moduleName = sel.value || '';
  var hasRows = Array.isArray(STATE.allRows) && STATE.allRows.length > 0;
  var enabled = !!moduleName && hasRows;

  if (compareBtn) {
    compareBtn.disabled = !enabled;
    compareBtn.title = enabled
      ? 'Compare records for the selected module'
      : 'Load environments and select a specific module first.';
  }

  if (btn) {
    btn.disabled = !enabled;
    btn.title = enabled
      ? 'Generate a standalone HTML comparison report for the selected module only'
      : 'Select a specific module group first. Full-report generation for All Module Groups is disabled.';
  }
}

/* ── Derive module from a raw entity record using runtime metadata only ── */
function deriveModule(e) {
  return getModuleInfo(e).name;
}

function normalizeHostName(host) {
  return String(host || '').trim().toLowerCase().replace(/\.$/, '');
}

function getD365HostAliases(host) {
  var clean = normalizeHostName(host);
  var aliases = [clean];
  if (/\.sandbox\.operations\.dynamics\.com$/i.test(clean)) {
    aliases.push(clean.replace('.sandbox.operations.dynamics.com', '.operations.dynamics.com'));
  } else if (/\.operations\.dynamics\.com$/i.test(clean)) {
    aliases.push(clean.replace('.operations.dynamics.com', '.sandbox.operations.dynamics.com'));
  }
  return aliases.filter(function(value, index, list) {
    return value && list.indexOf(value) === index;
  });
}

function isD365Host(host) {
  return /(^|\.)dynamics\.com$/i.test(host) || /(^|\.)operations\.dynamics\.com$/i.test(host);
}

function getTabHost(tab) {
  try { return normalizeHostName(new URL(tab.url || '').hostname); }
  catch { return ''; }
}

function getTabOrigin(tab) {
  try { return new URL(tab.url || '').origin; }
  catch { return ''; }
}

function isBadD365TabUrl(url) {
  return !url ||
    url.indexOf('login.microsoftonline') !== -1 ||
    url.indexOf('login.live') !== -1 ||
    url.indexOf('chrome-error://') === 0 ||
    url.indexOf('edge-error://') === 0 ||
    url.indexOf('about:') === 0;
}

function formatNoOpenTabMessage(found) {
  var msg = 'No visible Chrome tab for ' + found.host + '. Open it in this same Chrome profile and log in first.';
  if (found.candidates && found.candidates.length) {
    msg += ' Chrome can see: ' + found.candidates.slice(0, 4).join(', ');
  } else {
    msg += ' Chrome cannot see any D365 tabs in this profile.';
  }
  return msg;
}

function tabToD365Candidate(tab, host, aliases, fallback) {
  return {
    tab: tab,
    host: host,
    aliases: aliases,
    actualHost: getTabHost(tab),
    actualOrigin: getTabOrigin(tab),
    fallback: !!fallback
  };
}

function buildD365TabCandidates(envUrl, tabs) {
  var host = normalizeHostName(new URL(envUrl.replace(/\/+$/, '')).hostname);
  var aliases = getD365HostAliases(host);
  var d365Hosts = [];
  var exact = [];
  tabs.forEach(function(t) {
    var tabHost = getTabHost(t);
    if (isD365Host(tabHost) && d365Hosts.indexOf(tabHost) === -1) d365Hosts.push(tabHost);
    if (!isD365Host(tabHost) || isBadD365TabUrl(t.url || '')) return;
    // Only accept tabs whose host matches the selected environment (or its
    // sandbox/prod alias). Never fall back to an unrelated D365 environment —
    // doing so would silently probe and compare the wrong environment.
    if (aliases.indexOf(tabHost) !== -1) exact.push(tabToD365Candidate(t, host, aliases, false));
  });
  return {
    host: host,
    aliases: aliases,
    candidates: d365Hosts,
    tabCandidates: exact,
    fallbackCandidates: []
  };
}

/* ── Find D365 tab by hostname ── */
async function findD365Tab(envUrl) {
  var tabs = await chrome.tabs.query({});
  var result = buildD365TabCandidates(envUrl, tabs);
  if (result.tabCandidates.length) {
    return Object.assign({}, result.tabCandidates[0], {
      candidates: result.candidates,
      tabCandidates: result.tabCandidates,
      fallbackCandidates: result.fallbackCandidates
    });
  }
  return { tab: null, host: result.host, aliases: result.aliases, candidates: result.candidates, tabCandidates: [], fallbackCandidates: result.fallbackCandidates };
}

/* ── Low-level: try sending a message, resolve 'NO_LISTENER' if content script absent ── */
function _trySendMessage(tabId, msgObj) {
  return new Promise(function(resolve) {
    chrome.tabs.sendMessage(tabId, msgObj, function(res) {
      if (chrome.runtime.lastError) {
        resolve('NO_LISTENER');
        return;
      }
      resolve(res);
    });
  });
}

/* ── Ensure content script is loaded in tab, then send message ── */
async function askTab(tabId, msgObj) {
  var res = await _trySendMessage(tabId, msgObj);
  if (res !== 'NO_LISTENER') return res;

  // Inject content.js and retry
  try {
    await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] });
  } catch(e) {
    throw new Error('Could not inject into D365 tab: ' + e.message);
  }
  await new Promise(function(r){ setTimeout(r, 300); });

  var res2 = await _trySendMessage(tabId, msgObj);
  if (res2 === 'NO_LISTENER') throw new Error('Content script not responding. Reload the D365 tab.');
  return res2;
}

/* ── Probe a single endpoint — returns {ok, status, data, detail} ── */
async function probeEndpoint(tabId, endpoint) {
  return askTab(tabId, { type: 'FETCH_ENTITIES', endpoint: endpoint });
}

function withTimeout(promise, timeoutMs, message) {
  var timer;
  return Promise.race([
    promise,
    new Promise(function(_, reject) {
      timer = setTimeout(function() { reject(new Error(message || 'Timed out')); }, timeoutMs);
    })
  ]).finally(function() {
    clearTimeout(timer);
  });
}

async function probeEndpointWithTimeout(tabId, endpoint, timeoutMs) {
  return withTimeout(
    probeEndpoint(tabId, endpoint),
    timeoutMs || 8000,
    'Timed out probing D365 endpoint after ' + Math.round((timeoutMs || 8000) / 1000) + 's'
  );
}

function getProbeOrigins(envUrl, found) {
  var origins = [];
  function add(origin) {
    if (origin && origins.indexOf(origin) === -1) origins.push(origin);
  }
  try { add(new URL(envUrl).origin); } catch(e) {}
  if (found && found.actualOrigin) add(found.actualOrigin);
  return origins;
}

async function tryCandidateEndpoints(found, envUrl, endpointFactory, onAttemptError, timeoutMs) {
  var candidates = found && found.tabCandidates && found.tabCandidates.length
    ? found.tabCandidates
    : (found && found.tab ? [found] : []);
  var lastStatus = '';
  var lastDetail = '';
  for (var ti = 0; ti < candidates.length; ti++) {
    var candidate = candidates[ti];
    var origins = getProbeOrigins(envUrl, candidate);
    for (var oi = 0; oi < origins.length; oi++) {
      var origin = origins[oi];
      var endpoints = endpointFactory(origin, candidate);
      for (var ei = 0; ei < endpoints.length; ei++) {
        var endpoint = endpoints[ei];
        try {
          var res = await probeEndpointWithTimeout(candidate.tab.id, endpoint, timeoutMs || 8000);
          if (!res) continue;
          if (res.ok) {
            return { ok: true, candidate: candidate, origin: origin, endpoint: endpoint, res: res };
          }
          if (res.status === 401) {
            return { ok: false, auth: true, candidate: candidate, origin: origin, endpoint: endpoint, status: 401, detail: '401 — Not authorised. Log in to the D365 tab first.' };
          }
          lastStatus = res.status ? 'HTTP ' + res.status : '';
          lastDetail = res.detail ? res.detail.slice(0, 220) : '';
        } catch(e) {
          lastDetail = e && e.message ? e.message : String(e);
          if (onAttemptError) onAttemptError(candidate, origin, endpoint, lastDetail);
        }
      }
    }
  }
  return { ok: false, status: lastStatus, detail: lastDetail };
}

/* ── Build candidate endpoints ──
   OData first: /data/DataEntities returns a `Module` field per entity.
   Metadata:    /Metadata/DataEntities has richer entity metadata but NO Module field.
   We try OData first so module data is populated; fall back to Metadata if OData is blocked. ── */
function getODataCandidates(origin) {
  return [
    origin + '/data/DataEntities?$top=10000&cross-company=true',
    origin + '/data/DataEntities?$top=10000',
    origin + '/data/DataEntities',
    origin + '/data/dataentities?$top=10000&cross-company=true',
    origin + '/data/dataentities?$top=10000',
    origin + '/data/dataentities'
  ];
}

function getMetadataCandidates(origin) {
  return [
    origin + '/Metadata/DataEntities',
    origin + '/metadata/DataEntities',
    origin + '/metadata/dataentities'
  ];
}

function getDataManagementCandidates(origin) {
  return [
    origin + '/data/DataManagementEntities?$top=10000&cross-company=true',
    origin + '/data/DataManagementEntities?$top=10000',
    origin + '/data/DataManagementEntities'
  ];
}

function getServiceDocCandidates(origin) {
  return [
    origin + '/data',
    origin + '/data/'
  ];
}

function getCandidateEndpoints(origin) {
  // OData first so Module field is populated, then Metadata, then service doc as last resort
  return [].concat(
    getODataCandidates(origin),
    getMetadataCandidates(origin),
    getServiceDocCandidates(origin)
  );
}

function getValidationCandidates(origin) {
  return [
    origin + '/data/DataEntities?$top=1&cross-company=true',
    origin + '/Metadata/DataEntities',
    origin + '/data'
  ];
}

/* ── Try a list of endpoints against a tab, return first raw JSON that yields usable data.
   validateFn (optional): called with (data) — must return true for the result to be accepted.
   When omitted the raw JSON is accepted as soon as the request succeeds (raw mode). ── */
async function _tryEndpointList(tabId, endpoints, host, validateFn) {
  var lastErr = '';
  for (var i = 0; i < endpoints.length; i++) {
    var res;
    try {
      res = await probeEndpointWithTimeout(tabId, endpoints[i], 12000);
    } catch(e) {
      lastErr = e && e.message ? e.message : String(e);
      continue;
    }
    if (!res) continue;
    if (res.ok) {
      if (validateFn) {
        if (validateFn(res.data)) return { data: res.data, endpoint: endpoints[i] };
        lastErr = 'Endpoint returned 0 usable entities after filtering';
        continue;
      }
      return { data: res.data, endpoint: endpoints[i] };
    }
    if (res.status === 401) throw new Error('401 \u2014 Not authorised. Make sure you are logged in to ' + host);
    lastErr = 'HTTP ' + res.status + (res.detail ? ' \u2014 ' + res.detail.slice(0, 200) : '');
  }
  return { data: null, lastErr: lastErr };
}

/* ── Merge module info from an OData result into a Metadata result ──
   Metadata has richer entity metadata; OData has the Module field.
   We build a name→module map from OData and stamp it onto Metadata records. ── */
function _mergeModuleData(metaRaw, odataRaw) {
  var odataList = Array.isArray(odataRaw) ? odataRaw : (odataRaw && odataRaw.value ? odataRaw.value : []);
  var moduleMap = {};
  odataList.forEach(function(e) {
    var name = getEntityJoinKey(e);
    var mod = e.AppModule || e.appModule || e.ApplicationModule || e.Module || e.module || e.ModuleName || '';
    if (name && mod) moduleMap[name] = mod;
  });

  var metaList = Array.isArray(metaRaw) ? metaRaw : (metaRaw && metaRaw.value ? metaRaw.value : []);
  var merged = metaList.map(function(e) {
    var name = getEntityJoinKey(e);
    if (name && moduleMap[name] && !e.Module && !e.AppModule) {
      return Object.assign({}, e, { Module: moduleMap[name] });
    }
    return e;
  });
  return Array.isArray(metaRaw) ? merged : Object.assign({}, metaRaw, { value: merged });
}

function _mergeDataManagementData(entityRaw, dataManagementRaw) {
  var dataManagementList = Array.isArray(dataManagementRaw) ? dataManagementRaw : (dataManagementRaw && dataManagementRaw.value ? dataManagementRaw.value : []);
  var dmfMap = {};
  dataManagementList.forEach(function(e) {
    var targetName = (e && (e.TargetName || e.targetName)) || '';
    if (!targetName) return;
    dmfMap[targetName] = {
      dmfName: getEntityDmfName(e),
      modules: e.Modules || e.modules || '',
      isShared: e.IsShared,
      dataManagementEnabled: e.DataManagementEnabled
    };
  });

  var entityList = Array.isArray(entityRaw) ? entityRaw : (entityRaw && entityRaw.value ? entityRaw.value : []);
  var merged = entityList.map(function(e) {
    var joinKey = getEntityJoinKey(e);
    var dmfEntry = joinKey && dmfMap[joinKey];
    if (!dmfEntry) return e;
    var patch = {};
    if (dmfEntry.dmfName && !getEntityDmfName(e)) patch.DmfName = dmfEntry.dmfName;
    if (dmfEntry.modules && !e.Modules && !e.Module && !e.AppModule) patch.Modules = dmfEntry.modules;
    if (dmfEntry.isShared !== undefined && e.IsShared === undefined) patch.IsShared = dmfEntry.isShared;
    if (dmfEntry.dataManagementEnabled !== undefined && e.DataManagementEnabled === undefined) patch.DataManagementEnabled = dmfEntry.dataManagementEnabled;
    return Object.keys(patch).length ? Object.assign({}, e, patch) : e;
  });

  return Array.isArray(entityRaw) ? merged : Object.assign({}, entityRaw, { value: merged });
}

/* ── Fetch ── */
async function fetchEntities(envUrl, slot){
  var origin;
  try { origin = new URL(envUrl).origin; }
  catch(e) { throw new Error('Invalid URL: ' + envUrl); }

  var found = await findD365Tab(envUrl);
  if(!found.tab) throw new Error(formatNoOpenTabMessage(found));
  var working = await tryCandidateEndpoints(found, envUrl, function(candidateOrigin) {
    return getCandidateEndpoints(candidateOrigin);
  });
  if(!working.ok){
    throw new Error(working.detail || ('All endpoints failed ' + (working.status || '')));
  }

  origin = working.origin;
  var tabId = working.candidate.tab.id;
  var host = working.candidate.actualHost || working.candidate.host;

  // ── Pass 1: try OData (has Module field) ──
  var _entityValidator = function(data) { return normaliseEntities(data).length > 0; };
  var odataResult = await _tryEndpointList(tabId, getODataCandidates(origin), host, _entityValidator);

  // ── Pass 2: try Metadata (richer metadata, no Module field) ──
  var metaResult = await _tryEndpointList(tabId, getMetadataCandidates(origin), host, _entityValidator);

  // ── Pass 3: try DataManagementEntities (TargetName -> EntityName / Modules) ──
  var dmfResult = await _tryEndpointList(tabId, getDataManagementCandidates(origin), host);

  var mergedData = null;

  if (odataResult.data && metaResult.data) {
    // Best case: merge module data from OData into the richer Metadata records
    mergedData = _mergeModuleData(metaResult.data, odataResult.data);
  } else if (odataResult.data) {
    // OData only — Module field is present directly
    mergedData = odataResult.data;
  } else if (metaResult.data) {
    // Metadata only — module will fall back to heuristics (no OData available)
    mergedData = metaResult.data;
  }

  if (mergedData && dmfResult.data) {
    mergedData = _mergeDataManagementData(mergedData, dmfResult.data);
  }
  if (mergedData) {
    return mergedData;
  }

  // ── Pass 4: last resort service doc ──
  var svcResult = await _tryEndpointList(tabId, getServiceDocCandidates(origin), host, _entityValidator);
  if (svcResult.data) return svcResult.data;

  var lastErr = odataResult.lastErr || metaResult.lastErr || dmfResult.lastErr || svcResult.lastErr || 'Unknown error';
  throw new Error('All endpoints failed. Last error: ' + lastErr + '\nTried: ' + getCandidateEndpoints(origin).join(', '));
}

/* ── Validate ── */
async function validateAccess(){
  var urlA=getEnvUrl('A'), urlB=getEnvUrl('B');
  if(!urlA&&!urlB){toast('\u26A0\uFE0F Select or enter at least one environment.');return}
  refreshLegalEntityFilters().catch(function(){}); // Ensure filters are refreshed
  if(urlA&&!isHttps(urlA)){toast('\u26A0\uFE0F Source URL must start with https://');return}
  if(urlB&&!isHttps(urlB)){toast('\u26A0\uFE0F Target URL must start with https://');return}
  var btn=document.getElementById('btnVal'), sp=document.getElementById('spinVal');
  btn.disabled=true; sp.style.display='inline-block';

  async function check(url, stId, label, slot){
    setSt(stId,'loading',label+' \u2014 checking...');
    var origin;
    try { origin = new URL(url).origin; }
    catch(e) { setSt(stId,'error',label+' \u2014 Invalid URL'); return; }

    if(IS_EXT){
      var found = await findD365Tab(url);
      if(!found.tab){
        setSt(stId,'error',label+' \u2014 '+formatNoOpenTabMessage(found));
        return;
      }
      var probe = await tryCandidateEndpoints(found, url, function(candidateOrigin) {
        return getValidationCandidates(candidateOrigin).map(function(u){
          return u.replace('$top=10000','$top=1').replace(/&\$select=[^&]*/,'');
        });
      }, null, 6000);
      if(probe.ok){
        var viaPath = new URL(probe.endpoint).pathname;
        var approx = /\/data\/?$/i.test(viaPath) ? ' using OData service root fallback' : '';
        var hostNote = probe.candidate && probe.candidate.actualHost ? ' on ' + probe.candidate.actualHost : '';
        setSt(stId,'ok',label+' \u2014 Connected \u2713 via '+viaPath+approx+hostNote+' ('+esc((probe.candidate.tab && probe.candidate.tab.title)||probe.candidate.host)+')');
      } else if(probe.auth){
        setSt(stId,'error',label+' \u2014 '+probe.detail);
      } else {
        setSt(stId,'error',label+' \u2014 All endpoints failed ('+(probe.status||'')+'). '+
          (probe.detail||'Open the D365 tab, log in, then click \u1F9EA Diagnose for details.'));
      }
    } else {
      var proxyUrl='http://localhost:8888/proxy?url='+encodeURIComponent(buildEndpoint(origin,'DataEntities?$top=1&$select=Name&cross-company=true'));
      var token=getToken(slot);
      if(token) proxyUrl+='&token='+encodeURIComponent(token);
      try{
        var r=await Promise.race([
          fetch(proxyUrl,{method:'GET'}),
          new Promise(function(_,rej){setTimeout(function(){rej(new Error('Timed out after 12s'))},12000)})
        ]);
        if(r.status===401) setSt(stId,'error',label+' \u2014 401 Not authorised. Paste a valid bearer token.');
        else if(!r.ok) setSt(stId,'error',label+' \u2014 HTTP '+r.status+' response from D365.');
        else setSt(stId,'ok',label+' \u2014 reachable and authenticated \u2713');
      }catch(e){ setSt(stId,'error',label+' \u2014 '+e.message); }
    }
  }

  var tasks=[];
  if(urlA) tasks.push(check(urlA,'stA',getEnvLabel('A'),'A').catch(function(e){
    setSt('stA','error',getEnvLabel('A')+' — '+(e&&e.message?e.message:String(e)));
  }));
  if(urlB) tasks.push(check(urlB,'stB',getEnvLabel('B'),'B').catch(function(e){
    setSt('stB','error',getEnvLabel('B')+' — '+(e&&e.message?e.message:String(e)));
  }));
  try {
    await Promise.all(tasks);
  } finally {
    btn.disabled=false; sp.style.display='none';
  }
}

/* ── Load Entities ── */
async function loadEntities(){
  var urlA=getEnvUrl('A'),urlB=getEnvUrl('B');
  var lblA=getEnvLabel('A'),lblB=getEnvLabel('B');
  if(!urlA||!urlB){toast('\u26A0\uFE0F Select both Source and Target environments first.');return}
  var btn=document.getElementById('btnLoad'),sp=document.getElementById('spinLoad');
  btn.disabled=true;sp.style.display='inline-block';
  setSt('stA','loading',lblA+' \u2014 loading entities...');
  setSt('stB','loading',lblB+' \u2014 loading entities...');
  startDetailCompareRun();
  hideModuleProgress();
  showProgress('Load entity list', 'Preparing environment metadata...', 5);
  async function tryLoad(url,stId,label,slot){
    try{
      showProgress('Load entity list', 'Loading data entities from ' + label + '...', slot==='A' ? 20 : 60);
      var raw = await fetchEntities(url, slot);
      var entities = normaliseEntities(raw);
      if(!entities.length) throw new Error('No entities returned — endpoint responded but list is empty.');
      setSt(stId,'ok',label+' \u2014 '+entities.length+' entities loaded \u2713');
      return { ok:true, entities:entities };
    }catch(e){ setSt(stId,'error',label+' \u2014 '+e.message); return { ok:false, entities:[] }; }
  }
  var resA = await tryLoad(urlA,'stA',lblA,'A');
  showProgress('Load entity list', 'Merging Source entities and loading Target...', 50);
  var resB = await tryLoad(urlB,'stB',lblB,'B');
  var res=[resA,resB];
  btn.disabled=false;sp.style.display='none';
  if(!res[0].ok||!res[1].ok){showProgress('Load entity list', 'Loading failed. Check the status boxes above.', 100); hideProgress(1800); toast('\u26A0\uFE0F One or both environments failed. See status above.');return}
  STATE.entitiesA=res[0].entities;
  STATE.entitiesB=res[1].entities;
  STATE.entityMapA=indexEntitiesByName(res[0].entities);
  STATE.entityMapB=indexEntitiesByName(res[1].entities);
  showProgress('Load entity list', 'Building combined module list...', 85);
  STATE.allRows=buildRows(res[0].entities,res[1].entities);
  STATE.lblA=lblA;STATE.lblB=lblB;
  resetWorkspaceFilters(true);
  setComparisonDetailTitle('Module Comparison Detail');
  saveComparisonSnapshot();
  rebuildModuleFilter(STATE.allRows);
  renderEntityBrowser();
  updateWorkspaceTabs();
  updateReportButtonState();
  refreshLegalEntityFilters().catch(function(){});
  setSetupCardCollapsed(true);
  focusModuleFiltersCard();
  showProgress('Load entity list', 'Finished. Entity list is ready.', 100);
  hideProgress(1200);
  toast('\u2705 Entity list loaded. Choose a tab to compare records.');
}

/* ── Compare ── */
function entityMetaScore(e) {
  if (!e) return -1;
  var score = 0;
  if (e.moduleExact) score += 4;
  else if (e.moduleSource === 'tags') score += 3;
  else if (e.moduleSource === 'heuristic') score += 2;
  if (e.collection) score += 2;
  if (e.odataEnabled) score += 1;
  return score;
}

function chooseBetterEntity(a, b) {
  if (!a) return b;
  if (!b) return a;
  return entityMetaScore(b) > entityMetaScore(a) ? b : a;
}

function getBestEntityLabel(a, b) {
  var candidates = [a, b, chooseBetterEntity(a, b)].filter(Boolean);
  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    if (candidate.label && candidate.label !== candidate.name) return candidate.label;
  }
  var best = chooseBetterEntity(a, b) || a || b;
  return best ? (best.label || best.name || '') : '';
}

function indexEntitiesByName(list) {
  var map = {};
  list.forEach(function(e) {
    map[e.name] = chooseBetterEntity(map[e.name], e);
  });
  return map;
}

function buildRows(aList,bList){
  var map={};
  function upsert(list, sideKey) {
    list.forEach(function(e) {
      if (!map[e.name]) {
        map[e.name] = { entity: e };
      } else {
        map[e.name].entity = chooseBetterEntity(map[e.name].entity, e);
      }
      map[e.name][sideKey] = true;
      map[e.name][sideKey === 'inA' ? 'entityA' : 'entityB'] = e;
    });
  }
  upsert(aList, 'inA');
  upsert(bList, 'inB');
  return Object.entries(map).map(function(entry){
    var name=entry[0],it=entry[1],inA=!!it.inA,inB=!!it.inB;
    var moduleName =
      (it.entity && it.entity.module) ||
      (it.entityA && it.entityA.module) ||
      (it.entityB && it.entityB.module) ||
      MODULE_GROUP_UNCLASSIFIED;
    var moduleSource =
      (it.entity && it.entity.moduleSource) ||
      (it.entityA && it.entityA.moduleSource) ||
      (it.entityB && it.entityB.moduleSource) ||
      'none';
    var label =
      (it.entity && it.entity.label) ||
      (it.entityA && it.entityA.label) ||
      (it.entityB && it.entityB.label) ||
      name;
    var collection =
      (it.entity && it.entity.collection) ||
      (it.entityA && it.entityA.collection) ||
      (it.entityB && it.entityB.collection) ||
      '';
    return{
      name:name,
      label:label,
      aotName:(it.entity && it.entity.aotName) || (it.entityA && it.entityA.aotName) || (it.entityB && it.entityB.aotName) || name,
      dmfName:(it.entity && it.entity.dmfName) || (it.entityA && it.entityA.dmfName) || (it.entityB && it.entityB.dmfName) || name,
      publicCollectionName:collection,
      module:moduleName,
      moduleSource:moduleSource,
      collectionA:(it.entityA && it.entityA.collection) || '',
      collectionB:(it.entityB && it.entityB.collection) || '',
      inA:inA,
      inB:inB,
      status:inA&&inB?'Match':inA?'Only in Source':'Only in Target'
    };
  }).sort(function(a,b){return a.name.localeCompare(b.name)});
}

function isDifferenceStatus(status) {
  return status !== 'Match';
}

function stableJsonValue(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableJsonValue).join(',') + ']';
  var keys = Object.keys(value).sort();
  return '{' + keys.map(function(k) { return JSON.stringify(k) + ':' + stableJsonValue(value[k]); }).join(',') + '}';
}

function stringifyFieldValue(value) {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  if (typeof value === 'object') return stableJsonValue(value);
  return String(value);
}

var TECHNICAL_FIELD_RE = /^(@|dataAreaId$|RecId$|_Etag|modifiedDateTime|createdDateTime)/i;

function isComparableField(name) {
  return !TECHNICAL_FIELD_RE.test(String(name || ''));
}

function formatNumber(value) {
  var num = Number(value || 0);
  return isFinite(num) ? num.toLocaleString() : '0';
}

function formatPercent(value) {
  var num = Number(value || 0);
  return (isFinite(num) ? num : 0).toFixed(1) + '%';
}

function clampPercent(value) {
  var num = Number(value || 0);
  if (!isFinite(num)) return 0;
  return Math.max(0, Math.min(100, num));
}

function fileSafeName(value) {
  return String(value || 'report').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'report';
}

function summarizeEntityResult(result) {
  var total = result.matched + result.diffCount + result.missingInTarget + result.onlyInTarget;
  var alignment = total ? (result.matched / total) * 100 : 100;
  var issue = result.diffCount > 0 || result.missingInTarget > 0 || result.onlyInTarget > 0;
  return {
    total: total,
    alignmentPct: alignment,
    issue: issue,
    issueClass: issue ? 'issues' : 'ok'
  };
}

function shouldDisplayDiffEntity(row) {
  return !!row && row.status !== 'Match' && row.status !== 'No OData';
}

async function compareEntityRecords(row, idx, urlA, urlB) {
  var metaA = STATE.entityMapA[row.name] || null;
  var metaB = STATE.entityMapB[row.name] || null;
  var best = metaA || metaB;
  if (!best || !best.collection) {
    return {
      idx: idx + 1,
      name: row.name,
      label: row.label || getBestEntityLabel(metaA, metaB) || row.name,
      aotName: (best && best.aotName) || row.aotName || row.name,
      dmfName: (best && best.dmfName) || row.dmfName || row.label || row.name,
      publicCollectionName: '',
      module: row.module || '',
      countA: null,
      countB: null,
      matched: 0,
      diffCount: 0,
      missingInTarget: 0,
      onlyInTarget: 0,
      total: 0,
      alignmentPct: 0,
      status: 'No OData',
      detail: 'No OData collection',
      metaA: metaA,
      metaB: metaB,
      noOdata: true
    };
  }

  var resA = await fetchCollectionRows(urlA, 'A', metaA || metaB);
  var resB = await fetchCollectionRows(urlB, 'B', metaB || metaA);
  if (!resA.ok && !resB.ok) {
    return {
      idx: idx + 1,
      name: row.name,
      label: row.label || getBestEntityLabel(metaA, metaB) || row.name,
      aotName: (best && best.aotName) || row.aotName || row.name,
      dmfName: (best && best.dmfName) || row.dmfName || row.label || row.name,
      publicCollectionName: (best && best.collection) || '',
      module: row.module || '',
      countA: null,
      countB: null,
      matched: 0,
      diffCount: 0,
      missingInTarget: 0,
      onlyInTarget: 0,
      total: 0,
      alignmentPct: 0,
      status: 'No OData',
      detail: resA.detail || resB.detail || 'Entity query failed',
      metaA: metaA,
      metaB: metaB,
      noOdata: true
    };
  }
  if (!resA.ok || !resB.ok) {
    return {
      idx: idx + 1,
      name: row.name,
      label: row.label || getBestEntityLabel(metaA, metaB) || row.name,
      aotName: (best && best.aotName) || row.aotName || row.name,
      dmfName: (best && best.dmfName) || row.dmfName || row.label || row.name,
      publicCollectionName: (best && best.collection) || '',
      module: row.module || '',
      countA: resA.ok ? resA.count : null,
      countB: resB.ok ? resB.count : null,
      matched: 0,
      diffCount: 0,
      missingInTarget: 0,
      onlyInTarget: 0,
      total: Math.max(resA.count || 0, resB.count || 0),
      alignmentPct: 0,
      status: 'No OData',
      detail: (!resA.ok ? 'Source: ' + resA.detail : 'Target: ' + resB.detail),
      metaA: metaA,
      metaB: metaB,
      noOdata: true
    };
  }

  var pairs = findAllDifferentRowPairs(resA.rows || [], resB.rows || []);
  var diffCount = pairs.filter(function(p) { return p.rowA && p.rowB && p.fieldDiffs.length > 0; }).length;
  var missingInTarget = pairs.filter(function(p) { return p.rowA && !p.rowB; }).length;
  var onlyInTarget = pairs.filter(function(p) { return !p.rowA && p.rowB; }).length;
  var matched = Math.max(0, Math.min(
    resA.count - diffCount - missingInTarget,
    resB.count - diffCount - onlyInTarget
  ));
  var summary = summarizeEntityResult({
    matched: matched,
    diffCount: diffCount,
    missingInTarget: missingInTarget,
    onlyInTarget: onlyInTarget
  });
  var status = 'Match';
  var detail = '';
  if (diffCount > 0 || missingInTarget > 0 || onlyInTarget > 0) {
    if (matched === 0 && diffCount === 0 && missingInTarget > 0 && onlyInTarget === 0) {
      status = 'Only in Source';
      detail = missingInTarget + ' record(s) missing in target';
    } else if (matched === 0 && diffCount === 0 && onlyInTarget > 0 && missingInTarget === 0) {
      status = 'Only in Target';
      detail = onlyInTarget + ' record(s) only in target';
    } else {
      status = 'Diff';
      if (diffCount) detail += diffCount + ' value diff(s)';
      if (missingInTarget) detail += (detail ? ', ' : '') + missingInTarget + ' missing in target';
      if (onlyInTarget) detail += (detail ? ', ' : '') + onlyInTarget + ' only in target';
    }
  }

  return {
    idx: idx + 1,
    name: row.name,
    label: row.label || getBestEntityLabel(metaA, metaB) || row.name,
    aotName: (best && best.aotName) || row.aotName || row.name,
    dmfName: (best && best.dmfName) || row.dmfName || row.label || row.name,
    publicCollectionName: (best && best.collection) || '',
    module: row.module || '',
    countA: resA.count,
    countB: resB.count,
    matched: matched,
    diffCount: diffCount,
    missingInTarget: missingInTarget,
    onlyInTarget: onlyInTarget,
    total: summary.total,
    alignmentPct: summary.alignmentPct,
    status: status,
    detail: detail,
    metaA: metaA,
    metaB: metaB,
    noOdata: false,
    issueClass: summary.issueClass
  };
}

function aggregateModuleResults(detailRows) {
  var map = {};
  detailRows.forEach(function(row) {
    var key = row.module || '';
    if (!key) return;
    if (!map[key]) {
      map[key] = {
        module: key,
        total: 0,
        matched: 0,
        diffCount: 0,
        missingInTarget: 0,
        onlyInTarget: 0,
        entityCount: 0,
        noOdata: 0
      };
    }
    map[key].entityCount++;
    map[key].noOdata += row.noOdata ? 1 : 0;
    map[key].total += row.total || 0;
    map[key].matched += row.matched || 0;
    map[key].diffCount += row.diffCount || 0;
    map[key].missingInTarget += row.missingInTarget || 0;
    map[key].onlyInTarget += row.onlyInTarget || 0;
  });
  return Object.keys(map).sort().map(function(key) {
    var item = map[key];
    item.alignmentPct = item.total ? (item.matched / item.total) * 100 : 0;
    return item;
  });
}

function summarizeReport(detailRows) {
  var totals = {
    totalRecords: 0,
    matched: 0,
    diffCount: 0,
    missingInTarget: 0,
    onlyInTarget: 0,
    totalEntities: detailRows.length,
    identicalEntities: 0,
    differentEntities: 0,
    noOdataEntities: 0,
    totalModules: 0,
    alignmentPct: 0
  };
  detailRows.forEach(function(row) {
    totals.totalRecords += row.total || 0;
    totals.matched += row.matched || 0;
    totals.diffCount += row.diffCount || 0;
    totals.missingInTarget += row.missingInTarget || 0;
    totals.onlyInTarget += row.onlyInTarget || 0;
    if (row.noOdata) totals.noOdataEntities++;
    else if (row.diffCount === 0 && row.missingInTarget === 0 && row.onlyInTarget === 0) totals.identicalEntities++;
    else totals.differentEntities++;
  });
  totals.alignmentPct = totals.totalRecords ? (totals.matched / totals.totalRecords) * 100 : 0;
  return totals;
}

function buildReportHtml(detailRows) {
  var modules = aggregateModuleResults(detailRows);
  var totals = summarizeReport(detailRows);
  totals.totalModules = modules.length;
  var generatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  var sharedCompany = getCompany() || 'All legal entities';
  var diffRows = detailRows.filter(shouldDisplayDiffEntity);

  function pctClass(value) {
    if (value >= 95) return 'green';
    if (value >= 75) return 'amber';
    return 'red';
  }

  function badgeClass(status) {
    return { 'Match': 'bm', 'Diff': 'bd', 'Only in Source': 'bu', 'Only in Target': 'bs', 'No OData': 'bn' }[status] || 'bd';
  }

  function rowClass(status) {
    return { 'Match': 'data-row-M', 'Diff': 'data-row-D', 'Only in Source': 'data-row-S', 'Only in Target': 'data-row-T', 'No OData': 'data-row-N' }[status] || '';
  }

  function pct(n, d) { return d ? ((n / d) * 100).toFixed(1) : '0.0'; }
  function clamp(v) { return Math.min(100, Math.max(0, v || 0)); }

  // ── Module Summary rows ──────────────────────────────────────────
  var moduleRowsHtml = modules.map(function(item) {
    var matchPct = pct(item.matched, item.total);
    var cls = pctClass(item.alignmentPct);
    return '<tr class="data-row ' + rowClass('Match') + '" style="cursor:pointer" onclick="goToDetail(\'' + esc(item.module).replace(/'/g, "\\'") + '\')">' +
      '<td><span class="mod-tag">' + esc(item.module) + '</span></td>' +
      '<td class="val">' + formatNumber(item.total) + '</td>' +
      '<td class="green val">' + formatNumber(item.matched) + '</td>' +
      '<td class="amber val">' + formatNumber(item.diffCount) + '</td>' +
      '<td class="red val">' + formatNumber(item.missingInTarget) + '</td>' +
      '<td class="blue val">' + formatNumber(item.onlyInTarget) + '</td>' +
      '<td><div class="bar-wrap"><div class="bar bbar-' + cls + '" style="width:' + clamp(item.alignmentPct) + '%"></div></div><span style="font-size:10px;margin-left:4px">' + matchPct + '%</span></td>' +
    '</tr>';
  }).join('');

  // ── Data Entity Summary rows (ALL entities) ──────────────────────
  var allEntityRows = detailRows.slice().sort(function(a, b) {
    return (a.module || '').localeCompare(b.module || '') || (a.label || a.name).localeCompare(b.label || b.name);
  });
  var entitySummaryRowsHtml = allEntityRows.map(function(row) {
    var cls = pctClass(row.alignmentPct);
    var rc = rowClass(row.status);
    return '<tr class="data-row ' + rc + '" data-mod="' + esc(row.module) + '" data-status="' + esc(row.status) + '">' +
      '<td><span class="mod-tag">' + esc(row.module) + '</span></td>' +
      '<td>' + esc(row.label || row.name) + '</td>' +
      '<td class="val">' + (row.total ? formatNumber(row.total) : '—') + '</td>' +
      '<td class="green val">' + formatNumber(row.matched) + '</td>' +
      '<td class="amber val">' + formatNumber(row.diffCount) + '</td>' +
      '<td class="red val">' + formatNumber(row.missingInTarget) + '</td>' +
      '<td class="blue val">' + formatNumber(row.onlyInTarget) + '</td>' +
      '<td><div class="bar-wrap"><div class="bar bbar-' + cls + '" style="width:' + clamp(row.alignmentPct) + '%"></div></div><span style="font-size:10px;margin-left:4px">' + pct(row.matched, row.total) + '%</span></td>' +
    '</tr>';
  }).join('');

  // ── Full Detail rows (grouped by module, expandable) ─────────────
  var detailBodyHtml = modules.map(function(module) {
    var rows = detailRows.filter(function(r) { return r.module === module.module; });
    if (!rows.length) return '';
    var cls = pctClass(module.alignmentPct);
    var header = '<tr class="row-mod" data-mod-head="' + esc(module.module) + '">' +
      '<td colspan="8"><span class="chev">▼</span>' + esc(module.module) +
      '<span class="cnt-b">' + rows.length + ' entities</span>' +
      '<span class="pct-covered">Alignment ' + formatPercent(module.alignmentPct) + '</span></td></tr>';
    var entityRows = rows.map(function(row) {
      var rid = 'expand-' + row.idx;
      return '<tr class="row-det data-row ' + rowClass(row.status) + '" data-mod-row="' + esc(module.module) + '" data-status="' + esc(row.status) + '" onclick="toggleExpand(\'' + rid + '\')" style="cursor:pointer">' +
        '<td class="num-cell">' + row.idx + '</td>' +
        '<td><strong>' + esc(row.label || row.name) + '</strong><div class="sub">' + esc(row.aotName || row.name) + '</div></td>' +
        '<td><span class="badge ' + badgeClass(row.status) + '">' + esc(row.status) + '</span></td>' +
        '<td class="tc">' + (row.countA == null ? '—' : formatNumber(row.countA)) + '</td>' +
        '<td class="tc">' + (row.countB == null ? '—' : formatNumber(row.countB)) + '</td>' +
        '<td class="tc green">' + formatNumber(row.matched) + '</td>' +
        '<td class="tc amber">' + formatNumber(row.diffCount) + '</td>' +
        '<td class="tc red">' + formatNumber(row.missingInTarget) + '</td>' +
      '</tr>' +
      '<tr class="expand-row hidden-row" id="' + rid + '" data-mod-row="' + esc(module.module) + '">' +
        '<td colspan="8"><div class="expand-inner"><strong>Detail:</strong> ' + esc(row.detail || 'No differences detected') +
        (row.noOdata ? ' <span class="badge bn">No OData</span>' : '') + '</div></td>' +
      '</tr>';
    }).join('');
    return header + entityRows;
  }).join('');

  // ── Module filter options ─────────────────────────────────────────
  var modOptions = modules.map(function(m) {
    return '<option value="' + esc(m.module) + '">' + esc(m.module) + '</option>';
  }).join('');

  var lblA = esc(STATE.lblA);
  var lblB = esc(STATE.lblB);

  // ── CSS ───────────────────────────────────────────────────────────
  var css = [
    ':root{--primary:#1a237e;--primary2:#283593;--primary3:#3949ab;',
    '--green:#27ae60;--amber:#e67e22;--red:#e74c3c;--blue:#2980b9;--purple:#8e44ad;',
    '--green-bg:#eafaf1;--amber-bg:#fef9e7;--red-bg:#fdedec;--blue-bg:#ebf5fb;--purple-bg:#f5eef8;',
    '--border:#e0e4f0;--bg:#f0f3fa;--surface:#fff}',
    '*{box-sizing:border-box;margin:0;padding:0}',
    'body{font-family:"Segoe UI",system-ui,Arial,sans-serif;font-size:13px;background:var(--bg);color:#1a1a2e}',
    // Header
    '.app-header{background:linear-gradient(135deg,var(--primary) 0%,var(--primary2) 55%,var(--primary3) 100%);color:#fff;padding:18px 32px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;box-shadow:0 2px 10px rgba(0,0,0,.2)}',
    '.app-header h1{font-size:20px;font-weight:700;letter-spacing:.3px}',
    '.app-header p{font-size:11px;opacity:.75;margin-top:3px}',
    '.env-row{display:flex;gap:8px;align-items:center}',
    '.env-tag{padding:5px 16px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:.5px}',
    '.env-src{background:#f39c12;color:#fff}.env-tgt{background:#3498db;color:#fff}',
    // Tab bar
    '.tab-bar{display:flex;gap:0;background:var(--primary);padding:0 32px;border-bottom:3px solid var(--primary3);overflow-x:auto}',
    '.tab-btn-nav{padding:12px 20px;color:rgba(255,255,255,.68);font-size:12.5px;font-weight:600;border:none;background:none;cursor:pointer;white-space:nowrap;border-bottom:3px solid transparent;margin-bottom:-3px;transition:all .15s}',
    '.tab-btn-nav:hover{color:#fff;background:rgba(255,255,255,.08)}',
    '.tab-btn-nav.active{color:#fff;border-bottom-color:#ffd54f;background:rgba(255,255,255,.12)}',
    // Tab content
    '.tab-content{padding:24px 32px 48px}.tab-pane{display:none}.tab-pane.active{display:block}',
    '.section-title{font-size:14px;font-weight:700;color:var(--primary);margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid var(--border);display:flex;align-items:center;gap:8px}',
    '.cnt-badge{font-size:11px;background:var(--primary3);color:#fff;padding:2px 10px;border-radius:10px;font-weight:600}',
    // KPI cards
    '.kpi-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px}',
    '.kpi-card{flex:1;min-width:130px;background:var(--surface);border-radius:12px;padding:16px 20px;box-shadow:0 2px 8px rgba(0,0,0,.07);border-left:5px solid var(--primary3);transition:transform .15s}',
    '.kpi-card:hover{transform:translateY(-2px)}',
    '.kpi-card.kpi-green{border-left-color:var(--green);background:var(--green-bg)}',
    '.kpi-card.kpi-amber{border-left-color:var(--amber);background:var(--amber-bg)}',
    '.kpi-card.kpi-red{border-left-color:var(--red);background:var(--red-bg)}',
    '.kpi-card.kpi-blue{border-left-color:var(--blue);background:var(--blue-bg)}',
    '.kpi-card.kpi-purple{border-left-color:var(--purple);background:var(--purple-bg)}',
    '.kpi-icon{font-size:18px;opacity:.5;margin-bottom:6px}',
    '.kpi-val{font-size:26px;font-weight:800;color:var(--primary);line-height:1}',
    '.kpi-card.kpi-green .kpi-val{color:var(--green)}',
    '.kpi-card.kpi-amber .kpi-val{color:var(--amber)}',
    '.kpi-card.kpi-red .kpi-val{color:var(--red)}',
    '.kpi-card.kpi-blue .kpi-val{color:var(--blue)}',
    '.kpi-card.kpi-purple .kpi-val{color:var(--purple)}',
    '.kpi-lbl{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#666;margin-top:5px;font-weight:600}',
    // Tables
    '.summary-tbl{width:100%;border-collapse:collapse;background:var(--surface);border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:16px}',
    '.summary-tbl thead tr{background:var(--primary);color:#fff}',
    '.summary-tbl thead th{padding:9px 12px;font-size:11px;font-weight:600;text-align:left}',
    '.summary-tbl td{padding:9px 12px;border-bottom:1px solid var(--border);font-size:12.5px}',
    '.summary-tbl tr:last-child td{border-bottom:none}',
    '.summary-tbl tr:hover td{background:#f7f8fd}',
    '.data-tbl{width:100%;border-collapse:collapse;background:var(--surface);border-radius:8px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,.08);margin-bottom:8px}',
    '.data-tbl thead tr{background:var(--primary);color:#fff}',
    '.data-tbl thead th{padding:10px 10px;font-size:11px;font-weight:600;text-align:left;white-space:nowrap;border-right:1px solid rgba(255,255,255,.1)}',
    '.data-tbl thead th:last-child{border-right:none}',
    '.data-tbl tbody td{padding:7px 10px;border-bottom:1px solid #f0f2fb;font-size:12px;vertical-align:middle}',
    '.data-tbl tbody tr.data-row{cursor:pointer;transition:background .1s}',
    '.data-tbl tbody tr.data-row-M:hover td{background:#d4f5e3}',
    '.data-tbl tbody tr.data-row-D:hover td{background:#fde8c8}',
    '.data-tbl tbody tr.data-row-S:hover td{background:#fcd9d9}',
    '.data-tbl tbody tr.data-row-T:hover td{background:#d0e8f8}',
    '.data-tbl tbody tr.data-row:hover td{background:#eef1fb}',
    // Expand rows
    '.expand-row td{padding:0!important;border-bottom:2px solid #c9cfe8}',
    '.expand-inner{padding:12px 20px 16px 20px;background:#f0f3fa;font-size:12px;color:#333}',
    // Misc
    '.val{text-align:right;font-weight:700}',
    '.tc{text-align:center}',
    '.green{color:var(--green)}.amber{color:var(--amber)}.red{color:var(--red)}.blue{color:var(--blue)}.purple{color:var(--purple)}',
    '.badge{display:inline-block;padding:3px 9px;border-radius:12px;font-size:10px;font-weight:700;white-space:nowrap;letter-spacing:.3px}',
    '.bm{background:#c8f5d8;color:#1a6e38}.bd{background:#fde8c8;color:#9a5000}.bu{background:#fcd9d9;color:#a02020}.bs{background:#d0e8f8;color:#0d3f6e}.bn{background:#ede9fe;color:#5b21b6}',
    '.mod-tag{font-size:10px;background:#e8eaf6;color:var(--primary);padding:2px 8px;border-radius:4px;white-space:nowrap;font-weight:600}',
    '.sub{font-size:10px;color:#667085;margin-top:2px}',
    '.bar-wrap{background:#e8ecf0;border-radius:4px;height:6px;overflow:hidden;display:inline-block;width:80px;vertical-align:middle}',
    '.bar{height:100%;border-radius:4px}',
    '.bbar-green{background:var(--green)}.bbar-amber{background:var(--amber)}.bbar-red{background:var(--red)}',
    // Toolbar
    '.toolbar-inner{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 0 14px 0;margin-bottom:16px}',
    '.toolbar-inner label{font-size:11.5px;font-weight:700;color:#555;white-space:nowrap}',
    '.sel-box{padding:6px 10px;border:1.5px solid #ccd;border-radius:6px;font-size:12px;background:#fafbff;color:#222;outline:none}',
    '.sel-box:focus{border-color:var(--primary)}',
    '.search-box{padding:6px 12px;border:1.5px solid #ccd;border-radius:6px;font-size:12px;background:#fafbff;min-width:220px;outline:none}',
    '.search-box:focus{border-color:var(--primary)}',
    '.filter-btn{padding:5px 12px;border:1.5px solid #ccd;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;background:#fff;color:#333;transition:all .15s}',
    '.filter-btn:hover,.filter-btn.active{background:var(--primary);color:#fff;border-color:var(--primary)}',
    '.tbl-wrap{overflow-x:auto;max-height:70vh;overflow-y:auto}',
    '.table-footer-count{font-size:11px;color:#666;padding:6px 2px 0 2px}',
    // Detail rows
    '.row-mod{background:linear-gradient(90deg,#1e2a6a,#2c3e80);color:#fff;font-weight:700;cursor:pointer}',
    '.row-mod td{padding:8px 10px;border-bottom:2px solid rgba(255,255,255,.12)}',
    '.row-det.hidden-row,.expand-row.hidden-row{display:none}',
    '.chev{display:inline-block;transform:rotate(0deg);transition:transform .2s;margin-right:7px;font-size:9px;opacity:.8}',
    '.row-mod.collapsed .chev{transform:rotate(-90deg)}',
    '.cnt-b,.pct-covered{font-size:10px;background:rgba(255,255,255,.18);padding:2px 8px;border-radius:10px;margin-left:8px}',
    '.num-cell{width:36px;text-align:right;color:#aaa;font-size:11px}',
    '.hidden{display:none!important}',
    // Footer
    '.app-footer{text-align:center;font-size:11px;color:#999;padding:14px 32px;background:var(--surface);border-top:1px solid var(--border);margin-top:16px}',
    // Dual col layout
    '.dual-col{display:grid;grid-template-columns:1fr 1.4fr;gap:20px;margin-bottom:20px}@media(max-width:900px){.dual-col{grid-template-columns:1fr}}'
  ].join('');

  // ── KPI cards ─────────────────────────────────────────────────────
  var totRec = totals.totalRecords || 0;
  function kpiCard(extraClass, icon, val, lbl) {
    return '<div class="kpi-card' + (extraClass ? ' ' + extraClass : '') + '">' +
      '<div class="kpi-icon">' + icon + '</div>' +
      '<div class="kpi-val">' + val + '</div>' +
      '<div class="kpi-lbl">' + lbl + '</div>' +
    '</div>';
  }

  var kpiHtml =
    kpiCard('', '&#128203;', formatNumber(totRec), 'Total Records') +
    kpiCard('kpi-green', '&#9989;', formatNumber(totals.matched),
      'Match' + (totRec ? ' (' + pct(totals.matched, totRec) + '%)' : '')) +
    kpiCard('kpi-amber', '&#9889;', formatNumber(totals.diffCount),
      'Differences' + (totRec ? ' (' + pct(totals.diffCount, totRec) + '%)' : '')) +
    kpiCard('kpi-red', '&#128308;', formatNumber(totals.missingInTarget),
      lblA + ' Only' + (totRec ? ' (' + pct(totals.missingInTarget, totRec) + '%)' : '')) +
    kpiCard('kpi-blue', '&#128309;', formatNumber(totals.onlyInTarget),
      lblB + ' Only' + (totRec ? ' (' + pct(totals.onlyInTarget, totRec) + '%)' : ''));

  // ── HTML assembly ─────────────────────────────────────────────────
  return '<!DOCTYPE html>' +
  '<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>D365 Config: ' + lblA + ' vs ' + lblB + '</title>' +
  '<style>' + css + '</style></head><body>' +

  // Header
  '<div class="app-header">' +
    '<div><h1>D365 Config: ' + lblA + ' vs ' + lblB + '</h1>' +
    '<p>Generated: ' + esc(generatedAt) + '</p></div>' +
    '<div class="env-row">' +
      '<span class="env-tag env-src">' + lblA + '</span>' +
      '<span style="font-size:18px;color:rgba(255,255,255,.6)">&#8594;</span>' +
      '<span class="env-tag env-tgt">' + lblB + '</span>' +
    '</div>' +
  '</div>' +

  // Tab bar
  '<div class="tab-bar">' +
    '<button class="tab-btn-nav active" data-tab="summary">&#128203; Overall Summary</button>' +
    '<button class="tab-btn-nav" data-tab="entity">&#128196; Data Entity Summary</button>' +
    '<button class="tab-btn-nav" data-tab="le">&#127970; Legal Entity Wise</button>' +
    '<button class="tab-btn-nav" data-tab="detail">&#128269; Full Detail</button>' +
  '</div>' +
  '<div class="tab-content">' +

  // ── Tab: Overall Summary ─────────────────────────────────────────
  '<div class="tab-pane active" id="tab-summary">' +
    '<div class="kpi-row">' + kpiHtml + '</div>' +
    '<div class="section-title">Module Summary <span class="cnt-badge">' + formatNumber(modules.length) + ' Modules</span></div>' +
    '<table class="summary-tbl"><thead><tr>' +
      '<th>Module</th><th>Total</th><th>Match</th><th>Diff</th>' +
      '<th>' + lblA + ' Only</th><th>' + lblB + ' Only</th><th>Match %</th>' +
    '</tr></thead><tbody>' + moduleRowsHtml + '</tbody></table>' +
    '<div style="margin-top:6px;font-size:11px;color:#888">Click a module row to view entity detail &rarr; Data Entity Summary tab</div>' +
  '</div>' +

  // ── Tab: Data Entity Summary ─────────────────────────────────────
  '<div class="tab-pane" id="tab-entity">' +
    '<div class="section-title">Data Entity Summary <span class="cnt-badge" id="ent-cnt-badge">' + formatNumber(detailRows.length) + ' Data Entities</span></div>' +
    '<div class="toolbar-inner">' +
      '<label>Module:</label><select class="sel-box" id="entModFilter"><option value="">All Modules</option>' + modOptions + '</select>' +
      '<label>Status:</label><select class="sel-box" id="entStatusFilter">' +
        '<option value="">All Statuses</option>' +
        '<option value="Match">Match</option>' +
        '<option value="Diff">Diff</option>' +
        '<option value="Only in Source">' + lblA + ' Only</option>' +
        '<option value="Only in Target">' + lblB + ' Only</option>' +
        '<option value="No OData">No OData</option>' +
      '</select>' +
      '<input type="search" class="search-box" id="entSearch" placeholder="Search entity...">' +
    '</div>' +
    '<div class="tbl-wrap"><table class="data-tbl" id="entTable"><thead><tr>' +
      '<th>Module</th><th>Data Entity</th><th>Total</th><th>Match</th><th>Diff</th>' +
      '<th>' + lblA + ' Only</th><th>' + lblB + ' Only</th><th>Match %</th>' +
    '</tr></thead><tbody id="entTbody">' + entitySummaryRowsHtml + '</tbody></table></div>' +
    '<div class="table-footer-count" id="entFooter">' + formatNumber(detailRows.length) + ' entities</div>' +
  '</div>' +

  // ── Tab: Legal Entity Wise ───────────────────────────────────────
  '<div class="tab-pane" id="tab-le">' +
    '<div class="section-title">Legal Entity Wise</div>' +
    '<table class="summary-tbl"><thead><tr><th>Environment</th><th>URL</th><th>Legal Entity Filter</th><th>Scope</th></tr></thead><tbody>' +
      '<tr><td><span class="env-tag env-src">' + lblA + '</span></td>' +
        '<td style="font-size:11px;word-break:break-all">' + esc(getEnvUrl('A') || '—') + '</td>' +
        '<td>' + esc(sharedCompany) + '</td>' +
        '<td>' + esc(sharedCompany === 'All legal entities' ? 'Cross-company' : 'Filtered') + '</td></tr>' +
      '<tr><td><span class="env-tag env-tgt">' + lblB + '</span></td>' +
        '<td style="font-size:11px;word-break:break-all">' + esc(getEnvUrl('B') || '—') + '</td>' +
        '<td>' + esc(sharedCompany) + '</td>' +
        '<td>' + esc(sharedCompany === 'All legal entities' ? 'Cross-company' : 'Filtered') + '</td></tr>' +
    '</tbody></table>' +
    '<div style="margin-top:16px;padding:14px 18px;background:var(--surface);border-radius:8px;border-left:4px solid var(--primary3);font-size:12px;color:#555;box-shadow:0 1px 4px rgba(0,0,0,.06)">' +
      '&#8505; Per-legal-entity record breakdowns are not available in this report. ' +
      'The comparison uses the legal entity filter set in the extension popup. ' +
      'To compare a specific legal entity, set the Company filter before generating the report.' +
    '</div>' +
  '</div>' +

  // ── Tab: Full Detail ─────────────────────────────────────────────
  '<div class="tab-pane" id="tab-detail">' +
    '<div class="section-title">Full Detail <span class="cnt-badge">' + formatNumber(detailRows.length) + ' Entities</span></div>' +
    '<div class="toolbar-inner">' +
      '<label>Module:</label><select class="sel-box" id="detModFilter"><option value="">All Modules</option>' + modOptions + '</select>' +
      '<label>Status:</label><select class="sel-box" id="detStatusFilter">' +
        '<option value="">All Statuses</option>' +
        '<option value="Match">Match</option>' +
        '<option value="Diff">Diff</option>' +
        '<option value="Only in Source">' + lblA + ' Only</option>' +
        '<option value="Only in Target">' + lblB + ' Only</option>' +
        '<option value="No OData">No OData</option>' +
      '</select>' +
      '<input type="search" class="search-box" id="detSearch" placeholder="Search entity...">' +
    '</div>' +
    '<div class="tbl-wrap"><table class="data-tbl"><thead><tr>' +
      '<th>#</th><th>Entity</th><th>Status</th>' +
      '<th class="tc">' + lblA + ' Rows</th><th class="tc">' + lblB + ' Rows</th>' +
      '<th class="tc">Matched</th><th class="tc">Diff</th><th class="tc">' + lblA + ' Only</th>' +
    '</tr></thead><tbody id="detTbody">' + (detailBodyHtml || '<tr><td colspan="8" style="text-align:center;color:#999;padding:24px">No entities found</td></tr>') + '</tbody></table></div>' +
    '<div class="table-footer-count" id="detFooter">' + formatNumber(detailRows.length) + ' entities | Click a row to expand detail</div>' +
  '</div>' +

  '</div>' + // tab-content

  // Footer
  '<div class="app-footer">D365 Configuration Comparison &nbsp;|&nbsp; ' + lblA + ' vs ' + lblB + ' &nbsp;|&nbsp; ' + esc(generatedAt) + '</div>' +

  // ── JavaScript ───────────────────────────────────────────────────
  '<script>(function(){' +
  // Tab switching
  'function switchTab(name){' +
    'document.querySelectorAll(".tab-pane").forEach(function(el){el.classList.toggle("active",el.id==="tab-"+name);});' +
    'document.querySelectorAll(".tab-btn-nav").forEach(function(btn){btn.classList.toggle("active",btn.dataset.tab===name);});' +
  '}' +
  'document.querySelectorAll(".tab-btn-nav").forEach(function(btn){btn.addEventListener("click",function(){switchTab(btn.dataset.tab);});});' +

  // goToDetail: module summary row click -> entity tab filtered
  'function goToDetail(modName){switchTab("entity");var sel=document.getElementById("entModFilter");if(sel){sel.value=modName;}filterEntityTable();}' +
  'window.goToDetail=goToDetail;' +

  // Toggle expand row in detail tab
  'function toggleExpand(id){var el=document.getElementById(id);if(el){el.classList.toggle("hidden-row");}}' +
  'window.toggleExpand=toggleExpand;' +

  // Entity table filter
  'function filterEntityTable(){' +
    'var search=(document.getElementById("entSearch").value||"").toLowerCase();' +
    'var mod=(document.getElementById("entModFilter").value||"");' +
    'var status=(document.getElementById("entStatusFilter").value||"");' +
    'var rows=document.querySelectorAll("#entTbody tr");' +
    'var visible=0;' +
    'rows.forEach(function(row){' +
      'var text=row.textContent.toLowerCase();' +
      'var ok=(!search||text.indexOf(search)!==-1)&&(!mod||row.dataset.mod===mod)&&(!status||row.dataset.status===status);' +
      'row.classList.toggle("hidden",!ok);' +
      'if(ok)visible++;' +
    '});' +
    'var badge=document.getElementById("ent-cnt-badge");if(badge)badge.textContent=visible+" Data Entities";' +
    'var footer=document.getElementById("entFooter");if(footer)footer.textContent=visible+" entities";' +
  '}' +
  'var es=document.getElementById("entSearch");if(es)es.addEventListener("input",filterEntityTable);' +
  'var em=document.getElementById("entModFilter");if(em)em.addEventListener("change",filterEntityTable);' +
  'var est=document.getElementById("entStatusFilter");if(est)est.addEventListener("change",filterEntityTable);' +

  // Detail table filter (module headers show/hide based on filter)
  'function filterDetailTable(){' +
    'var search=(document.getElementById("detSearch").value||"").toLowerCase();' +
    'var mod=(document.getElementById("detModFilter").value||"");' +
    'var status=(document.getElementById("detStatusFilter").value||"");' +
    'var visible=0;' +
    'document.querySelectorAll("#detTbody tr.row-mod").forEach(function(head){' +
      'var modName=head.dataset.modHead;' +
      'var show=!mod||modName===mod;' +
      'head.classList.toggle("hidden",!show);' +
    '});' +
    'document.querySelectorAll("#detTbody tr.row-det").forEach(function(row){' +
      'var text=row.textContent.toLowerCase();' +
      'var rmod=row.dataset.modRow||"";' +
      'var rst=row.dataset.status||"";' +
      'var ok=(!search||text.indexOf(search)!==-1)&&(!mod||rmod===mod)&&(!status||rst===status);' +
      'row.classList.toggle("hidden",!ok);' +
      'if(ok)visible++;' +
    '});' +
    'var footer=document.getElementById("detFooter");if(footer)footer.textContent=visible+" entities | Click a row to expand detail";' +
  '}' +
  'var ds=document.getElementById("detSearch");if(ds)ds.addEventListener("input",filterDetailTable);' +
  'var dm=document.getElementById("detModFilter");if(dm)dm.addEventListener("change",filterDetailTable);' +
  'var dst=document.getElementById("detStatusFilter");if(dst)dst.addEventListener("change",filterDetailTable);' +

  // Module group collapse/expand in detail tab
  'document.querySelectorAll(".row-mod").forEach(function(head){' +
    'head.addEventListener("click",function(e){' +
      'if(e.target.closest("select,input,button"))return;' +
      'var modName=head.dataset.modHead;' +
      'head.classList.toggle("collapsed");' +
      'var collapsed=head.classList.contains("collapsed");' +
      'document.querySelectorAll("[data-mod-row]").forEach(function(row){' +
        'if(row.dataset.modRow===modName){row.classList.toggle("hidden-row",collapsed);}' +
      '});' +
    '});' +
  '});' +

  '})();<\/script>' +
  '</body></html>';
}

function openGeneratedReport(html) {
  var blob = new Blob([html], { type: 'text/html' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = buildReportFileName();
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Release the object URL once the download has been handed to Chrome.
  setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
}

function buildReportFileName() {
  var stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return 'd365-comparison-' + stamp + '.html';
}

async function generateHtmlReport() {
  if (!STATE.allRows.length) {
    toast('⚠️ Load and compare entities first.');
    return;
  }
  var selectedModule = document.getElementById('modSel').value;
  if (!selectedModule) {
    toast('⚠️ Select a specific module group first. Full-report generation for All Module Groups is disabled.');
    return;
  }
  var urlA = getEnvUrl('A'), urlB = getEnvUrl('B');
  if (!urlA || !urlB) {
    return;
  }
  var btn = document.getElementById('btnReport');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>Generating report...';
  try {
    var rows = STATE.allRows.filter(function(row) {
      return row.module === selectedModule;
    }).sort(function(a, b) {
      return a.module.localeCompare(b.module) || a.name.localeCompare(b.name);
    });
    if (!rows.length) {
      throw new Error('No entities found for the selected module.');
    }
    var detailRows = await mapLimit(rows, 4, async function(row, i) {
      showProgress('Generate Report', 'Comparing ' + row.module + ' / ' + row.name + '...', 5 + Math.round((i / Math.max(1, rows.length)) * 90));
      return compareEntityRecords(row, i, urlA, urlB);
    });
    var reportTimedOut = !!detailRows.timedOut;
    var completedRows = detailRows.filter(Boolean);
    var html = buildReportHtml(completedRows);
    openGeneratedReport(html);
    if (reportTimedOut) {
      showProgress('Generate Report', 'Timed out — partial report generated.', 100);
      hideProgress(1800);
      toast('⚠️ Report timed out: only ' + completedRows.length + ' of ' + rows.length + ' entities included.');
    } else {
      showProgress('Generate Report', 'Report downloaded successfully.', 100);
      hideProgress(1200);
      toast('✅ HTML report downloaded.');
    }
  } catch (e) {
    hideProgress();
    toast('⚠️ Report generation failed: ' + (e && e.message ? e.message : String(e)));
  } finally {
    btn.innerHTML = '📄';
    updateReportButtonState();
  }
}

/* ── Retry-with-backoff for 429 Rate Limit responses ── */
async function fetchWithRetry(doFetch, label, maxRetries, baseDelay) {
  maxRetries = maxRetries || 3;
  baseDelay  = baseDelay  || 800;
  var delay = baseDelay;
  for (var attempt = 0; attempt <= maxRetries; attempt++) {
    var result;
    try { result = await doFetch(); }
    catch(e) { throw e; } // non-HTTP errors (network down etc) — propagate immediately
    var is429 = result && result.ok === false && (result.status === 429 ||
                (result.detail && result.detail.indexOf('429') !== -1));
    if (!is429) return result;
    if (attempt === maxRetries) break;
    var waitMs = delay;
    if (result.retryAfter && !isNaN(Number(result.retryAfter))) {
      waitMs = Math.max(waitMs, Number(result.retryAfter) * 1000);
    }
    console.warn('[429] ' + (label || 'request') + ' rate-limited — retrying in ' + (waitMs / 1000).toFixed(1) + 's (attempt ' + (attempt + 1) + '/' + maxRetries + ')');
    await new Promise(function(r) { setTimeout(r, waitMs); });
    delay *= 2;
  }
  return { ok: false, status: 429, rows: [], count: 0,
    detail: 'HTTP 429 – Rate limited after ' + maxRetries + ' retries. Wait a moment and try again.' };
}

async function fetchCollectionRows(envUrl, slot, entityMeta) {
  if (!entityMeta || !entityMeta.collection) {
    return { ok: false, rows: [], count: 0, detail: 'No OData collection name', endpoint: '' };
  }
  var origin = new URL(envUrl).origin;
  var found = null;
  var tabId = null;
  found = await findD365Tab(envUrl);
  if (!found.tab) return { ok: false, status: 0, rows: [], count: 0, detail: formatNoOpenTabMessage(found), endpoint: '' };
  var working = await tryCandidateEndpoints(found, envUrl, function(candidateOrigin) {
    return [candidateOrigin + '/data/' + encodeURIComponent(entityMeta.collection) + '?$top=1&cross-company=true'];
  });
  if (!working.ok) return { ok: false, status: 0, rows: [], count: 0, detail: working.detail || ('All endpoints failed ' + (working.status || '')), endpoint: '' };
  tabId = working.candidate.tab.id;
  origin = working.origin;
  var company = getCompany();
  var rowLimit = getRowLimit();
  // When filtering by a specific legal entity, cross-company=true is not needed and
  // sending both together is semantically contradictory in D365 OData.
  var companyFilter = company ? "&$filter=dataAreaId%20eq%20'" + encodeURIComponent(company) + "'" : '';
  var queryParts = ['$count=true'];
  if (!company) queryParts.push('cross-company=true');
  if (rowLimit > 0) queryParts.unshift('$top=' + rowLimit);
  var endpoint = origin + '/data/' + encodeURIComponent(entityMeta.collection) + '?' + queryParts.join('&') + companyFilter;

  function normalizePageUrl(url) {
    if (!url) return '';
    try { return new URL(url, origin).href; }
    catch(e) { return url; }
  }

  return fetchWithRetry(async function() {
    async function fetchPage(pageUrl) {
      var res;
      try {
        res = await probeEndpointWithTimeout(tabId, pageUrl, 15000);
      } catch(e) {
        return { ok: false, status: 0, detail: e && e.message ? e.message : String(e) };
      }
      if (!res || !res.ok) {
        return { ok: false, status: res && res.status, retryAfter: res && res.retryAfter, detail: res ? (res.detail || ('HTTP ' + res.status)) : 'No response' };
      }
      return { ok: true, data: res.data };
    }

    var firstPage = await fetchPage(endpoint);
    if (!firstPage.ok) {
      return { ok: false, status: firstPage.status, retryAfter: firstPage.retryAfter, rows: [], count: 0, detail: firstPage.detail, endpoint: endpoint };
    }

    var raw = firstPage.data;
    var rows = Array.isArray(raw) ? raw : (raw && raw.value ? raw.value : []);
    var count = raw && raw['@odata.count'] != null ? Number(raw['@odata.count']) : rows.length;
    var nextLink = rowLimit === 0 && raw ? normalizePageUrl(raw['@odata.nextLink']) : '';
    var pageCount = 1;

    while (nextLink) {
      var page = await fetchPage(nextLink);
      if (!page.ok) {
        return { ok: false, status: page.status, retryAfter: page.retryAfter, rows: rows, count: count, detail: page.detail || 'Could not load all pages', endpoint: nextLink };
      }
      var pageRaw = page.data;
      var pageRows = Array.isArray(pageRaw) ? pageRaw : (pageRaw && pageRaw.value ? pageRaw.value : []);
      rows = rows.concat(pageRows);
      nextLink = pageRaw && pageRaw['@odata.nextLink'] ? normalizePageUrl(pageRaw['@odata.nextLink']) : '';
      pageCount++;
    }

    if (!isFinite(count)) count = rows.length;
    return { ok: true, rows: rows, count: rows.length, totalCount: count, endpoint: endpoint, rowLimit: rowLimit, pageCount: pageCount };
  }, entityMeta.collection, 3, 800);
}

function findFirstDifferentRowPair(rowsA, rowsB) {
  var sortedA = rowsA.map(function(row) { return { raw: row, key: stableJsonValue(row) }; }).sort(function(a, b) { return a.key.localeCompare(b.key); });
  var sortedB = rowsB.map(function(row) { return { raw: row, key: stableJsonValue(row) }; }).sort(function(a, b) { return a.key.localeCompare(b.key); });
  var maxLen = Math.max(sortedA.length, sortedB.length);
  for (var i = 0; i < maxLen; i++) {
    var a = sortedA[i] || null;
    var b = sortedB[i] || null;
    if (!a || !b || a.key !== b.key) {
      return { rowA: a && a.raw, rowB: b && b.raw, index: i };
    }
  }
  return { rowA: sortedA[0] && sortedA[0].raw, rowB: sortedB[0] && sortedB[0].raw, index: 0 };
}

// Returns all differing row pairs, matched by business key (first non-odata field value).
// Records only in one side appear as { rowA, rowB:null } or { rowA:null, rowB }.
function findAllDifferentRowPairs(rowsA, rowsB) {

  /* ── Smart key detection ──────────────────────────────────────────────────
   * Priority order:
   *  1. Known D365 natural-key suffixes: Id, Code, Num, Key, Name, No, Ref
   *     (case-insensitive suffix match, prefer shorter/simpler field names)
   *  2. Fields named exactly: Id, Key, Code, Name, Number
   *  3. dataAreaId is normally EXCLUDED from the natural key, but IS prefixed
   *     onto the key when rows span multiple legal entities (cross-company),
   *     because then it forms part of the record's identity.
   *  4. OData metadata fields (@odata.*) are always excluded
   *  5. If nothing qualifies → use ALL non-OData fields (full-row equality)
   * ─────────────────────────────────────────────────────────────────────── */
  var KEY_EXACT   = /^(id|key|code|name|number|num|no)$/i;
  var KEY_SUFFIX  = /(Id|Code|Num|Key|Name|No|Ref|Number)$/;

  function detectKeyFields(rows) {
    if (!rows || !rows.length) return null;

    // Gather all field names from the combined sample
    var fieldSet = {};
    rows.forEach(function(row) {
      Object.keys(row || {}).forEach(function(k) { fieldSet[k] = true; });
    });
    var allFields = Object.keys(fieldSet).filter(isComparableField).sort();

    if (!allFields.length) return null;

    // Score each field — higher = better key candidate
    function score(f) {
      if (KEY_EXACT.test(f)) return 100;
      if (KEY_SUFFIX.test(f)) {
        // Prefer shorter names (less compound) and names that appear early alphabetically
        return 50 + Math.max(0, 20 - f.length);
      }
      return 0;
    }

    var candidates = allFields
      .map(function(f) { return { f: f, s: score(f) }; })
      .filter(function(x) { return x.s > 0; })
      .sort(function(a, b) { return b.s - a.s || a.f.localeCompare(b.f); });

    if (!candidates.length) return null;

    // Verify uniqueness: the top candidate(s) must produce unique keys across the sample
    // Try the top candidate alone first, then combos of 2-3 if needed
    function tryFields(fields) {
      var seen = {};
      var ok = true;
      rows.forEach(function(row) {
        var key = fields.map(function(f) { return String(row[f] == null ? '' : row[f]); }).join('|');
        if (seen[key]) ok = false;
        seen[key] = true;
      });
      return ok;
    }

    // Try top-1
    if (tryFields([candidates[0].f])) return [candidates[0].f];

    // Try top-2 combo
    if (candidates.length >= 2 && tryFields([candidates[0].f, candidates[1].f]))
      return [candidates[0].f, candidates[1].f];

    // Try top-3 combo
    if (candidates.length >= 3 && tryFields([candidates[0].f, candidates[1].f, candidates[2].f]))
      return [candidates[0].f, candidates[1].f, candidates[2].f];

    // Fallback: use the best single candidate even if not perfectly unique
    return [candidates[0].f];
  }

  // Detect key from the combined pool so both sides agree on the same fields
  var combinedSample = (rowsA || []).concat(rowsB || []);
  var keyFields = detectKeyFields(combinedSample);

  // When rows span multiple legal entities (cross-company queries), dataAreaId is
  // part of the record identity — without it, rows from different companies that
  // share the same natural key collide and their differences are silently hidden.
  // Detect this and prefix dataAreaId onto the business key so each company's
  // records stay distinct.
  var partitionField = '';
  (function() {
    var seenPartitions = {};
    var hasPartitionField = false;
    for (var i = 0; i < combinedSample.length; i++) {
      var row = combinedSample[i] || {};
      var area = row.dataAreaId != null ? row.dataAreaId : (row.DataAreaId != null ? row.DataAreaId : undefined);
      if (area === undefined) continue;
      hasPartitionField = true;
      seenPartitions[String(area)] = true;
    }
    if (hasPartitionField && Object.keys(seenPartitions).length > 1) {
      partitionField = combinedSample.some(function(r) { return r && r.dataAreaId != null; }) ? 'dataAreaId' : 'DataAreaId';
    }
  })();

  function rowBusinessKey(row) {
    if (!row) return '';
    var prefix = partitionField ? String(row[partitionField] == null ? '' : row[partitionField]) + '::' : '';
    if (keyFields) {
      return prefix + keyFields.map(function(f) { return String(row[f] == null ? '' : row[f]); }).join('|');
    }
    // Ultimate fallback: hash all non-OData fields
    var keys = Object.keys(row).filter(isComparableField).sort();
    return prefix + keys.map(function(k) { return String(row[k]); }).join('|');
  }

  var mapA = {}, mapB = {};
  (rowsA || []).forEach(function(row) { var k = rowBusinessKey(row); mapA[k] = row; });
  (rowsB || []).forEach(function(row) { var k = rowBusinessKey(row); mapB[k] = row; });

  var allKeys = {};
  Object.keys(mapA).forEach(function(k) { allKeys[k] = true; });
  Object.keys(mapB).forEach(function(k) { allKeys[k] = true; });

  var pairs = [];
  Object.keys(allKeys).sort().forEach(function(k) {
    var a = mapA[k] || null;
    var b = mapB[k] || null;
    if (!a || !b) {
      pairs.push({ rowA: a, rowB: b, keyMatch: false, fieldDiffs: [], keyFields: keyFields });
    } else {
      var fields = Object.keys(Object.assign({}, a, b)).filter(isComparableField).sort();
      var diffs = fields.filter(function(f) {
        return stringifyFieldValue(a[f]) !== stringifyFieldValue(b[f]);
      });
      if (diffs.length > 0) {
        pairs.push({ rowA: a, rowB: b, keyMatch: true, fieldDiffs: diffs, keyFields: keyFields });
      }
    }
  });
  return pairs;
}

async function showEntityDiff(detailRow, targetPanel) {
  var panel = targetPanel || openEntityDiffModal(detailRow);
  panel.style.display = 'block';
  if(panel.id === 'entityDiffPanel') panel.className = 'detail-panel';
  panel.innerHTML = '<div class="detail-head" style="color:#6b7280">⏳ Loading records…</div>';

  var metaA = detailRow.metaA || detailRow.metaB;
  var metaB = detailRow.metaB || detailRow.metaA;
  var resA = await fetchCollectionRows(getEnvUrl('A'), 'A', metaA || metaB);
  var resB = await fetchCollectionRows(getEnvUrl('B'), 'B', metaB || metaA);

  /* ── Load error ── */
  if (!resA.ok || !resB.ok) {
    panel.innerHTML =
      '<div class="detail-head">⚠ Cannot Load: ' + esc(detailRow.name) + '</div>' +
      '<div class="tbl-wrap"><table><tbody>' +
        '<tr><th style="width:140px;padding:8px 12px;border-bottom:1px solid rgba(0,0,0,.08);width:36px">#</th>' +
            '<td style="padding:8px 12px;color:' + (resA.ok ? '#166534' : '#991b1b') + '">' + esc(resA.ok ? 'OK' : resA.detail) + '</td></tr>' +
        '<tr><th style="padding:8px 12px">🟢 ' + esc(STATE.lblB) + '</th>' +
            '<td style="padding:8px 12px;color:' + (resB.ok ? '#166534' : '#991b1b') + '">' + esc(resB.ok ? 'OK' : resB.detail) + '</td></tr>' +
      '</tbody></table></div>';
    return;
  }

  var pairs       = findAllDifferentRowPairs(resA.rows || [], resB.rows || []);
  var detectedKeys = pairs.length && pairs[0].keyFields ? pairs[0].keyFields : null;
  var keyLabel    = detectedKeys ? detectedKeys.join(' + ') : 'full-row match';
  var missingA    = pairs.filter(function(p){ return p.rowA && !p.rowB; });
  var missingB    = pairs.filter(function(p){ return !p.rowA && p.rowB; });
  var valueDiffs  = pairs.filter(function(p){ return p.rowA && p.rowB && p.fieldDiffs.length > 0; });
  var rowLimit = getRowLimit();
  var rowScopeLabel = rowLimit === 0 ? 'Compared all returned rows.' : 'Compared up to ' + rowLimit + ' fetched rows per environment.';

  /* ── Record identity label from key fields ── */
  function recLabel(row) {
    if (!row) return '(absent)';
    var flds = detectedKeys
      ? detectedKeys
      : Object.keys(row).filter(function(k){ return !k.startsWith('@'); }).sort().slice(0,3);
    return flds.map(function(k){ return row[k] != null ? String(row[k]) : ''; }).filter(Boolean).join(' / ') || 'Record';
  }

  function recPreview(row) {
    if (!row) return '—';
    var priority = ['Name', 'Description', 'GroupName', 'PoolName', 'ItemName'];
    var used = {};
    (detectedKeys || []).forEach(function(key) { used[key] = true; });
    var parts = [];

    priority.forEach(function(field) {
      if (used[field] || !isComparableField(field)) return;
      var value = row[field];
      if (value == null || value === '') return;
      used[field] = true;
      parts.push(field + ': ' + String(value));
    });

    Object.keys(row).filter(function(field) {
      return isComparableField(field) && !used[field];
    }).sort().some(function(field) {
      var value = row[field];
      if (value == null || value === '') return false;
      parts.push(field + ': ' + String(value));
      return parts.length >= 2;
    });

    return parts.length ? parts.slice(0, 2).join(' | ') : 'No additional business fields';
  }

  function buildMissingTable(pairs, side) {
    var keyTitle = detectedKeys && detectedKeys.length ? detectedKeys.join(' + ') : 'Record key';
    return '<div style="margin-top:8px;font-size:11px;color:#6b7280">Key field: <strong>' + esc(keyTitle) + '</strong></div>' +
      '<div style="overflow:auto;margin-top:8px">' +
        '<table style="width:100%;border-collapse:collapse;font-size:11.5px;background:rgba(255,255,255,.6);border-radius:6px;overflow:hidden">' +
          '<thead><tr>' +
            '<th style="text-align:right;padding:6px 8px;border-bottom:1px solid rgba(0,0,0,.08);width:36px">#</th>' +
            '<th style="text-align:left;padding:6px 8px;border-bottom:1px solid rgba(0,0,0,.08);min-width:140px">Key</th>' +
            '<th style="text-align:left;padding:6px 8px;border-bottom:1px solid rgba(0,0,0,.08)">Preview</th>' +
          '</tr></thead>' +
          '<tbody>' + pairs.map(function(pair, index) {
            var row = side === 'A' ? pair.rowA : pair.rowB;
            return '<tr>' +
              '<td style="text-align:right;padding:6px 8px;border-bottom:1px solid rgba(0,0,0,.05);color:#6b7280">' + (index + 1) + '</td>' +
              '<td style="padding:6px 8px;border-bottom:1px solid rgba(0,0,0,.05);font-family:Consolas,monospace;font-weight:700">' + esc(recLabel(row)) + '</td>' +
              '<td style="padding:6px 8px;border-bottom:1px solid rgba(0,0,0,.05);color:#4b5563">' + esc(recPreview(row)) + '</td>' +
            '</tr>';
          }).join('') + '</tbody>' +
        '</table>' +
      '</div>';
  }

  /* ── Build tbody rows for one diff pair ── */
  function buildRows(p, diffOnly) {
    var diffSet = {};
    (p.fieldDiffs || []).forEach(function(f){ diffSet[f] = true; });

    var allFields = Object.keys(Object.assign({}, p.rowA || {}, p.rowB || {}))
      .filter(isComparableField)
      .sort(function(a, b){
        // diffs first, then alpha
        return (diffSet[a] ? 0 : 1) - (diffSet[b] ? 0 : 1) || a.localeCompare(b);
      });

    if (diffOnly) allFields = allFields.filter(function(f){ return diffSet[f]; });

    var hasSame   = !diffOnly && allFields.some(function(f){ return !diffSet[f]; });
    var shownSame = false;
    var html = '';

    allFields.forEach(function(f) {
      var isDiff = !!diffSet[f];
      // Insert a divider before the first unchanged row
      if (!isDiff && !shownSame && hasSame) {
        shownSame = true;
        html += '<tr class="divider-row"><td colspan="3">── Unchanged fields ──</td></tr>';
      }
      var vA = stringifyFieldValue(p.rowA ? p.rowA[f] : undefined);
      var vB = stringifyFieldValue(p.rowB ? p.rowB[f] : undefined);
      html +=
        '<tr class="' + (isDiff ? 'r-diff' : '') + '">' +
          '<td class="c-field">' + esc(f) + (isDiff ? '<span class="diff-pill">diff</span>' : '') + '</td>' +
          '<td class="c-src' + (isDiff ? ' changed' : '') + '">' + esc(vA) + '</td>' +
          '<td class="c-tgt' + (isDiff ? ' changed' : '') + '">' + esc(vB) + '</td>' +
        '</tr>';
    });
    return html || '<tr><td colspan="3" style="text-align:center;padding:20px;color:#9ca3af">No fields to show</td></tr>';
  }

  /* ── Render selected pair into the table ── */
  function renderPair(idx, diffOnly) {
    panel.querySelectorAll('.edv-rec').forEach(function(el, i){
      el.classList.toggle('active', i === idx);
    });
    var p = valueDiffs[idx];
    if (!p) return;
    var totalFields = Object.keys(Object.assign({}, p.rowA || {}, p.rowB || {}))
      .filter(isComparableField).length;
    document.getElementById('edv-panel-rec').textContent  = recLabel(p.rowA || p.rowB);
    document.getElementById('edv-panel-stat').textContent = p.fieldDiffs.length + ' of ' + totalFields + ' fields differ';
    document.getElementById('edv-tbody').innerHTML = buildRows(p, diffOnly);
  }

  /* ── No differences at all ── */
  if (!valueDiffs.length && !missingA.length && !missingB.length) {
    panel.innerHTML =
      '<div class="detail-head">✅ No Differences — ' + esc(detailRow.name) + '</div>' +
      '<div class="detail-sub">' +
        '🔵 ' + esc(STATE.lblA) + ': ' + resA.count + ' checked records &nbsp;|&nbsp; ' +
        '🟢 ' + esc(STATE.lblB) + ': ' + resB.count + ' checked records &nbsp;|&nbsp; ' +
        esc(rowScopeLabel) + ' No differences found.' +
      '</div>';
    return;
  }

  /* ── Build missing-records banners ── */
  var missingHtml = '';
  if (missingA.length || missingB.length) {
    missingHtml = '<div class="edv-missing">';
    if (missingA.length) {
      missingHtml +=
        '<div class="edv-missing-blk src">' +
          '<strong>✕ ' + missingA.length + ' record' + (missingA.length > 1 ? 's' : '') +
          ' exist in 🔵 ' + esc(STATE.lblA) + ' but are missing from 🟢 ' + esc(STATE.lblB) + '</strong>' +
          '<div style="margin-top:4px;font-size:11px;opacity:.9">These keys exist in the source environment only.</div>' +
          buildMissingTable(missingA, 'A') +
        '</div>';
    }
    if (missingB.length) {
      missingHtml +=
        '<div class="edv-missing-blk tgt">' +
          '<strong>✕ ' + missingB.length + ' record' + (missingB.length > 1 ? 's' : '') +
          ' exist in 🟢 ' + esc(STATE.lblB) + ' but are missing from 🔵 ' + esc(STATE.lblA) + '</strong>' +
          '<div style="margin-top:4px;font-size:11px;opacity:.9">These keys exist in the target environment only.</div>' +
          buildMissingTable(missingB, 'B') +
        '</div>';
    }
    missingHtml += '</div>';
  }

  /* ── Build sidebar nav items ── */
  var navHtml = valueDiffs.map(function(p, i){
    return '<div class="edv-rec' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '">' +
      '<span class="edv-rec-key">' + esc(recLabel(p.rowA || p.rowB)) + '</span>' +
      '<span class="edv-rec-badge">' + p.fieldDiffs.length + ' diff' + (p.fieldDiffs.length > 1 ? 's' : '') + '</span>' +
    '</div>';
  }).join('');

  /* ── First pair data ── */
  var first = valueDiffs[0];
  var firstTotal = first
    ? Object.keys(Object.assign({}, first.rowA || {}, first.rowB || {})).filter(function(f){ return !f.startsWith('@'); }).length
    : 0;

  /* ── Assemble full HTML ── */
  panel.innerHTML =
    /* Header */
    '<div class="edv-head">' +
      '<div class="edv-head-title">' + esc(detailRow.label || detailRow.name) + '</div>' +
      '<div class="edv-counts">' +
        '<span class="edv-count-src">🔵 ' + esc(STATE.lblA || 'Source') + ': ' + resA.count + ' checked</span>' +
        '<span class="edv-count-tgt">🟢 ' + esc(STATE.lblB || 'Target') + ': ' + resB.count + ' checked</span>' +
      '</div>' +
      '<span class="edv-key">🔑 ' + esc(keyLabel) + '</span>' +
      '<span style="font-size:10.5px;color:#b45309">' + esc(rowScopeLabel) + '</span>' +
    '</div>' +
    /* Body */
    '<div class="edv-body">' +
      /* Sidebar — only shown if there are value diffs */
      (valueDiffs.length > 0
        ? '<div class="edv-sidebar">' +
            '<div class="edv-sidebar-hdr">⚠ ' + valueDiffs.length + ' record' + (valueDiffs.length > 1 ? 's' : '') + ' differ</div>' +
            '<div class="edv-sidebar-list">' + navHtml + '</div>' +
          '</div>'
        : '') +
      /* Main comparison panel */
      (valueDiffs.length > 0
        ? '<div class="edv-panel">' +
            '<div class="edv-panel-bar">' +
              '<span class="edv-panel-rec" id="edv-panel-rec">' + esc(recLabel(first.rowA || first.rowB)) + '</span>' +
              '<span class="edv-panel-stat" id="edv-panel-stat">' + (first ? first.fieldDiffs.length : 0) + ' of ' + firstTotal + ' fields differ</span>' +
              '<label class="edv-difftoggle"><input type="checkbox" id="edv-diffsonly"/> Differences only</label>' +
            '</div>' +
            '<div class="edv-tbl-wrap">' +
              '<table class="edv-tbl">' +
                '<colgroup><col class="c-field"/><col class="c-val"/><col class="c-val"/></colgroup>' +
                '<thead><tr>' +
                  '<th class="h-field">Field</th>' +
                  '<th class="h-src">🔵 ' + esc(STATE.lblA) + ' &nbsp;<small style="font-weight:400;opacity:.7">(Source)</small></th>' +
                  '<th class="h-tgt">🟢 ' + esc(STATE.lblB) + ' &nbsp;<small style="font-weight:400;opacity:.7">(Target)</small></th>' +
                '</tr></thead>' +
                '<tbody id="edv-tbody">' + (first ? buildRows(first, false) : '') + '</tbody>' +
              '</table>' +
            '</div>' +
          '</div>'
        : '<div style="padding:16px;font-size:12.5px;color:#6b7280">No field-value differences — only missing records (see below).</div>') +
    '</div>' +
    /* Missing records */
    missingHtml +
  '</div>';

  /* ── Wire sidebar clicks ── */
  var diffOnly = false;
  panel.querySelectorAll('.edv-rec').forEach(function(el){
    el.addEventListener('click', function(){
      renderPair(parseInt(el.getAttribute('data-idx'), 10), diffOnly);
    });
  });

  /* ── Wire diff-only toggle ── */
  var chk = document.getElementById('edv-diffsonly');
  if (chk) {
    chk.addEventListener('change', function(){
      diffOnly = chk.checked;
      var active = panel.querySelector('.edv-rec.active');
      renderPair(active ? parseInt(active.getAttribute('data-idx'), 10) : 0, diffOnly);
    });
  }
}

/* ── Build OData endpoint ── */
function buildEndpoint(origin, path){
  return origin + '/data/' + path;
}

/* ── Data entity browser ── */
function getEntityBrowserRows(){
  var term = String(STATE.entityBrowserSearch || '').trim().toLowerCase();
  var statusFilter = String(STATE.entityBrowserStatusFilter || '').trim();
  var rows = Array.isArray(STATE.allRows) ? STATE.allRows.slice() : [];
  if(statusFilter){
    rows = rows.filter(function(r){ return r.status === statusFilter; });
  }
  if(!term) return rows;
  return rows.filter(function(r){
    var haystack = [
      r.name,
      r.label,
      r.aotName,
      r.dmfName,
      r.module,
      r.publicCollectionName,
      r.collection,
      r.category,
      r.status
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.indexOf(term) !== -1;
  });
}

function getEntityBrowserDetailRow(row){
  var metaA = STATE.entityMapA[row.name] || null;
  var metaB = STATE.entityMapB[row.name] || null;
  var publicCollectionName = row.publicCollectionName || row.collection ||
    (metaA && (metaA.publicCollectionName || metaA.collection)) ||
    (metaB && (metaB.publicCollectionName || metaB.collection)) || '';
  return Object.assign({}, row, {
    metaA: metaA,
    metaB: metaB,
    publicCollectionName: publicCollectionName,
    countA: row.countA != null ? row.countA : '?',
    countB: row.countB != null ? row.countB : '?'
  });
}

/* ── Target-only notice ── */
function updateTgtOnlyNotice() {
  var notice = document.getElementById('tgtOnlyNotice');
  if (!notice) return;
  var hasRows = Array.isArray(STATE.allRows) && STATE.allRows.length > 0;
  if (!hasRows) {
    notice.classList.remove('show');
    return;
  }
  var tgtOnlyRows = STATE.allRows.filter(function(r) { return r.status === 'Only in Target'; });
  var count = tgtOnlyRows.length;
  if (count === 0) {
    notice.classList.remove('show');
    return;
  }
  var countEl = document.getElementById('tgtOnlyCount');
  var envNameEl = document.getElementById('tgtOnlyEnvName');
  if (countEl) countEl.textContent = count;
  if (envNameEl) envNameEl.textContent = STATE.lblB || 'Target';
  notice.classList.add('show');
}

/* Wire the "View them →" button: switch to entity browser filtered to Target-only */
document.addEventListener('DOMContentLoaded', function() {
  var filterBtn = document.getElementById('tgtOnlyFilterBtn');
  if (filterBtn) {
    filterBtn.addEventListener('click', function() {
      // Switch to entity browser tab
      var tabEntities = document.getElementById('tabEntities');
      if (tabEntities) tabEntities.click();
      // Apply "Only in Target" status filter
      var statusFilter = document.getElementById('entityStatusFilter');
      if (statusFilter) {
        statusFilter.value = 'Only in Target';
        // Trigger change so the browser re-filters
        statusFilter.dispatchEvent(new Event('change'));
      }
      // Scroll to the entity browser
      var panel = document.getElementById('entityBrowserPanel');
      if (panel && panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
});

function renderEntityBrowser(){
  var panel = document.getElementById('entityBrowserPanel');
  var tbody = document.getElementById('entityBrowserTbody');
  if(!panel || !tbody) return;
  var hasLoadedRows = Array.isArray(STATE.allRows) && STATE.allRows.length > 0;
  panel.style.display = hasLoadedRows && STATE.activeWorkspaceTab !== 'module' ? 'block' : 'none';

  // ── UAT2-only notice ─────────────────────────────────────────────
  updateTgtOnlyNotice();

  if(!hasLoadedRows) return;
  var summary = document.getElementById('entityBrowserSummary');
  var footer = document.getElementById('entityBrowserFooter');
  var pageLabel = document.getElementById('entityPageLabel');
  var prevBtn = document.getElementById('entityPrevPage');
  var nextBtn = document.getElementById('entityNextPage');
  var pageSize = Math.max(1, Math.floor(Number(STATE.entityBrowserPageSize) || 30));
  var rows = getEntityBrowserRows();
  var total = rows.length;
  var totalPages = Math.max(1, Math.ceil(total / pageSize));
  if(STATE.entityBrowserPage > totalPages) STATE.entityBrowserPage = totalPages;
  if(STATE.entityBrowserPage < 1) STATE.entityBrowserPage = 1;
  var start = (STATE.entityBrowserPage - 1) * pageSize;
  var pageRows = rows.slice(start, start + pageSize);
  var sourceCount = STATE.entitiesA.length || 0;
  var targetCount = STATE.entitiesB.length || 0;

  if(summary) summary.textContent = (STATE.lblA || 'Source') + ': ' + sourceCount + ' • ' + (STATE.lblB || 'Target') + ': ' + targetCount;
  if(footer) footer.textContent = total ? 'Showing ' + (start + 1) + '-' + (start + pageRows.length) + ' of ' + total + ' entities' : 'No matching entities';
  if(pageLabel) pageLabel.textContent = 'Page ' + STATE.entityBrowserPage + ' of ' + totalPages;
  if(prevBtn) prevBtn.disabled = STATE.entityBrowserPage <= 1;
  if(nextBtn) nextBtn.disabled = STATE.entityBrowserPage >= totalPages;

  if(!pageRows.length){
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#9ca3af">No entities match your search</td></tr>';
    return;
  }

  tbody.innerHTML = pageRows.map(function(r, i){
    var row = getEntityBrowserDetailRow(r);
    var isActive = row.name === STATE.activeEntityName;
    var envHtml = '<span class="env-flags">' +
      (row.metaA ? '<span class="env-flag src">Source</span>' : '') +
      (row.metaB ? '<span class="env-flag tgt">Target</span>' : '') +
      (isActive && STATE.activeEntityLoading ? '<span class="env-flag busy">Comparing</span>' : '') +
      (!row.metaA && !row.metaB ? '<span style="color:#9ca3af">Missing</span>' : '') +
      '</span>';
    return '<tr class="' + (isActive ? (STATE.activeEntityLoading ? 'eb-loading' : 'eb-active') : '') + '" data-name="' + esc(row.name) + '" tabindex="0" role="row">' +
      '<td class="eb-num">' + (start + i + 1) + '</td>' +
      '<td class="eb-aot" title="' + esc(row.aotName || row.name) + '">' + esc(row.aotName || row.name || '') + '</td>' +
      '<td class="eb-dmf" title="' + esc(row.dmfName || row.label || row.name) + '">' + esc(row.dmfName || row.label || row.name || '') + '</td>' +
      '<td class="eb-odata" title="' + esc(row.publicCollectionName || '') + '">' + (row.publicCollectionName ? esc(row.publicCollectionName) : '<span style="color:#9ca3af">no entry</span>') + '</td>' +
      '<td class="eb-module" title="' + esc(row.module || '') + '">' + esc(row.module || '') + '</td>' +
      '<td>' + envHtml + '</td>' +
    '</tr>';
  }).join('');
}

function setComparisonDetailTitle(text){
  var title = document.getElementById('modDetailTitle');
  if(title) title.textContent = text || 'Module Comparison Detail';
}

function scrollPanelIntoView(el, block){
  if(el && el.scrollIntoView){
    el.scrollIntoView({behavior:'smooth',block:block||'start'});
  }
}

function openEntityDiffModal(row){
  var modal = document.getElementById('entityDiffModal');
  var body = document.getElementById('entityDiffModalBody');
  var title = document.getElementById('entityDiffModalTitle');
  var sub = document.getElementById('entityDiffModalSub');
  var inlinePanel = document.getElementById('entityDiffPanel');
  if(inlinePanel) inlinePanel.style.display = 'none';
  if(!modal || !body) return document.getElementById('entityDiffPanel');
  var name = row && (row.dmfName || row.label || row.aotName || row.name) || 'Environment record differences';
  if(title) title.textContent = name;
  if(sub) sub.textContent = (STATE.lblA || 'Source') + ' vs ' + (STATE.lblB || 'Target');
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
  return body;
}

function closeEntityDiffModal(){
  var modal = document.getElementById('entityDiffModal');
  if(!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
}

function renderEntityDiffLoading(row, message, targetPanel){
  var panel = targetPanel || document.getElementById('entityDiffPanel');
  if(!panel) return;
  var title = row && (row.dmfName || row.label || row.aotName || row.name) || 'Selected entity';
  panel.style.display = 'block';
  panel.innerHTML =
    '<div class="edv edv-loading">' +
      '<div class="edv-head">' +
        '<div class="edv-head-title">' + esc(title) + '</div>' +
        '<span class="edv-count-src">' + esc(STATE.lblA || 'Source') + '</span>' +
        '<span class="edv-count-tgt">' + esc(STATE.lblB || 'Target') + '</span>' +
      '</div>' +
      '<div class="edv-loading-body">' +
        '<div>' +
          '<div class="edv-loading-status"><span>Preparing records</span><span>' + esc(STATE.lblA || 'Source') + ' vs ' + esc(STATE.lblB || 'Target') + '</span></div>' +
          '<div class="edv-loading-message">' + esc(message || 'Fetching records from both environments...') + '</div>' +
          '<div class="edv-loading-progress" role="progressbar" aria-label="Preparing side-by-side records"></div>' +
        '</div>' +
        '<div class="edv-loading-lines" aria-hidden="true">' +
          '<div class="edv-loading-line"></div>' +
          '<div class="edv-loading-line mid"></div>' +
          '<div class="edv-loading-line"></div>' +
          '<div class="edv-loading-line short"></div>' +
        '</div>' +
      '</div>' +
    '</div>';
}

async function compareEntityFromBrowser(row){
  var runId = startDetailCompareRun();
  var urlA = getEnvUrl('A');
  var urlB = getEnvUrl('B');
  if(!urlA || !urlB){
    toast('⚠️ Select both environments first.');
    return;
  }

  var entityName = row.aotName || row.name;
  STATE.activeEntityName = row.name || '';
  STATE.activeEntityLoading = true;
  renderEntityBrowser();
  var diffModalBody = openEntityDiffModal(row);
  renderEntityDiffLoading(row, 'Reading ' + entityName + ' from Source and Target.', diffModalBody);
  setSt('stA','loading',getEnvLabel('A')+' — comparing '+entityName+'...');
  setSt('stB','loading',getEnvLabel('B')+' — comparing '+entityName+'...');

  try{
    var result = await compareEntityRecords(row, 0, urlA, urlB);
    if(!isCurrentDetailCompareRun(runId)) return;
    result.srcOnly = result.srcOnly != null ? result.srcOnly : (result.missingInTarget || 0);
    result.tgtOnly = result.tgtOnly != null ? result.tgtOnly : (result.onlyInTarget || 0);
    result.idx = 1;
    setSt('stA','ok',getEnvLabel('A')+' — compared '+entityName+' ✓');
    setSt('stB','ok',getEnvLabel('B')+' — compared '+entityName+' ✓');

    if(result.publicCollectionName && (result.metaA || result.metaB)){
      renderEntityDiffLoading(result, 'Building the field-by-field comparison view.', diffModalBody);
      await showEntityDiff(result, diffModalBody);
      if(!isCurrentDetailCompareRun(runId)) return;
      STATE.activeEntityLoading = false;
      renderEntityBrowser();
    } else {
      STATE.activeEntityLoading = false;
      renderEntityBrowser();
    }
  }catch(e){
    if(!isCurrentDetailCompareRun(runId)) return;
    STATE.activeEntityLoading = false;
    renderEntityBrowser();
    setSt('stA','error',getEnvLabel('A')+' — compare failed');
    setSt('stB','error',getEnvLabel('B')+' — compare failed');
    toast('⚠️ Entity compare failed: '+(e&&e.message?e.message:String(e)));
  }
}

function handleEntityBrowserRowClick(tr){
  if(!tr) return;
  var name = tr.dataset.name;
  var row = STATE.allRows.find(function(r){ return r.name === name; });
  if(!row) return;
  var detailRow = getEntityBrowserDetailRow(row);
  if(!detailRow.publicCollectionName){
    toast('⚠️ This entity has no OData public collection to compare.');
    return;
  }
  compareEntityFromBrowser(detailRow).catch(function(e){
    toast('⚠️ Entity compare failed: '+(e&&e.message?e.message:String(e)));
  });
}

/* ── Render module detail table ── */
function renderModuleDetailTable(rows){
  var el=document.getElementById('modDetailTbody');

  // Update column headers to actual env names
  var thSrcRows=document.getElementById('thSrcRows');
  var thTgtRows=document.getElementById('thTgtRows');
  var thSrc=document.getElementById('thSrcOnly');
  var thTgt=document.getElementById('thTgtOnly');
  var srcLabel=esc(STATE.lblA||'Source');
  var tgtLabel=esc(STATE.lblB||'Target');
  if(thSrcRows){
    thSrcRows.title='Records checked from '+srcLabel;
    thSrcRows.innerHTML='<span class="th-kicker">'+srcLabel+'</span><span class="th-title">Checked</span><span class="th-hint">records read</span>';
  }
  if(thTgtRows){
    thTgtRows.title='Records checked from '+tgtLabel;
    thTgtRows.innerHTML='<span class="th-kicker">'+tgtLabel+'</span><span class="th-title">Checked</span><span class="th-hint">records read</span>';
  }
  if(thSrc){
    thSrc.title=srcLabel+' records with no matching '+tgtLabel+' record';
    thSrc.innerHTML='<span class="th-kicker">'+srcLabel+'</span><span class="th-title">Unmatched</span><span class="th-hint">missing in target</span>';
  }
  if(thTgt){
    thTgt.title=tgtLabel+' records with no matching '+srcLabel+' record';
    thTgt.innerHTML='<span class="th-kicker">'+tgtLabel+'</span><span class="th-title">Unmatched</span><span class="th-hint">missing in source</span>';
  }

  if(!rows||!rows.length){
    el.innerHTML='<tr><td colspan="10" style="text-align:center;padding:20px;color:#9ca3af">No matching entities for the current filters</td></tr>';
    return;
  }
  el.innerHTML=rows.map(function(r){
    var stCls={Match:'rm',Diff:'rd','Only in Source':'ru','Only in Target':'rs','No OData':''}[r.status]||'';
    var stBadge={Match:'<span class="badge bm">Match</span>',Diff:'<span class="badge bd">Diff</span>',
      'Only in Source':'<span class="badge bu">Only Source</span>','Only in Target':'<span class="badge bs">Only Target</span>',
      'No OData':'<span class="badge" style="background:#e5e7eb;color:#6b7280">No OData</span>'}[r.status]||r.status;
    var canDiff=r.status!=='No OData'&&(r.metaA||r.metaB);
    return'<tr class="'+stCls+(canDiff?' mod-row-clickable':'')+'"'+(canDiff?' style="cursor:pointer"'+' tabindex="0" role="row"':'')+' data-name="'+esc(r.name)+'">' +
      '<td style="width:26px;text-align:right;color:#aaa;font-size:11px">'+esc(r.idx)+'</td>'+
      '<td><strong>'+esc(r.aotName || r.name)+'</strong>'+(r.name&&r.aotName&&r.name!==r.aotName?'<br/><span style="font-size:10px;color:#888">'+esc(r.name)+'</span>':'')+'</td>'+
      '<td>'+esc(r.dmfName || r.label || r.name)+'</td>'+
      '<td>'+(r.publicCollectionName?'<span style="font-family:Consolas,monospace;color:#1d4ed8">'+esc(r.publicCollectionName)+'</span>':'<span style="color:#9ca3af">no entry</span>')+'</td>'+
      '<td style="text-align:center">'+esc(r.countA!=null?r.countA:'?')+'</td>'+
      '<td style="text-align:center">'+esc(r.countB!=null?r.countB:'?')+'</td>'+
      '<td style="text-align:center;color:#c0392b;font-weight:600">'+(r.srcOnly?r.srcOnly:'—')+'</td>'+
      '<td style="text-align:center;color:#2980b9;font-weight:600">'+(r.tgtOnly?r.tgtOnly:'—')+'</td>'+
      '<td>'+stBadge+'</td>'+
      '<td style="font-size:10.5px;color:#888;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(r.detail||'')+'</td>'+
    '</tr>';
  }).join('');
}

function renderModuleDetailPlaceholder(message){
  var el=document.getElementById('modDetailTbody');
  if(!el)return;
  el.innerHTML='<tr><td colspan="10" style="text-align:center;padding:20px;color:#9ca3af">'+esc(message||'Loading module detail...')+'</td></tr>';
}

function clearModuleDetailResults(message){
  STATE.moduleDetailRows=[];
  STATE.visibleModuleDetailRows=[];
  var panel=document.getElementById('modDetailPanel');
  if(panel){
    panel.hidden=STATE.activeWorkspaceTab!=='module';
    panel.style.display=STATE.activeWorkspaceTab==='module'?'block':'none';
  }
  document.getElementById('modDetailSummary').innerHTML='';
  renderModuleDetailPlaceholder(message||'Loading module detail...');
}

function applyModuleDetailFilters(){
  var search=(document.getElementById('modDetailFilter').value||'').toLowerCase().trim();
  var statusFilter=(document.getElementById('modDetailStatusFilter').value||'');
  var baseRows=STATE.moduleDetailRows.slice();
  STATE.visibleModuleDetailRows=baseRows.filter(function(r){
    var matchesStatus=!statusFilter||r.status===statusFilter;
    var matchesSearch=!search||
      r.name.toLowerCase().indexOf(search)!==-1||
      (r.label&&r.label.toLowerCase().indexOf(search)!==-1)||
      r.status.toLowerCase().indexOf(search)!==-1||
      (r.detail&&r.detail.toLowerCase().indexOf(search)!==-1);
    return matchesStatus&&matchesSearch;
  });
  updateModuleDetailSummary();
  renderModuleDetailTable(STATE.visibleModuleDetailRows);
}

/* ── Row click handler ── */
function handleModuleRowClick(tr){
  if(!tr)return;
  var name=tr.dataset.name;
  var row=STATE.visibleModuleDetailRows.find(function(r){return r.name===name;});
  if(!row)return;
  var modalBody = openEntityDiffModal(row);
  renderEntityDiffLoading(row, 'Reading records from Source and Target.', modalBody);
  showEntityDiff(row, modalBody).catch(function(e){
    toast('\u26A0\uFE0F Diff error: '+(e&&e.message?e.message:String(e)));
  });
}

/* ── Filter module detail ── */
window.filterModuleDetail=function(val){
  document.getElementById('modDetailFilter').value=val||'';
  applyModuleDetailFilters();
};

/* ── mapLimit ── */
function mapLimit(items,limit,worker,runId){
  return new Promise(function(resolve){
    var results=new Array(items.length);
    var idx=0,completed=0,active=0;
    var TIMEOUT_MS=3*60*1000;
    var dead=false;
    var timer=setTimeout(function(){
      dead=true;
      results.timedOut=true;
      results.completedCount=completed;
      resolve(results);
      toast('\u23F1 Module compare timed out after 3 min. Partial results shown.');
    },TIMEOUT_MS);
    function next(){
      if(dead)return;
      while(active<limit&&idx<items.length){
        (function(i){
          active++;
          Promise.resolve().then(function(){return worker(items[i],i);}).then(function(r){
            if(!dead){results[i]=r;}
          }).catch(function(e){
            if(!dead){
              var item=items[i]||{};
              results[i]={
                name:item.name||'',
                label:item.label||item.name||'',
                module:item.module||'',
                aotName:item.aotName||item.name||'',
                dmfName:item.dmfName||item.label||item.name||'',
                publicCollectionName:item.publicCollectionName||'',
                idx:i+1,
                countA:null,
                countB:null,
                srcOnly:0,tgtOnly:0,
                status:'No OData',detail:'No OData collection',metaA:null,metaB:null};
            }
          }).then(function(){
            active--;completed++;
            if(!dead && (!runId || isCurrentDetailCompareRun(runId))){showModuleProgress('Compare Module Details',completed+' / '+items.length+' entities',5+Math.round((completed/items.length)*90));}
            if(completed===items.length){clearTimeout(timer);results.timedOut=false;results.completedCount=completed;resolve(results);}
            else next();
          });
        })(idx++);
      }
    }
    next();
  });
}

function updateModuleDetailSummary() {
  var summary = document.getElementById('modDetailSummary');
  if (!summary) return;
  var total = STATE.moduleDetailRows.length;
  var match = STATE.moduleDetailRows.filter(function(r){return r.status==='Match';}).length;
  var diff = STATE.moduleDetailRows.filter(function(r){return r.status==='Diff';}).length;
  var onlyA = STATE.moduleDetailRows.filter(function(r){return r.status==='Only in Source';}).length;
  var onlyB = STATE.moduleDetailRows.filter(function(r){return r.status==='Only in Target';}).length;
  var noOdata = STATE.moduleDetailRows.filter(function(r){return r.status==='No OData';}).length;
  var displayed = STATE.visibleModuleDetailRows.length || total;
  summary.innerHTML =
    '<span class="badge bd">\u25B3 Diff: '+diff+'</span> '+
    '<span class="badge bu">\u2212 Only Source: '+onlyA+'</span> '+
    '<span class="badge bs">+ Only Target: '+onlyB+'</span> '+
    '<span style="font-size:11px;color:#888;margin-left:6px">Compared '+total+' entities from Source and Target</span>'+
    '<span style="font-size:11px;color:#888;margin-left:6px">Showing '+displayed+' entities</span>'+
    ((match||noOdata)?'<span style="font-size:11px;color:#9ca3af;margin-left:6px">Includes '+match+' match and '+noOdata+' no OData</span>':'');
}

/* ── Load Module Entities ── */
async function loadModuleEntities(){
  var runId = startDetailCompareRun();
  var mod=document.getElementById('modSel').value;
  var rows=STATE.allRows.filter(function(r){
    return !mod || r.module===mod;
  });
  if(!rows.length){toast('\u26A0\uFE0F No entities for current filter.');return;}
  var urlA=getEnvUrl('A'),urlB=getEnvUrl('B');
  if(!urlA||!urlB){toast('\u26A0\uFE0F Select both environments first.');return;}
  setComparisonDetailTitle('Module Comparison Detail');
  clearModuleDetailResults('Loading '+(mod||'selected module')+'...');
  setSt('stA','loading',getEnvLabel('A')+' — comparing module data...');
  setSt('stB','loading',getEnvLabel('B')+' — comparing module data...');
  showModuleProgress('Compare Module Details','Starting\u2026',5);
  STATE.activeModule=mod;

  var detailRows=await mapLimit(rows,4,async function(row,i){
    var metaA=STATE.entityMapA[row.name]||null;
    var metaB=STATE.entityMapB[row.name]||null;
    var best=metaA||metaB;
    if(!best||!best.collection){
      return{name:row.name,label:(best&&best.label)||row.name,module:row.module,aotName:(best&&best.aotName)||row.aotName||row.name,dmfName:(best&&best.dmfName)||row.dmfName||row.label||row.name,publicCollectionName:(best&&best.collection)||row.publicCollectionName||'',
        idx:i+1,countA:null,countB:null,
        srcOnly:0,tgtOnly:0,
        status:'No OData',detail:'No OData collection',metaA:metaA,metaB:metaB};
    }
    if(i<4)await new Promise(function(r){setTimeout(r,i*50);});
    var resA=await fetchCollectionRows(urlA,'A',metaA||metaB);
    var resB=await fetchCollectionRows(urlB,'B',metaB||metaA);
    var status='Match',detail='';
    var srcOnly=0,tgtOnly=0;
    if(!resA.ok&&!resB.ok){status='No OData';detail=resA.detail||resB.detail;}
    else if(!resA.ok){status='No OData';detail='Src: '+resA.detail;}
    else if(!resB.ok){status='No OData';detail='Tgt: '+resB.detail;}
    else{
      var pairs=findAllDifferentRowPairs(resA.rows||[],resB.rows||[]);
      var vd=pairs.filter(function(p){return p.rowA&&p.rowB&&p.fieldDiffs.length>0;});
      var ma=pairs.filter(function(p){return p.rowA&&!p.rowB;});
      var mb=pairs.filter(function(p){return!p.rowA&&p.rowB;});
      srcOnly=ma.length;tgtOnly=mb.length;
      if(vd.length>0){status='Diff';detail=vd.length+' record(s) differ';}
      else if(ma.length && !mb.length){
        status='Only in Source';
        detail=ma.length+' only in Source';
      } else if(!ma.length && mb.length){
        status='Only in Target';
        detail=mb.length+' only in Target';
      } else if(ma.length||mb.length){
        status='Diff';
        detail=(ma.length?ma.length+' only in Source':'')+(mb.length?(ma.length?', ':'')+mb.length+' only in Target':'');
      } else { status='Match'; }
    }
    return{name:row.name,label:(best&&best.label)||row.name,module:row.module,aotName:(best&&best.aotName)||row.aotName||row.name,dmfName:(best&&best.dmfName)||row.dmfName||row.label||row.name,publicCollectionName:(best&&best.collection)||row.publicCollectionName||'',
      idx:i+1,countA:resA.ok?resA.count:null,countB:resB.ok?resB.count:null,
      srcOnly:srcOnly,tgtOnly:tgtOnly,
      status:status,detail:detail,metaA:metaA,metaB:metaB};
  },runId);

  if(!isCurrentDetailCompareRun(runId)) return;

  var timedOut = !!detailRows.timedOut;
  var attempted = rows.length;
  STATE.moduleDetailRows=detailRows.filter(Boolean);
  STATE.visibleModuleDetailRows=STATE.moduleDetailRows.slice();
  var detailPanel=document.getElementById('modDetailPanel');
  if(detailPanel){
    detailPanel.hidden=STATE.activeWorkspaceTab!=='module';
    detailPanel.style.display=STATE.activeWorkspaceTab==='module'?'block':'none';
  }

  var total=STATE.moduleDetailRows.length;
  updateModuleDetailSummary();

  var sf=document.getElementById('modDetailFilter');
  if(sf)sf.value='';
  var ssf=document.getElementById('modDetailStatusFilter');
  if(ssf)ssf.value='';
  applyModuleDetailFilters();
  saveComparisonSnapshot();
  if(timedOut){
    showModuleProgress('Compare Module Details','Timed out — partial results.',100);
    hideModuleProgress(1800);
    setSt('stA','error',getEnvLabel('A')+' — timed out, '+total+' of '+attempted+' entities compared');
    setSt('stB','error',getEnvLabel('B')+' — timed out, '+total+' of '+attempted+' entities compared');
    toast('\u26A0\uFE0F Module compare timed out. Only '+total+' of '+attempted+' entities were compared.');
  } else {
    showModuleProgress('Compare Module Details','Done!',100);
    hideModuleProgress(1000);
    setSt('stA','ok',getEnvLabel('A')+' — compared '+total+' entities ✓');
    setSt('stB','ok',getEnvLabel('B')+' — compared '+total+' entities ✓');
    toast('\u2705 Module compare complete.');
  }
}

/* ── Diagnose ── */
async function runDiagnose(){
  var panel=document.getElementById('diagPanel');
  panel.style.display='block';
  panel.textContent='\uD83D\uDD0D Running diagnostics\u2026\n';
  var urlA=getEnvUrl('A'),urlB=getEnvUrl('B');
  async function probe(url,label){
    if(!url){panel.textContent+=label+': (no URL)\n';return;}
    panel.textContent+=label+': checking '+url+'\u2026\n';
    try{
      var origin=new URL(url).origin;
      var found=await findD365Tab(url);
      if(!found.tab){panel.textContent+=label+': \u274C '+formatNoOpenTabMessage(found)+'\n';return;}
      var probe = await tryCandidateEndpoints(found, url, function(candidateOrigin){
        return getCandidateEndpoints(candidateOrigin).map(function(u){
          return u.replace('$top=10000','$top=1').replace(/&\$select=[^&]*/,'');
        });
      }, function(candidate, candidateOrigin, endpoint, detail){
        panel.textContent+=label+': '+candidate.actualHost+' '+endpoint+' => \u274C '+detail+'\n';
      });
      if(probe.ok){
        if(probe.candidate.fallback&&probe.candidate.actualHost){
          panel.textContent+=label+': using visible tab host '+probe.candidate.actualHost+' for selected URL '+probe.candidate.host+'\n';
        }
        panel.textContent+=label+': '+probe.endpoint+' => \u2705 OK\n';
      } else {
        panel.textContent+=label+': \u274C All candidates failed '+(probe.status||'')+' '+(probe.detail||'')+'\n';
      }
      return;
    }catch(e){panel.textContent+=label+': \u274C '+e.message+'\n';}
  }
  await probe(urlA,'Source');
  await probe(urlB,'Target');
  panel.textContent+='Done.\n';
}

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
(function initApp(){
  var isFullPage = window.location.search.includes('fullpage=1');
  if(isFullPage){
    document.body.classList.add('fullpage');
  }

  function bind(id, eventName, handler) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(eventName, handler);
    return el;
  }

  // Pull profiles & picks from chrome.storage first, then render
  syncProfilesFromStorage().then(function(){
    renderProfileList();
    refreshPickers();
    restore();
    if(isFullPage){
      restoreComparisonSnapshot().then(function(restored){
        if(restored) toast('Restored loaded entity list.');
      });
    }
  });

  bind('btnAddProfile','click',function(e){
    e.preventDefault();
    addOrUpdateProfile().catch(function(err){
      toast('⚠️ Could not save profile: '+(err && err.message ? err.message : String(err)));
    });
  });
  bind('pfList','click',function(e){
    var editBtn=e.target.closest('.pf-edit-btn');
    var delBtn=e.target.closest('.pf-del-btn');
    if(editBtn)editProfile(editBtn.dataset.id);
    else if(delBtn)deleteProfile(delBtn.dataset.id).catch(function(err){
      toast('⚠️ Could not delete profile: '+(err && err.message ? err.message : String(err)));
    });
  });
  bind('pickerA','change',function(){loadSlot('A');persist();});
  bind('pickerB','change',function(){loadSlot('B');persist();});

  ['modalCloseBtn','modalGotItBtn'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.addEventListener('click',hideTokenModal);
  });
  var tokenModal=document.getElementById('tokenModal');
  if(tokenModal)tokenModal.addEventListener('click',function(e){if(e.target===this)hideTokenModal();});
  bind('entityDiffModalClose','click',closeEntityDiffModal);
  var entityDiffModal=document.getElementById('entityDiffModal');
  if(entityDiffModal)entityDiffModal.addEventListener('click',function(e){if(e.target===this)closeEntityDiffModal();});
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape')closeEntityDiffModal();
  });
  bind('btnToggleSetup','click',function(){
    var shouldCollapse=this.getAttribute('aria-expanded')==='true';
    setSetupCardCollapsed(shouldCollapse);
  });

  bind('btnVal','click',validateAccess);
  bind('btnLoad','click',function(){
    loadEntities().catch(function(e){toast('\u26A0\uFE0F Load failed: '+(e&&e.message?e.message:String(e)));});
  });
  bind('btnDiag','click',runDiagnose);

  bind('tabEntities','click',function(){setWorkspaceTab('entities');});
  bind('tabModule','click',function(){setWorkspaceTab('module');});

  bind('btnCompareModule','click',function(){
    loadModuleEntities().catch(function(e){
      hideModuleProgress();
      toast('\u26A0\uFE0F Compare failed: '+(e&&e.message?e.message:String(e)));
    });
  });

  bind('entitySearch','input',function(){
    STATE.entityBrowserSearch = this.value || '';
    STATE.entityBrowserPage = 1;
    renderEntityBrowser();
    // Debounce the snapshot write — serialising the full entity list on every keystroke is expensive
    clearTimeout(_entitySearchSaveTimer);
    _entitySearchSaveTimer = setTimeout(saveComparisonSnapshot, 600);
  });
  bind('entityStatusFilter','change',function(){
    STATE.entityBrowserStatusFilter = this.value || '';
    STATE.entityBrowserPage = 1;
    renderEntityBrowser();
  });
  bind('entityPageSize','change',function(){
    STATE.entityBrowserPageSize = Math.max(1, Math.floor(Number(this.value) || 30));
    STATE.entityBrowserPage = 1;
    renderEntityBrowser();
    saveComparisonSnapshot();
  });
  bind('entityPrevPage','click',function(){
    STATE.entityBrowserPage = Math.max(1, STATE.entityBrowserPage - 1);
    renderEntityBrowser();
    saveComparisonSnapshot();
  });
  bind('entityNextPage','click',function(){
    STATE.entityBrowserPage += 1;
    renderEntityBrowser();
    saveComparisonSnapshot();
  });
  bind('entityBrowserTbody','click',function(e){
    var tr = e.target.closest('tr[data-name]');
    if(tr) handleEntityBrowserRowClick(tr);
  });

  bind('modSel','change',function(){
    startDetailCompareRun();
    hideModuleProgress();
    STATE.activeModule=this.value||'';
    saveComparisonSnapshot();
    var entityDiffPanel = document.getElementById('entityDiffPanel');
    if(entityDiffPanel)entityDiffPanel.style.display='none';
    setComparisonDetailTitle('Module Comparison Detail');
    clearModuleDetailResults(this.value ? 'Click Compare to load '+this.value+' details.' : 'Click Compare to load module details.');
    updateReportButtonState();
  });
  // ── Keyboard activation for entity browser rows (Enter / Space) ──
  (function(){
    var ebTbody=document.getElementById('entityBrowserTbody');
    if(ebTbody){ebTbody.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===' '){var tr=e.target.closest('tr[data-name]');if(tr){e.preventDefault();handleEntityBrowserRowClick(tr);}}
    });}
  })();

  // ── Module detail table: click and keyboard activation ──
  (function(){
    var mdTbody=document.getElementById('modDetailTbody');
    if(mdTbody){
      mdTbody.addEventListener('click',function(e){
        var tr=e.target.closest('tr[data-name]');
        if(tr) handleModuleRowClick(tr);
      });
      mdTbody.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '){
          var tr=e.target.closest('tr[data-name]');
          if(tr){e.preventDefault();handleModuleRowClick(tr);}
        }
      });
    }
  })();

  // ── Module detail filter inputs ──
  bind('modDetailFilter','input',applyModuleDetailFilters);
  bind('modDetailStatusFilter','change',applyModuleDetailFilters);

  /* Full page — save snapshot first, THEN open tab so the write is committed before the new page reads it */
  bind('btnFullPage','click',function(){
    var openTab = function() {
      if(typeof chrome!=='undefined'&&chrome.tabs){
        chrome.tabs.create({url:chrome.runtime.getURL('popup.html?fullpage=1')});
      } else {
        window.open(window.location.href.split('?')[0]+'?fullpage=1','_blank');
      }
    };
    var savePromise = saveComparisonSnapshot();
    if (savePromise && typeof savePromise.then === 'function') {
      savePromise.then(openTab);
    } else {
      openTab();
    }
  });

  // restore() is now called inside syncProfilesFromStorage().then() at top of initApp
})(); // end initApp

// ── Token & UI helpers ──
/* NOTE: Stub token provider.
   Extension mode uses the signed-in browser session and does not need a bearer token.
   Proxy/localhost mode can be wired later to return a stored token per slot. */
function getToken(slot){
  return '';
}

function showTokenHelp(){
  var m = document.getElementById('tokenModal');
  if(m) m.classList.add('show');
}

function hideTokenModal(){
  var m = document.getElementById('tokenModal');
  if(m) m.classList.remove('show');
}

function copyTokenCmd(){
  var el = document.getElementById('tokenCmd');
  if(!el) return;
  var text = el.textContent;
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){toast('📋 Copied!');}).catch(function(){});
  } else {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('📋 Copied!'); } catch(e){}
    document.body.removeChild(ta);
  }
}

// filterModuleDetail removed — applyModuleDetailFilters() is the single source of truth.

})(); // end outer IIFE
