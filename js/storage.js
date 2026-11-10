import {currentJournal,managedWrite} from './sync-storage.js';
import {googleRouteURL} from './final-utils.js';
import {validEmbedURL} from './embed.js';
import {defaults,dates,cities,groups} from './data.js';
export const KEY='europe-journal.user.v1';
const fields={events:['id','title','city','date','start','end','category','address','description','transport','duration','route','origin','cost','status','note','map','image','local','mode','order'],bookings:['id','title','city','type','checkin','checkout','address','instructions','contact','status','note','reference'],checks:['id','title','group','done']};
fields.events.push('condition','destination','line','transfer','platform','exit','boarding','alighting','caution','steps','directions','official','streetview','imageCaption','localDescription','pronunciation','website','hours','durationMinutes','travelMinutes','amount','currency','imageId');
fields.bookings.push('checkinTime','checkoutTime','access','local','image','imageCaption','map','directions','streetview','origin','mode');
fields.checks.push('date','eventId');
fields.events.push('iconType','lineName','lineNumber','lineColor','operator','fare','reservationStatus','importance','originLabel','destinationLabel','localAddress','placeUrl','mapUrl','directionsUrl','streetViewUrl','websiteUrl','instagramUrl','memo','tags');
fields.events.push('transportMode','durationUnit','originStreetViewUrl','destinationStreetViewUrl','latitude','longitude');
fields.events.push('attachments','costStatus','pano');
fields.bookings.push('attachments','iconType','linkedDate','destination','serviceNumber');
fields.checks.push('bookingId');
fields.events.push('sortOrder','reservationId','embedUrl');
fields.checks.push('eventIds');
fields.events.push('detailedNote');
fields.bookings.push('imageId','seat','durationMinutes','amount','currency','cost','costStatus');
const validDate=v=>!v||dates.includes(v);
const validTime=v=>!v||/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export function validate(data){
 if(!data||data.schemaVersion!==1)throw Error('지원하지 않는 백업 형식입니다.');
 for(const [kind,allowed] of Object.entries(fields)){
  if(!Array.isArray(data[kind])||data[kind].length>5000)throw Error('목록 형식 또는 항목 수가 올바르지 않습니다.');
  const ids=new Set();
  for(const x of data[kind]){
   if(!x||typeof x!=='object'||typeof x.id!=='string'||!x.id||ids.has(x.id)||typeof x.title!=='string'||!x.title.trim())throw Error('항목의 ID 또는 제목이 올바르지 않습니다.');ids.add(x.id);
   for(const [k,v]of Object.entries(x)){if(!allowed.includes(k))throw Error(`${kind} / ${x.title} / ${k}: 지원하지 않는 입력 항목입니다. 백업 형식을 확인해 주세요.`);if(k==='eventIds'){if(!Array.isArray(v)||v.some(id=>typeof id!=='string'))throw Error('연결 일정 ID 목록 오류');}else if(k==='attachments'){if(!Array.isArray(v)||v.length>200||v.some(a=>!a||typeof a.id!=='string'||!a.id||typeof a.name!=='string'||typeof a.type!=='string'||!['image/jpeg','image/png','image/webp','application/pdf'].includes(a.type)||!Number.isFinite(a.size)||a.size<0||a.size>10485760||typeof a.createdAt!=='string'||(a.caption!==undefined&&typeof a.caption!=='string'))||new Set(v.map(a=>a.id)).size!==v.length)throw Error('첨부파일 목록: 이름·형식·크기를 확인해 주세요.');}else if(k==='tags'){if(!(typeof v==='string'||(Array.isArray(v)&&v.length<=100&&v.every(t=>typeof t==='string'&&t.length<=300))))throw Error('태그 형식 오류');}else if(['fare','durationMinutes','latitude','longitude'].includes(k)&&typeof v==='number'){if(!Number.isFinite(v)||(!['latitude','longitude'].includes(k)&&v<0))throw Error('금액 또는 시간 오류');}else if(k==='done'){if(typeof v!=='boolean')throw Error('체크 상태 오류');}else if((k==='order'||k==='sortOrder')){if(!Number.isFinite(v))throw Error('순서 오류');}else if(typeof v!=='string'||v.length>20000)throw Error('텍스트 형식 오류');}
   if(kind==='events'&&(!validDate(x.date)||!validTime(x.start)||!validTime(x.end)))throw Error('날짜 또는 시간 형식 오류');
   if(kind==='bookings'&&(!validDate(x.linkedDate)||!validDate(x.checkin)||!validDate(x.checkout)||(x.checkin&&x.checkout&&x.checkout<x.checkin)))throw Error('체크인·체크아웃 날짜 오류');
   if(kind!=='checks'&&(typeof x.city!=='string'||!x.city.trim()||x.city.length>100))throw Error('도시: 1~100자 도시명을 입력해 주세요.');
   if(x.embedUrl&&!validEmbedURL(x.embedUrl))throw Error('Google Maps 임베드 주소를 확인해 주세요.');
   if(kind==='checks'&&((typeof x.group!=='string'||!x.group.trim())||typeof x.done!=='boolean'))throw Error('체크리스트 형식 오류');
   for(const [key,max]of [['latitude',90],['longitude',180]])if(x[key]!==undefined&&x[key]!==''&&(!Number.isFinite(+x[key])||Math.abs(+x[key])>max))throw Error('위도·경도 범위를 확인해 주세요.');
   if(x.lineColor&&!/^#[0-9a-f]{6}$/i.test(x.lineColor))throw Error('노선 색상은 #RRGGBB 형식으로 입력해 주세요.');
   for(const k of ['map','image','directions','official','streetview','website','placeUrl','mapUrl','directionsUrl','streetViewUrl','websiteUrl','instagramUrl','originStreetViewUrl','destinationStreetViewUrl'])if(x[k]){let u;try{u=new URL(x[k]);}catch{throw Error('URL 형식 오류');}if(u.protocol!=='https:')throw Error('링크는 https 주소를 사용해 주세요.');}
  }
 }
 if(data.dayNotes!==undefined){if(!data.dayNotes||typeof data.dayNotes!=='object'||Array.isArray(data.dayNotes))throw Error('하루 요약 형식 오류');for(const [d,n] of Object.entries(data.dayNotes)){if(!dates.includes(d)||!n||typeof n!=='object'||Array.isArray(n))throw Error('하루 요약 날짜 오류');if(n.routeUrl&&!googleRouteURL(n.routeUrl))throw Error('하루 전체 경로 URL: HTTPS Google Maps 링크를 입력해 주세요.');for(const [k,v] of Object.entries(n))if(!['sunset','returnTime','note','routeUrl'].includes(k)||typeof v!=='string'||v.length>20000||(['sunset','returnTime'].includes(k)&&!validTime(v)))throw Error('하루 요약 값 오류');}}
 for(const c of data.checks)if(!validDate(c.date))throw Error('체크리스트 날짜 오류');
 return data;
}
export function read(){const journal=currentJournal();if(journal)return validate(journal.data);const raw=localStorage.getItem(KEY);return raw?validate(JSON.parse(raw)):defaults();}
export function write(data,before,bulk=false){validate(data);const managed=managedWrite(data,before,bulk);if(managed)return managed;localStorage.setItem(KEY,JSON.stringify(data));return data;}
