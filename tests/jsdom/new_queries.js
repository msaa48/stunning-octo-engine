// أسئلة جديدة: أداء المدرّسين بفترة، التقارير، ذاكرة المحادثة، المدرّسين والامتحانات، تفاصيل المتأخرات
const fs=require('fs'), vm=require('vm');
const {ctx,api,db}=require('./harness');
const html=fs.readFileSync(require('path').join(__dirname,'..','..','index.html'),'utf8');
function constSrc(name){const a=html.indexOf('const '+name);let depth=0,i=html.indexOf('{',a);for(;i<html.length;i++){if(html[i]=='{')depth++;else if(html[i]=='}'){depth--;if(!depth)break;}}return html.slice(a,i+2)+'\n';}
function fnSrc(name){const a=html.indexOf('function '+name);let depth=0,i=html.indexOf('{',a);for(;i<html.length;i++){if(html[i]=='{')depth++;else if(html[i]=='}'){depth--;if(!depth)break;}}return html.slice(a,i+1)+'\n';}

// الدوال الحقيقية لحساب الأداء (من غير ستابس): من بداية إعدادات التقييم لحد computeAutoTeacherScore
const a=html.indexOf('function workingDaysInMonth'), pre=html.lastIndexOf('const EVAL_OLD_LABELS',a);
function cut(startMarker,endMarker){const x=html.indexOf(startMarker), y=html.indexOf(endMarker,x); if(x<0||y<0) throw new Error('marker '+startMarker+' / '+endMarker); return html.slice(x,y);}
let evalCode='';
try{
  const start=html.indexOf('function defaultEvalConfig'); 
  const end=html.indexOf('function ensureAutoEvalsUpToDate');
  evalCode=html.slice(Math.min(start,a,html.indexOf('function evalNum')), end);
}catch(e){ console.log('slice fail',e.message); }
ctx.monthKey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
ctx.uid=p=>p+'_x';
db.teacherAttendance=[]; db.taskCompletions=[]; db.settings={};
// بيانات أسبوع: السبت 31/10 → الجمعة 6/11 (النهاردة الأربعاء 4/11 الساعة 2 ضهرًا)
const att=(tid,day,type,h)=>({teacherId:tid,type,time:`2026-11-${String(day).padStart(2,'0')}T${h}:00:00`});
// هاني: حاضر كل الأيام وفي الميعاد. سعاد: حضرت يوم واحد ومتأخرة
[1,2,3,4].forEach(d=>{db.teacherAttendance.push(att('t1',d,'CHECK_IN','08'),att('t1',d,'CHECK_OUT','16'));});
db.teacherAttendance.push(att('t2',2,'CHECK_IN','12'));
db.attendance=[{id:'a',childId:'c1',classroomId:'r1',sessionDate:'2026-11-04',teacherId:'t1'},{id:'b',childId:'c1',classroomId:'r1',sessionDate:'2026-11-02',teacherId:'t1'}];
try{ vm.runInContext(constSrc('EVAL_METRICS')+fnSrc('isLateCheckIn')+evalCode+'\nthis.__ev={computeTeacherScoreDetail,getEvalConfig,buildEvalContext};',ctx); }catch(e){ console.log('eval load error:',e.message); process.exit(1); }
const out=[]; ctx.assistantRenderResult=async r=>{out.push(r)}; ctx.assistantAddText=async t=>{out.push({text:t})};
ctx.session.role='ADMIN';
ctx.computeTeacherScoreDetail=ctx.__ev.computeTeacherScoreDetail; ctx.getEvalConfig=ctx.__ev.getEvalConfig;
ctx.supabaseClient={from:()=>({select:()=>({order:()=>({limit:async()=>({data:[
  {teacher_id:'t1',teacher_name:'أ. هاني',title:'شهري رياضيات',archived:false,scheduled_at:'2026-11-20T10:00:00Z',created_at:'2026-11-01T10:00:00Z'},
  {teacher_id:'t1',teacher_name:'أ. هاني',title:'كويز وحدة 2',archived:true,scheduled_at:null,created_at:'2026-10-01T10:00:00Z'},
  {teacher_id:'t2',teacher_name:'أ. سعاد',title:'قواعد',archived:false,scheduled_at:null,created_at:'2026-10-20T10:00:00Z'}],error:null})})})})};
async function ask(q){
  const p=api.assistantPlan(q); out.length=0;
  let line=`«${q}» → `+(p?(p.reply?'reply: '+p.reply:`${p.tool} ${JSON.stringify(p.args||{})} conf=${p.conf}`):'null');
  if(p&&p.tool&&p.conf>=4){ try{ await api.assistantExecute(p); }catch(e){ line+=' !!ERR '+e.message; } line+='\n     '+out.map(r=>r.text?('📝'+r.text):('['+(r.title||'')+'] '+(r.summary||'')+' :: '+(r.rows||[]).map(x=>x.label+(x.sub?' ('+x.sub+')':'')).join(' | '))).join('\n     '); }
  console.log(line);
}
(async()=>{
  for(const q of ['مين من المدرسين اداؤه منخفض اخر اسبوع؟','مين افضل مدرس الشهر ده؟','اداء المدرسين الاسبوع اللي فات','هل في مدرسين شغالة على امتحانات؟','هاتلى شاشة التقارير','افتح التقارير','هاتلى شاشة الاحصائيات','هاتلي شاشة الميزانية','هل انت متذكر الرسايل اللي هنا فالشاشة؟','مين متأخر؟','هات بيانات الطالب سارة'])
    await ask(q);
  // لو الدور مدرّس: ماينفعش يشوف أداء المدرّسين
  ctx.session.role='TEACHER'; ctx.session.personId='t1';
  await ask('مين من المدرسين اداؤه منخفض اخر اسبوع؟');
})();
