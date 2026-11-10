import * as sdk from './vendor/firebase.js';
import {publicEvent,newToken,SHARE_LIMIT} from './share-model.js';
export const configRef=(db,uid)=>sdk.doc(db,'users',uid,'sharing','current');
// Compatibility with the old deny-all sharing rules. Never weaken private sync rules.
export async function supportsSharing(db,uid){try{await sdk.getDocFromServer(configRef(db,uid));return true;}catch(e){if(e.code==='permission-denied')return false;throw e;}}
export async function preparePublicUpdate(tx,db,uid,recordId,value){
 const snap=await tx.get(configRef(db,uid));if(!snap.exists())return null;const config=snap.data();
 const index=config.selected.indexOf(recordId);if(!config.active||index<0)return null;
 const ref=sdk.doc(db,'publicTrips',config.token,'items',String(index));
 return ()=>tx.set(ref,publicEvent(value)||{hidden:true});
}
export async function loadSharing(db,uid){const [config,records]=await Promise.all([sdk.getDocFromServer(configRef(db,uid)),sdk.getDocsFromServer(sdk.collection(db,'users',uid,'records'))]);return {config:config.exists()?config.data():null,events:records.docs.filter(d=>d.data().kind==='events'&&!d.data().deleted).map(d=>({id:d.id,value:publicEvent(d.data().payload)}))};}
export async function publishSharing(db,uid,loaded,selected,rotate=false){
 if(!selected.length||selected.length>SHARE_LIMIT)throw Error(`1~${SHARE_LIMIT}개 일정을 선택해 주세요.`);
 const expected=loaded.config?.revision||0,token=rotate||!loaded.config?.active?newToken():loaded.config.token;
 return sdk.runTransaction(db,async tx=>{
  const ref=configRef(db,uid),snap=await tx.get(ref),old=snap.exists()?snap.data():null;
  if((old?.revision||0)!==expected)throw Error('다른 기기에서 공유 설정이 바뀌었습니다. 다시 불러와 주세요.');
  const snapshots=await Promise.all(selected.map(id=>tx.get(sdk.doc(db,'users',uid,'records',id))));
  const items=snapshots.map((s,i)=>{const value=s.exists()&&!s.data().deleted?publicEvent(s.data().payload):null;const preview=loaded.events.find(e=>e.id===selected[i])?.value;if(!value||JSON.stringify(value)!==JSON.stringify(preview))throw Error('일정 내용이 변경되었거나 공개할 수 없습니다. 다시 불러와 미리보기를 확인해 주세요.');return value;});
  if(old?.token&&old.token!==token)tx.set(sdk.doc(db,'publicTrips',old.token),{active:false,slots:[]});
  if(token!==old?.token)tx.set(sdk.doc(db,'shareKeys',token),{uid});
  tx.set(ref,{token,selected,active:true,revision:expected+1});tx.set(sdk.doc(db,'publicTrips',token),{active:true,slots:items.map((_,i)=>String(i))});items.forEach((item,i)=>tx.set(sdk.doc(db,'publicTrips',token,'items',String(i)),item));return token;
 });
}
export async function disableSharing(db,uid,expected){return sdk.runTransaction(db,async tx=>{const ref=configRef(db,uid),snap=await tx.get(ref);if(!snap.exists())return;const old=snap.data();if(old.revision!==expected)throw Error('다른 기기에서 공유 설정이 바뀌었습니다. 다시 불러와 주세요.');tx.set(ref,{...old,active:false,revision:old.revision+1});tx.set(sdk.doc(db,'publicTrips',old.token),{active:false,slots:[]});});}
