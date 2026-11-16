// تحقق الموديل على الجهاز: اسم ملف q8 الصحيح + استيراد الملف اللي اتنزّل من إشعارات الموبايل (كاش وهمي)
const fs=require('fs'), vm=require('vm'), path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
const a=html.indexOf('const LOCAL_AI = {'), b=html.indexOf('async function localAiRemove');
let code=html.slice(a,b);
// نضيف دوال التحقق/الاستيراد بس (من غير الواجهة)
const pick=n=>{const x=html.indexOf('async function '+n+'(')>=0?html.indexOf('async function '+n+'('):html.indexOf('function '+n+'(');let d=0,i=html.indexOf('{',x);for(;i<html.length;i++){if(html[i]=='{')d++;else if(html[i]=='}'){d--;if(!d)break;}}return html.slice(x,i+1)+'\n';};
const store=new Map(); const cache={ async keys(){return [...store.keys()].map(u=>({url:u}));}, async match(k){const u=typeof k==='string'?k:k.url;return store.has(u)?store.get(u).clone():undefined;}, async put(k,res){const u=typeof k==='string'?k:k.url;const buf=await res.arrayBuffer();store.set(u,new Response(buf,{status:200,headers:res.headers}));}, async delete(k){store.delete(typeof k==='string'?k:k.url);} };
const ls={}; 
const ctx={console,Response,Promise,JSON,Date,Math,Object,Array,String,Number,Error,Set,
  caches:{open:async()=>cache}, navigator:{storage:{persist:async()=>true,estimate:async()=>({quota:5e9,usage:0})},deviceMemory:8,onLine:true},
  window:{isSecureContext:true}, localStorage:{getItem:k=>ls[k]??null,setItem:(k,v)=>{ls[k]=v},removeItem:k=>delete ls[k]},
  WebAssembly:{}, fetch:async(u)=>{ if(/(config|tokenizer|generation_config|tokenizer_config)\.json$/.test(u)) return new Response('{}',{status:200}); return new Response('x',{status:404}); }, atob};
vm.createContext(ctx);
vm.runInContext(code+pick('localAiCheckDevice')+pick('localAiVerify')+pick('localAiImportFile')+'\nthis.api={LOCAL_AI,localAiVerify,localAiImportFile,localAiNativeUrl,localAiHint};',ctx);
const api=ctx.api; let fails=0; const ok=(c,m)=>{console.log((c?'✅ ':'❌ ')+m); if(!c) fails++;};
const MB=1048576, M='https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct/resolve/main/';
const put=(f,len)=>store.set(M+f,new Response('x',{status:200,headers:len?{'content-length':String(len)}:{}}));
(async()=>{
  // 1) الباج القديم: ملف باسم model_q8.onnx مش هو اللي Transformers.js بيحمّله
  put('config.json'); put('tokenizer.json'); put('onnx/model_q8.onnx',512*MB);
  ok(await api.localAiVerify('q8')===false,'q8: ملف باسم model_q8.onnx (الاسم الغلط) مش بيتحسب');
  store.clear(); put('config.json'); put('tokenizer.json'); put('onnx/model_quantized.onnx',512*MB);
  ok(await api.localAiVerify('q8')===true,'q8: ملف model_quantized.onnx (الاسم الصح) بيتحسب');
  store.clear(); put('config.json'); put('tokenizer.json'); put('onnx/model_q4f16.onnx',483*MB);
  ok(await api.localAiVerify('q4f16')===true,'q4f16: model_q4f16.onnx بيتحسب');
  ok(api.localAiNativeUrl('q8')===M+'onnx/model_quantized.onnx?download=true','رابط التحميل العادي q8 صح');
  // 2) الاستيراد
  store.clear();
  const mkFile=(size)=>({size, stream(){return new Response('model-bytes').body;}});
  let err=null; try{ await api.localAiImportFile(mkFile(10*MB)); }catch(e){ err=e; }
  ok(err && /الحجم المتوقع/.test(err.message),'ملف صغير غلط: رسالة واضحة');
  ok(store.size===0,'ملف غلط: ماكتبش حاجة في الكاش');
  await api.localAiImportFile(mkFile(512*MB));
  ok(store.has(M+'onnx/model_quantized.onnx'),'الاستيراد حفظ الملف الكبير بالمفتاح الصح');
  ok(store.has(M+'config.json') && store.has(M+'tokenizer.json'),'الاستيراد جاب ملفات الموديل الصغيرة');
  ok(store.get(M+'onnx/model_quantized.onnx').headers.get('content-length')===String(512*MB),'content-length متسجّل');
  ok(await api.localAiVerify('q8')===true,'بعد الاستيراد: التحقق ناجح');
  ok(api.localAiHint() && api.localAiHint().dtype==='q8','علامة الموديل اتسجّلت');
  // 3) الإنترنت واقع وقت جلب الملفات الصغيرة
  store.clear(); ctx.fetch=async()=>{throw new Error('offline')};
  err=null; try{ await api.localAiImportFile(mkFile(512*MB)); }catch(e){ err=e; }
  ok(err && /الملفات الصغيرة|الإنترنت/.test(err.message),'من غير نت: رسالة واضحة');
  console.log(fails? ('FAILED '+fails):'ALL LOCAL-AI IMPORT CHECKS PASSED'); process.exit(fails?1:0);
})();
