import React,{useMemo,useState,useEffect} from "react";
import {UsersThree,ChartBar,MagnifyingGlass} from "@phosphor-icons/react";
import {externalTeamExpenses,externalExpenseTotals} from "../data/external-expenses.js";
const money=n=>new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format((n||0)/100);
export function IncomingExpenses({data,onOpen}){
 const [target,setTarget]=useState(data.profile.role==="team"?data.profile.teamId:data.teams[0]?.id||"");
 const [origin,setOrigin]=useState("");
 const [search,setSearch]=useState("");
 useEffect(()=>{if(data.profile.role==="team")setTarget(data.profile.teamId)},[data.profile.role,data.profile.teamId]);
 const items=useMemo(()=>externalTeamExpenses(data.activities,target,data.teams),[data.activities,target,data.teams]);
 const sources=[...new Set(items.map(x=>x.origin.name))].sort((a,b)=>a.localeCompare(b,"ar"));
 const rows=items.filter(x=>(!origin||x.origin.name===origin)&&(!search.trim()||`${x.activity.type} ${x.origin.name} ${x.activity.clients.map(c=>c.name+" "+c.code).join(" ")}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())));
 const totals=externalExpenseTotals(rows);
 return <section className="incoming-expenses-page">
  <div className="section-heading">
   <div><h2>المصاريف الواردة من الفرق</h2><p>مبالغ أضافتها فرق أخرى وحمّلتها مباشرة على حصة الفريق المحدد في الأنشطة المشتركة</p></div>
   <span className="count">{rows.length} نشاط</span>
  </div>
  <div className="incoming-filter-bar">
   {data.profile.role!=="team"&&<label className="field"><span>الفريق المستقبل</span>
    <select value={target} onChange={e=>{setTarget(e.target.value);setOrigin("")}}>
     {data.teams.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}
    </select></label>}
   <label className="field"><span>من أي فريق</span><select value={origin} onChange={e=>setOrigin(e.target.value)}>
    <option value="">كل الفرق المنشئة</option>{sources.map(name=><option key={name}>{name}</option>)}
   </select></label>
   <label className="search"><MagnifyingGlass size={18}/><input placeholder="ابحث بالنشاط أو الطبيب" value={search} onChange={e=>setSearch(e.target.value)}/></label>
  </div>
  <div className="incoming-summary">
   <div><small>مخطط حمّلته الفرق الأخرى</small><b dir="ltr">{money(totals.planned)} USD</b></div>
   <div><small>الفعلي المسجل</small><b dir="ltr">{money(totals.actual)} USD</b></div>
   <div><small>المؤثر على الميزانية حالياً</small><b dir="ltr">{money(totals.charged)} USD</b></div>
  </div>
  <section className="surface">
   <div className="table-wrap"><table>
    <thead><tr><th>نوع النشاط</th><th>الفريق المنشئ</th><th>العملاء</th><th>التاريخ</th><th>المخطط على الفريق USD</th><th>الفعلي على الفريق USD</th><th>الحالة</th><th></th></tr></thead>
    <tbody>{rows.map(({activity:a,origin:from,planned,actual})=><tr key={a.id}>
     <td><b>{a.type}</b><small className="row-sub">{a.id.slice(-8)}</small></td>
     <td><strong>{from.name}</strong></td>
     <td>{a.clients.map(c=>c.name).join("، ")}</td>
     <td>{a.date||"غير محدد"}</td>
     <td className="numeric">{money(planned)}</td>
     <td className="numeric">{actual==null?"—":money(actual)}</td>
     <td>{a.status==="planned"?"مخطط":a.status==="executed"?"منفذ":"ملغي"}</td>
     <td><button type="button" className="text-button" onClick={()=>onOpen(a)}>تفاصيل</button></td>
    </tr>)}</tbody>
   </table></div>
   {!rows.length&&<p className="incoming-empty">لا توجد مبالغ محمّلة على هذا الفريق من أنشطة أنشأتها فرق أخرى ضمن الفلاتر الحالية</p>}
  </section>
  <p className="incoming-disclaimer">الأرقام هنا حصص مسجلة صراحة على ميزانية الفريق، وليست تقديراً لما أنفقته فرق أخرى على طبيب مشترك دون تحديد حصة مالية لهذا الفريق.</p>
 </section>;
}
