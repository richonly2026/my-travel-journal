import {transitStops,transitRouteHTML,imageRatios} from './transit.js';
import {getImage} from './images.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let draft=[],previewURLs=[];
export function editorTransport(){const root=document.querySelector('#transport-editor');if(!root)return [];
 return [...root.querySelectorAll('[data-stop-row]')].map(row=>Object.fromEntries(['name','line','color'].map(key=>[key,row.querySelector('[data-stop-field="'+key+'"]').value])));
}
export function simplifyEventEditor(item,field){
 const root=document.querySelector('#fields'),sections=[...root.querySelectorAll(':scope > .form-section')];
 const basic=sections.find(s=>s.querySelector('summary')?.textContent==='기본 정보'),detail=sections.find(s=>s.querySelector('summary')?.textContent==='상세 정보'),transport=sections.find(s=>s.querySelector('summary')?.textContent==='교통 및 이동'),media=sections.find(s=>s.querySelector('summary')?.textContent==='지도 및 이미지');
 const move=(name,to)=>{const el=root.querySelector('[name="'+name+'"]');if(el)to.append(el.closest('label')||el);};
 move('condition',basic.lastElementChild);
 for(const name of ['hours','platform','exit','alighting','steps','route','local','localDescription','pronunciation','website','instagramUrl','official','operator','lineNumber','mode','line','transfer','transport'])root.querySelector('[name="'+name+'"]')?.closest('label')?.remove();
 move('detailedNote',detail.lastElementChild);const memo=root.querySelector('[name=detailedNote]');memo.maxLength=60000;memo.closest('label').firstChild.textContent='메모';
 move('caution',detail.lastElementChild);root.querySelector('[name=caution]').closest('label').firstChild.textContent='주의사항';
 const cost=sections.find(s=>s.querySelector('summary')?.textContent==='소요 시간 및 비용');if(cost){for(const child of [...cost.children].slice(1))detail.append(child);}
 const mode=root.querySelector('[name=transportMode]')?.closest('label'),boarding=root.querySelector('[name=boarding]')?.closest('label');
 draft=transitStops(item);transport.innerHTML='<summary>교통 및 이동</summary><div class="form-grid" data-transport-options></div><div id="transport-editor"></div>';
 if(mode)transport.querySelector('[data-transport-options]').append(mode);
 if(boarding)transport.querySelector('[data-transport-options]').append(boarding);
 const host=root.querySelector('#transport-editor');
 host.innerHTML=field('origin','출발지',item.origin||'')+'<div class="route-line-input">'+field('lineName','노선명',item.lineName??item.line??'')+field('lineColor','노선 컬러',item.lineColor||'')+'<input type="color" data-base-color aria-label="노선 컬러 선택" value="'+(item.lineColor||'#939ba3')+'"></div><div data-transfer-list></div><button type="button" data-add-transfer>환승 추가 +</button>'+field('destination','도착지',item.destination||'')+'<div data-route-preview></div>';
 function preview(){const values=Object.fromEntries(new FormData(document.querySelector('#form')));host.querySelector('[data-route-preview]').innerHTML=transitRouteHTML({...values,transitStops:editorTransport()});}
 function rows(){host.querySelector('[data-transfer-list]').innerHTML=draft.map((s,i)=>'<div data-stop-row class="transfer-row"><label>환승역 '+(i+1)+'<input data-stop-field="name" value="'+esc(s.name)+'" maxlength="300"></label><label>다음 구간 노선<input data-stop-field="line" value="'+esc(s.line)+'" maxlength="300"></label><label>다음 구간 컬러<input data-stop-field="color" value="'+esc(s.color)+'" maxlength="7" placeholder="#RRGGBB"></label><input type="color" data-stop-color="'+i+'" aria-label="환승 구간 색상 선택" value="'+(s.color||'#939ba3')+'"><button type="button" data-stop-move="'+i+'" data-delta="-1" '+(i===0?'disabled':'')+'>↑</button><button type="button" data-stop-move="'+i+'" data-delta="1" '+(i===draft.length-1?'disabled':'')+'>↓</button><button type="button" data-stop-remove="'+i+'">환승 삭제</button></div>').join('');preview();}
 host.oninput=e=>{if(e.target.hasAttribute('data-base-color'))host.querySelector('[name=lineColor]').value=e.target.value;if(e.target.hasAttribute('data-stop-color'))e.target.closest('[data-stop-row]').querySelector('[data-stop-field=color]').value=e.target.value;preview();};
 host.onclick=e=>{const b=e.target.closest('button');if(!b)return;draft=editorTransport();if(b.hasAttribute('data-add-transfer')){if(draft.length>=12)return;draft.push({name:'',line:'',color:''});}else if(b.hasAttribute('data-stop-remove'))draft.splice(+b.dataset.stopRemove,1);else if(b.hasAttribute('data-stop-move')){const i=+b.dataset.stopMove,j=i+ +b.dataset.delta;if(draft[j])[draft[i],draft[j]]=[draft[j],draft[i]];}else return;rows();};rows();
 media.querySelector('summary').textContent='지도 및 첨부 이미지';
 for(const section of sections){const title=section.querySelector('summary')?.textContent;if(['이미지·PDF 첨부','Google Maps 퍼가기'].includes(title))for(const child of [...section.children].slice(1))media.append(child);else if(title==='기존 예약 불러오기')basic.append(section);}
 // Old link/extra fields are not submitted; old object values survive the normal merge-on-save.
 for(const section of sections)if(![basic,detail,transport,media].includes(section)&&section.parentElement===root)section.remove();
 for(const child of [...root.children])if(![basic,detail,transport,media].includes(child))child.remove();
 previewURLs.forEach(URL.revokeObjectURL);previewURLs=[];
 if(item.imageId||item.image){media.insertAdjacentHTML('beforeend',field('imageRatio','기존 이미지 표시 비율',item.imageRatio||'original','text',imageRatios.map(r=>[r,r==='original'?'원본 비율':r]))+'<div class="image-ratio-preview" data-ratio="'+esc(item.imageRatio||'original')+'"><img alt="기존 이미지 비율 미리보기"></div>');const image=media.querySelector('.image-ratio-preview img');if(item.imageId)getImage(item.imageId).then(blob=>{if(blob&&image.isConnected){const u=URL.createObjectURL(blob);previewURLs.push(u);image.src=u;}});else image.src=item.image;root.querySelector('[name=imageRatio]').onchange=e=>image.parentElement.dataset.ratio=e.target.value;}
}
