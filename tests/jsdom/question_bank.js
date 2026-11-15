// بنك أسئلة المدير الواقعية (صيغ مختلفة: فصحى/عامية/إملاء). بيقيس كام سؤال المساعد المحلي بيحلّه من غير AI.
// الصيغة: [السؤال, الأداة المتوقعة]. 'AI' = سؤال مفتوح مقبول إنه يروح للـAI (مايتحسبش فشل).
// بعد أي تعديل على المحرّك شغّل:  node question_bank.js   — ولازم النسبة ماتقلّش.
const {ctx,api,db}=require('./harness');
db.teacherAttendance=[{id:'ta1',teacherId:'t1',type:'CHECK_IN',time:'2026-11-04T09:00:00'}];
db.subscriptions.push({id:'u9',childId:'c4',classroomId:'r3',status:'active',periodEnd:'2026-11-08',amount:200,paymentMode:'monthly'});
const BANK=[
 // الغياب
 ['مين الغايبين النهاردة','absent_today'],['مين غايب النهارده؟','absent_today'],['الطلاب اللي مجوش النهاردة','absent_today'],['عايز اعرف مين ماحضرش النهاردة','absent_today'],['الغياب النهاردة','absent_today'],['كام طالب غايب النهاردة','absent_today'],['مين الطلبة اللي غابو','absent_today'],['فيه حد غايب؟','absent_today'],['اسماء الغايبين','absent_today'],
 ['مين اكتر طالب غايب','top_absent'],['اكتر الطلاب غياب الشهر ده','top_absent'],['الطلاب كتير الغياب','top_absent'],['مين اللي بيغيب كتير','top_absent'],['ترتيب الغياب','top_absent'],
 ['المدرسين اللي مجوش النهاردة','teachers_absent_today'],['مين المدرس الغايب','teachers_absent_today'],['فيه مدرس متاخر','teachers_absent_today'],['المعلمين اللي ماحضروش','teachers_absent_today'],['مين من المدرسين لسه ماسجلش حضور','teachers_absent_today'],
 // المالية
 ['مين المتأخرين في الدفع','overdue_payments'],['المتأخرات','overdue_payments'],['مين عليه فلوس','overdue_payments'],['الطلاب اللي لسه ماسددوش','overdue_payments'],['مين مدفعش','overdue_payments'],['الاشتراكات المنتهية','overdue_payments'],['اشتراكات منتهيه','overdue_payments'],['مين اشتراكه خلص','overdue_payments'],['المديونيات','overdue_payments'],['حالة المدفوعات','overdue_payments'],
 ['اشتراكات هتنتهي الاسبوع ده','expiring_subs'],['مين اشتراكه هينتهي قريب','expiring_subs'],['اشتراكات قربت تخلص','expiring_subs'],['الاشتراكات اللي هتنتهي الشهر ده','expiring_subs'],
 // الجدول
 ['عندي ايه النهاردة','today_schedule'],['حصص النهاردة','today_schedule'],['ايه الحصص بكرة','today_schedule'],['جدول يوم الخميس','today_schedule'],['مواعيد الحصص','today_schedule'],['الحصص اللي اتعملت امبارح','today_schedule'],['امتي حصة الرياضيات','today_schedule'],
 // استثناءات وشكاوى وتقويم
 ['في طلبات استثناء','pending_exceptions'],['طلبات الاستثناء المعلقة','pending_exceptions'],['استثناءات الحضور','pending_exceptions'],['فيه استثناءات محتاجة موافقة','pending_exceptions'],
 ['في شكاوي','complaints'],['الشكاوي المفتوحة','complaints'],['حد اشتكي؟','complaints'],['شكاوى اولياء الامور','complaints'],
 ['ايه الاجازات الجاية','calendar_upcoming'],['اجازة امتى','calendar_upcoming'],['احداث التقويم','calendar_upcoming'],['فيه مناسبات قريب','calendar_upcoming'],
 // ملخص وأعداد
 ['ملخص النهاردة','day_summary'],['اخبار اليوم ايه','day_summary'],['خلاصة اليوم','day_summary'],['فيه ايه النهاردة','day_summary'],['الوضع النهاردة','day_summary'],
 ['كام طالب عندي','counts'],['عدد الطلاب','counts'],['كام مدرس','counts'],['عدد المدرسين','counts'],['كام مجموعة عندنا','counts'],['عدد اولياء الامور','counts'],['اجمالي الطلاب','counts'],['كام مادة عندنا','counts'],
 // طلاب بالاسم
 ['تقرير احمد سامي','student_report'],['احمد سامي عامل ايه','student_report'],['اخبار منى خالد','student_report'],['ملف يوسف','student_report'],['احمد سامي حضر النهاردة','child_attendance'],['منى غابت؟','child_attendance'],['اشتراك منى خالد','subscription_status'],['احمد سامي دفع؟','subscription_status'],['تقييمات منى','child_evals'],['احمد سامي ايه مستواه','child_evals'],['منى عملت ايه النهاردة','child_today'],['دور على احمد','find_student'],['فين يوسف','find_student'],['ابحث عن منى','find_student'],['هات بيانات احمد','find_student'],
 // المدرسين
 ['مين من المدرسين اداؤه منخفض','teacher_performance'],['افضل مدرس الشهر ده','teacher_performance'],['اداء المدرسين','teacher_performance'],['ترتيب المدرسين','teacher_performance'],['مين المدرس المقصر','teacher_performance'],['المدرسين اللي عملو امتحانات','teachers_exams'],['مين شغال على امتحانات','teachers_exams'],
 // فتح الشاشات
 ['افتح المدفوعات','open_screen'],['افتح الاشتراكات','open_screen'],['افتح التقويم','open_screen'],['افتح الطلاب','open_screen'],['افتح المدرسين','open_screen'],['افتح الشكاوى','open_screen'],['وديني على الجدول','open_screen'],['روح لمرتبات المدرسين','open_screen'],['افتح اولياء الامور','open_screen'],['افتح المجموعات','open_screen'],['هاتلي شاشة الاستثناءات','open_screen'],['افتح الارشيف المالي','open_screen'],['افتح حضور المدرسين','open_screen'],
 // مساعدة وتقارير وتعديل
 ['تقدر تعمل ايه','help'],['ايه اللي تقدر تساعدني فيه','help'],['مساعدة','help'],['ايه التقارير المتاحة','reports_hub'],['افتح التقارير','reports_hub'],
 ['عايز اضيف طالب','read_only_notice'],['امسح الطالب احمد','read_only_notice'],['ابعت رسالة لولي امر احمد','read_only_notice'],['عدل بيانات المدرس','read_only_notice'],['سجل دفعة لمنى','read_only_notice'],['غير ميعاد حصة الرياضيات','read_only_notice'],
 // مجموعتين اتضافوا بعد قياس التعميم (held-out + fresh) — حماية من الرجوع
 ['وريني الغياب بتاع النهارده','absent_today'],
 ['مين اللي مجاش من الطلبة','absent_today'],
 ['الطلبه الغايبه','absent_today'],
 ['حد من العيال مجاش؟','absent_today'],
 ['مين مأخر في السداد','overdue_payments'],
 ['اللي عليهم فلوس','overdue_payments'],
 ['مين لسه مدفعش الشهر ده','overdue_payments'],
 ['عايز كشف بالمتأخرات','overdue_payments'],
 ['اشتراكات خلصانه','overdue_payments'],
 ['مين اشتراكه واقف','overdue_payments'],
 ['الاستثناءات اللي مستنيه','pending_exceptions'],
 ['فيه طلب استثناء جديد','pending_exceptions'],
 ['ايه اخر الشكاوى','complaints'],
 ['اولياء الامور اشتكوا من ايه','complaints'],
 ['عندنا حصص ايه بكرا','today_schedule'],
 ['ايه جدول السبت','today_schedule'],
 ['مين هيشتغل النهاردة','today_schedule'],
 ['كام عيل مسجل عندنا','counts'],
 ['قولي عدد الطلبه','counts'],
 ['عندنا كام معلم','counts'],
 ['كام ولي امر عندنا','counts'],
 ['المدرس اللي ما جاش','teachers_absent_today'],
 ['مين من المعلمين ما سجلش حضوره','teachers_absent_today'],
 ['مين اكتر واحد بيغيب','top_absent'],
 ['الطلاب اللي غيابهم عالي','top_absent'],
 ['مين اغيب طالب الاسبوع ده','top_absent'],
 ['مين اشتراكه هيخلص الاسبوع الجاي','expiring_subs'],
 ['اشتراكات هتنتهى قريب','expiring_subs'],
 ['اخبار احمد سامي ايه','student_report'],
 ['احمد سامي ماشي ازاي','student_report'],
 ['قولي عن منى خالد','student_report'],
 ['منى خالد جت النهاردة','child_attendance'],
 ['احمد سامي غاب كام مره','child_attendance'],
 ['هل احمد سامي مسدد','subscription_status'],
 ['اشتراك احمد سامي لسه ساري','subscription_status'],
 ['درجات منى خالد','child_evals'],
 ['افتحلي المدفوعات','open_screen'],
 ['خدني للتقويم','open_screen'],
 ['عايز اشوف الشكاوى','complaints|open_screen'],
 ['افتح قسم المدرسين','open_screen'],
 ['مين من الطلبة مش جاي النهاردة','absent_today'],
 ['الي ماجوش النهاردة مين','absent_today'],
 ['كشف الغياب','absent_today'],
 ['حضور وغياب النهاردة','absent_today'],
 ['مين مسددش الاشتراك','overdue_payments'],
 ['الطلبه المتاخرين في الفلوس','overdue_payments'],
 ['اللي مدفعوش المصاريف','overdue_payments'],
 ['فيه حد مديون','overdue_payments'],
 ['الحصص الجايه','today_schedule'],
 ['النهارده فيه حصص؟','today_schedule'],
 ['ايه مواعيد الخميس','today_schedule'],
 ['الاعذار اللي مستنيه رد','pending_exceptions'],
 ['طلبات استثناء مش متراجعة','pending_exceptions'],
 ['فيه ملاحظات من الاهالي','complaints'],
 ['شكاوي جديده','complaints'],
 ['كام طالب مسجل','counts'],
 ['قد ايه عدد المدرسين','counts'],
 ['كام مجموعه شغاله','counts'],
 ['مين اكتر مدرس ملتزم','teacher_performance'],
 ['تقييم المدرسين الشهر ده','teacher_performance'],
 ['مين المدرس اللي متاخر النهاردة','teachers_absent_today'],
 ['المدرسين الغايبين','teachers_absent_today'],
 ['مين اكتر الاطفال غيابا','top_absent'],
 ['الطلاب اللي بيغيبوا كتير','top_absent'],
 ['احمد سامي مدفوع؟','subscription_status'],
 ['منى خالد اشتراكها خلص؟','subscription_status'],
 ['تقييم احمد سامي','child_evals'],
 ['احمد سامي حضر ولا لا','child_attendance'],
 ['وريني مرتبات المدرسين','open_screen'],
 ['روح على الطلاب','open_screen'],
 ['فتح ملف المدفوعات','open_screen'],
 ['ملخص سريع','day_summary'],
 ['عاوز نظره عامه','day_summary'],
 ['ايه اللي حصل النهاردة في السنتر','day_summary'],
 // أسئلة مفتوحة: مقبول AI
 ['قارن الشهر ده باللي فات','AI'],['اكتب رسالة لولي امر متأخر','AI'],['ليه الغياب زاد','AI'],['اقترح خطة لتحسين الحضور','AI'],['ايه رايك في اداء السنتر','AI']
];
const out=[];ctx.assistantRenderResult=async r=>{out.push(r)};ctx.assistantAddText=async t=>{out.push({text:t})};
(async()=>{
 ctx.session.role='ADMIN';ctx.session.personId=null;
 let hit=0,total=0,ai=0;const miss=[];
 for(const [q,tool] of BANK){
  const p=api.assistantPlan(q);
  if(tool==='AI'){ ai++; continue; }
  total++; const got=p?(p.reply?'reply':p.tool):null; const conf=p?p.conf:0;
  if(tool.split('|').indexOf(got)>=0&&conf>=4) hit++; else miss.push(`${q}  →  ${got||'null'}/${conf}  (المتوقع ${tool})`);
 }
 console.log(`تغطية المدير الأوفلاين: ${hit}/${total} = ${Math.round(hit/total*100)}%  (+ ${ai} سؤال مفتوح مقبول يروح للـAI)`);
 miss.forEach(m=>console.log('❌ '+m));
 const min=parseInt(process.env.BANK_MIN||'0',10);process.exit(Math.round(hit/total*100)<min?1:0);
})();
