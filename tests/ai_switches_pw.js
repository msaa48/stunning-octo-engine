// اختبار مفاتيح تشغيل المساعد (لوحة المالك + تأثيرها على الشات). التشغيل: node tests/ai_switches_pw.js
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path');
const ROOT = path.join(__dirname, '..'); const PORT = 8767;
let pass = 0, fail = 0; const ck = (n, c, x) => { if(c){ pass++; console.log('✅', n); } else { fail++; console.log('❌', n, x===undefined?'':JSON.stringify(x)); } };
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '-d', ROOT], {stdio:'ignore'}); await new Promise(r=>setTimeout(r,800));
  const b = await chromium.launch();
  async function open(role, rpcMode){
    const p = await (await b.newContext({viewport:{width:390,height:800}})).newPage(); const errs = []; p.on('pageerror', e=>errs.push(String(e)));
    await p.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
    await p.addInitScript(() => { const mk = () => new Proxy(function(){}, { get:(t,k)=> k==='then'?undefined:mk(), apply:()=>mk() }); window.supabase = { createClient: () => new Proxy({}, { get:(t,k)=> k==='rpc' ? (n,a)=>window.__rpc(n,a) : k==='then' ? undefined : mk() }) }; window.__rpc = async()=>({data:[],error:null}); });
    await p.goto('http://localhost:'+PORT+'/index.html'); await p.waitForTimeout(700);
    await p.evaluate(([role, rpcMode]) => {
      const base = loadDB(); const db = Object.assign({}, base, {children:[{id:'c1',name:'سلمى'}], teachers:[], events:[], payments:[], teacherAttendance:[]});
      window.loadDB = () => db; session.role = role; session.isOwner = (role==='OWNER'); if(role==='OWNER') session.role='ADMIN'; assistantTypeSpeed = 0;
      window.__sw = [{key:'local_engine',enabled:true,value:null},{key:'on_device',enabled:true,value:'ADMIN'},{key:'api',enabled:true,value:null},{key:'suggestions',enabled:true,value:null}];
      window.__sets = []; window.__api = 0;
      window.__rpc = async (n, a) => {
        if(n==='ai_switches_get') return rpcMode==='fail' ? {data:null, error:{message:'function not found'}} : {data: JSON.parse(JSON.stringify(__sw)), error:null};
        if(n==='ai_switch_set'){ __sets.push(a); if(!session.isOwner) return {error:{message:'forbidden'}}; const r = __sw.find(x=>x.key===a.p_key); if(a.p_enabled!==null) r.enabled = a.p_enabled; if(a.p_value!==null) r.value = a.p_value; return {error:null}; }
        return {data:[], error:null};
      };
      window.aiChainCall = async () => { __api++; return '{"reply":"رد من الـAPI على سؤالك"}'; };
    }, [role, rpcMode]);
    return {p, errs};
  }
  const last = p => p.evaluate(()=> { const r = [...document.querySelectorAll('.asst-row.bot .asst-text')]; return r.length ? r[r.length-1].textContent : ''; });
  const ask = async (p, q) => { await p.evaluate(q=> assistantAsk(q), q); await p.waitForTimeout(350); };
  const SET = 'سؤال غريب ملوش علاقة بأي أداة خالص يا ريس';
  // 1) الافتراضي لما السيرفر مش متاح: كله شغّال
  { const {p} = await open('ADMIN','fail'); await p.evaluate(()=> aiSwitchesLoad(true));
    ck('الـRPC فشل: الافتراضي كله شغّال', await p.evaluate(()=> AI_SWITCHES.local_engine && AI_SWITCHES.api && AI_SWITCHES.suggestions && AI_SWITCHES.on_device && AI_SWITCHES.on_device_roles==='ADMIN'));
    await ask(p, SET); ck('الافتراضي: السؤال الغريب يروح للـAPI', await p.evaluate(()=>__api===1)); await p.close(); }
  // 2) قفل الـAPI
  { const {p} = await open('ADMIN'); await p.evaluate(()=>{ __sw.find(x=>x.key==='api').enabled=false; return aiSwitchesLoad(true); });
    await ask(p, SET); ck('الـAPI مقفول: مفيش نداء للـAPI + رد الأسئلة الجاهزة', await p.evaluate(()=>__api===0) && /مفهمتش|مش قادر|هل تقصد/.test(await last(p)), await last(p));
    await ask(p, 'مين الغايبين النهاردة'); ck('الـAPI مقفول: الفهم المحلي شغّال عادي', (await p.$$('.ai-card, .asst-text')).length>2); await p.close(); }
  // 3) قفل الفهم المحلي: السؤال المعروف يروح للـAPI
  { const {p} = await open('ADMIN'); await p.evaluate(()=>{ __sw.find(x=>x.key==='local_engine').enabled=false; return aiSwitchesLoad(true); });
    await ask(p, 'مين الغايبين النهاردة'); ck('الفهم المحلي مقفول: سؤال معروف راح للـAPI', await p.evaluate(()=>__api===1)); await p.close(); }
  // 4) قفل الاقتراحات
  { const {p} = await open('ADMIN'); await p.evaluate(()=>{ __sw.find(x=>x.key==='api').enabled=false; __sw.find(x=>x.key==='suggestions').enabled=false; return aiSwitchesLoad(true); });
    await ask(p, SET); const t = await last(p); ck('الاقتراحات مقفولة: رد قصير من غير «هل تقصد»', /مفهمتش/.test(t) && !(await p.$('.ai-card')), t); await p.close(); }
  // 5) كله مقفول
  { const {p} = await open('ADMIN'); await p.evaluate(()=>{ __sw.forEach(x=> x.enabled=false); return aiSwitchesLoad(true); });
    await ask(p, SET); ck('كله مقفول: رسالة «المساعد متوقّف»', /متوقّف/.test(await last(p)) && await p.evaluate(()=>__api===0), await last(p)); await p.close(); }
  // 6) الموديل على الجهاز: مين يشوفه
  { const {p} = await open('PARENT'); await p.evaluate(()=> aiSwitchesLoad(true));
    ck('ولي أمر + «المدير بس»: غير مسموح', await p.evaluate(()=> !aiOnDeviceAllowed()));
    await p.evaluate(()=>{ __sw.find(x=>x.key==='on_device').value='ALL'; return aiSwitchesLoad(true); });
    ck('ولي أمر + «كل الأدوار»: مسموح', await p.evaluate(()=> aiOnDeviceAllowed()));
    await p.evaluate(()=>{ __sw.find(x=>x.key==='on_device').enabled=false; return aiSwitchesLoad(true); });
    ck('الموديل مقفول: ولا دور مسموح + مش بيُستخدم', await p.evaluate(()=> !aiOnDeviceAllowed() && !(localAiReady=true, localAiUsable()))); await p.close(); }
  // 7) صفحة المالك
  { const {p, errs} = await open('OWNER'); await p.evaluate(()=>{ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active')); });
    await p.evaluate(()=> saSwitchesRender()); await p.waitForTimeout(300);
    const rows = await p.$$eval('#sa-sw-list button.badge', b=> b.map(x=>x.textContent.trim()));
    ck('صفحة المالك: 4 طرق ربط ظاهرة وكلها شغّالة', rows.length===4 && rows.every(t=>/شغّال/.test(t)), rows);
    p.once('dialog', d=>d.accept());
    await p.evaluate(()=> document.querySelectorAll('#sa-sw-list button.badge')[2].click()); await p.waitForTimeout(400);
    ck('قفل الـAPI من الصفحة: بيبعت للسيرفر ويتحدّث', await p.evaluate(()=> __sets.length===1 && __sets[0].p_key==='api' && __sets[0].p_enabled===false && AI_SWITCHES.api===false));
    ck('الزر بقى «مقفول»', (await p.$$eval('#sa-sw-list button.badge', b=> b[2].textContent)).includes('مقفول'));
    await p.evaluate(()=> document.querySelectorAll('#sa-sw-list select')[0].dispatchEvent(Object.assign(new Event('change'),{})));
    await p.evaluate(()=> { const s = document.querySelector('#sa-sw-list select'); s.value='ALL'; s.dispatchEvent(new Event('change')); }); await p.waitForTimeout(400);
    ck('تغيير «مين يشوف الموديل» لكل الأدوار', await p.evaluate(()=> AI_SWITCHES.on_device_roles==='ALL'));
    ck('مفيش أخطاء صفحة', errs.length===0, errs); await p.close(); }
  // 8) غير المالك: الأزرار معطّلة
  { const {p} = await open('ADMIN'); await p.evaluate(()=> saSwitchesRender()); await p.waitForTimeout(300);
    ck('مش مالك: الأزرار معطّلة', await p.$$eval('#sa-sw-list button.badge', b=> b.every(x=>x.disabled)));
    await p.evaluate(()=> saSwitchSet('local_engine', true, null)); await p.waitForTimeout(300);
    ck('مش مالك: السيرفر يرفض والواجهة ما بتتغيّرش', await p.evaluate(()=> AI_SWITCHES.local_engine===true && __sw[0].enabled===true)); await p.close(); }
  console.log(`\n${fail?'FAILED '+fail:'ALL PASSED'} (${pass} ✓)`); await b.close(); srv.kill(); process.exit(fail?1:0);
})();
