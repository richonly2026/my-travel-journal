export const OWNER='europe-journal.sync.owner';
export const journalKey=uid=>'europe-journal.sync.v1.'+uid;
export function currentJournal(){const uid=localStorage.getItem(OWNER);return uid?JSON.parse(localStorage.getItem(journalKey(uid))||'null'):null;}
export function recovery(data,reason){const key='europe-journal.recovery.'+new Date().toISOString()+'.'+crypto.randomUUID();localStorage.setItem(key,JSON.stringify({reason,data}));return key;}
let writer;
export function installWriter(fn){writer=fn;}
export function managedWrite(data,before,bulk){if(writer)return writer(data,before,bulk);if(localStorage.getItem(OWNER))throw Error('동기화 준비 중입니다. 잠시 후 다시 저장해 주세요.');return null;}
