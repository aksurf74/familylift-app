(function(){
  'use strict';
  let choice=null;
  function state(){return window.FamilyLiftAuth||window.FamilyLiftState||{};}
  function profile(){return state().profile||null;}
  function rides(){return window.FamilyLiftRemoteRides||state().rides||[];}
  function currentRide(){
    const p=profile(); if(!p)return null;
    const id=p.id;
    return rides().find(r=>{
      if(['completed','cancelled','rejected'].includes(r.status))return false;
      if(r.requesterId===id)return true;
      if(r.driverId)return r.driverId===id;
      return (p.canDrive??p.can_drive) && r.requesterId!==id;
    })||null;
  }
  function mark(button){
    document.querySelectorAll('[data-eta]').forEach(b=>b.classList.remove('selected'));
    button.classList.add('selected');
    const custom=document.querySelector('#customEta');
    if(custom)custom.classList.toggle('hidden',choice!=='custom');
  }
  function numericEta(){
    if(choice==='custom'){
      const n=Number(document.querySelector('#customEta')?.value);
      return Number.isInteger(n)&&n>=1&&n<=180?n:null;
    }
    const n=Number(choice);return Number.isInteger(n)&&n>=1&&n<=180?n:null;
  }
  async function handlePrimary(button){
    const r=currentRide(),p=profile();
    if(!r||!p)return false;
    const text=button.textContent.trim().toUpperCase();
    if(!['ANNEHMEN','FAHRT ANBIETEN','ANGEBOT AKTUALISIEREN'].includes(text))return false;
    const eta=numericEta();
    if(!eta){alert('Bitte zuerst eine ETA zwischen 1 und 180 Minuten auswählen.');return true;}
    button.disabled=true;button.textContent='WIRD GESPEICHERT …';
    try{
      if(r.driverId===p.id){
        await FamilyLiftData.acceptDirectRide(r.id,eta);
      }else{
        const own=(r.proposals||[]).find(x=>x.driverId===p.id);
        if(own)await FamilyLiftData.updateRideOffer(own.id,r.id,p.id,eta);
        else await FamilyLiftData.createRideOffer(r.id,p.id,eta);
      }
      choice=null;
      if(window.FamilyLiftReload)await window.FamilyLiftReload();
      else location.reload();
    }catch(error){
      button.disabled=false;button.textContent=text;
      alert('ETA konnte nicht gespeichert werden: '+(error?.message||error));
    }
    return true;
  }
  document.addEventListener('click',async event=>{
    const etaButton=event.target.closest?.('[data-eta]');
    if(etaButton){
      event.preventDefault();event.stopImmediatePropagation();
      choice=etaButton.dataset.eta==='custom'?'custom':Number(etaButton.dataset.eta);
      mark(etaButton);
      if(choice==='custom')setTimeout(()=>document.querySelector('#customEta')?.focus(),0);
      return;
    }
    const primary=event.target.closest?.('#offer');
    if(primary){
      event.preventDefault();event.stopImmediatePropagation();
      await handlePrimary(primary);
    }
  },true);
  // Re-apply visible selection after app re-renders for unrelated reasons.
  const observer=new MutationObserver(()=>{
    if(choice===null)return;
    const b=document.querySelector(`[data-eta="${choice}"]`);
    if(b&&!b.classList.contains('selected'))mark(b);
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.FamilyLiftEtaHotfix={version:'B3.2.2',getChoice:()=>choice};
})();
