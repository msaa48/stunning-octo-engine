// يولّد 200+ صيغة عامية لكل سؤال من الشاشات (مع أخطاء إملاء شائعة) ويقيس هل المساعد المحلي يوجّهها صح.
// التشغيل: node variants.js   (يطبع نسبة كل نية + أمثلة الفاشل)
const {api}=require('./harness');
const pick=(a,i)=>a[i%a.length];
const mutate=(s,i)=>{ // تغييرات إملائية واقعية
  const m=[x=>x, x=>x.replace(/ة/g,'ه'), x=>x.replace(/[؟?]/g,''), x=>x.replace(/ا/g,'ا').replace(/ى/g,'ي'), x=>x+'؟؟', x=>x.replace(/النهاردة|النهارده/g,'انهرده'), x=>x.replace(/امبارح/g,'مبارح'), x=>x.replace(/\s+/g,'  '), x=>x.replace(/مين/g,'مييين'), x=>'طيب '+x, x=>'يا باشا '+x, x=>x+' لو سمحت', x=>'ممكن '+x];
  return m[i%m.length](s);
};
function gen(prefixes,cores,suffixes){const out=[];for(const p of prefixes)for(const c of cores)for(const s of suffixes)out.push((p+' '+c+' '+s).replace(/\s+/g,' ').trim());return out;}
const INTENTS={
 count_classes_today:{tool:'today_schedule',qs:gen(['','فيه','عندنا','هل فيه','يا ترى فيه','قولي'],['كام حصة','كام حصه','كام مجموعة','كام حصة او مجموعة','عدد الحصص','كام درس','كام ميعاد'],['النهاردة','انهرده','النهارده','اليوم','دلوقتي','']) },
 class_days:{tool:'class_days',qs:gen(['','طيب','قولي','يا ترى','عايز اعرف'],['فيه يوم ايه','ايه الايام اللي فيها حصص','الايام اللي فيها مجموعات','انهي ايام فيها حصص','الحصص في انهي ايام','ايام الحصص','جدول الاسبوع','حصص الاسبوع ايه','فيه حصص يوم ايه','عندنا حصص ايام ايه'],['','في الاسبوع','يا باشا','لو سمحت']) },
 student_weak:{tool:'students_performance',qs:gen(['','قولي','عايز اعرف','هات'],['مين مستواه ضعيف في الطلبة','مين الطلاب الضعاف','اضعف الطلاب','مين الطالب اللي مستواه وحش','الطلبة اللي مستواهم ضعيف','مين اضعف طالب','الطلاب اللي مستواهم واطي','الطلاب المتدني مستواهم','مين مستواه تعبان من الطلاب','مين اللي مستواه منخفض في الطلاب'],['','الشهر ده','اخر اسبوع','يا باشا']) },
 absent_today:{tool:'absent_today',qs:gen(['','طيب','قولي','هو','يا ترى'],['مين مجاش','مين غايب','مين مجاح','مين الغايبين','مين ماجاش','مين اللي مجاش','الغايبين مين','مين مجوش','مين غاب','فيه حد غايب'],['','النهاردة','انهرده','يا باشا']) },
 absent_yesterday:{tool:'absent_today',day:'yesterday',qs:gen(['','طيب','قولي','هو'],['مين مجاش','مين مجاح','مين غايب','مين الغايبين','مين غاب','مين اللي مجاش','الغايبين مين'],['امبارح','مبارح','امس','يوم امبارح']) },
 absent_date:{tool:'absent_today',date:true,qs:gen(['','طيب','قولي','هو'],['مين مجاش','مين غايب','مين مجاح','مين الغايبين','مين غاب','الغايبين مين'],['يوم ١/١١','يوم 1/11','يوم ٢/١١','يوم 2-11','يوم ٣ نوفمبر','يوم 3/11']) },
 count_absent:{tool:'absent_today',count:true,qs:gen(['','قولي','عايز اعرف'],['كام واحد غايب','كام طالب غايب','عدد الغايبين','كام واحد مجاش','كام غايب','كام طالب مجاش','عدد اللي غابوا'],['','النهاردة','انهرده','يا باشا']) },
};
let tot=0,okT=0;
for(const [name,it] of Object.entries(INTENTS)){
  let qs=[...new Set(it.qs)];
  // مضاعفة بالتحويرات الإملائية لحد 200+
  const all=[];qs.forEach((q,i)=>{for(let k=0;k<4;k++)all.push(mutate(q,i+k*3));});
  const uniq=[...new Set(all)];
  let ok=0;const bad=[];
  for(const q of uniq){
    api.resetPending&&api.resetPending();
    const p=api.assistantPlan(q);
    let good=p&&p.tool===it.tool;
    if(good&&it.day) good=p.args.day===it.day;
    if(good&&it.date) good=/^\d{4}-\d{2}-\d{2}$/.test(p.args.day);
    if(good&&it.count) good=p.mode==='count';
    if(good&&name==='absent_today') good=(p.args.day==='today'&&p.mode!=='count');
    ok++; if(!good){ok--;bad.push(q+'  →  '+(p?p.tool+' '+JSON.stringify(p.args)+' '+p.mode:p===null?'null':JSON.stringify(p).slice(0,40)));}
  }
  tot+=uniq.length;okT+=ok;
  console.log(`${name}: ${ok}/${uniq.length} = ${Math.round(ok/uniq.length*100)}%`);
  bad.slice(0,8).forEach(b=>console.log('   ❌ '+b));
}
console.log(`\nالإجمالي: ${okT}/${tot} = ${Math.round(okT/tot*100)}%`);
