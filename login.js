(function(){
  const app=document.getElementById('app');
  const db=window.familyLiftSupabase;
  window.FamilyLiftAuth={profile:null,members:[]};
  function loginMarkup(message=''){app.innerHTML=`<main class="shell login-shell"><section class="glass login-card"><div class="brand-lockup"><div class="brand-wordmark"><span>Family</span><em>Lift</em></div><div class="brand-tagline">TOGETHER FURTHER</div></div><h1>Willkommen.</h1><p class="muted">Melde dich mit deinem persönlichen FamilyLift-Zugang an.</p><form id="familyLiftLogin"><div class="field"><label>E-Mail</label><input id="loginEmail" type="email" autocomplete="username" required></div><div class="field"><label>Passwort</label><input id="loginPassword" type="password" minlength="10" autocomplete="current-password" required></div>${message?`<div class="error">${message}</div>`:''}<button id="loginSubmit" class="primary">ANMELDEN</button></form></section></main>`;document.getElementById('familyLiftLogin').onsubmit=submit}
  async function submit(e){e.preventDefault();const b=document.getElementById('loginSubmit');b.disabled=true;b.textContent='ANMELDUNG LÄUFT …';const {error}=await window.FamilyLiftData.signIn(document.getElementById('loginEmail').value.trim(),document.getElementById('loginPassword').value);if(error){loginMarkup(error.message);return}await start()}
  async function loadApp(){if(document.querySelector('script[data-familylift-app]'))return;const s=document.createElement('script');s.src='app.js';s.dataset.familyliftApp='1';document.body.appendChild(s)}
  async function start(){try{const profile=await window.FamilyLiftData.getCurrentProfile();if(!profile){loginMarkup('Kein FamilyLift-Profil gefunden.');return}const members=await window.FamilyLiftData.getFamilyMembers(profile.family_id);window.FamilyLiftAuth={profile:{...profile,display_name:profile.name,can_drive:profile.canDrive,is_admin:profile.isAdmin},members};await loadApp();setTimeout(()=>window.FamilyLiftDiagnostics?.render(),100)}catch(err){loginMarkup(err.message||'Backend konnte nicht geladen werden.')}}
  window.FamilyLiftLogout=async()=>{await window.FamilyLiftData.signOut();location.reload()};
  if(!db){loginMarkup('Supabase-Verbindung nicht verfügbar.');return}
  window.FamilyLiftData.getSession().then(({data})=>data.session?start():loginMarkup()).catch(e=>loginMarkup(e.message));
})();
