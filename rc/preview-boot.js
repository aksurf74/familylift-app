(function(){
  const root=document.getElementById('app');
  window.FamilyLiftAuth={profile:null,members:[]};
  function login(message=''){
    root.innerHTML=`<main class="shell login-shell"><section class="glass login-card"><div class="brand-lockup"><div class="brand-wordmark"><span>Family</span><em>Lift</em></div><div class="brand-tagline">TOGETHER FURTHER</div></div><h1>RC1.1 Preview</h1><p class="muted">Separater Safari-Test. Die Live-PWA bleibt unangetastet.</p><form id="rcLogin"><div class="field"><label>E-Mail</label><input id="rcEmail" type="email" autocomplete="username" required></div><div class="field"><label>Passwort</label><input id="rcPassword" type="password" minlength="10" autocomplete="current-password" required></div>${message?`<div class="error">${message}</div>`:''}<button id="rcLoginButton" class="primary">ANMELDEN</button></form></section></main>`;
    document.getElementById('rcLogin').onsubmit=submit;
  }
  async function submit(e){e.preventDefault();const b=document.getElementById('rcLoginButton');b.disabled=true;b.textContent='ANMELDUNG LÄUFT …';const {error}=await FamilyLiftData.signIn(document.getElementById('rcEmail').value.trim(),document.getElementById('rcPassword').value);if(error)return login(error.message);await start()}
  async function start(){
    try{
      const p=await FamilyLiftData.getCurrentProfile();if(!p)return login('Kein FamilyLift-Profil gefunden.');
      const members=await FamilyLiftData.getFamilyMembers(p.family_id);
      window.FamilyLiftAuth={profile:p,members};
      const s=document.createElement('script');s.src='rc/app.js?v=rc1.1';document.body.appendChild(s);
    }catch(e){login(e.message||'Preview konnte nicht geladen werden.')}
  }
  window.FamilyLiftLogout=async()=>{await FamilyLiftData.signOut();location.href='rc/'};
  if(!window.familyLiftSupabase)return login('Supabase-Verbindung nicht verfügbar.');
  FamilyLiftData.getSession().then(({data})=>data.session?start():login()).catch(e=>login(e.message));
})();
