// Pure item-level state machine. All updates return a new journal for atomic persistence.
export const kinds=['events','bookings','checks','dayNotes'];
export const empty=()=>({schemaVersion:1,events:[],bookings:[],checks:[],dayNotes:{}});
const canonical=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const equal=(a,b)=>JSON.stringify(canonical(a??null))===JSON.stringify(canonical(b??null));
export const keyOf=(kind,id)=>JSON.stringify([kind,id]);
export function records(data){const result={};for(const kind of kinds)for(const [id,value] of kind==='dayNotes'?Object.entries(data.dayNotes||{}):(data[kind]||[]).map(v=>[v.id,v]))result[keyOf(kind,id)]=value;return result;}
export function put(data,key,value){const [kind,id]=JSON.parse(key);if(!kinds.includes(kind))throw Error('알 수 없는 동기화 항목');if(kind==='dayNotes'){data.dayNotes={...data.dayNotes};if(value===null)delete data.dayNotes[id];else data.dayNotes[id]=value;}else{data[kind]=data[kind].filter(v=>v.id!==id);if(value!==null)data[kind].push(value);}}
export function createJournal(data){return {version:1,data:structuredClone(data),base:{},pending:{},conflicts:{},paused:false};}
function queue(j,key,value){const old=j.pending[key];j.pending[key]={value,revision:j.base[key]?.revision||0,operationId:crypto.randomUUID(),ancestors:old?[...old.ancestors,old.operationId]:[]};}
export function edit(journal,before,next,bulk=false){const j=structuredClone(journal),old=records(before),values=records(next),latest=records(j.data);for(const key of new Set([...Object.keys(old),...Object.keys(values)])){const value=values[key]??null;if(equal(old[key],value))continue;queue(j,key,value);if(!equal(latest[key],old[key])&&!equal(latest[key],value))j.conflicts[key]={value:latest[key]??null,revision:j.base[key]?.revision||0};put(j.data,key,value);}if(bulk)j.paused=true;return j;}
export function uploadAll(journal){const j=structuredClone(journal);for(const [key,value] of Object.entries(records(j.data)))if(!equal(j.base[key]?.value,value))queue(j,key,value);return j;}
export function receive(journal,envelopes,initial=false){const j=structuredClone(journal);for(const remote of envelopes){const key=keyOf(remote.kind,remote.itemId),value=remote.deleted?null:remote.payload,base=j.base[key],pending=j.pending[key],local=records(j.data)[key]??null;if(base&&remote.revision<base.revision)continue;
 const own=pending&&(pending.operationId===remote.operationId||pending.ancestors.includes(remote.operationId));
 if(pending){if(equal(pending.value,value)){delete j.pending[key];delete j.conflicts[key];}else if(own){pending.revision=remote.revision;delete j.conflicts[key];}else if(remote.revision!==pending.revision){j.conflicts[key]={value,revision:remote.revision};}}
 else if((initial||!base)&&local!==null&&!equal(local,value)){queue(j,key,local);j.conflicts[key]={value,revision:remote.revision};}
 else put(j.data,key,value);
 j.base[key]={value,revision:remote.revision};
 }return j;}
export function resolve(journal,key,choice){const j=structuredClone(journal),conflict=j.conflicts[key];if(!conflict)throw Error('이미 해결된 충돌입니다.');if(choice==='cloud'){put(j.data,key,conflict.value);delete j.pending[key];}else{queue(j,key,records(j.data)[key]??null);j.pending[key].revision=conflict.revision;}delete j.conflicts[key];return j;}
export function decide(remote,pending){if(remote&&(remote.operationId===pending.operationId||equal(remote.deleted?null:remote.payload,pending.value)))return 'same';return (remote?.revision||0)===pending.revision?'write':'conflict';}
