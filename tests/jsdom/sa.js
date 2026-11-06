const fs=require('fs');const {JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','..','index.html'),'utf8');
const a=html.indexOf('/* ---------- لوحة مفاتيح الـAI عند مالك المنصة'), b=html.indexOf('async function initSuperAdminScreen(){');
const code=html.slice(a,b);
const fa=(()=>{const i=html.indexOf('function faEsc');let d=0,j=html.indexOf('{',i);for(;;j++){if(html[j]=='{')d++;else if(html[j]=='}'){d--;if(!d)break;}}return html.slice(i,j+1)})();
const ui=html.slice(html.indexOf('<div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">\n      <span>🔑'),html.indexOf('<div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">\n      <span>🗑️'));
const modal=html.slice(html.indexOf('<div class="modal-bg" id="sa-key-modal-bg">'),html.indexOf('<!-- Modal: دعوة عضو فريق جديد -->'));
const w=new JSDOM('<body>'+ui+modal+'</body>',{runScripts:'outside-only'}).window;
const calls=[];const toasts=[];
const ID1='11111111-1111-1111-1111-111111111111',ID2='22222222-2222-2222-2222-222222222222';
w.supabaseClient={rpc:async(n,p)=>{calls.push([n,p]);
 if(n==='ai_keys_overview')return{data:[
  {id:ID1,center_id:null,center_name:null,scope:'platform',provider:'groq',model:'llama',priority:100,enabled:true,vision:true,label:null,last_status:'ok',key_tail:'ab12',key_len:56,calls_today:0},
  {id:ID2,center_id:'c',center_name:'سنتر <img src=x onerror=alert(1)>',scope:'center',provider:'gemini',model:'gem',priority:10,enabled:true,last_status:'HTTP 503',key_tail:'zz99',key_len:39,calls_today:4}]};
 if(n==='ai_centers_ai_status')return{data:[{center_id:'c',center_name:'سنتر <img src=x onerror=alert(1)>',own_keys:1,own_keys_enabled:1,platform_calls_today:30},{center_id:'d',center_name:'بدون',own_keys:0,own_keys_enabled:0,platform_calls_today:5}]};
 if(n==='ai_update_key')return{error:p.p_key==='x'.repeat(30)?null:{message:'forbidden'}};
 return{data:[]};},functions:{invoke:async()=>({data:{diagnose:[{ok:true,source:'platform',provider:'groq',model:'m',ms:300}]}})}};
w.showToast=m=>toasts.push(m);w.closeModal=id=>w.document.getElementById(id).classList.remove('show');
w.eval(fa+'\n'+code+'\nwindow.__s={saKeysRender,saKeyEdit,saKeySave,saKeyToggle,saKeysDiagnose,get cache(){return saKeysCache}};');
const $=s=>w.document.querySelector(s);let f=0;const ok=(c,m)=>{console.log((c?'✅ ':'❌ ')+m);if(!c)f++;};
(async()=>{
 await w.__s.saKeysRender();
 const t=$('#sa-keys-list').textContent;
 ok(t.includes('••••ab12')&&t.includes('••••zz99'),'masked tails shown');
 ok(!$('#sa-keys-list').innerHTML.includes('<img src=x'),'XSS escaped in center name');
 ok($('#sa-keys-summary').textContent.includes('1 محتاج انتباه'),'summary counts failing key');
 ok($('#sa-keys-summary').textContent.includes('وصلت حد المنصة'),'summary mentions platform limit');
 ok(t.includes('بدون مفتاح خاص'),'centers without own key listed');
 w.__s.saKeyEdit(ID2);ok($('#sa-key-modal-bg').classList.contains('show')&&$('#sa-key-model').value==='gem','edit modal opens prefilled');
 await w.__s.saKeySave();ok($('#sa-key-msg').textContent.includes('مالك الأساسي'),'forbidden → clear message');
 $('#sa-key-new').value='x'.repeat(30);await w.__s.saKeySave();
 const last=calls.filter(c=>c[0]==='ai_update_key').pop()[1];
 ok(last.p_id===ID2&&last.p_key==='x'.repeat(30)&&last.p_model==='gem','save sends id+model+new key');
 ok(!$('#sa-key-modal-bg').classList.contains('show'),'modal closes on success');
 await w.__s.saKeyToggle(ID1,false);ok(calls.filter(c=>c[0]==='ai_update_key').pop()[1].p_enabled===false,'toggle off');
 await w.__s.saKeyToggle('bad-id',false);ok(calls.filter(c=>c[0]==='ai_update_key').length===3,'invalid id never sent');
 await w.__s.saKeysDiagnose();ok($('#sa-keys-diag').textContent.startsWith('OK'),'diagnose output');
 console.log(f?'FAILED '+f:'ALL PANEL CHECKS PASSED');
})();
