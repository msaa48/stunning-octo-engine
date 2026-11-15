// تسجيل أسئلة المساعد: إزالة الأسماء/الأرقام، التجميع محليًا، الإرسال، والاسترجاع عند الفشل + لوحة المالك
const fs=require('fs'),path=require('path');const {JSDOM}=require('jsdom');
const {ctx,api,db}=require('./harness');let f=0;const ok=(c,m)=>{console.log((c?'✅ ':'❌ ')+m);if(!c)f++;};
const store={};ctx.localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v)}};
let calls=[],fail=false;ctx.supabaseClient={rpc:async(n,p)=>{calls.push([n,p]);return fail?{error:{message:'x'}}:{data:null}}};
ctx.setTimeout=(fn)=>0; ctx.clearTimeout=()=>{};
const run=(c)=>require('vm').runInContext(c,ctx);
ctx.session.role='PARENT';ctx.session.personId='p1';
const S=q=>run(`assistantSanitizeQ(${JSON.stringify(q)})`);
(async()=>{
 ok(!S('تقرير عن احمد محمد علي').includes('احمد'),'اسم الطالب بيتشال');
 ok(S('منى خالد حضرت؟').startsWith('[اسم] [اسم]'),'الاسم الأول والتاني');
 ok(!/\d{3,}/.test(S('اتصل بيه على 01012345678')) && S('اتصل بيه على 01012345678').includes('#'),'أرقام التليفون');
 ok(S('ابعتلي على ahmed@test.com').includes('[بريد]'),'الإيميل');
 ok(S('كام طالب غايب النهاردة')==='كام طالب غايب النهاردة','سؤال عادي بيفضل زي ما هو');
 run(`assistantLogOutcome('local')`);run(`assistantLogOutcome('none','اكتب لي قصيدة عن احمد')`);run(`assistantLogOutcome('ai','قارن الشهر ده باللي فات')`);
 const st=JSON.parse(store['masar_asst_qlog_v1']);
 ok(st.stats.local===1&&st.stats.none===1&&st.stats.ai===1,'العدادات اتجمعت محليًا');
 ok(st.items.length===2&&!st.items[0].q.includes('احمد'),'العناصر متنظفة (الـlocal مفيهوش نص)');
 await run(`assistantQLogFlush()`);
 const c=calls.filter(x=>x[0]==='assistant_log_batch');
 ok(c.length===1&&c[0][1].p_items.length===2&&c[0][1].p_stats.local===1,'اتبعت دفعة واحدة');
 ok(JSON.parse(store['masar_asst_qlog_v1']||'{}').items===undefined,'المخزن اتفضّى بعد النجاح');
 run(`assistantLogOutcome('none','سؤال فاشل')`);fail=true;await run(`assistantQLogFlush()`);
 const back=JSON.parse(store['masar_asst_qlog_v1']);ok(back.items&&back.items.length===1&&back.stats.none===1,'لو الإرسال فشل البيانات بترجع للمخزن');
 fail=false;ctx.navigator.onLine=false;calls=[];await run(`assistantQLogFlush()`);ok(calls.length===0,'أوفلاين: مفيش إرسال والبيانات محفوظة');ctx.navigator.onLine=true;
 // الحد 30
 for(let i=0;i<40;i++)run(`assistantLogOutcome('none','سؤال رقم زيادة ${'x'.repeat(i%3)}')`);
 ok(JSON.parse(store['masar_asst_qlog_v1']).items.length<=30,'حد أقصى 30 سؤال في الدفعة');
 // ---- لوحة المالك ----
 const html=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
 const a=html.indexOf('/* ---------- أسئلة المساعد (شاشة المالك)'),b=html.indexOf('/* ---------- لوحة مفاتيح الـAI عند مالك المنصة');
 const fa=(()=>{const i=html.indexOf('function faEsc');let d=0,j=html.indexOf('{',i);for(;;j++){if(html[j]=='{')d++;else if(html[j]=='}'){d--;if(!d)break;}}return html.slice(i,j+1)})();
 const sec=html.slice(html.indexOf('<div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">\n      <span>❓'),html.indexOf('<div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">\n      <span>🔑'));
 const w=new JSDOM('<body>'+sec+'</body>',{runScripts:'outside-only'}).window;const marks=[];const toasts=[];
 w.supabaseClient={rpc:async(n,p)=>{if(n==='assistant_questions_overview')return{data:{stats:{local:70,ai:10,fallback:5,none:15},questions:[
  {q:'قارن الشهر ده باللي فات',cnt:7,last_seen:'2026-11-05T10:00:00Z',centers:3,roles:['ADMIN'],none:5,fallback:0,ai:2,resolved:false},
  {q:'اكتب رسالة لولي أمر <img src=x onerror=alert(1)>',cnt:2,last_seen:'2026-11-05T10:00:00Z',centers:1,roles:['TEACHER'],none:0,fallback:0,ai:2,resolved:false},
  {q:'سؤال قديم',cnt:1,last_seen:'2026-11-01T10:00:00Z',centers:1,roles:['PARENT'],none:1,fallback:0,ai:0,resolved:true}]}};
  if(n==='assistant_question_mark'){marks.push(p);return{error:null}}return{data:null}}};
 w.showToast=m=>toasts.push(m);w.assistantFmtDate=d=>String(d).slice(0,10);
 w.navigator.clipboard={writeText:async t=>{w.__copied=t}};
 w.eval(fa+'\n'+html.slice(a,b)+'\nwindow.__q={saQRender,saQTab,saQMark,saQCopy};');
 const $=s=>w.document.querySelector(s);
 await w.__q.saQRender();
 ok($('#sa-q-summary').textContent.includes('70% اتجاوب أوفلاين'),'ملخص التغطية');
 ok($('#sa-q-list').textContent.includes('قارن الشهر ده')&&!$('#sa-q-list').textContent.includes('سؤال قديم'),'تاب «محتاجة تطوير»');
 ok(!$('#sa-q-list').innerHTML.includes('<img src=x'),'XSS متهرّب');
 w.__q.saQTab('ai');ok($('#sa-q-list').textContent.includes('اكتب رسالة'),'تاب AI');
 w.__q.saQTab('done');ok($('#sa-q-list').textContent.includes('سؤال قديم'),'تاب تم');
 w.__q.saQTab('need');await w.__q.saQMark(0,true);ok(marks[0]&&marks[0].p_q==='قارن الشهر ده باللي فات'&&marks[0].p_resolved===true,'تعليم «اتحلّت»');
 ok(!$('#sa-q-list').textContent.includes('قارن الشهر'),'بتختفي من «محتاجة تطوير» بعد التعليم');
 await w.__q.saQRender();w.__q.saQTab('need');await w.__q.saQCopy();ok((w.__copied||'').includes('قارن الشهر ده')&&(w.__copied||'').includes('tests/jsdom'),'نسخ برومبت لـClaude');
 console.log(f?'FAILED '+f:'ALL QLOG CHECKS PASSED');
})();
