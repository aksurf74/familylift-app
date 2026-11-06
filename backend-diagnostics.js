(function(){
  if(new URLSearchParams(location.search).get('familyliftTest')!=='1')return;
  window.FamilyLiftDiagnostics={
    async render(){const old=document.getElementById('backendDiagnostics');old?.remove();const p=window.FamilyLiftAuth?.profile;const el=document.createElement('aside');el.id='backendDiagnostics';el.className='backend-diagnostics';el.innerHTML=`<b>BACKEND DIAGNOSTICS · B3.1</b><span>User: ${p?.display_name||'–'}</span><span>can_drive: ${String(p?.can_drive??'–')}</span><span>Auth: ${p?'connected':'signed out'}</span><span>Realtime: not enabled</span>`;document.body.appendChild(el)}
  };
})();
