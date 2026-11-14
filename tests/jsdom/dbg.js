const fs=require('fs'), vm=require('vm');
const {ctx,api,db}=require('./harness');
const html=fs.readFileSync(require('path').join(__dirname,'..','..','index.html'),'utf8');
function constSrc(name){const a=html.indexOf('const '+name);let depth=0,i=html.indexOf('{',a);for(;i<html.length;i++){if(html[i]=='{')depth++;else if(html[i]=='}'){depth--;if(!depth)break;}}return html.slice(a,i+2)+'\n';}
function fnSrc(name){const a=html.indexOf('function '+name);let depth=0,i=html.indexOf('{',a);for(;i<html.length;i++){if(html[i]=='{')depth++;else if(html[i]=='}'){depth--;if(!depth)break;}}return html.slice(a,i+1)+'\n';}

const a=html.indexOf('function workingDaysInMonth');
const start=html.indexOf('function defaultEvalConfig'), end=html.indexOf('function ensureAutoEvalsUpToDate');
ctx.monthKey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); ctx.uid=p=>p+'_x';
db.teacherAttendance=[]; db.taskCompletions=[]; db.settings={};
const att=(tid,day,type,h)=>({teacherId:tid,type,time:`2026-11-${String(day).padStart(2,'0')}T${h}:00:00`});
[1,2,3,4].forEach(d=>{db.teacherAttendance.push(att('t1',d,'CHECK_IN','08'),att('t1',d,'CHECK_OUT','16'));});
vm.runInContext(constSrc('EVAL_METRICS')+fnSrc('isLateCheckIn')+html.slice(Math.min(start,a,html.indexOf('function evalNum')), end)+'\nthis.__ev={computeTeacherScoreDetail,getEvalConfig,buildEvalContext};',ctx);
const ev=ctx.__ev;
const rg={start:new Date(2026,9,29),end:new Date(2026,10,4,14,0,0)};
try{
  const x=ev.buildEvalContext(db,'t1',2026,9,ev.getEvalConfig(db),rg);
  console.log('ctx:',{daysAttended:x.daysAttended,expectedDays:x.expectedDays,lateCount:x.lateCount,hasActivity:x.hasActivity});
  const d=ev.computeTeacherScoreDetail(db,'t1',2026,9,undefined,rg);
  console.log('hasData',d.hasData,'overall',d.overallScore.toFixed(2)); d.rows.forEach(r=>console.log(' ',r.label,r.enabled,r.hasData,r.score));
}catch(e){ console.log('ERR',e.stack.split('\n').slice(0,4).join('\n')); }
