import {resolveDisplayEvent} from './event-content.js';
import {normalize,durationLabel,costLabel,visual} from './presentation.js';
import {detailedMemo} from './final-utils.js';
import {digest,publicEvent,publicSummary,escapeHTML as esc} from './share-model.js';
export const detailLabels={transportMode:'교통수단',transport:'이동 안내',duration:'소요 시간',cost:'비용',status:'예약 상태',condition:'일정 상태',operator:'운영사',detailedNote:'상세 메모',origin:'출발지',destination:'도착지',platform:'승강장',exit:'출구',boarding:'탑승 안내',alighting:'하차 안내',transfer:'환승역',route:'이동 경로',hours:'운영시간',localDescription:'현지어 설명',pronunciation:'발음',steps:'이동 단계',caution:'주의사항'};
export const detailScope=c=>({detailApprovals:[...(c?.detailApprovals||[])]});
export async function detailCandidates(id,raw,bookings){
 const booking=bookings.find(b=>b.id===raw.reservationId),resolved=normalize(resolveDisplayEvent(raw,bookings)),base=publicEvent(resolved),result=[];
 async function add(field,value,label){if(value===undefined||value===null||value==='')return;const key=await digest([id,field]);result.push({field,value,label,key,approval:key+':'+await digest(value),suspect:/@|예약번호|비밀번호|여권|카드번호|\d[\d ().+-]{7,}\d/i.test(typeof value==='string'?value:JSON.stringify(value))});}
 if(base)await add('presentation',{title:base.title,start:base.start,end:base.end,category:base.category,iconType:visual(resolved).icon},'원본 표시 제목·시각·아이콘');
 const values={...resolved,transportMode:visual(resolved).mode,duration:durationLabel(resolved),cost:costLabel(resolved),detailedNote:detailedMemo(resolved)};
 // Booking-only addresses, seat/service numbers, instructions, notes and URLs are never candidates.
 for(const [field,label] of Object.entries(detailLabels)){await add(field,String(values[field]??''),label);}
 const publicBooking=booking&&publicSummary('bookings',booking);if(publicBooking)await add('linkedBooking',{title:publicBooking.title,type:publicBooking.type},'연결 예약 공개 제목 카드');
 return result;
}
export function approvedEvent(event,scope){if(!event.value)return null;const value={...event.value};for(const candidate of event.candidates||[]){let approved;if((scope.detailApprovals||[]).includes(candidate.approval))approved=candidate.value;else if(candidate.previous&&(scope.detailApprovals||[]).includes(candidate.previous.approval))approved=candidate.previous.value;else continue;if(approved===null||approved==='')continue;if(['presentation','linkedBooking'].includes(candidate.field))value[candidate.field]=approved;else(value.details??={})[candidate.field]=approved;}return value;}
export async function restoreApprovedCandidates(events,config,readSnapshot){
 const tokens=new Map((config?.detailApprovals||[]).map(x=>[x.split(':')[0],x]));if(!tokens.size)return;
 const labels={presentation:'원본 표시 제목·시각·아이콘',...detailLabels,linkedBooking:'연결 예약 공개 제목 카드'};
 for(const event of events)for(const [field,label] of Object.entries(labels)){
  const key=await digest([event.id,field]),token=tokens.get(key);if(!token)continue;
  let candidate=event.candidates.find(c=>c.key===key);if(candidate?.approval===token)continue;
  const saved=await readSnapshot(token,field);if(!saved||await digest(saved.value)!==token.split(':')[1])continue;
  if(!candidate){candidate={field,label,key,value:null,approval:key+':'+await digest(null),removed:true};event.candidates.push(candidate);}
  candidate.previous={approval:token,value:saved.value};
 }
}
export function materializeEvents(loaded,scope){return loaded.events.map(event=>({...event,value:approvedEvent(event,scope)}));}
export function detailPreviewText(value){return value===null?'현재 공개 후보 없음(원본 제거 또는 공개 필터 제외) · 비공개 처리하려면 기존 승인 해제':typeof value==='string'?value:Object.entries(value).map(([k,v])=>`${k}: ${v}`).join('\n');}
