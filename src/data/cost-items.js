// Cost components are purposes of spend, independent of the team budget allocation.
export const COST_CATEGORIES=Object.freeze([
 {value:"client",label:"تكلفة مرتبطة بالعميل"},
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
