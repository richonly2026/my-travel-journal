import * as sdk from './vendor/firebase.js';
import {configRef,loadSharing,publishSharing,disableSharing} from './share-service.js';
import {maskedScope} from './share-sanitize.js';
import {escapeHTML as esc} from './share-model.js';
export async function openShareManager(db,uid){
 let dialog=document.querySelector('#share-manager');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='share-manager';document.body.append(dialog);}
 dialog.stopShareListeners?.();
 dialog.innerHTML='<div class="share-compact-head"><h2>여행 일정 공유</h2><div data-share-state>확인 중…</div><button data-close aria-label="닫기">×</button></div><div data-share-link-host></div><p data-share-error role="status"></p>';
 let current=null,verified=false,busy=false,closed=false,epoch=0;
 const state=dialog.querySelector('[data-share-state]'),host=dialog.querySelector('[data-share-link-host]'),error=dialog.querySelector('[data-share-error]');
 const url=()=>{const u=new URL('share.html',location.href);u.hash=current.token;return u.href;};
 function render(){
  const active=verified&&current?.active;
  state.innerHTML=verified?'<span class="share-status">'+(active?'공유 중':'공유 안 함')+'</span><button class="small" '+(busy?'disabled ':'')+(active?'data-disable-share>공유 중단':'data-start-share>공유 시작')+'</button>':'<span>상태 확인 중…</span>';
  host.innerHTML=active?'<div class="share-link-row"><input readonly aria-label="공유 링크" value="'+esc(url())+'"><button data-copy-share aria-label="공유 링크 복사">⧉</button></div>':'';
 }
 const fail=e=>{verified=false;render();error.textContent='공유 상태를 확인하지 못했습니다. 네트워크와 보안 규칙을 확인해 주세요. ('+(e.code||'state-error')+')';};
 async function refresh(){
  const run=++epoch;
  try{
   const snap=await sdk.getDocFromServer(configRef(db,uid)),value=snap.exists()?snap.data():null;
   // An inactive public document is intentionally unreadable. Its private config is authoritative.
   if(value?.active){const root=await sdk.getDocFromServer(sdk.doc(db,'publicTrips',value.token));if(!root.exists()||!root.data().active||(value.version===2&&root.data().generation!==value.generation))throw Error('공유 상태 불일치');}
   if(closed||run!==epoch)return;current=value;verified=true;render();
  }catch(e){if(!closed&&run===epoch)fail(e);}
 }
 const stopConfig=sdk.onSnapshot(configRef(db,uid),{includeMetadataChanges:true},snap=>{
  if(!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites)void refresh();
 },e=>{if(!closed)fail(e);});
 dialog.stopShareListeners=()=>{closed=true;epoch++;stopConfig();};dialog.onclose=()=>{if(!dialog.open)dialog.stopShareListeners?.();};dialog.showModal();
 dialog.onclick=async e=>{
  const button=e.target.closest('button');if(!button||busy)return;
  if(button.hasAttribute('data-close')){dialog.close();return;}
  if(button.hasAttribute('data-copy-share')){try{await navigator.clipboard.writeText(url());button.textContent='✓';button.setAttribute('aria-label','복사 완료');}catch{error.textContent='복사하지 못했습니다. 링크를 선택해 복사해 주세요.';}return;}
  if(!verified)return;
  busy=true;dialog.setAttribute('aria-busy','true');render();error.textContent='';
  try{
   if(button.hasAttribute('data-start-share')){
    const loaded=await loadSharing(db,uid,{legacy:false});
    if(loaded.config?.active)throw Error('다른 기기에서 이미 공유를 시작했습니다. 현재 링크를 사용해 주세요.');
    if(confirm('전체 여행을 공유할까요? 이후 변경도 자동 반영됩니다. 민감정보는 자동 처리하지만 자유 입력 문장의 개인정보를 모두 식별할 수는 없습니다.'))
     await publishSharing(db,uid,loaded,maskedScope());
   }else if(button.hasAttribute('data-disable-share')){
    const snap=await sdk.getDocFromServer(configRef(db,uid));if(snap.exists())await disableSharing(db,uid,snap.data().revision);
   }
  }catch(e){error.textContent='공유 변경 실패: '+(e.code==='permission-denied'?'최신 통합 규칙과 로그인 상태를 확인해 주세요.':e.message);}
  finally{await refresh();busy=false;dialog.removeAttribute('aria-busy');render();}
 };
}
