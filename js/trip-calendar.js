// Public trip calendar only; no user records or reservation defaults.
export const dates=Array.from({length:14},(_,i)=>`2026-12-${String(i+2).padStart(2,'0')}`);
export const cityFor=d=>d<'2026-12-07'?'PARIS':d<'2026-12-09'?'VENICE':d<'2026-12-11'?'FLORENCE':'ROME';
export const cityLabel=d=>({'2026-12-07':'PARIS → VENICE','2026-12-09':'VENICE → FLORENCE','2026-12-11':'FLORENCE → ROME'}[d]||cityFor(d));
export const weekday=d=>!d?'날짜 미정':new Intl.DateTimeFormat('ko',{weekday:'short',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));

export const validTravelDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
export const sharedDates=items=>[...new Set([...dates,...items.map(e=>e.date||'')])].sort((a,b)=>(a||'9999').localeCompare(b||'9999'));
