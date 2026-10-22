import React,{useState} from "react";
import {FloppyDisk,CheckCircle,PencilSimple,MagnifyingGlass} from "@phosphor-icons/react";
import {cents} from "../data/domain.js";
const money=n=>new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format((n||0)/100);
export function ActualTracking({data,busy,onSave,onOpen,canEditActivity}){
 const [search,setSearch]=useState(""),[filter,setFilter]=useState("planned"),
       [selected,setSelected]=useState(""),[values,setValues]=useState({}),[error,setError]=useState("");
 const activities=data.activities.filter(a=>a.status!=="cancelled"&&
   (!filter||a.status===filter)&&
   (!search.trim()||`${a.type} ${a.date} ${a.id} ${a.clients.map(c=>c.name).join(" ")}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())));
 const editing=data.activities.find(a=>a.id===selected);
 const allow=editing&&canEditActivity(editing);
 const open=a=>{setSelected(a.id===selected?"":a.id);setError("");
   setValues(Object.fromEntries(a.teamShares.map(s=>[s.teamId,s.actual===null?"":String(s.actual/100)])));
 };
 const save=async status=>{
  if(!editing||!allow)return;
  try{
   if(editing.teamShares.some(s=>values[s.teamId]===undefined||String(values[s.teamId]).trim()===""))
    throw new Error("أدخل الفعلي لكل فريق حتى لو كان صفر");
   if(status==="executed"&&!editing.date)throw new Error("حدد تاريخ النشاط قبل اعتماده كمنفذ");
   const teamShares=editing.teamShares.map(s=>({...s,actual:cents(values[s.teamId])}));
   const actual=teamShares.reduce((n,s)=>n+s.actual,0);
   await onSave({...editing,teamShares,actual,status});
   setSelected("");setError("");
  }catch(e){setError(e.message);}
 };
 const pending=data.activities.filter(a=>a.status==="planned").length;
 const completed=data.activities.filter(a=>a.status==="executed").length;
 return <div className="actual-page">
  <div className="section-heading"><div><h2>الفعلي والمتابعة</h2><p>سجل المصروف على الفرق مباشرة، وحدث حالة كل نشاط طوال سنة 2027</p></div><span className="count">{data.activities.length} نشاط</span></div>
  <div className="actual-stats">
   <div><small>قيد المتابعة</small><b>{pending}</b></div>
   <div><small>منفذ</small><b>{completed}</b></div>
   <div><small>الفعلي المسجل USD</small><b dir="ltr">{money(data.activities.reduce((n,a)=>n+(a.actual||0),0))}</b></div>
  </div>
  <div className="actual-toolbar">
   <label className="search"><MagnifyingGlass size={19}/><input placeholder="ابحث باسم النشاط أو الطبيب" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <select value={filter} onChange={e=>setFilter(e.target.value)} aria-label="تصفية حالة النشاط">
    <option value="planned">مخطط وقيد المتابعة</option><option value="executed">منفذ</option><option value="">كل الأنشطة</option>
   </select>
  </div>
  <div className="actual-entries">{activities.map(a=><article className="actual-entry" key={a.id}>
   <div><b>{a.type}</b><small>{a.date||"غير مجدول"} • {a.clients.length} عميل • {a.teamShares.length} فريق</small><p>{a.clients.map(c=>c.name).join("، ")}</p></div>
   <div className="actual-entry-amounts"><span>المخطط <b dir="ltr">{money(a.total)} USD</b></span><span>الفعلي <b dir="ltr">{a.actual===null?"لم يسجل":money(a.actual)+" USD"}</b></span></div>
   <button type="button" onClick={()=>open(a)}><PencilSimple size={17}/>{selected===a.id?"إغلاق":"إدخال الفعلي"}</button>
   {selected===a.id&&<div className="actual-edit-panel">
    <h3>المصروف الفعلي حسب الفريق</h3>
    {a.teamShares.map(s=><label className="actual-team-line" key={s.teamId}>
     <span><b>{s.teamName||data.teams.find(t=>t.id===s.teamId)?.name||s.teamId}</b><small>المخطط: {money(s.amount)} USD</small></span>
     <input dir="ltr" aria-label={`فعلي ${s.teamName||s.teamId}`} type="number" min="0" step=".01" disabled={!allow||busy}
       value={values[s.teamId]??""} placeholder="0.00" onChange={e=>setValues(x=>({...x,[s.teamId]:e.target.value}))}/>
    </label>)}
    <div className="actual-edit-total"><span>إجمالي المدخل</span><b dir="ltr">{money(Object.values(values).reduce((n,v)=>n+(Number.isFinite(Number(v))?Number(v)*100:0),0))} USD</b></div>
    {error&&<p className="warning-text" role="alert">{error}</p>}
    <div className="actual-edit-buttons">
     <button type="button" onClick={()=>onOpen(a)}>تفاصيل النشاط</button>
     {allow&&<><button type="button" disabled={busy} onClick={()=>save("planned")}><FloppyDisk size={17}/> حفظ مبدئي</button>
     <button type="button" className="primary" disabled={busy} onClick={()=>save("executed")}><CheckCircle size={17}/> اعتماد كمنفذ</button></>}
     {!allow&&<small>للقراءة فقط — التعديل للمنشئ والإدارة</small>}
    </div>
   </div>}
  </article>)}
  {!activities.length&&<div className="actual-empty">لا توجد أنشطة تطابق هذه الفلاتر</div>}</div>
 </div>;
}
