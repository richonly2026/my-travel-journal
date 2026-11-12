import {transitStops,validLineColor} from './transit.js';
import {publicLocation} from './share-location.js';
// Owner-side projection only. Never pass raw records to the shared viewer.
import {resolveDisplayEvent} from './event-content.js';
import {normalize,visual,costLabel} from './presentation.js';
import {minutesOf,moneyOf} from './input-values.js';
import {detailedMemo} from './final-utils.js';
import {validTravelDate} from './trip-calendar.js';
export const MASK_POLICY='masked-v1';
export const maskedScope=()=>({sharingPolicy:MASK_POLICY,mode:'all',selected:[],excluded:[],bookingSelected:[],checkSelected:[],detailApprovals:[]});
const escapeRE=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const sensitiveLabel=/(?:이름|성명|예약자|탑승자|투숙객|연락처|전화|휴대폰|이메일|예약\s*(?:번호|코드|일자|일|날짜|상세)|좌석|여권|비밀번호|출입\s*(?:코드|번호)|결제|카드\s*번호|계좌|확인\s*링크|주소|address|check.?in\s*(?:code|pin|details)|(?:guest|passenger|travell?er)\s*name|booking\s*(?:ref|number|date|details)|confirmation|pnr|seat|passport|password|payment|card\s*number|phone|email)/i;
// Do not infer names from title case or require travel keywords.
const explicitPerson=/(?:[가-힣]{2,4}\s*(?:님|씨)(?:\s|$)|\b(?:Mr|Mrs|Ms|Dr)\.?\s+[A-Z][a-z]+)/;
const privateAddress=/(?:\b\d{1,5}\s+(?:[\p{L}.'-]+\s+){0,5}(?:street|road|avenue|rue|via|avenue|lane|st|rd)\b|(?:rue|via|viale)\s+[^,\n]{1,50}\s+\d{1,5}\b|[가-힣]+(?:로|길)\s*\d+(?:-\d+)?)/iu;
function secretsOf(data){const values=new Set();for(const record of [...(data.events||[]),...(data.bookings||[]),...(data.checks||[])]){
 for(const key of ['reference','contact','seat','name','guestName','passengerName','travelerName','email','phone','imageId','reservationId','id','address','localAddress','checkinCode','password','pin','confirmationUrl','bookingUrl'])if(typeof record[key]==='string'&&record[key].trim().length>=3)values.add(record[key].trim());
 for(const a of record.attachments||[])if(a.id)values.add(a.id);
 for(const text of Object.values(record).filter(x=>typeof x==='string'))for(const match of text.matchAll(/(?:이름|성명|예약자|탑승자|투숙객|(?:guest|passenger|traveler)\s*name)\s*[:：=]\s*([^\n,;|]{2,60})/gi))values.add(match[1].trim());
 }return [...values].sort((a,b)=>b.length-a.length);}
export function maskingContext(data){return {secrets:secretsOf(data),hidden:0,masked:0,omissions:[],location:'공개 제목',field:''};}
function omit(context,reason){context.hidden++;if(context.omissions.length<200)context.omissions.push({where:[context.location,context.field].filter(Boolean).join(' · '),reason});}
export function maskText(value,context,{free=false,max=20000}={}){
 if(typeof value!=='string'||!value.trim())return '';
 if(value.length>max){omit(context,'입력 길이가 안전한 공개 한도를 초과함');return '';}
 const lines=value.split('\n').map(line=>{
  if(!line.trim())return '';
  if(sensitiveLabel.test(line)){omit(context,'개인정보·예약·결제 관련 표식이 포함된 문장');return '';}
  let text=line;
  for(const secret of context.secrets)text=text.replace(new RegExp(escapeRE(secret),'giu'),'[비공개]');
  text=text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[비공개]')
   .replace(/(?:https?:\/\/|www\.)\S+/gi,'[비공개]')
   .replace(/(?:\+?\d[\d ()-]{6,}\d)/g,'[비공개]')
   .replace(/\b(?:19|20)\d{2}[.\/년-]\s*\d{1,2}[.\/월-]\s*\d{1,2}(?:일)?\b/g,'[비공개]')
   .replace(/\b\d{1,2}[\/.]\d{1,2}\b/g,'[비공개]')
   .replace(/\b(?=[A-Z0-9-]{6,}\b)(?=[A-Z0-9-]*\d)[A-Z][A-Z0-9-]{5,}\b/g,'[비공개]')
   .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi,'[비공개]');
  if(text!==line)context.masked++;
  // Unlabelled prose/names are not assumed safe just because no phone/email was found.
  if(free&&(explicitPerson.test(text)||privateAddress.test(text))){omit(context,'사람 이름 또는 상세 주소가 포함된 문장');return '';}
  return text.trimEnd();
 });return lines.join('\n').trim();
}
function title(value,ctx,fallback){const result=maskText(String(value||''),ctx,{max:200});return result||fallback;}
function summaryBooking(b,ctx){return {kind:'booking',title:title(b.title,ctx,'예약 제목 비공개'),type:['숙소','기차','항공편','투어','티켓'].includes(b.type)?b.type:'기타'};}
export function maskedTrip(data){
 const ctx=maskingContext(data),bookings=data.bookings||[],items=[];
 for(const raw of data.events||[]){
  const resolved=normalize(resolveDisplayEvent(raw,bookings)),v=visual(resolved),safeTime=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t||'')?t:'';
  const e={title:title(resolved.title,ctx,'일정 제목 비공개'),date:validTravelDate(raw.date)?raw.date:'',start:safeTime(resolved.start),end:safeTime(resolved.end),city:maskText(String(raw.city||''),ctx,{max:100}),category:maskText(String(resolved.category||''),ctx,{max:50})||'기타'};
  const location=publicLocation(raw,e);if(location)e.location=location;
  e.presentation={title:e.title,start:e.start,end:e.end,category:e.category,iconType:v.icon};
  ctx.location=raw.date+' · '+e.title;ctx.field='';const details={};if(raw.lineColor&&validLineColor(raw.lineColor))details.lineColor=raw.lineColor;const line=maskText(raw.lineName??raw.line??'',ctx,{max:300});if(line)details.line=line;const stops=transitStops(raw).map(s=>({name:maskText(s.name,ctx,{free:true,max:300}),line:maskText(s.line,ctx,{max:300}),color:validLineColor(s.color)?s.color:''})).filter(s=>s.name);if(stops.length||Array.isArray(raw.transitStops))e.transitStops=stops.map(s=>[s.name,s.line,s.color].map(x=>String(x||'').replace(/[\u001e\u001f]/g,' ')).join('\u001f')).join('\u001e');if(v.mode)details.transportMode=v.mode;
  // Only a fixed display-status enum; dates, service/seat numbers, addresses and booking notes never enter details.
  if(['미정','확인 필요','예약 예정','예약 완료','예약 불필요'].includes(resolved.status))details.status=resolved.status;
  if(['필수','선택','확인만','대체 코스','방문 취소'].includes(resolved.condition))details.condition=resolved.condition;
  const duration=minutesOf(raw);if(Number.isFinite(duration)&&duration>=0&&duration<=10080)details.duration=duration+'분';
  const money=moneyOf(normalize(raw));if(money&&money.amount!==''&&Number.isFinite(+money.amount)&&+money.amount>=0&&/^(EUR|KRW|USD|GBP)$/.test(money.currency))details.cost=costLabel({amount:money.amount,currency:money.currency});
  for(const field of ['transport','operator','boarding','alighting','transfer','route','steps','caution','origin','destination','localDescription','pronunciation']){if(field==='transfer'&&Array.isArray(raw.transitStops))continue;ctx.field=field;const value=maskText(String(raw[field]||''),ctx,{free:true});if(value)details[field]=value;}
  for(const field of ['platform','exit']){const value=String(raw[field]||'');if(/^[0-9]{1,2}(?:번)?(?:\s*(?:승강장|출구))?$/.test(value))details[field]=value;else if(value)ctx.hidden++;}
  ctx.field='상세 메모';const memo=maskText(detailedMemo(raw),ctx,{free:true,max:60000});if(memo)details.detailedNote=memo;
  if(Object.keys(details).length)e.details=details;
  const b=bookings.find(x=>x.id===raw.reservationId);if(b){const safe=summaryBooking(b,ctx);e.linkedBooking={title:safe.title,type:safe.type};}
  items.push(e);
 }
 ctx.location='예약 제목 / 준비 목록';ctx.field='';const summaries=bookings.map(b=>summaryBooking(b,ctx));for(const c of data.checks||[]){const text=maskText(c.title,ctx,{free:true,max:200});if(text)summaries.push({kind:'check',title:text,done:c.done===true});}
 items.sort((a,b)=>a.date.localeCompare(b.date)||(a.start||'99:99').localeCompare(b.start||'99:99')||a.title.localeCompare(b.title));
 return {items,summaries,report:{sourceCount:(data.events||[]).length,publicCount:items.length,undatedCount:items.filter(x=>!x.date).length,hidden:ctx.hidden,masked:ctx.masked,omissions:ctx.omissions}};
}
