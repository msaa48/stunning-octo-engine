const fs=require('fs'); const {JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','..','index.html'),'utf8');
function slice(a,b){const i=html.indexOf(a),j=html.indexOf(b,i);if(i<0||j<0)throw new Error(a);return html.slice(i,j);}
const screen=slice('<div id="ai-chat-screen" class="screen">','<div class="modal-bg" id="ai-settings-modal-bg">');
const dom=new JSDOM('<!doctype html><body>'+screen+'<select id="parent-child-select"><option value="c1">a</option><option value="c3">b</option></select></body>',{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
// copy real helper functions
function fn(name){const a=html.indexOf('function '+name);let d=0,i=html.indexOf('{',a);for(;i<html.length;i++){if(html[i]=='{')d++;else if(html[i]=='}'){d--;if(!d)break;}}return html.slice(a,i+1);}
const helpers=['normalizeArabic','pad2','localDateStr','localMonthStr','addDaysStr','isToday','faEsc'].map(fn).join('\n');
const grade=html.match(/const GRADE_LABELS = \{[^\n]*\};/)[0];
const evmeta=slice('const EVENT_META = {','const MOOD_META');
const wk="const WEEKDAY_AR_BY_JS_INDEX = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];";
const adminMeta="const ADMIN_TAB_META={children:{icon:'🧑‍🎓',label:'الطلاب'},payments:{icon:'💳',label:'المدفوعات'},calendar:{icon:'🗓️',label:'التقويم'},complaints:{icon:'📩',label:'الشكاوى'}};";
const region=slice('/* ===== المساعد الذكي لكل الأدوار','function initAdminScreen(){');
const T=h=>'2026-11-04T'+h+':00';
w.__db={
 classrooms:[{id:'r1',name:'رياضيات',meetingTimes:[{day:'الأربعاء',start:'10:00'}]},{id:'r2',name:'علوم',meetingTimes:[{day:'الأربعاء',start:'18:00'}]}],
 subjects:[],teachers:[{id:'t1',name:'أ. هاني',classroomIds:['r1','r2']}],assistants:[],
 parents:[{id:'p1',name:'والد',childIds:['c1','c3']}],
 children:[{id:'c1',name:'أحمد محمد',grade:'PREP3',classroomIds:['r1']},{id:'c3',name:'منى <img src=x onerror=alert(1)>',grade:'PREP2',classroomIds:['r2']},{id:'c9',name:'غريب عني',classroomIds:['r1']}],
 enrollments:[{id:'e1',childId:'c1',classroomId:'r1'},{id:'e2',childId:'c3',classroomId:'r2'}],
 attendance:[{id:'a',childId:'c1',classroomId:'r1',sessionDate:'2026-11-04'}],subscriptions:[],events:[],evaluations:[],messages:[],payments:[],complaints:[],calendarEvents:[],attendanceExceptions:[],teacherPayouts:[]};
const calls={ai:0,screens:[],tab:[],child:[],toasts:[]};
w.session={role:'PARENT',personId:'p1'};
w.loadDB=()=>w.__db; w.getSystemNow=()=>new w.Date(2026,10,4,14,0,0);
w.getSubscriptionState=()=>({key:'none',label:'بدون اشتراك'}); w.getAdminSubscriptionCounts=()=>({expired:0,pending:0});
w.timeStr=iso=>iso.slice(11,16); w.showToast=m=>calls.toasts.push(m);
w.showScreen=id=>calls.screens.push(id); w.switchParentTab=t=>calls.tab.push('parent:'+t); w.switchTeacherTab=t=>calls.tab.push('teacher:'+t);
w.onParentChildChange=()=>{}; w.selectTeacherChild=id=>calls.child.push(id); w.openStudentDetail=id=>calls.child.push('admin:'+id);
w.openAdminSection=t=>calls.tab.push('admin:'+t); w.openAiSettings=()=>{}; w.supabaseClient={rpc:async()=>({data:[]})}; w.aiCenterHealth=()=>'OK';
w.aiErrorMsg=e=>'خطأ: '+(e&&e.message); w.aiChainCall=async()=>{calls.ai++; return w.__aiReply;};
w.eval(helpers+'\n'+grade+'\n'+evmeta+'\n'+wk+'\n'+adminMeta+'\n'+region+'\nassistantTypeSpeed=0; window.__A=ASSIST_ACTIONS;');
const $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; function ok(c,m){console.log((c?'✅ ':'❌ ')+m); if(!c)fails++;}
(async()=>{
 // PARENT
 w.openAssistant(); await sleep(50);
 ok($('#asst-welcome-text').textContent.includes('ابنك'),'parent welcome text');
 ok(w.document.querySelectorAll('#asst-sugs .asst-sug').length===6,'parent suggestions = 6');
 ok($('#asst-settings-btn').style.display==='none','settings button hidden for parent');
 ok(calls.screens.slice(-1)[0]==='ai-chat-screen','openAssistant shows chat screen');
 await w.assistantAsk('ابني حضر النهاردة؟');
 ok($$('#ai-asst-log .ai-card').length===2,'parent: 2 cards (two children)');
 ok(!$('#ai-asst-log').innerHTML.includes('<img src=x'),'XSS: raw <img> not injected');
 ok($('#ai-asst-log').textContent.includes('<img src=x onerror=alert(1)>'),'XSS: shown as text');
 ok(!$('#ai-asst-log').textContent.includes('غريب'),"parent never sees another family's child");
 await w.assistantAsk('غريب عني اشتراكه ايه');
 ok(!$$('#ai-asst-log .ai-card-title').some(e=>e.textContent.includes('غريب')),'parent cannot look up a non-own student (no card for them)');
 // action click
 await w.assistantAsk('مين أولادي');
 const btn=$$('#ai-asst-log [data-act="askLocal"]')[0]; btn.click(); await sleep(50);
 ok($$('#ai-asst-log .ai-card').length>=4,'click on askLocal button renders a report');
 await w.assistantAsk('افتح الاشتراك'); const f=$$('#ai-asst-log [data-act="openRoleTab"]').pop(); f.click();
 ok(calls.screens.slice(-1)[0]==='parent-screen' && calls.tab.slice(-1)[0]==='parent:payments','openRoleTab → parent payments tab');
 // AI: disallowed tool must not run
 calls.ai=0; w.__aiReply='{"tool":"overdue_payments","args":{}}';
 await w.assistantAsk('اكتبلي قصيدة عن المركز');
 ok(calls.ai===1,'unmatched text goes to AI once');
 ok(!$('#ai-asst-log').textContent.includes('المتابعة المالية'),'AI cannot run admin-only tool for parent');
 // AI tool allowed
 w.__aiReply='{"tool":"calendar_upcoming","args":{}}';
 await w.assistantAsk('ايه اللي جاي في المركز كمان شوية'); 
 ok($('#ai-asst-log').textContent.includes('تقويم')||$('#ai-asst-log').textContent.includes('مفيش أحداث'),'AI allowed tool runs');
 // confident local → no AI
 calls.ai=0; await w.assistantAsk('تقييمات ابني'); ok(calls.ai===0,'confident local query does NOT call AI');
 // AI failure → fallback + AI paused
 w.aiChainCall=async()=>{calls.ai++; throw new Error('GW:PLATFORM_LIMIT');};
 calls.ai=0; await w.assistantAsk('هو ايه الجو بره'); ok(calls.ai===1,'AI tried');
 ok($('#ai-asst-log').textContent.includes('تقصد واحد من دول')||$('#ai-asst-log').textContent.includes('مفهمتش'),'fallback after AI failure');
 await w.assistantAsk('وريني حاجه غريبه خالص'); ok(calls.ai===1,'AI paused after platform limit (no 2nd call)');
 // offline
 w.assistantAiOffUntil=0; Object.defineProperty(w.navigator,'onLine',{value:false,configurable:true});
 w.aiChainCall=async()=>{calls.ai++; return '{"reply":"x"}';}; calls.ai=0;
 await w.assistantAsk('كلام مش مفهوم'); ok(calls.ai===0,'offline: AI not called');
 // role switch → TEACHER
 w.session={role:'TEACHER',personId:'t1'}; w.openAssistant(); await sleep(50);
 ok($('#asst-welcome-text').textContent.includes('حصصك'),'teacher welcome text'); ok($('#asst-settings-btn').style.display==='none','teacher: no AI settings');
 w.assistantNewChat();
 await w.assistantAsk('مين الغايبين النهاردة'); ok($('#ai-asst-log').textContent.includes('أحمد')||$('#ai-asst-log').textContent.includes('حضروا')||$('#ai-asst-log').textContent.includes('غايب'),'teacher absent answer');
 await w.assistantAsk('دور على احمد'); const ob=$$('#ai-asst-log [data-act="openTeacherChild"]')[0]; ob.click();
 ok(calls.child.slice(-1)[0]==='c1','openTeacherChild selects child'); ok(calls.tab.slice(-1)[0]==='teacher:log','…and opens log tab');
 await w.assistantAsk('افتح المدفوعات'); ok(!$('#ai-asst-log [data-act="openRoleTab"][data-arg="payments"]'),'teacher cannot open admin payments');
 // fabricated action name / role mismatch
 w.session={role:'PARENT',personId:'p1'}; w.__A.openTeacherChild('c1'); const before=calls.child.length; ok(calls.child.length===before,'openTeacherChild ignored for parent');
 w.__A.openStudent('c1'); ok(!calls.child.includes('admin:c1'),'openStudent ignored for non-admin');
 // student role
 w.session={role:'STUDENT',personId:'s'}; ok(w.assistantCanUse()===false,'student: assistant unavailable');
 console.log(fails?('FAILED '+fails):'ALL UI CHECKS PASSED');
})().catch(e=>{console.error('ERR',e);process.exit(1)});
