import {shareScreen,views} from './share-layout.js';
import {loadSharing,publishSharing,disableSharing} from './share-service.js';
import {maskedScope,MASK_POLICY} from './share-sanitize.js';
import {escapeHTML as esc} from './share-model.js';
import {dates} from './trip-calendar.js';
export async function openShareManager(db,uid){
 let dialog=document.querySelector('#share-manager');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='share-manager';document.body.append(dialog);}
 dialog.innerHTML='<div class="sheet-head"><h2>여행 일정 공유</h2><button data-close aria-label="닫기">×</button></div><div data-share-content>불러오는 중…</div><p data-share-error role="status"></p>';
 dialog.showModal();
 const content=dialog.querySelector('[data-share-content]'),error=dialog.querySelector('[data-share-error]');
 let loaded,busy=false,preview=false,view='home',day=dates[0];
 const link=()=>{const u=new URL('share.html',location.href);u.hash=loaded.config.token;return u.href;};
 function render(){
 const active=loaded.config?.active,automatic=active&&loaded.config.sharingPolicy===MASK_POLICY;
 content.innerHTML=`<section class="share-step"><h3>전체 여행 공유</h3><button class="share-primary" role="switch" aria-checked="${!!automatic}" data-toggle-share>전체 여행 공유 ${automatic?'ON':'OFF'}</button><p class="hint">한 번 시작하면 새 일정과 수정사항도 자동 반영됩니다. 예약은 제목·유형만 공개하고 첨부파일은 전달하지 않습니다.</p>${active&&!automatic?'<p class="notice">기존 링크의 공개 범위를 유지 중입니다. 전체 여행 공유는 아래 미리보기 확인 후 시작됩니다.</p>':''}<button class="share-secondary" data-preview-share>공개 화면 전체 미리보기</button><button class="share-tertiary" data-reload-share>다시 불러오기</button></section>
 ${active?`<section data-share-result><span class="share-badge">공유 중</span><div class="share-link-row"><input readonly aria-label="공유 링크" value="${esc(link())}"><button data-copy-share aria-label="공유 링크 복사">⧉</button></div><button class="share-danger" data-disable-share>공유 중단</button><button class="share-tertiary" data-rotate-share>링크 재발급</button><p class="hint">재발급하면 이전 링크는 즉시 무효화됩니다.</p></section>`:''}<div data-share-preview></div>`;
 if(preview)renderPreview();
 }
 function renderPreview(){
 const {items,summaries,report}=loaded.masked;
 dialog.querySelector('[data-share-preview]').innerHTML=`<section class="share-step"><h3>실제 공개 화면 · 일정 ${items.length}개</h3><p class="notice">자동 탐지는 모든 개인정보를 알아낼 수 없습니다. 아래 네 화면과 날짜별 내용을 확인하세요. 불확실한 자유 입력 문장은 기본 비공개입니다. 마스킹 ${report.masked}곳 · 비공개 ${report.hidden}곳. 원본은 유지됩니다.</p>${report.omissions.length?'<details><summary>비공개 처리 이유 보기</summary><ul>'+report.omissions.map(x=>'<li>'+esc(x.where)+' — '+esc(x.reason)+'</li>').join('')+'</ul><p class="hint">비공개 원문은 이 미리보기에 전달하지 않습니다. 원본 일정에서 확인할 수 있습니다.</p></details>':''}<nav class="share-preview-tabs">${views.map((v,i)=>`<button data-preview-view="${v}" aria-pressed="${v===view}">${['HOME','ITINERARY','STAY & BOOKING','CHECKLIST'][i]}</button>`).join('')}</nav><div class="share-preview-screen">${shareScreen(view,items,summaries,day)}</div>${loaded.config?.active&&loaded.config.sharingPolicy===MASK_POLICY?'<p class="hint">전체 여행 공유 중 · 변경 내용은 자동 반영됩니다.</p>':'<p>이 화면과 이후 마스킹된 새 일정·예약 제목·체크리스트의 자동 공개에 동의하면 시작하세요.</p><button class="share-primary" data-publish-share>전체 미리보기를 확인했으며 공유 시작</button>'}</section>`;
 }
 async function refresh(){loaded=await loadSharing(db,uid,{legacy:false});preview=false;render();}
 dialog.onclick=async e=>{
 const b=e.target.closest('button');if(!b||busy)return;
 if(b.hasAttribute('data-close')){dialog.close();return;}
 busy=true;error.textContent='';dialog.setAttribute('aria-busy','true');
 try{
 if(b.dataset.previewView){view=b.dataset.previewView;renderPreview();}
 else if(b.dataset.shareDate||b.dataset.day){day=b.dataset.shareDate||b.dataset.day;view='itinerary';renderPreview();}
 else if(b.dataset.shift){day=dates[Math.max(0,Math.min(dates.length-1,dates.indexOf(day)+Number(b.dataset.shift)))];renderPreview();}
 else if(b.hasAttribute('data-reload-share'))await refresh();
 else if(b.hasAttribute('data-copy-share')){await navigator.clipboard.writeText(link());b.textContent='✓';error.textContent='공유 링크를 복사했습니다.';}
 else if(b.hasAttribute('data-disable-share')||(b.hasAttribute('data-toggle-share')&&loaded.config?.active&&loaded.config.sharingPolicy===MASK_POLICY)){
 if(confirm('공유를 중단할까요? 기존 링크의 조회가 차단됩니다.')){await disableSharing(db,uid,loaded.config.revision);await refresh();}
 }else if(b.hasAttribute('data-publish-share')){
 if(!preview)throw Error('전체 미리보기를 먼저 확인해 주세요.');
 await publishSharing(db,uid,loaded,maskedScope());await refresh();error.textContent='전체 여행 공유를 시작했습니다. 이후 변경은 자동 반영됩니다.';
 }else if(b.hasAttribute('data-rotate-share')){
 if(loaded.config.sharingPolicy!==MASK_POLICY){preview=true;renderPreview();error.textContent='기존 범위를 확대하려면 먼저 전체 미리보기를 확인하고 공유를 시작하세요.';}
 else if(confirm('새 링크를 발급하면 이전 링크는 즉시 무효화됩니다. 재발급할까요?')){loaded=await loadSharing(db,uid,{legacy:false});await publishSharing(db,uid,loaded,maskedScope(),true);await refresh();}
 }else if(b.hasAttribute('data-preview-share')||b.hasAttribute('data-toggle-share')){preview=true;renderPreview();}
 }catch(err){error.textContent=err.code==='permission-denied'?'firestore.simple-sharing.rules 및 모든 기기의 앱 업데이트를 확인해 주세요.':err.message;}
 finally{busy=false;dialog.removeAttribute('aria-busy');}
 };
 try{await refresh();}catch(e){content.textContent='공유 설정을 불러오지 못했습니다.';error.textContent=e.message;}
}
