// تغطية أسئلة المدير الأوفلاين بعد إضافة (أعداد / غياب المدرّسين / أكتر غياب / اشتراكات قربت تنتهي / للقراءة فقط)
const {ctx,api,db}=require('./harness');
db.teacherAttendance=[{id:'ta1',teacherId:'t1',type:'CHECK_IN',time:'2026-11-04T09:00:00'}];
db.subscriptions.push({id:'u9',childId:'c4',classroomId:'r3',status:'active',periodEnd:'2026-11-08',amount:200,paymentMode:'monthly'});
const out=[];ctx.assistantRenderResult=async r=>{out.push(r)};ctx.assistantAddText=async t=>{out.push({text:t})};
let bad=0;const exp=(q,tool,must)=>({q,tool,must});
const cases=[
 ['كام طالب عندي','counts','4 طالب'],['عدد المدرسين','counts','2 مدرّس'],['كام مجموعة عندنا','counts','3 مجموعة'],['عدد اولياء الامور','counts','2 ولي أمر'],
 ['المدرسين اللي مجوش النهاردة','teachers_absent_today','سعاد'],['مين المدرس الغايب','teachers_absent_today','سعاد'],
 ['مين اكتر طالب غايب','top_absent','غاب'],['اكتر طالب غياب الاسبوع اللي فات','top_absent',null],
 ['اشتراكات هتنتهي الاسبوع ده','expiring_subs','يوسف'],['مين اشتراكه هينتهي الشهر ده','expiring_subs',null],
 ['افتح الاشتراكات','open_screen',null],['عايز اضيف طالب','read_only_notice','مبعدّلش'],['امسح الطالب احمد','read_only_notice','مبعدّلش'],['ابعت رسالة لولي امر احمد','read_only_notice','مبعدّلش'],
 // ما اتكسرش: أسئلة كانت شغّالة
 ['مين الغايبين النهاردة','absent_today',null],['كام طالب غايب النهاردة','absent_today',null],['مين المتأخرين في الدفع','overdue_payments',null],['تقرير احمد سامي','student_report',null],['حصص بكرة','today_schedule',null],
 ['احمد سامي حضر النهارده','child_attendance',null],['في شكاوي','complaints',null],['ملخص النهاردة','day_summary',null],['افتح المدفوعات','open_screen',null],
 ['إيه التقارير المتاحة','reports_hub',null],['مين من المدرسين اداؤه منخفض','teacher_performance',null],['مين من المدرسين شغال على امتحانات','teachers_exams',null],['هل انت فاكر كلامنا','chat_memory',null],
 ['عدلي احمد','!read_only_notice',null]
];
(async()=>{
 ctx.session.role='ADMIN';ctx.session.personId=null;
 for(const [q,tool,must] of cases){
  const p=api.assistantPlan(q); out.length=0; let ok=true,note='';
  if(tool[0]==='!'){ ok=!p||p.tool!==tool.slice(1); note=p?p.tool:'null'; }
  else { ok=!!p&&p.tool===tool&&p.conf>=4; note=p?`${p.tool}/${p.conf}`:'null';
    if(ok&&must){ await api.assistantExecute(p); const txt=JSON.stringify(out); if(!txt.includes(must)){ok=false;note+=' | missing "'+must+'" in '+txt.slice(0,160);} } }
  if(!ok)bad++; console.log((ok?'✅ ':'❌ ')+q+' → '+note);
 }
 // أدوار تانية: الأدوات الإدارية ماتتنفذش
 for(const [role,pid,q,notTool] of [['TEACHER','t1','المدرسين اللي مجوش النهاردة','teachers_absent_today'],['PARENT','p1','كام طالب عندي','counts'],['PARENT','p1','اشتراكات هتنتهي','expiring_subs']]){
  ctx.session.role=role;ctx.session.personId=pid;const p=api.assistantPlan(q);const ok=!p||p.tool!==notTool;if(!ok)bad++;console.log((ok?'✅ ':'❌ ')+role+' لا يستخدم '+notTool+' ← '+(p?p.tool:'null'));}
 ctx.session.role='TEACHER';ctx.session.personId='t1';let p=api.assistantPlan('كام طالب عندي');out.length=0;await api.assistantExecute(p);console.log((JSON.stringify(out).includes('2 طالب')||JSON.stringify(out).includes('3 طالب')?'✅ ':'❌ ')+'المدرّس يشوف أعداد نطاقه بس: '+JSON.stringify(out[0]&&out[0].summary));
 console.log(bad?('FAILED '+bad):'ALL ADMIN PROBE CHECKS PASSED');
})();
