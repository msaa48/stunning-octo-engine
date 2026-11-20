// جسر أندرويد (Capacitor): الحافظة، فتح الروابط، تنزيل الملفات. بيتجرّب ببلجنات وهمية.
const {JSDOM}=require('jsdom'); const fs=require('fs'), path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
const a=html.indexOf('/* ===== تطبيق أندرويد (Capacitor)'), b=html.indexOf('function normalizeArabic(s){');
const code=html.slice(a,b);
let fails=0; const ok=(c,m)=>{console.log((c?'✅ ':'❌ ')+m); if(!c) fails++;};
function mk(native){
  const dom=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only',url:'https://localhost/'}); const w=dom.window;
  const calls=[]; w.__calls=calls; let n=0;
  w.URL.createObjectURL=()=> 'blob:https://localhost/'+(++n);
  w.showToast=m=>calls.push(['toast',m]);
  if(native){
    w.Capacitor={isNativePlatform:()=>true, Plugins:{}, registerPlugin:name=>({
      Clipboard:{read:async()=>({value:'AQ.copied-key'}), write:async o=>{calls.push(['clip.write',o.string])}},
      Browser:{open:async o=>{calls.push(['browser.open',o.url])}},
      Filesystem:{writeFile:async o=>{calls.push(['fs.write',o.path,o.directory,o.data]); return {uri:'file:///cache/'+o.path};}},
      Share:{share:async o=>{calls.push(['share',o.url,o.title])}}
    }[name])};
  }
  w.eval(code); return w;
}
(async()=>{
  // متصفح عادي: مفيش أي تغيير
  const web=mk(false); const _o=web.open;
  ok(web.masarIsNative()===false,'متصفح عادي: masarIsNative=false'); ok(web.open===_o,'متصفح عادي: window.open ماتغيّرش'); ok(!web.navigator.clipboard,'متصفح عادي: الحافظة ماتغيّرتش');
  // أندرويد
  const w=mk(true); const calls=w.__calls;
  ok(w.masarIsNative()===true,'أندرويد: masarIsNative=true');
  ok(await w.navigator.clipboard.readText()==='AQ.copied-key','قراية الحافظة بتروح للبلجن');
  await w.navigator.clipboard.writeText('نص'); ok(calls.some(c=>c[0]==='clip.write'&&c[1]==='نص'),'كتابة الحافظة بتروح للبلجن');
  const r=w.open('https://aistudio.google.com/apikey','_blank','noopener'); ok(calls.some(c=>c[0]==='browser.open'&&c[1].includes('aistudio')),'رابط خارجي بيتفتح بالـBrowser'); ok(!!r && r.closed===false,'window.open رجّع كائن (مش null)');
  w.open('https://wa.me/201000000000?text=x'); ok(calls.filter(c=>c[0]==='browser.open').length===2,'رابط واتساب بيتفتح برا التطبيق');
  // تنزيل Word: blob + a.download
  const blob=new w.Blob(['docx-bytes'],{type:'application/octet-stream'}); const url=w.URL.createObjectURL(blob);
  const aEl=w.document.createElement('a'); aEl.href=url; aEl.download='امتحان.docx'; w.document.body.appendChild(aEl); aEl.click();
  await new Promise(r=>setTimeout(r,60));
  const wr=calls.find(c=>c[0]==='fs.write'); ok(wr && wr[1]==='امتحان.docx' && wr[2]==='CACHE','الملف اتحفظ في الكاش باسمه');
  ok(wr && Buffer.from(wr[3],'base64').toString()==='docx-bytes','محتوى الملف سليم (base64)');
  ok(calls.some(c=>c[0]==='share'&&c[1]==='file:///cache/امتحان.docx'),'شيت المشاركة اتفتح');
  // ورقة الامتحان (window.open على blob)
  calls.length=0; const hb=new w.Blob(['<html></html>'],{type:'text/html'}); const hu=w.URL.createObjectURL(hb); const hw=w.open(hu,'_blank');
  await new Promise(r=>setTimeout(r,60)); ok(!!hw,'window.open(blob) رجّع كائن'); ok(calls.some(c=>c[0]==='fs.write'&&c[1]==='exam.html'),'ورقة الامتحان اتحفظت exam.html'); ok(calls.some(c=>c[0]==='share'),'ورقة الامتحان اتشاركت');
  // اسم ملف فيه رموز ممنوعة
  calls.length=0; const a2=w.document.createElement('a'); a2.href=w.URL.createObjectURL(new w.Blob(['x'])); a2.download='a/b:c?.docx'; a2.click(); await new Promise(r=>setTimeout(r,60));
  ok(calls.find(c=>c[0]==='fs.write')[1]==='a-b-c-.docx','الرموز الممنوعة في اسم الملف اتنضفت');
  // روابط عادية (anchor من غير download) بتشتغل زي الأول
  console.log(fails?('FAILED '+fails):'ALL NATIVE-BRIDGE CHECKS PASSED'); process.exit(fails?1:0);
})();
