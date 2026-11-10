import {dates} from './trip-calendar.js';
export const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sensitive=s=>/@|\b(?:\+?\d[\d ().-]{7,}\d)\b|(?:예약번호|비밀번호|카드번호|여권번호|booking\s*(?:ref|number)|password)/i.test(s);
export function exclusionReason(event){
 if(!event?.title?.trim())return '장소 이름이 없습니다';
 if(!dates.includes(event.date))return '여행 기간 밖 또는 날짜 미정';
 if([event.title,event.city,event.category].some(s=>sensitive(String(s||''))))return '이메일·연락처·예약/인증 정보 의심';
 if([event.start,event.end].some(t=>t&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))return '시간 형식 확인 필요';
 if(String(event.title).length>200||String(event.city||'').length>100||String(event.category||'').length>50)return '공개 텍스트 길이 확인 필요';
 return '';
}
export function publicEvent(event){if(exclusionReason(event))return null;return {title:event.title.trim(),date:event.date,start:String(event.start||''),end:String(event.end||''),city:String(event.city||''),category:String(event.category||'기타')};}
export function newToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');}
export async function digest(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');}
export function normalizeScope(scope){if(Array.isArray(scope))return {mode:'selected',selected:[...new Set(scope)],excluded:[]};if(!scope||!['all','selected'].includes(scope.mode))throw Error('공유 방식을 선택해 주세요.');return {mode:scope.mode,selected:scope.mode==='selected'?[...new Set(scope.selected||[])]:[],excluded:scope.mode==='all'?[...new Set(scope.excluded||[])]:[]};}
export function scopeFrom(config){return config?normalizeScope({mode:config.version===2?config.mode:'selected',selected:config.selected||[],excluded:config.excluded||[]}):normalizeScope({mode:'all'});}
export function included(scope,id){return scope.mode==='all'?!scope.excluded.includes(id):scope.selected.includes(id);}
export function selectedItems(events,scope){return events.filter(e=>e.value&&included(scope,e.id)).map(e=>e.value).sort((a,b)=>a.date.localeCompare(b.date)||(a.start||'99:99').localeCompare(b.start||'99:99')||a.title.localeCompare(b.title));}
export function pageChunks(items){const chunks=[];for(const date of dates){const day=items.filter(x=>x.date===date);for(let i=0;i<day.length;i+=5)chunks.push(day.slice(i,i+5));}return chunks;}
export function publicMarkup(items){let date='',previous=null;return [...items].filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date)||(a.start||'99:99').localeCompare(b.start||'99:99')||a.title.localeCompare(b.title)).map(x=>{const heading=x.date!==date?`<h2>${escapeHTML(x.date)}</h2>`:'';const origin=previous?.date===x.date?'&origin='+encodeURIComponent(previous.title+' '+previous.city):'';date=x.date;previous=x;const query=encodeURIComponent(x.title+' '+x.city),type=/식사|카페|음식|식당/.test(x.category)?'food':/기차|도보|항공|이동|택시|버스|지하철|교통/.test(x.category)?'transit':'visit';return `${heading}<article class="shared-event share-${type}"><div class="share-time">${escapeHTML(x.start||'시간 미정')}${x.end?'<small> — '+escapeHTML(x.end)+'</small>':''}</div><div><p class="meta">${escapeHTML(x.city)} · <span class="share-type">${escapeHTML(x.category)}</span></p><h3>${escapeHTML(x.title)}</h3><div class="actions"><a href="https://www.google.com/maps/search/?api=1&query=${query}" target="_blank" rel="noopener noreferrer">지도 보기 ↗</a><a href="https://www.google.com/maps/dir/?api=1&destination=${query}${origin}" target="_blank" rel="noopener noreferrer">길찾기 ↗</a></div></div></article>`;}).join('')||'<p class="share-empty">이 날짜에 공개된 일정이 없습니다.</p>';}
// Separate DTOs. No original record ID, address, reservation data or attachments leave the owner.
export function publicSummary(kind,value){
 const title=String(value?.title||'').trim();if(!title||title.length>200||sensitive(title))return null;
 if(kind==='bookings')return {kind:'booking',title,type:['숙소','기차','항공편','투어','티켓'].includes(value.type)?value.type:'기타'};
 if(kind==='checks')return {kind:'check',title,done:value.done===true};
 return null;
}
export function summaryScope(config){return {bookingSelected:[...new Set(config?.bookingSelected||[])],checkSelected:[...new Set(config?.checkSelected||[])]};}
export function selectedSummaries(loaded,scope){return ['bookings','checks'].flatMap(kind=>(loaded[kind]||[]).filter(x=>x.value&&(scope[kind==='bookings'?'bookingSelected':'checkSelected']||[]).includes(x.id)).map(x=>x.value));}
