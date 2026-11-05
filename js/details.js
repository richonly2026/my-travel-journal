import {visual,normalize} from './presentation.js';
export const transitTypes=['이동','도보 이동','지하철','기차','버스','택시','항공'];
export function summary(items){
 const active=items.map(normalize).filter(e=>e.condition!=='방문 취소');
 const starts=active.map(e=>e.start).filter(Boolean).sort(),ends=active.map(e=>e.end).filter(Boolean).sort();
 const totals={},transport={};let minutes=0,hasMinutes=false;const costIds=new Set();
 for(const e of active){if(e.travelMinutes&&Number.isFinite(+e.travelMinutes)){minutes+=+e.travelMinutes;hasMinutes=true;}if(e.amount!==undefined&&e.amount!==''&&Number.isFinite(+e.amount)&&e.currency&&!costIds.has(e.reservationId||e.id||e)){costIds.add(e.reservationId||e.id||e);totals[e.currency]=(totals[e.currency]||0)+ +e.amount;if(visual(e).transit)transport[e.currency]=(transport[e.currency]||0)+ +e.amount;}}
 const money=o=>Object.entries(o).map(([c,n])=>`${n.toFixed(2)} ${c}`).join(' + ')||'미입력';
 return {start:starts[0]||'미입력',end:ends.at(-1)||'미입력',places:active.filter(e=>!visual(e).transit).map(e=>e.title).join(' → ')||'미입력',travel:hasMinutes?`${minutes}분`:'미입력',cost:money(totals),transportCost:money(transport),optional:items.filter(e=>['선택','확인만','대체 코스'].includes(e.condition)).length};
}
