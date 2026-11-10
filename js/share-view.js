import * as sdk from './vendor/firebase.js';
import {firebaseConfig} from './firebase-config.js';
import {shareScreen,shareNavigation,views} from './share-layout.js';
import {dates} from './trip-calendar.js';
const db=sdk.getFirestore(sdk.initializeApp(firebaseConfig)),status=document.querySelector('#share-status'),content=document.querySelector('#main');
let unsubscribe,children=[],epoch=0,contentEpoch=0,selected=dates[0],allItems=[],allSummaries=[],dateScroll=0,ready=false;
const tokenOf=()=>location.hash.slice(1).split('/')[0];
const viewOf=()=>views.includes(location.hash.split('/')[1])?location.hash.split('/')[1]:'home';
function render(){document.querySelector('#nav').innerHTML=shareNavigation(tokenOf(),viewOf());document.querySelector('#share-home').href='#'+tokenOf()+'/home';content.innerHTML=ready?shareScreen(viewOf(),allItems,allSummaries,selected):'';const calendar=document.querySelector('#shared-dates');if(calendar)calendar.scrollLeft=dateScroll;}
document.querySelector('.skip').onclick=e=>{e.preventDefault();content.focus();};
content.onclick=e=>{const date=e.target.closest('[data-share-date]'),day=e.target.closest('[data-day]'),shift=e.target.closest('[data-shift]');if(!date&&!day&&!shift)return;dateScroll=document.querySelector('#shared-dates')?.scrollLeft||0;if(date)selected=date.dataset.shareDate;if(day){selected=day.dataset.day;location.hash=tokenOf()+'/itinerary';}if(shift)selected=dates[Math.min(13,Math.max(0,dates.indexOf(selected)+Number(shift.dataset.shift)))];render();};
function clear(message){dateScroll=document.querySelector('#shared-dates')?.scrollLeft||dateScroll;allItems=[];allSummaries=[];ready=false;render();status.textContent=message;}
function stop(){epoch++;unsubscribe?.();children.forEach(fn=>fn());children=[];}
function listen(){stop();const run=epoch;clear('공유 일정을 확인하고 있습니다.');const token=tokenOf();if(!/^[0-9a-f]{64}$/.test(token)){clear('올바른 공유 링크가 아닙니다.');return;}if(!navigator.onLine){clear('인터넷 연결 후 공유 일정을 확인할 수 있습니다.');return;}
 const fail=()=>{stop();clear('공유가 중단되었거나 접근할 수 없습니다. 연결 상태를 확인해 주세요.');};
 unsubscribe=sdk.onSnapshot(sdk.doc(db,'publicTrips',token),{includeMetadataChanges:true},async snap=>{if(run!==epoch)return;const revision=++contentEpoch;children.forEach(fn=>fn());children=[];if(snap.metadata.fromCache||snap.metadata.hasPendingWrites){clear('서버에서 공개 상태를 확인하고 있습니다.');return;}if(!snap.exists()||!snap.data().active){clear('공유가 중단되었거나 사용할 수 없는 링크입니다.');return;}
 clear('최신 공개 일정을 불러오는 중입니다.');const root=snap.data();
 if(root.version===2){try{const generation=await sdk.getDocFromServer(sdk.doc(db,'publicTrips',token,'generations',root.generation));if(!generation.exists())throw Error('missing generation');const pages=[];const ids=generation.data().pages;
 for(let i=0;i<ids.length;i+=20){const batch=await Promise.all(ids.slice(i,i+20).map(id=>sdk.getDocFromServer(sdk.doc(db,'publicTrips',token,'pages',id))));if(run!==epoch||revision!==contentEpoch)return;for(const p of batch){if(!p.exists())throw Error('missing page');pages.push(...p.data().items);}}
 if(run!==epoch||revision!==contentEpoch)return;if(pages.length!==generation.data().count)throw Error('incomplete generation');const summaries=[];const summaryIds=generation.data().summaries||[];for(let i=0;i<summaryIds.length;i+=20){const docs=await Promise.all(summaryIds.slice(i,i+20).map(id=>sdk.getDocFromServer(sdk.doc(db,'publicTrips',token,'summaries',id))));if(run!==epoch||revision!==contentEpoch)return;for(const p of docs){if(!p.exists())throw Error('missing summary');summaries.push(...p.data().items);}}
 if(summaries.length!==(generation.data().summaryCount||0))throw Error('incomplete summaries');if(run!==epoch||revision!==contentEpoch)return;allSummaries=summaries;allItems=pages;ready=true;render();status.textContent=`최신 공개 일정 · ${pages.length}개`;
 }catch{if(run===epoch&&revision===contentEpoch){try{const latest=await sdk.getDocFromServer(sdk.doc(db,'publicTrips',token));if(run!==epoch||revision!==contentEpoch)return;if(latest.exists()&&latest.data().active&&latest.data().generation!==root.generation)listen();else fail();}catch{if(run===epoch&&revision===contentEpoch)fail();}}}return;}
 // Legacy selected links stay selected; never infer all-sharing from an old link.
 const items=new Map(),slots=root.slots||[];if(!slots.length){allItems=[];ready=true;render();status.textContent='공개 일정 없음';}
 for(const slot of slots)children.push(sdk.onSnapshot(sdk.doc(db,'publicTrips',token,'items',slot),{includeMetadataChanges:true},item=>{if(run!==epoch||revision!==contentEpoch)return;if(item.metadata.fromCache||item.metadata.hasPendingWrites){items.delete(slot);clear('서버에서 공개 상태를 확인하고 있습니다.');return;}items.set(slot,item.exists()&&!item.data().hidden?item.data():null);if(items.size===slots.length){allItems=[...items.values()].filter(Boolean);ready=true;render();status.textContent=`최신 공개 일정 · ${allItems.length}개`; }},fail));
 },fail);}
let activeToken=tokenOf();window.addEventListener('hashchange',()=>{if(tokenOf()!==activeToken){activeToken=tokenOf();listen();}else{render();window.scrollTo(0,0);}});window.addEventListener('online',listen);window.addEventListener('offline',()=>{stop();clear('인터넷 연결이 끊겨 공개 상태를 확인할 수 없습니다.');});document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();clear('공개 상태를 다시 확인합니다.');}else listen();});listen();
