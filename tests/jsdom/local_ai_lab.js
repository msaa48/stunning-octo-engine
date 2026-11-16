// الشات التجريبي المؤقت للموديل المحلي: بيكلّم الموديل بس (لو ندّه أي API/لوج هيرمي ReferenceError)
const {JSDOM}=require('jsdom'); const fs=require('fs'), path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
const a=html.indexOf('/* ===== TEMP: شات تجريبي'), b=html.indexOf('/* ===== END TEMP ===== */');
const block=html.slice(a,b);
const dom=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window; const log=[]; w.__log=log;
w.eval(`
let localAiReady = true, localAiPipe = null; let seenMsgs = []; let mode='ok';
const fakePipe = Object.assign(async (msgs, opts)=>{
  seenMsgs.push(msgs.map(m=>m.role+':'+m.content));
  if(mode==='hang'){ await new Promise(r=>{ const t=setInterval(()=>{ if(opts.stopping_criteria.i){ clearInterval(t); r(); } },10); }); opts.streamer.cb('نص جزئي'); return [{generated_text:[{role:'assistant',content:''}]}]; }
  for(const wd of ['اهلا ','بيك ','يا ','فندم']) { await new Promise(r=>setTimeout(r,5)); opts.streamer.cb(wd); }
  return [{generated_text:[...msgs,{role:'assistant',content:'اهلا بيك يا فندم'}]}];
}, {tokenizer:{}});
async function localAiGetLib(){ return {InterruptableStoppingCriteria: class{ interrupt(){ this.i=true; } }, TextStreamer: class{ constructor(tok,o){ this.cb=o.callback_function; } }}; }
async function localAiLoad(){ await new Promise(r=>setTimeout(r,10)); localAiPipe = fakePipe; return fakePipe; }
${block}
window.__api = { openLocalAiLab, laiLabSend, laiLabClose, setReady:v=>{localAiReady=v}, setMode:m=>{mode=m}, get seen(){return seenMsgs}, get busy(){return laiLabBusy} };
`);
const api=w.__api, $=id=>w.document.getElementById(id); let fails=0; const ok=(c,m)=>{console.log((c?'✅ ':'❌ ')+m); if(!c) fails++;};
const texts=()=>[...w.document.querySelectorAll('#lai-lab-msgs > div')].map(d=>d.textContent);
(async()=>{
  api.openLocalAiLab(); ok(!!$('lai-lab'),'الشاشة اتفتحت');
  api.openLocalAiLab(); ok(w.document.querySelectorAll('#lai-lab').length===1,'فتحها تاني مابيكررهاش');
  ok(/أول سؤال هيحمّل/.test(texts()[0]),'رسالة البداية: الموديل لسه ماتحمّلش في الرام');
  await api.laiLabSend('ازيك؟');
  let t=texts(); ok(t.includes('ازيك؟'),'سؤال المستخدم اتعرض'); ok(t.includes('اهلا بيك يا فندم'),'رد الموديل اتعرض');
  ok(t.some(x=>/⏱ تحميل الموديل .*الإجمالي/.test(x)),'سطر الأزمنة ظهر'); ok(api.busy===false && $('lai-lab-send').disabled===false,'الزرار رجع بعد الرد');
  await api.laiLabSend('وإنت عامل إيه؟');
  ok(api.seen[1].some(x=>x==='user:ازيك؟') && api.seen[1].some(x=>x==='assistant:اهلا بيك يا فندم'),'السؤال التاني شايل سياق الأول');
  ok(api.seen[0][0].startsWith('system:'),'فيه system prompt مصري قصير');
  // زرار الإيقاف
  api.setMode('hang'); const p=api.laiLabSend('سؤال طويل'); await new Promise(r=>setTimeout(r,50));
  ok($('lai-lab-stop').style.display==='','زرار الإيقاف ظاهر أثناء التوليد'); $('lai-lab-stop').onclick(); await p;
  ok(api.busy===false && $('lai-lab-stop').style.display==='none','الإيقاف شغّال والزرار اختفى');
  // الموديل مش متفعّل
  api.setReady(false); const n=texts().length; await api.laiLabSend('تجربة'); ok(/مش متفعّل/.test(texts().slice(n).join(' ')),'من غير موديل: رسالة واضحة ومفيش توليد');
  api.laiLabClose(); ok(!$('lai-lab'),'الإغلاق شال الشاشة');
  console.log(fails?('FAILED '+fails):'ALL LAB CHECKS PASSED'); process.exit(fails?1:0);
})();
