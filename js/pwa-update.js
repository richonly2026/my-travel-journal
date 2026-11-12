// Reload only when the current document has no open work or pending writes.
export function installSafeUpdates(syncBlocked){
 if(!('serviceWorker' in navigator))return;
 let registration,changed=false,requested=false,lastInput=Date.now(),hadController=!!navigator.serviceWorker.controller;
 const blocked=()=>document.hidden||Date.now()-lastInput<2000||!!document.querySelector('dialog[open],[aria-busy="true"]')||!!document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')||[...document.querySelectorAll('.inline-task-entry:not([hidden]) input')].some(input=>input.value.length>0)||syncBlocked();
 function attempt(){
  if(!changed&&!registration?.waiting)return;
  if(blocked())return;
  if(changed){location.reload();return;}
  if(!requested){requested=true;registration.waiting.postMessage({type:'SKIP_WAITING'});}
 }
 function offer(){
  if(!registration?.waiting)return;
  let status=document.querySelector('#app-update');
  if(!status){status=document.createElement('aside');status.id='app-update';status.setAttribute('role','status');status.textContent='새 버전 준비 완료 · 입력과 동기화가 끝나면 자동 적용됩니다.';document.body.append(status);}
  attempt();
 }
 document.addEventListener('input',()=>{lastInput=Date.now();},true);
 document.addEventListener('keydown',()=>{lastInput=Date.now();},true);
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(!hadController){hadController=true;return;}
  changed=true;attempt();
 });
 navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
  registration=reg;offer();reg.update().catch(()=>{});
  reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)offer();});});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){reg.update().catch(()=>{});attempt();}});
 }).catch(()=>{});
 setInterval(attempt,2000);
}
