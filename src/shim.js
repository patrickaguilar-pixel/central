/* Central standalone: Firebase (login + banco) e Google Agenda direto, no lugar do runtime do Claude */
(function(){
"use strict";
const CFG=window.CENTRAL_FIREBASE;
const TZ=Intl.DateTimeFormat().resolvedOptions().timeZone||'America/Sao_Paulo';
const SCOPE='https://www.googleapis.com/auth/calendar.events';
firebase.initializeApp(CFG);
const auth=firebase.auth(), fs=firebase.firestore();
try{ fs.enablePersistence({synchronizeTabs:true}).catch(()=>{}); }catch(e){}
const provider=new firebase.auth.GoogleAuthProvider(); provider.addScope(SCOPE); provider.setCustomParameters({prompt:'select_account'});

/* ---- token do Google Agenda ---- */
const TK='central.gtoken';
function getTok(){ try{ const t=JSON.parse(localStorage.getItem(TK)||'null'); if(t&&t.exp>Date.now()+60000) return t.v; }catch(e){} return null; }
function setTok(cred){ if(cred&&cred.accessToken){ try{ localStorage.setItem(TK,JSON.stringify({v:cred.accessToken,exp:Date.now()+55*60000})); }catch(e){} } }
async function connectGoogle(){
  const u=auth.currentUser; if(!u) throw {code:'needs_reauth'};
  const r=await u.reauthenticateWithPopup(provider); setTok(r.credential); return getTok();
}
window.centralConnectGoogle=()=>connectGoogle().then(()=>{ document.dispatchEvent(new CustomEvent('central:gconnected')); }).catch(e=>{ if(e&&e.code!=='auth/popup-closed-by-user') alert('Não consegui conectar ao Google Agenda: '+(e.message||e.code)); });

/* ---- tela de login ---- */
let readyResolve; const ready=new Promise(r=>readyResolve=r);
function loginScreen(show,msg){
  let el=document.getElementById('loginGate');
  if(!show){ if(el) el.remove(); return; }
  if(!el){ el=document.createElement('div'); el.id='loginGate'; document.body.appendChild(el); }
  el.innerHTML=`<div class="lg-box"><div class="lg-logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg></div>
    <h1>Central</h1><p>Suas tarefas, áreas e prazos, no PC e no celular.</p>
    <button id="lgBtn" type="button"><svg viewBox="0 0 48 48" width="20" height="20"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Entrar com Google</button>
    <div class="lg-msg">${msg||''}</div></div>`;
  el.querySelector('#lgBtn').onclick=async()=>{
    el.querySelector('.lg-msg').textContent='';
    try{ const r=await auth.signInWithPopup(provider); setTok(r.credential); }
    catch(e){ if(e&&e.code==='auth/popup-blocked'){ try{ await auth.signInWithRedirect(provider); }catch(_){} }
      else if(e&&e.code!=='auth/popup-closed-by-user'&&e.code!=='auth/cancelled-popup-request') el.querySelector('.lg-msg').textContent='Não foi possível entrar: '+(e.message||e.code); }
  };
}
auth.getRedirectResult().then(r=>{ if(r&&r.credential) setTok(r.credential); }).catch(()=>{});
let started=false;
auth.onAuthStateChanged(u=>{
  if(u){ loginScreen(false); if(!started){ started=true; readyResolve(u); } else if(window.__centralUid&&window.__centralUid!==u.uid) location.reload(); window.__centralUid=u.uid; }
  else { if(started){ location.reload(); return; } loginScreen(true); }
});
window.centralSignOut=()=>{ try{ localStorage.removeItem(TK); }catch(e){} auth.signOut(); };

/* ---- banco (mesma interface do runtime do Claude) ---- */
async function makeDb(){
  const u=await ready, base=fs.collection('users').doc(u.uid);
  const ref=p=>{ const [c,id]=p.split('/'); return base.collection(c).doc(id); };
  return { doc:ref, collection:n=>base.collection(n) };
}

/* ---- Google Agenda via API (mesma interface das ferramentas do conector) ---- */
const API='https://www.googleapis.com/calendar/v3/calendars/primary/events';
const rfc=local=>new Date(local).toISOString();
function evBody(a){
  const b={};
  if('summary' in a) b.summary=a.summary;
  if('description' in a) b.description=a.description;
  if(a.startTime){ if(a.allDay){ b.start={date:a.startTime.slice(0,10)}; b.end={date:(a.endTime||a.startTime).slice(0,10)}; }
    else { b.start={dateTime:a.startTime,timeZone:TZ}; b.end={dateTime:a.endTime||a.startTime,timeZone:TZ}; } }
  if('useDefaultReminders' in a||a.overrideReminders) b.reminders={useDefault:!!a.useDefaultReminders,overrides:a.overrideReminders||[]};
  return b;
}
async function gfetch(url,opt){
  const t=getTok(); if(!t) throw {code:'needs_reauth',message:'Conecte o Google Agenda.'};
  let r; try{ r=await fetch(url,Object.assign({},opt,{headers:Object.assign({'Authorization':'Bearer '+t,'Content-Type':'application/json'},(opt&&opt.headers)||{})})); }catch(e){ throw {code:'upstream_error',message:'Sem conexão com o Google. Confira a internet.'}; }
  if(r.status===401){ try{ localStorage.removeItem(TK);}catch(e){} throw {code:'needs_reauth',message:'Sessão do Google expirou.'}; }
  if(r.status===403){ try{ localStorage.removeItem(TK);}catch(e){} throw {code:'needs_reauth',message:'Permissão do Google Agenda não concedida.'}; }
  if(r.status===404||r.status===410) throw {code:'tool_error',message:'not found'};
  if(!r.ok){ let m=''; try{ m=(await r.json()).error.message; }catch(e){} throw {code:'upstream_error',message:m||('Erro '+r.status)}; }
  return r.status===204?null:r.json();
}
const gmcp={ async callTool(server,name,a){
  a=a||{};
  if(name==='list_events'){ const q=new URLSearchParams({timeMin:rfc(a.startTime),timeMax:rfc(a.endTime),singleEvents:'true',orderBy:'startTime',maxResults:String(a.pageSize||250)});
    const j=await gfetch(API+'?'+q.toString()); return {payload:{events:(j&&j.items)||[]}}; }
  if(name==='create_event'){ const j=await gfetch(API,{method:'POST',body:JSON.stringify(evBody(a))}); return {payload:j}; }
  if(name==='update_event'){ const j=await gfetch(API+'/'+encodeURIComponent(a.eventId),{method:'PATCH',body:JSON.stringify(evBody(a))}); return {payload:j}; }
  if(name==='delete_event'){ await gfetch(API+'/'+encodeURIComponent(a.eventId),{method:'DELETE'}); return {payload:{ok:true}}; }
  throw {code:'tool_error',message:'Ferramenta desconhecida'};
}};

/* ---- ditado por voz (Chrome) ---- */
function makeDictation(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR) return null;
  const L={p:[],f:[],s:[]}; let rec=null;
  return {
    onPartial:f=>L.p.push(f), onFinal:f=>L.f.push(f), onState:f=>L.s.push(f),
    start(){ return new Promise((res,rej)=>{ rec=new SR(); rec.lang='pt-BR'; rec.interimResults=true; rec.continuous=false;
      rec.onstart=()=>{ L.s.forEach(f=>f({state:'listening'})); res(); };
      rec.onresult=e=>{ let fin='',par=''; for(let i=e.resultIndex;i<e.results.length;i++){ const t=e.results[i][0].transcript; if(e.results[i].isFinal) fin+=t; else par+=t; }
        if(par) L.p.forEach(f=>f({text:par})); if(fin) L.f.forEach(f=>f({text:fin})); };
      rec.onerror=e=>{ if(e.error==='not-allowed') rej({code:'not_granted'}); };
      rec.onend=()=>L.s.forEach(f=>f({state:'idle'}));
      try{ rec.start(); }catch(e){ rej(e); } }); },
    stop(){ try{ rec&&rec.stop(); }catch(e){} return Promise.resolve(); }
  };
}

window.claude={ async use(name){
  if(name==='db') return makeDb();
  if(name==='mcp'){ await ready; return gmcp; }
  if(name==='dictation') return makeDictation();
  return null;
}};

/* atualização automática: ao voltar para o app, verifica se há versão nova */
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').then(reg=>{
    document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') reg.update().catch(()=>{}); });
  }).catch(()=>{});
  let reloaded=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{ if(reloaded) return; reloaded=true; if(!document.querySelector('#modalBg:not(.hidden)')&&!(document.activeElement&&/INPUT|TEXTAREA/.test(document.activeElement.tagName))) location.reload(); });
}
})();
