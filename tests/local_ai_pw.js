// اختبار Playwright للذكاء الاصطناعي على الجهاز بمكتبة وهمية (مفيش تحميل حقيقي): الزر، الفحص، الكاش، سلسلة البدائل.
// التشغيل: node tests/local_ai_pw.js   (محتاج playwright و python3)
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path');
const ROOT = path.join(__dirname, '..'); const PORT = 8765;
const FAKE = `
export const env = {};
export class InterruptableStoppingCriteria { interrupt(){ globalThis.__interrupted = (globalThis.__interrupted||0)+1; } }
export async function pipeline(task, model, opts){
  const dt = opts.dtype, size = dt==='q4f16' ? 483*1048576 : 512*1048576;
  if(opts.progress_callback){
    for(let i=1;i<=4;i++){ opts.progress_callback({status:'progress', file:'onnx/model_'+dt+'.onnx', loaded:size*i/4, total:size}); await new Promise(r=>setTimeout(r,30)); }
    opts.progress_callback({status:'done', file:'onnx/model_'+dt+'.onnx'});
  }
  if(!globalThis.__noCache){
    const c = await caches.open('transformers-cache'), base = 'https://huggingface.co/'+model+'/resolve/main/';
    await c.put(base+'config.json', new Response('{}', {headers:{'content-length':'2'}}));
    await c.put(base+'tokenizer.json', new Response('{}', {headers:{'content-length':'2'}}));
    await c.put(base+'onnx/model_'+dt+'.onnx', new Response('x', {headers:{'content-length':String(size)}}));
  }
  globalThis.__loads = (globalThis.__loads||0)+1;
  const fn = async (msgs, o) => {
    globalThis.__calls = (globalThis.__calls||0)+1;
    if(globalThis.__mode==='hang') await new Promise(()=>{});
    if(globalThis.__mode==='throw') throw new Error('boom');
    return [{generated_text:[...msgs, {role:'assistant', content: globalThis.__reply}]}];
  };
  fn.dispose = async ()=>{ globalThis.__disposed = (globalThis.__disposed||0)+1; };
  return fn;
}`;
let pass = 0, fail = 0; const ck = (n, c, x) => { if(c){ pass++; console.log('✅', n); } else { fail++; console.log('❌', n, x===undefined?'':JSON.stringify(x)); } };
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '-d', ROOT], {stdio:'ignore'}); await new Promise(r=>setTimeout(r,800));
  const b = await chromium.launch();
  async function open(opts){
    opts = opts || {};
    const ctx = opts.ctx || await b.newContext({viewport:{width:390,height:800}});
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e=>errs.push(String(e)));
    await p.route(/^https?:\/\/(?!localhost)/, r=>{ const u = r.request().url(); if(u.indexOf('@huggingface/transformers@4.3.2')>=0) return r.fulfill({contentType:'application/javascript', body:FAKE}); return r.abort(); });
    await p.addInitScript(o => {
      const mk = () => new Proxy(function(){}, { get:(t,k)=> k==='then'?undefined:mk(), apply:()=>mk() }); window.supabase = { createClient: () => mk() };
      if(o.mem !== undefined) Object.defineProperty(navigator, 'deviceMemory', {get:()=>o.mem});
      if(o.nogpu) Object.defineProperty(navigator, 'gpu', {get:()=>undefined});
      if(o.gpu) Object.defineProperty(navigator, 'gpu', {get:()=>({requestAdapter: async()=>({features:{has:f=>f==='shader-f16'}})})});
    }, opts);
    await p.goto('http://localhost:'+PORT+'/index.html'); await p.waitForTimeout(700);
    await p.evaluate(() => {
      const base = loadDB(); const db = Object.assign({}, base, {children:[{id:'c1',name:'سلمى'}], teachers:[], events:[], payments:[], teacherAttendance:[]});
      window.loadDB = () => db; session.role='ADMIN'; assistantTypeSpeed = 0; LOCAL_AI.TIMEOUT_MS = 1500;
      window.__apiCalls = 0; window.aiChainCall = async () => { window.__apiCalls++; if(window.__apiFail) throw new Error('GW:ALL_FAILED'); return '{"reply":"رد من الـAPI"}'; };
      window.supabaseClient = {rpc: async()=>({data:[]})};
    });
    return {p, ctx, errs};
  }
  const txt = p => p.evaluate(()=> document.getElementById('asst-localai').innerText);
  const visible = (p, id) => p.evaluate(id => !!document.getElementById(id), id);
  const openAst = async p => { await p.evaluate(()=> openAssistant()); await p.waitForTimeout(500); };
  const lastBot = p => p.evaluate(()=> { const r = [...document.querySelectorAll('.asst-row.bot .asst-text')]; return r.length ? r[r.length-1].textContent : ''; });

  // 1) جهاز ضعيف: رسالة بس من غير زر
  { const {p} = await open({mem:2, nogpu:true}); await openAst(p);
    ck('جهاز رامه 2GB: رسالة من غير زر', /مش مناسب/.test(await txt(p)) && !(await visible(p,'lai-start')), await txt(p)); await p.close(); }
  // 1ب) غير المدير: الزر مخفي
  { const {p} = await open({mem:4, nogpu:true}); await p.evaluate(()=>{ session.role='PARENT'; }); await openAst(p);
    ck('ولي الأمر: مفيش زر ولا رسالة', !(await visible(p,'lai-start')) && (await txt(p)).trim()==='', await txt(p));
    ck('ولي الأمر: الموديل مش مستخدم', await p.evaluate(()=> !localAiUsable())); await p.close(); }
  // 2) جهاز كويس بدون WebGPU → زر + تأكيد بحجم q8 (512) ثم تحميل وتفعيل
  const ctx = await b.newContext({viewport:{width:390,height:800}});
  { const {p, errs} = await open({mem:4, nogpu:true, ctx}); await openAst(p);
    ck('بدون WebGPU: الزر ظاهر', await visible(p,'lai-start'), await txt(p));
    await p.click('#lai-start'); await p.waitForTimeout(300);
    const t = await txt(p); ck('رسالة التأكيد فيها الحجم 512 وواي فاي', /512/.test(t) && /واي فاي/.test(t) && /مرة واحدة/.test(t), t);
    await p.click('#lai-cancel'); ck('إلغاء يرجّع الزر', await visible(p,'lai-start'));
    await p.click('#lai-start'); await p.click('#lai-go'); await p.waitForTimeout(1500);
    ck('بعد التحميل: مفعّل ✓ + زر الحذف', /مفعّل/.test(await txt(p)) && await visible(p,'lai-del'), await txt(p));
    ck('الموديل اتفضّى من الرام بعد التثبيت', await p.evaluate(()=> __disposed>=1 && !localAiPipe));
    ck('زر التحميل مبقاش ظاهر', !(await visible(p,'lai-start')));
    ck('hint اتسجل بنوع q8', await p.evaluate(()=> (localAiHint()||{}).dtype==='q8'));
    ck('مفيش أخطاء صفحة', errs.length===0, errs); await p.close(); }
  // 3) إعادة فتح المتصفح (صفحة جديدة بنفس التخزين): لسه مفعّل من الكاش مش بس العلامة
  { const {p} = await open({mem:4, nogpu:true, ctx}); await openAst(p);
    ck('بعد إعادة الفتح: مفعّل (الكاش فعلًا)', /مفعّل/.test(await txt(p)), await txt(p));
    // نمسح العلامة بس والملفات موجودة → يتعرف عليها
    await p.evaluate(()=> localStorage.removeItem(LOCAL_AI.STORAGE_FLAG)); await openAst(p);
    ck('العلامة اتمسحت والملفات موجودة: لسه مفعّل', /مفعّل/.test(await txt(p)), await txt(p));
    // نمسح الملفات بس والعلامة موجودة → ما نقولش مفعّل
    await p.evaluate(async()=>{ const c = await caches.open(LOCAL_AI.CACHE); for(const k of await c.keys()) await c.delete(k); localAiSetHint({dtype:'q8'}); });
    await openAst(p); ck('العلامة موجودة والملفات اتمسحت: بيعرض الزر مش مفعّل', await visible(p,'lai-start') && !/مفعّل/.test(await txt(p)), await txt(p)); await p.close(); }
  // 4) WebGPU فيه f16 → q4f16 (483)
  { const {p} = await open({mem:4, gpu:true}); await openAst(p); await p.click('#lai-start'); await p.waitForTimeout(300);
    ck('WebGPU: حجم 483', /483/.test(await txt(p)), await txt(p)); await p.close(); }
  // 5) تحميل ناقص: المكتبة خلصت بس مكتبتش ملفات → مفيش "مفعّل"
  { const {p} = await open({mem:4, nogpu:true}); await openAst(p);
    await p.evaluate(()=>{ __noCache = true; }); // إعداد في الصفحة مش في وحدة المكتبة؛ نعمله عبر globalThis
    await p.click('#lai-start'); await p.click('#lai-go'); await p.waitForTimeout(1500);
    ck('تحميل ناقص: رسالة خطأ + حاول تاني', /ماكملش|مش موجودة|مشكلة/.test(await txt(p)) && !/مفعّل/.test(await txt(p)), await txt(p)); await p.close(); }
  // 6) سلسلة البدائل
  const mk = async () => { const o = await open({mem:4, nogpu:true}); const p = o.p; await openAst(p); await p.click('#lai-start'); await p.click('#lai-go'); await p.waitForTimeout(1500); await p.evaluate(()=>{ __mode='ok'; }); await p.evaluate(()=>{ assistantNewChat(); }); return o; };
  { const {p} = await mk();
    const q = 'ازاي اعمل حاجة غريبة خالص ملهاش اداة';
    await p.evaluate(()=>{ __reply='{"tool":"class_days","args":{}}'; __mode='ok'; }); // أداة مش موجودة في الأدوار → ترفض وتروح للـAPI
    await p.evaluate(q=> assistantAsk(q), q); await p.waitForTimeout(400);
    ck('أداة غلط من الموديل → API', await p.evaluate(()=> __apiCalls===1), await lastBot(p));
    await p.evaluate(()=>{ __reply='{"reply":"this is english text only"}'; __apiCalls=0; });
    await p.evaluate(q=> assistantAsk(q+' 2'), q); await p.waitForTimeout(400);
    ck('رد غير عربي → API', await p.evaluate(()=> __apiCalls===1));
    await p.evaluate(()=>{ __reply=''; __apiCalls=0; });
    await p.evaluate(q=> assistantAsk(q+' 3'), q); await p.waitForTimeout(400);
    ck('رد فاضي → API', await p.evaluate(()=> __apiCalls===1));
    await p.evaluate(()=>{ __reply='{"reply":"مش لاقي حاجة بالاسم ده في بياناتك"}'; __apiCalls=0; });
    await p.evaluate(q=> assistantAsk(q+' 4'), q); await p.waitForTimeout(400);
    ck('رد عربي سليم من الموديل → بيتعرض من غير API', await p.evaluate(()=> __apiCalls===0) && /بياناتك/.test(await lastBot(p)), await lastBot(p));
    await p.evaluate(()=>{ __reply='{"tool":"overdue_payments","args":{}}'; __apiCalls=0; });
    await p.evaluate(q=> assistantAsk(q+' 5'), q); await p.waitForTimeout(500);
    ck('أداة صحيحة من الموديل → بتتنفّذ محليًا من غير API', await p.evaluate(()=> __apiCalls===0) && /متابعة|مفيش|مفيش حد|دفع|متأخر/.test(await lastBot(p)), await lastBot(p));
    await p.evaluate(()=>{ __mode='hang'; __apiCalls=0; __interrupted=0; });
    const t0 = Date.now(); await p.evaluate(q=> assistantAsk(q+' 6'), q); await p.waitForTimeout(300);
    ck('الموديل بيتأخر (مهلة): بيتحوّل للـAPI + بيوقف التوليد', await p.evaluate(()=> __apiCalls===1 && __interrupted>=1), Date.now()-t0);
    await p.evaluate(()=>{ __mode='throw'; __apiCalls=0; });
    await p.evaluate(q=> assistantAsk(q+' 7'), q); await p.waitForTimeout(300);
    ck('الموديل بيرمي خطأ: API', await p.evaluate(()=> __apiCalls===1));
    // 3 فشل ورا بعض → يترك الموديل 10 دقايق
    await p.evaluate(q=> assistantAsk(q+' 8'), q); await p.waitForTimeout(200); await p.evaluate(q=> assistantAsk(q+' 9'), q); await p.waitForTimeout(200);
    ck('3 فشل ورا بعض: بيتوقف مؤقتًا', await p.evaluate(()=> !localAiUsable()));
    // أوفلاين + موديل فاشل → الأسئلة الجاهزة
    await p.evaluate(()=>{ localAiOffUntil=0; __mode='throw'; __apiCalls=0; Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true}); });
    await p.evaluate(()=> assistantAsk('كلام مش مفهوم خالص زززز')); await p.waitForTimeout(400);
    ck('أوفلاين والموديل فشل: الرد الجاهز (من غير API)', await p.evaluate(()=> __apiCalls===0) && /مفهمتش|مش قادر|هل تقصد/.test(await lastBot(p)), await lastBot(p));
    ck('الموديل المحلي بيرفض أي غرض غير المساعد', await p.evaluate(async()=>{ try{ await localAiAsk('exam','s','u'); return false; }catch(e){ return e.message==='forbidden'; } }));
    // الخروج من الشاشة يفضّي الرام
    await p.evaluate(()=>{ Object.defineProperty(navigator,'onLine',{get:()=>true,configurable:true}); __mode='ok'; __reply='{"reply":"تمام جدًا يا فندم"}'; localAiOffUntil=0; });
    await p.evaluate(()=> assistantAsk('سؤال تحميل الرام الاول')); await p.waitForTimeout(400);
    const loaded = await p.evaluate(()=> !!localAiPipe); await p.evaluate(()=> showScreen('admin-screen')); await p.waitForTimeout(200);
    ck('الموديل بيتحمّل عند أول سؤال وبيتفضّى لما نخرج من الشاشة', loaded && await p.evaluate(()=> !localAiPipe), loaded);
    // حذف الموديل
    await p.evaluate(()=> { openAssistant(); assistantNewChat(); }); await p.waitForTimeout(500); p.once('dialog', d=>d.accept());
    await p.click('#lai-del'); await p.waitForTimeout(400);
    ck('حذف الموديل: الكاش اتمسح والزر رجع', await p.evaluate(async()=>{ const c = await caches.open(LOCAL_AI.CACHE); return (await c.keys()).length===0; }) && await visible(p,'lai-start'));
    await p.close(); }
  console.log(`\n${fail?'FAILED '+fail:'ALL PASSED'} (${pass} ✓)`);
  await b.close(); srv.kill(); process.exit(fail?1:0);
})();
