import {detailCandidates,detailScope,materializeEvents,restoreApprovedCandidates} from './share-details.js';
import * as sdk from './vendor/firebase.js';
import {publicEvent,exclusionReason,publicSummary,summaryScope,selectedSummaries,newToken,digest,scopeFrom,normalizeScope,selectedItems,pageChunks} from './share-model.js';
export const configRef=(db,uid)=>sdk.doc(db,'users',uid,'sharing','current');
const sourceRef=(db,uid)=>sdk.doc(db,'users',uid,'sharing','source');
export async function supportsSharing(db,uid){try{await sdk.getDocFromServer(configRef(db,uid));return true;}catch(e){if(e.code==='permission-denied')return false;throw e;}}
export async function supportsFullSharing(db,uid){try{await sdk.getDocFromServer(sourceRef(db,uid));return true;}catch(e){if(e.code==='permission-denied')return false;throw e;}}
// Read every dependency before the caller writes its private record.
export async function preparePublicUpdate(tx,db,uid,recordId,value,full=false,kind='events'){
 const snap=await tx.get(configRef(db,uid));const config=snap.exists()?snap.data():null;
 const source=full?await tx.get(sourceRef(db,uid)):null;
 const legacyIndex=kind==='events'&&config?.version!==2&&config?.active?config.selected.indexOf(recordId):-1;
 return ()=>{if(source?.exists())tx.set(sourceRef(db,uid),{revision:source.data().revision+1});if(legacyIndex>=0)tx.set(sdk.doc(db,'publicTrips',config.token,'items',String(legacyIndex)),publicEvent(value)||{hidden:true});};
}
async function ensureSource(db,uid){await sdk.runTransaction(db,async tx=>{const snap=await tx.get(sourceRef(db,uid));if(!snap.exists())tx.set(sourceRef(db,uid),{revision:0});});}
export async function loadSharing(db,uid){
 await ensureSource(db,uid);
 for(let attempt=0;attempt<4;attempt++){
  const before=await sdk.getDocFromServer(sourceRef(db,uid));const config=await sdk.getDocFromServer(configRef(db,uid));
  const records=await sdk.getDocsFromServer(sdk.collection(db,'users',uid,'records'));const after=await sdk.getDocFromServer(sourceRef(db,uid));
  if(before.data().revision===after.data().revision){const bookings=records.docs.filter(d=>d.data().kind==='bookings'&&!d.data().deleted).map(d=>d.data().payload);const events=await Promise.all(records.docs.filter(d=>d.data().kind==='events'&&!d.data().deleted).map(async d=>({id:d.id,value:publicEvent(d.data().payload),reason:exclusionReason(d.data().payload),title:d.data().payload.title,date:d.data().payload.date,candidates:await detailCandidates(d.id,d.data().payload,bookings)})));await restoreApprovedCandidates(events,config.exists()?config.data():null,async token=>{const saved=await sdk.getDocFromServer(sdk.doc(db,'users',uid,'detailApprovals',token));return saved.exists()?saved.data():null;});return {sourceRevision:after.data().revision,config:config.exists()?config.data():null,...Object.fromEntries(['bookings','checks'].map(kind=>[kind,records.docs.filter(d=>d.data().kind===kind&&!d.data().deleted).map(d=>({id:d.id,value:publicSummary(kind,d.data().payload),title:d.data().payload.title}))])),events};}
 }
 throw Error('일정이 동기화 중입니다. 잠시 후 다시 불러와 주세요.');
}
export async function publishSharing(db,uid,loaded,scope,rotate=false){
 scope={...normalizeScope(scope),...summaryScope(scope),...detailScope(scope)};if(scope.selected.length+scope.excluded.length+scope.bookingSelected.length+scope.checkSelected.length+scope.detailApprovals.length*2>12000)throw Error('선택·제외 목록의 합계는 12,000단위 (상세 승인은 2단위) 이하여야 합니다. 공유 범위를 줄여 주세요.');const items=selectedItems(materializeEvents(loaded,scope),scope),summaries=selectedSummaries(loaded,scope),hash=await digest({items,summaries}),expected=loaded.config?.revision||0;
 for(const item of items)if(new TextEncoder().encode(JSON.stringify(item)).length>800000)throw Error('일정 상세 공개 내용이 너무 큽니다. 공개할 상세 항목을 줄여 주세요. 원본은 유지됩니다.');
 const token=rotate||!loaded.config?.active?newToken():loaded.config.token,generation=newToken();
 const same=loaded.config?.version===2&&loaded.config.active&&token===loaded.config.token&&loaded.config.digest===hash;
 const next={version:2,token,...scope,active:true,revision:expected+1,sourceRevision:loaded.sourceRevision,digest:hash,generation:same?loaded.config.generation:generation};
 // Retain the exact approved value privately. New edits cannot replace this immutable snapshot.
 for(const event of loaded.events)for(const c of event.candidates||[]){const approval=scope.detailApprovals.includes(c.approval)?{token:c.approval,value:c.value}:c.previous&&scope.detailApprovals.includes(c.previous.approval)?{token:c.previous.approval,value:c.previous.value}:null;if(!approval)continue;const ref=sdk.doc(db,'users',uid,'detailApprovals',approval.token),saved=await sdk.getDocFromServer(ref);if(!saved.exists())await sdk.setDoc(ref,{field:c.field,value:approval.value});}
 if(!same){
  // Claim a new opaque token privately. Unfinished generations are never readable.
  if(token!==loaded.config?.token)await sdk.setDoc(sdk.doc(db,'shareKeys',token),{uid});
  const pages=[];for(const chunk of pageChunks(items)){
   const id=await digest(chunk),ref=sdk.doc(db,'publicTrips',token,'pages',id);pages.push(id);
   const existing=await sdk.getDocFromServer(ref);if(!existing.exists())await sdk.setDoc(ref,{items:chunk});
  }
  const summaryPages=[];for(let i=0;i<summaries.length;i+=5){const items=summaries.slice(i,i+5),id=await digest(items),ref=sdk.doc(db,'publicTrips',token,'summaries',id);summaryPages.push(id);const existing=await sdk.getDocFromServer(ref);if(!existing.exists())await sdk.setDoc(ref,{items});}
  await sdk.setDoc(sdk.doc(db,'publicTrips',token,'generations',generation),{pages,count:items.length,summaries:summaryPages,summaryCount:summaries.length});
 }
 // A single pointer/config commit makes all staged pages visible together.
 await sdk.runTransaction(db,async tx=>{
  const [cfg,source]=await Promise.all([tx.get(configRef(db,uid)),tx.get(sourceRef(db,uid))]);
  if((cfg.exists()?cfg.data().revision:0)!==expected)throw Error('다른 기기에서 공유 설정이 바뀌었습니다. 다시 불러와 주세요.');
  if(source.data().revision!==loaded.sourceRevision)throw Error('일정이 변경되었습니다. 다시 불러와 미리보기를 확인해 주세요.');
  if(loaded.config?.token&&loaded.config.token!==token)tx.set(sdk.doc(db,'publicTrips',loaded.config.token),loaded.config.version===2?{version:2,active:false,generation:loaded.config.generation}:{active:false,slots:[]});
  tx.set(configRef(db,uid),next);if(!same)tx.set(sdk.doc(db,'publicTrips',token),{version:2,active:true,generation});
 });return token;
}
export async function disableSharing(db,uid,expected){return sdk.runTransaction(db,async tx=>{const ref=configRef(db,uid),snap=await tx.get(ref);if(!snap.exists())return;const old=snap.data();if(old.revision!==expected)throw Error('다른 기기에서 공유 설정이 바뀌었습니다. 다시 불러와 주세요.');tx.set(ref,{...old,active:false,revision:old.revision+1});tx.set(sdk.doc(db,'publicTrips',old.token),old.version===2?{version:2,active:false,generation:old.generation}:{active:false,slots:[]});});}
let timer,busy=false;
export function scheduleSharedRefresh(db,uid,valid,onError=()=>{}){clearTimeout(timer);timer=setTimeout(async()=>{if(busy){scheduleSharedRefresh(db,uid,valid,onError);return;}if(!valid())return;busy=true;try{const snap=await sdk.getDocFromServer(configRef(db,uid));if(!snap.exists()||snap.data().version!==2||!snap.data().active)return;const loaded=await loadSharing(db,uid);if(!valid()||!loaded.config?.active||loaded.config.version!==2)return;if(loaded.sourceRevision===loaded.config.sourceRevision){onError(null);return;}onError({message:'최신 공개 내용을 게시 중입니다. 잠시 앱을 열어 두세요.'});await publishSharing(db,uid,loaded,{...scopeFrom(loaded.config),...summaryScope(loaded.config),...detailScope(loaded.config)});onError(null);}catch(e){if(valid()){onError(e);if(!['permission-denied','resource-exhausted','invalid-argument'].includes(e.code))scheduleSharedRefresh(db,uid,valid,onError);}}finally{busy=false;}},1200);}
