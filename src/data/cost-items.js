import {isDoctorClient} from "./activity-presence.js";
// Cost components are purposes of spend, independent of the team budget allocation.
export const COST_CATEGORIES=Object.freeze([
 {value:"client",label:"Honorarium / أتعاب الأطباء"},
 {value:"meal",label:"غداء / ضيافة"},
 {value:"venue",label:"قاعة / مكان"},
 {value:"logistics",label:"تجهيزات / نقل"},
 {value:"other",label:"بند آخر"},
]);
export const costItemsTotal=items=>(items||[]).reduce((sum,x)=>sum+Number(x.amount||0),0);
export function validateCostItems(items,total){
 if(items===undefined||items===null)return;
 if(!Array.isArray(items)||items.length>8)throw new Error("تفاصيل التكلفة تدعم حتى 8 بنود");
 const allowed=new Set(COST_CATEGORIES.map(c=>c.value)),seen=new Set();
 for(const x of items){
  if(!x||!allowed.has(x.category)||typeof x.id!=="string"||!/^[a-zA-Z0-9_-]{1,64}$/.test(x.id)||
   typeof x.label!=="string"||!x.label.trim()||x.label.length>140||
   !Number.isSafeInteger(x.amount)||x.amount<=0||x.amount>100000000000)
   throw new Error("تفاصيل التكلفة تحتوي بندا غير صحيح: أدخل وصفا ومبلغا أكبر من صفر");
  if(seen.has(x.id))throw new Error("تفاصيل التكلفة تحتوي بندا مكررا");
  seen.add(x.id);
 }
 if(items.length&&costItemsTotal(items)!==total)
  throw new Error("مجموع تفاصيل تكلفة النشاط لا يطابق الميزانية المخططة");
}

export const honorariumTotal=costItems=>(costItems||[])
 .filter(item=>item.category==="client")
 .reduce((sum,item)=>sum+Number(item.amount||0),0);

export function equalHonorariumShares(clients,total) {
 const doctors=(clients||[]).filter(c=>isDoctorClient(c));
 const n=doctors.length;
 return doctors.map((c,i)=>({
  code:String(c.code),
  amount:Math.floor(total/n)+(i<total%n?1:0),
 }));
}

// Optional detail is assigned to doctors only; team budgets stay completely independent.
export function withHonorariumParticipants(draft,clients) {
 const chosen=(draft.honorariumShares||[]);
 if(!chosen.length)return {...draft,clients};
 const doctors=clients.filter(isDoctorClient);
 const same=doctors.length===chosen.length && doctors.every(c=>chosen.some(s=>s.code===String(c.code)));
 return {...draft,clients,honorariumShares:same?chosen:equalHonorariumShares(doctors,honorariumTotal(draft.costItems))};
}

export function validateHonorariumShares(draft) {
 const shares=draft.honorariumShares||[];
 if(!Array.isArray(shares)||shares.length>8)
  throw new Error("توزيع Honorarium يدعم حتى 8 أطباء");
 if(!shares.length)return;
 const codes=new Set((draft.clients||[]).filter(isDoctorClient).map(c=>String(c.code)));
 const seen=new Set();
 for(const share of shares){
  if(!share||typeof share.code!=="string"||!codes.has(share.code)||
   !Number.isSafeInteger(share.amount)||share.amount<0||share.amount>100000000000)
   throw new Error("توزيع Honorarium يحتوي طبيبا أو مبلغا غير صحيح");
  if(seen.has(share.code))throw new Error("توزيع Honorarium يحتوي طبيبا مكررا");
  seen.add(share.code);
 }
 if(seen.size!==codes.size)throw new Error("أضف توزيع Honorarium لجميع الأطباء المشاركين");
 if(shares.reduce((sum,s)=>sum+s.amount,0)!==honorariumTotal(draft.costItems))
  throw new Error("مجموع حصص الأطباء لا يطابق مبلغ Honorarium");
}

export function withCostBreakdown(draft,costItems){
 const total=costItemsTotal(costItems),shares=draft.teamShares||[];
 const size=shares.length;
 const evenly=shares.map((s,i)=>Math.floor(total/size)+(i<total%size?1:0));
 const honorChanged=honorariumTotal(draft.costItems)!==honorariumTotal(costItems);
 return {...draft,total,costItems,
  teamShares:shares.map((s,i)=>({...s,amount:total===draft.total?s.amount:evenly[i]})),
  ...(honorChanged&&(draft.honorariumShares||[]).length
   ?{honorariumShares:equalHonorariumShares(draft.clients,honorariumTotal(costItems))}:{})
 };
}
