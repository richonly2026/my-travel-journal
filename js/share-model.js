export const SHARE_LIMIT=30;
export const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sensitive=s=>/@|\b(?:\+?\d[\d ().-]{7,}\d)\b/.test(s);
export function publicEvent(event){
 if(!event||!event.title?.trim())return null;
 const value={title:String(event.title).trim().slice(0,200),date:String(event.date||''),start:String(event.start||''),end:String(event.end||''),city:String(event.city||'').slice(0,100),category:String(event.category||'기타').slice(0,50)};
 if([value.title,value.city,value.category].some(sensitive))return null;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||[value.start,value.end].some(t=>t&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))return null;
 return value;
}
export function newToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');}
export function publicMarkup(items){let date='';return items.filter(Boolean).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start)).map(x=>{const heading=x.date!==date?`<h2>${escapeHTML(x.date)}</h2>`:'';date=x.date;const query=encodeURIComponent(x.title+' '+x.city);return `${heading}<article class="shared-event"><p class="meta">${escapeHTML(x.city)} · ${escapeHTML(x.category)}</p><p class="share-time">${escapeHTML(x.start||'시간 미정')}${x.end?' — '+escapeHTML(x.end):''}</p><h3>${escapeHTML(x.title)}</h3><div class="actions"><a href="https://www.google.com/maps/search/?api=1&query=${query}" target="_blank" rel="noopener noreferrer">지도 열기 ↗</a><a href="https://www.google.com/maps/dir/?api=1&destination=${query}" target="_blank" rel="noopener noreferrer">길찾기 ↗</a></div></article>`;}).join('')||'<p>공개된 일정이 없습니다.</p>';}
