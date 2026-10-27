import React,{useState} from "react";
import {Copy,ArrowLeft,CheckCircle,MagnifyingGlass} from "@phosphor-icons/react";
export function CopyCustomer({data,busy,onCopy}){
 const [source,setSource]=useState(``),[target,setTarget]=useState(``),[search,setSearch]=useState(``),[code,setCode]=useState(``),[classification,setClassification]=useState(`A`);
 const rows=data.rosters.find(r=>r.teamId===source)?.rows||[];
 const selected=rows.find(c=>String(c.code)===code);
 const targetCodes=new Set((data.rosters.find(r=>r.teamId===target)?.rows||[]).map(c=>String(c.code)));
 const duplicate=Boolean(code&&targetCodes.has(code));
 const paused=data.teams.some(t=>t.uploading);
 const listed=rows.filter(c=>!search.trim()||[c.code,c.name,c.specialty,c.area].join(` `).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
 return <section className="surface copy-customer-panel">
  <div className="section-heading"><div><h3><Copy size={22}/> نسخ عميل بين الفرق</h3><p>اضافة نفس العميل للفريق الهدف مع الاحتفاظ بكوده ووجوده في الفريق الاصلي</p></div></div>
  <form onSubmit={async e=>{e.preventDefault();if(!selected||duplicate||paused)return;await onCopy({sourceTeamId:source,targetTeamId:target,code,classification});}}>
   <div className="copy-team-grid">
    <label>من فريق<select required disabled={busy} value={source} onChange={e=>{setSource(e.target.value);setCode(``);setSearch(``);if(e.target.value===target)setTarget(``);}}><option value="">اختر الفريق المصدر</option>{data.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <span className="copy-team-arrow"><ArrowLeft size={24}/></span>
    <label>الى فريق<select required disabled={busy||!source} value={target} onChange={e=>setTarget(e.target.value)}><option value="">اختر الفريق الهدف</option>{data.teams.filter(t=>t.id!==source).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
   </div>
   <label>ابحث عن العميل<div className="search"><MagnifyingGlass size={18}/><input disabled={busy||!source} value={search} onChange={e=>setSearch(e.target.value)} placeholder="الاسم او الكود او التخصص او المنطقة"/></div></label>
   <label>العميل<select required disabled={busy||!source} value={code} onChange={e=>setCode(e.target.value)}><option value="">اختر العميل من الفريق المصدر</option>{selected&&!listed.some(c=>String(c.code)===code)&&<option value={code}>{selected.name} — {code}</option>}{listed.map(c=><option key={c.code} value={c.code}>{c.name} — {c.code}{targetCodes.has(String(c.code))?` — موجود في الفريق الهدف`:``}</option>)}</select></label>
   {source&&!listed.length&&<p role="status">لا يوجد عملاء مطابقون للبحث</p>}
   <label>تصنيف العميل في الفريق الهدف<select disabled={busy} value={classification} onChange={e=>setClassification(e.target.value)}>{[`A`,`B`,`C`].map(x=><option key={x}>{x}</option>)}</select></label>
   {selected&&<div className="copy-customer-preview"><CheckCircle size={22}/><div><b>{selected.name}</b><small>{selected.code} • {selected.specialty||`بدون تخصص`} • {selected.area||`بدون منطقة`}</small><small>الفريق المصدر: {selected.classification||`بدون تصنيف`} • الفريق الهدف: {classification}</small></div></div>}
   {duplicate&&<p role="status" className="standalone-notice">العميل موجود بالفعل في الفريق الهدف، لا يمكن نسخه مرة ثانية</p>}
   {paused&&<p role="status" className="standalone-notice">اكمل رفع قوائم العملاء قبل النسخ</p>}
   <p className="copy-customer-note">يتم نسخ عضوية العميل فقط، دون نسخ اختيارات الانشطة او اضافة اي مصاريف</p>
   <button className="primary" type="submit" disabled={busy||!selected||!target||duplicate||paused}><Copy size={18}/>{busy?`جاري النسخ…`:`نسخ العميل`}</button>
  </form>
 </section>;
}
