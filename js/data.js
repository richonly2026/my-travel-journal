export const dates=Array.from({length:14},(_,i)=>`2026-12-${String(i+2).padStart(2,'0')}`);
export const cities=['PARIS','VENICE','FLORENCE','ROME'];
export const groups=['출국 전','항공 및 기차','숙소','준비물','현지에서 확인할 사항','귀국 준비'];
export const cityFor=d=>d<'2026-12-07'?'PARIS':d<'2026-12-09'?'VENICE':d<'2026-12-11'?'FLORENCE':'ROME';
export const cityLabel=d=>({'2026-12-07':'PARIS → VENICE','2026-12-09':'VENICE → FLORENCE','2026-12-11':'FLORENCE → ROME'}[d]||cityFor(d));
export function defaults(){return {schemaVersion:1,events:[],bookings:[],checks:[]};}
export const sorted=events=>[...events].sort((a,b)=>(Number.isFinite(a.sortOrder)||Number.isFinite(b.sortOrder)?(a.sortOrder??Infinity)-(b.sortOrder??Infinity):0)||(a.start||'99:99').localeCompare(b.start||'99:99')||(a.order||0)-(b.order||0)||a.id.localeCompare(b.id));
