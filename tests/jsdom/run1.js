const {ctx,api}=require('./harness');
const out=[];
ctx.assistantRenderResult=async r=>{out.push(r)};
ctx.assistantAddText=async t=>{out.push({text:t})};
function setRole(role,pid){ctx.session.role=role;ctx.session.personId=pid;api.setCtx({childId:null});}
async function ask(q){
  const p=api.assistantPlan(q); out.length=0;
  let line=`  «${q}» → `+(p? (p.reply?('reply'):`${p.tool} ${JSON.stringify(p.args||{})} conf=${p.conf}`):'null');
  if(p&&p.tool&&p.conf>=1){ await api.assistantExecute(p); line+='\n      '+out.map(r=>r.text?('📝'+r.text):('['+(r.title||'')+']'+(r.summary?' '+r.summary:'')+' :: '+(r.rows||[]).map(x=>x.label+(x.sub?' ('+x.sub+')':'')).join(' | '))).join('\n      '); }
  console.log(line);
}
(async()=>{
 const suites={
  ADMIN:[null,['مين الغايبين النهاردة؟','مين المتأخرين في الدفع','افتح المدفوعات','افتح التقويم','دوّر على احمد','ملخص النهاردة','في طلبات استثناء؟','في شكاوي مفتوحة','تقرير احمد سامي','احمد سامي اشتراكه ايه','تقييمات منى','يوسف حضر النهارده؟','عندي ايه بكرة','تقدر تساعدني في ايه','ازيك','فلوس','منى']],
  TEACHER:['t1',['مين الغايبين النهاردة؟','عندي ايه النهاردة','عندي ايه الخميس','مرتبي','آخر رسايل الأهالي','في طلبات استثناء','افتح شات الأهالي','افتح جدولي','مجموعاتي','احمد سامي حضر؟','تقرير عن منى','مين اشتراكه منتهي','يوسف','ملخص النهاردة','وهو غاب كام مرة','يوسف إبراهيم تقييماته']],
  ASSISTANT:['a1',['مين الغايبين النهاردة؟','مين اشتراكه منتهي؟','في طلبات استثناء','دور على منى','ملخص النهاردة','مرتبي','يوسف']],
  PARENT:['p1',['ابني عمل ايه النهاردة؟','ابني حضر النهاردة؟','تقييمات ابني','اشتراك ابني ساري؟','الحصص الجاية','إيه الأحداث الجاية؟','مين أولادي','منى اشتراكها ايه','احمد سامي','افتح الاشتراك','افتح الشكوى','آخر رسايل المدرس','شكاوي','ملخص','وهو حضر']]
 };
 for(const [role,[pid,qs]] of Object.entries(suites)){
  setRole(role,pid); console.log('=== '+role+' (tools: '+api.assistantToolsFor(role).length+')');
  for(const q of qs) await ask(q);
 }
})();
