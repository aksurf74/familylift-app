(function(){
  'use strict';
  const root=document.getElementById('app');
  function show(title,detail){
    root.innerHTML=`<main class="shell"><section class="glass"><h1>${title}</h1><div class="error">${detail||''}</div></section></main>`;
  }
  window.addEventListener('error',e=>show('RC1.1 konnte nicht starten',e.message||'JavaScript-Fehler'));
  window.addEventListener('unhandledrejection',e=>show('RC1.1 Backend-Fehler',e.reason?.message||String(e.reason||'Unbekannter Fehler')));
  if(!window.familyLiftSupabase){show('RC1.1 konnte nicht starten','Supabase Client fehlt.');return;}
  if(!window.FamilyLiftData){show('RC1.1 konnte nicht starten','familylift-data.js wurde nicht geladen.');return;}
  window.FamilyLiftAuth={profile:null,members:[]};
  window.FamilyLiftState={profile:null,members:[],rides:[]};
  function login(message=''){
    root.innerHTML=`<main class="shell login-shell"><section class="glass login-card"><div class="brand-lockup"><div class="brand-wordmark"><span>Family</span><em>Lift</em></div><div class="brand-tagline">TOGETHER FURTHER</div></div><h1>RC1.1 Preview</h1><p class="muted">Separater Safari-Test. Live bleibt unangetastet.</p><form id="rcLogin"><div class="field"><label>E-Mail</label><input id="rcEmail" type="email" autocomplete="username" required></div><div class="field"><label>Passwort</label><input id="rcPassword" type="password" minlength="10" autocomplete="current-password" required></div>${message?`<div class="error">${message}</div>`:''}<button id="rcLoginButton" class="primary" type="submit">ANMELDEN</button></form></section></main>`;
    document.getElementById('rcLogin').addEventListener('submit',submit);
  }
  async function submit(e){
    e.preventDefault();
    const b=document.getElementById('rcLoginButton');b.disabled=true;b.textContent='ANMELDUNG LÄUFT …';
    const {error}=await FamilyLiftData.signIn(document.getElementById('rcEmail').value.trim(),document.getElementById('rcPassword').value);
    if(error){login(error.message);return;}
    await start();
  }
  async function start(){
    try{
      const p=await FamilyLiftData.getCurrentProfile();
      if(!p){login('Kein FamilyLift-Profil gefunden.');return;}
      const [members,rides]=await Promise.all([
        FamilyLiftData.getFamilyMembers(p.family_id),
        FamilyLiftData.getRides ? FamilyLiftData.getRides() : Promise.resolve([])
      ]);
      window.FamilyLiftAuth={profile:p,members};
      window.FamilyLiftState={profile:p,members,rides};
      const old=document.querySelector('script[data-rc-app]');if(old)old.remove();
      const s=document.createElement('script');s.src='./app.js?v=rc1.1-final';s.dataset.rcApp='1';s.onerror=()=>show('RC1.1 konnte nicht starten','rc/app.js wurde nicht geladen.');document.body.appendChild(s);
    }catch(e){show('RC1.1 Backend-Fehler',e.message||String(e));}
  }
  window.FamilyLiftReload=async()=>{
    if(FamilyLiftData.getRides){
      window.FamilyLiftState.rides=await FamilyLiftData.getRides();
      window.FamilyLiftRender?.();
    }
  };
  window.FamilyLiftLogout=async()=>{await FamilyLiftData.signOut();location.reload();};
  FamilyLiftData.getSession().then(({data,error})=>{if(error)throw error;return data.session?start():login();}).catch(e=>show('RC1.1 Session-Fehler',e.message||String(e)));
})();
