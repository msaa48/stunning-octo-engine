// أسئلة التوضيح للمساعد المحلي: "مين متأخر؟" → تقصد مين؟ → متأخر في إيه؟
const {ctx,api,db}=require('./harness');
let fails=0; const ok=(c,m)=>{ if(c) console.log('✅ '+m); else { console.log('❌ '+m); fails++; } };
const out=[]; ctx.assistantRenderResult=async r=>{out.push(r)}; ctx.assistantAddText=async t=>{out.push({text:t})};
function role(r,pid){ ctx.session.role=r; ctx.session.personId=pid||null; api.setCtx({childId:null}); api.resetPending(); }
const labels=p=>(p.chips||[]).map(c=>c.label.replace(/^\S+\s/,''));

// بيانات للأدوات الجديدة
ctx.isLateCheckIn = iso => new Date(iso).getHours()>8 || (new Date(iso).getHours()===8 && new Date(iso).getMinutes()>30);
ctx.getTeacherFirstClassTimeToday = id => id==='t2' ? '11:00' : null;   // t2 حصته 11:00 ولسه ما سجّلش (الوقت دلوقتي 14:00)
db.events.push({id:'L1',childId:'c1',eventType:'LATE',eventTime:'2026-11-04T10:15:00'});
db.teacherAttendance=[{id:'ta1',teacherId:'t1',type:'CHECK_IN',time:'2026-11-04T09:10:00'}];

(async()=>{
 role('ADMIN');
 // 1) السؤال الغامض → سؤال "مين؟" بأربع اختيارات
 let p=api.assistantPlan('مين متأخر؟');
 ok(p && p.reply && !p.tool, 'ADMIN «مين متأخر؟» → سؤال توضيح مش تنفيذ مباشر');
 ok(JSON.stringify(labels(p))===JSON.stringify(['طالب','مدرّس','ولي أمر','أسيستنت']), 'الاختيارات: طالب/مدرّس/ولي أمر/أسيستنت');
 ok(api.pending && api.pending.who===null, 'الحالة: مستني تحديد مين');
 // 2) الإجابة "طالب" → سؤال "في إيه؟"
 p=api.assistantPlan('الطلاب');
 ok(p && /في إيه/.test(p.reply) && JSON.stringify(labels(p))===JSON.stringify(['في الدفع','في الحضور والمواعيد']), 'طالب → «متأخر في إيه بالظبط؟» (دفع / حضور)');
 // 3) الإجابة "في الدفع" → المتابعة المالية
 p=api.assistantPlan('في الدفع');
 ok(p && p.tool==='overdue_payments' && p.conf>=4, 'طالب + دفع → overdue_payments');
 ok(api.pending===null, 'الحالة اتمسحت بعد التنفيذ');
 // 4) طالب + حضور → late_arrivals ويرجّع أحمد
 api.assistantPlan('مين متأخر'); api.assistantPlan('طالب'); p=api.assistantPlan('في الحضور');
 ok(p && p.tool==='late_arrivals', 'طالب + حضور → late_arrivals');
 out.length=0; await api.assistantExecute(p);
 ok(out[0] && /أحمد محمد علي/.test(JSON.stringify(out[0])), 'late_arrivals بيرجّع الطالب اللي اتسجّل «جه متأخر»');
 // 5) مدرّس → اختيار واحد متاح فبينفّذ مع توضيح إنه المتاح
 api.assistantPlan('مين متأخر'); p=api.assistantPlan('المدرسين');
 ok(p && p.tool==='teachers_absent_today' && p.intro, 'مدرّس → teachers_absent_today (الخيار الوحيد المتاح) مع جملة توضيح');
 out.length=0; await api.assistantExecute(p);
 ok(/أ\. سعاد/.test(JSON.stringify(out[0])) && !/حضور 09/.test('') , 'teachers_absent_today بيطلّع المدرّس اللي حصته بدأت ولسه ما سجّلش');
 // 6) ولي أمر → overdue_parents
 api.assistantPlan('مين متأخر'); p=api.assistantPlan('ولي أمر');
 ok(p && p.tool==='overdue_parents', 'ولي أمر → overdue_parents');
 out.length=0; await api.assistantExecute(p);
 ok(/والد أحمد/.test(JSON.stringify(out)) || /والد/.test(JSON.stringify(out)), 'overdue_parents بيرجّع ولي أمر عليه متأخرات');
 // 7) أسيستنت → رد صريح إن مفيش بيانات
 api.assistantPlan('مين متأخر'); p=api.assistantPlan('اسيستنت');
 ok(p && p.reply && /مالهمش تسجيل حضور/.test(p.reply) && !p.tool, 'أسيستنت → رد صريح إن مفيش بيانات حضور ليهم');
 // 8) أسئلة واضحة ماتتغيرش
 role('ADMIN');
 p=api.assistantPlan('مين المتأخرين في الدفع؟'); ok(p && p.tool==='overdue_payments' && !p.reply, '«مين المتأخرين في الدفع؟» لسه بتتنفّذ مباشرة');
 p=api.assistantPlan('المدرسين المتأخرين'); ok(p && p.tool==='teachers_absent_today', '«المدرسين المتأخرين» → teachers_absent_today مباشرة');
 p=api.assistantPlan('الطلاب المتأخرين'); ok(p && /في إيه/.test(p.reply), '«الطلاب المتأخرين» → بيسأل في إيه');
 api.resetPending(); p=api.assistantPlan('مين جه متأخر'); ok(p && /مين بالظبط/.test(p.reply), '«مين جه متأخر» → بيسأل مين (طالب ولا مدرّس)');
 p=api.assistantPlan('الواجب متأخر'); ok(!(p && p.chips), '«الواجب متأخر» → مش بيسأل (معنى تاني)');
 p=api.assistantPlan('احمد محمد متأخر'); ok(!(p && p.chips), 'لو في اسم طالب مش بيسأل «مين»');
 // 9) الإجابة اللي مالهاش علاقة بتتعامل كسؤال جديد
 api.assistantPlan('مين متأخر'); p=api.assistantPlan('افتح المدفوعات');
 ok(p && p.tool==='open_screen' && api.pending===null, 'رد مالوش علاقة → سؤال جديد والحالة اتمسحت');
 api.assistantPlan('مين متأخر'); p=api.assistantPlan('مين المدرسين اللي عندي النهاردة وحصصهم ايه');
 ok(!(p && p.tool==='teachers_absent_today'), 'جملة طويلة مش بتتاخد كإجابة');
 // 10) سؤال "في إيه" بإجابة غير متاحة
 role('ADMIN'); api.assistantPlan('المدرسين المتأخرين في الدفع'); 
 role('ADMIN'); p=api.assistantPlan('ولي الامر المتأخر في الحضور');
 ok(p && /مش متاح/.test(p.reply) && JSON.stringify(labels(p))===JSON.stringify(['في الدفع']), 'ولي أمر + حضور → مش متاح ويعرض المتاح بس');
 // 11) غير الأدمن: مفيش سؤال "مين"
 role('TEACHER','t1'); p=api.assistantPlan('مين متأخر؟');
 ok(p && /في إيه/.test(p.reply) && !/مين بالظبط/.test(p.reply), 'TEACHER «مين متأخر؟» → بيسأل في إيه مباشرة (مفيش مين)');
 p=api.assistantPlan('الدفع'); ok(p && p.tool==='overdue_payments', 'TEACHER + دفع → overdue_payments');
 role('PARENT','p1'); api.assistantPlan('ابني متأخر'); 
 role('PARENT','p1'); api.assistantPlan('مين متأخر'); p=api.assistantPlan('الدفع');
 ok(p && p.tool==='subscription_status', 'PARENT + دفع → subscription_status');
 role('TEACHER','t1'); p=api.assistantPlan('المدرسين المتأخرين'); ok(p && /مش متاح/.test(p.reply), 'TEACHER مايقدرش يسأل عن مدرّسين');
 console.log(fails? '\nFAILED '+fails : '\nALL CLARIFY CHECKS PASSED'); process.exit(fails?1:0);
})();
