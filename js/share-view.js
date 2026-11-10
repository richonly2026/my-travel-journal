import * as sdk from './vendor/firebase.js';
import {firebaseConfig} from './firebase-config.js';
import {publicMarkup} from './share-model.js';
const db=sdk.getFirestore(sdk.initializeApp(firebaseConfig)),status=document.querySelector('#share-status'),content=document.querySelector('#shared-events');let unsubscribe,children=[],epoch=0,contentEpoch=0;
function clear(message){content.replaceChildren();status.textContent=message;}
function stop(){epoch++;unsubscribe?.();children.forEach(fn=>fn());children=[];}
function listen(){stop();const run=epoch;clear('공유 일정을 확인하고 있습니다.');const token=location.hash.slice(1);if(!/^[0-9a-f]{64}$/.test(token)){clear('올바른 공유 링크가 아닙니다.');return;}if(!navigator.onLine){clear('인터넷 연결 후 공유 일정을 확인할 수 있습니다.');return;}
 unsubscribe=sdk.onSnapshot(sdk.doc(db,'publicTrips',token),{includeMetadataChanges:true},snap=>{if(run!==epoch)return;const renderEpoch=++contentEpoch;children.forEach(fn=>fn());children=[];
 if(snap.metadata.fromCache||snap.metadata.hasPendingWrites){clear('서버에서 공개 상태를 확인하고 있습니다.');return;}
 if(!snap.exists()||!snap.data().active){clear('공유가 중단되었거나 사용할 수 없는 링크입니다.');return;}
 const slots=snap.data().slots,items=new Map();clear('최신 공개 일정을 불러오는 중입니다.');
 for(const slot of slots)children.push(sdk.onSnapshot(sdk.doc(db,'publicTrips',token,'items',slot),{includeMetadataChanges:true},item=>{if(run!==epoch||renderEpoch!==contentEpoch)return;if(item.metadata.fromCache||item.metadata.hasPendingWrites){items.delete(slot);clear('서버에서 공개 상태를 확인하고 있습니다.');return;}items.set(slot,item.exists()&&!item.data().hidden?item.data():null);if(items.size===slots.length){content.innerHTML=publicMarkup([...items.values()]);status.textContent='최신 공개 일정';}},()=>{stop();clear('공유가 중단되었거나 접근할 수 없습니다. 연결 상태를 확인해 주세요.');}));
 },()=>{stop();clear('공유가 중단되었거나 접근할 수 없습니다. 연결 상태를 확인해 주세요.');});}
window.addEventListener('hashchange',listen);window.addEventListener('online',listen);window.addEventListener('offline',()=>{stop();clear('인터넷 연결이 끊겨 공개 상태를 확인할 수 없습니다.');});document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();clear('공개 상태를 다시 확인합니다.');}else listen();});listen();
