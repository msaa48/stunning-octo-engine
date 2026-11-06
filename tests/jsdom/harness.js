const fs=require('fs'), vm=require('vm');
const html=fs.readFileSync(require('path').join(__dirname,'..','..','index.html'),'utf8');
function slice(startMarker,endMarker){const a=html.indexOf(startMarker);const b=html.indexOf(endMarker,a);if(a<0||b<0)throw new Error('marker '+startMarker);return html.slice(a,b);}
const block=slice('/* ===== المساعد الذكي لكل الأدوار','/* ---------- واجهة المحادثة ---------- */');
const askBlock=slice('function assistantSetBusy(b){','function assistantInputChanged(){');
const fns=['function normalizeArabic','function pad2','function localDateStr','function localMonthStr','function addDaysStr','function isToday'];
let helpers='';
fns.forEach(f=>{const a=html.indexOf(f);let depth=0,i=html.indexOf('{',a);const st=a;for(;i<html.length;i++){if(html[i]=='{')depth++;else if(html[i]=='}'){depth--;if(!depth){break;}}}helpers+=html.slice(st,i+1)+'\n';});
const grade=html.match(/const GRADE_LABELS = \{[^\n]*\};/)[0];
const evmeta=slice('const EVENT_META = {','const MOOD_META');
const wk="const WEEKDAY_AR_BY_JS_INDEX = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];";
const adminMeta="const ADMIN_TAB_META={children:{icon:'🧑‍🎓',label:'الطلاب'},teachers:{icon:'🧑‍🏫',label:'المدرّسين'},payments:{icon:'💳',label:'المدفوعات'},calendar:{icon:'🗓️',label:'التقويم'},complaints:{icon:'📩',label:'الشكاوى'},attendanceExceptions:{icon:'🎫',label:'استثناءات الحضور'},teacherPayouts:{icon:'💰',label:'مرتبات المدرّسين'},schedule:{icon:'📅',label:'الجدول'},classrooms:{icon:'👥',label:'المجموعات'},parents:{icon:'👨‍👩‍👧',label:'أولياء الأمور'},subjects:{icon:'📚',label:'المواد'},teacherAttendance:{icon:'🕒',label:'حضور المدرّسين'},teacherEvaluations:{icon:'⭐',label:'تقييمات المدرّسين'},assistants:{icon:'🧑‍💼',label:'الأسيستنت'},links:{icon:'🔗',label:'الربط'},financialArchive:{icon:'🗄️',label:'الأرشيف المالي'},passwordRequests:{icon:'🔑',label:'طلبات كلمات المرور'}};";
const T=h=>'2026-11-04T'+h+':00';
const db={
 classrooms:[
  {id:'r1',name:'رياضيات تالتة إعدادي',meetingTimes:[{day:'الأربعاء',start:'10:00',end:'12:00'},{day:'الاثنين',start:'16:00'}]},
  {id:'r2',name:'علوم تانية إعدادي',meetingTimes:[{day:'الأربعاء',start:'18:00'}]},
  {id:'r3',name:'عربي',meetingTimes:[{day:'الأربعاء',start:'11:00'}]}],
 subjects:[{id:'s1',name:'رياضيات'},{id:'s2',name:'علوم'}],
 teachers:[{id:'t1',name:'أ. هاني',classroomIds:['r1','r2']},{id:'t2',name:'أ. سعاد',classroomIds:['r3']}],
 assistants:[{id:'a1',name:'مي',teacherIds:['t1']}],
 parents:[{id:'p1',name:'والد أحمد',childIds:['c1','c3']},{id:'p2',name:'والد يوسف',childIds:['c4']}],
 children:[
  {id:'c1',name:'أحمد محمد علي',grade:'PREP3',classroomIds:['r1']},
  {id:'c2',name:'أحمد سامي',grade:'PREP3',classroomIds:['r1','r2']},
  {id:'c3',name:'منى خالد',grade:'PREP2',classroomIds:['r2']},
  {id:'c4',name:'يوسف إبراهيم',grade:'PREP3',classroomIds:['r3']}],
 enrollments:[{id:'e1',childId:'c1',classroomId:'r1',paymentMode:'monthly'},{id:'e2',childId:'c2',classroomId:'r1',paymentMode:'monthly'},{id:'e3',childId:'c2',classroomId:'r2',paymentMode:'session'},{id:'e4',childId:'c3',classroomId:'r2',paymentMode:'monthly'},{id:'e5',childId:'c4',classroomId:'r3',paymentMode:'monthly'}],
 attendance:[{id:'a',childId:'c1',classroomId:'r1',sessionDate:'2026-11-04'},{id:'b',childId:'c1',classroomId:'r1',sessionDate:'2026-11-02'}],
 subscriptions:[{id:'u1',childId:'c1',classroomId:'r1',status:'active',periodEnd:'2026-11-30',amount:300,paymentMode:'monthly'},{id:'u2',childId:'c2',classroomId:'r1',status:'active',periodEnd:'2026-10-20',amount:300,paymentMode:'monthly'},{id:'u3',childId:'c3',classroomId:'r2',status:'pending',periodEnd:'2026-12-01',amount:250,paymentMode:'monthly'}],
 events:[{id:'v1',childId:'c1',eventType:'HOMEWORK_DONE',eventTime:T('10:30'),note:'ممتاز'},{id:'v2',childId:'c1',eventType:'PARTICIPATION',eventTime:T('11:00')}],
 evaluations:[{id:'x1',childId:'c1',subjectId:'s1',rating:'GOOD',note:'محتاج تركيز في الهندسة',date:T('09:00')}],
 messages:[{id:'m1',childId:'c1',sender:'PARENT',senderName:'والد أحمد',text:'هل في واجب الأسبوع الجاي؟',time:T('08:00')},{id:'m2',childId:'c1',sender:'TEACHER',senderName:'أ. هاني',text:'أيوه حل تمارين الوحدة',time:T('09:00')}],
 payments:[{id:'pp',childId:'c2',month:'2026-09',amount:300,status:'PENDING'}],
 complaints:[{id:'q1',parentId:'p1',message:'التكييف عطلان في القاعة',submittedAt:T('07:00'),status:'PENDING'}],
 calendarEvents:[{id:'k1',title:'إجازة رسمية',date:'2026-11-10',note:''},{id:'k2',title:'امتحان شهري',date:'2026-11-20'}],
 attendanceExceptions:[{id:'z1',childId:'c2',classroomId:'r1',status:'pending',reason:'ظروف مادية'}],
 teacherPayouts:[{id:'o1',teacherId:'t1',periodStart:'2026-10-01',periodEnd:'2026-10-31',sessionCount:12,finalAmount:1800,status:'paid'}]
};
const ctx={console,db,Date,Math,JSON,Set,Object,Array,String,Number,RegExp,parseFloat,Promise,setTimeout,navigator:{onLine:true},
 session:{role:'ADMIN',personId:null},
 loadDB:()=>db, getSystemNow:()=>new Date(2026,10,4,14,0,0),
 getSubscriptionState:(sub,today)=>{if(!sub)return{key:'none',label:'بدون اشتراك'};if(sub.status==='pending')return{key:'pending',label:'في انتظار الدفع'};if(sub.status==='active'&&sub.periodEnd>=today)return{key:'active',label:'سارية لحد '+sub.periodEnd};return{key:'expired',label:'منتهي من '+sub.periodEnd};},
 getAdminSubscriptionCounts:()=>({expired:1,pending:1}), timeStr:iso=>iso.slice(11,16), showToast:()=>{}, supabaseClient:{}, assistantInputChanged:()=>{},
};
vm.createContext(ctx);
const code=helpers+'\n'+grade+'\n'+evmeta+'\n'+wk+'\n'+adminMeta+'\n'+block+'\n'+askBlock+'\nthis.__api={assistantPlan,assistantExecute,assistantScope,assistantToolsFor,assistantParse,assistantSuggest,assistantCatalog,ASSIST_TOOLS,get ctxState(){return assistantCtx},setCtx(v){assistantCtx=v}};';
vm.runInContext(code,ctx);
module.exports={ctx,api:ctx.__api,db};
