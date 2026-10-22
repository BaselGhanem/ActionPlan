import React from "react";
import { X, Plus, FloppyDisk, SquaresFour, CheckCircle, Trash } from "@phosphor-icons/react";
import { cents, equally, weighted } from "../data/domain.js";
const money = n => new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format((n||0)/100);
const read = value => value===""?0:cents(value);
export function TeamActivityDialog({ draft,setDraft,teams,types,eligible,canEdit,canCancel,busy,onClose,onSave,onDelete,onPick,renderName }) {
 const shares=draft.teamShares||[];
 const planned=shares.reduce((n,s)=>n+s.amount,0);
 const actual=shares.reduce((n,s)=>n+(s.actual||0),0);
 const update=patch=>setDraft(d=>({...d,...patch}));
 const changeShare=(teamId,patch)=>setDraft(d=>({...d,teamShares:d.teamShares.map(s=>s.teamId===teamId?{...s,...patch}:s)}));
 const distribute=(field)=>setDraft(d=>{
   const portions=field==="amount"?equally(d.total,d.teamShares.length):
    weighted(d.actual||0,d.teamShares.map(s=>s.amount));
   return {...d,teamShares:d.teamShares.map((s,i)=>({...s,[field]:portions[i]}))};
 });
 const chooseTeam=t=>setDraft(d=>{
   const current=d.teamShares;
   const next=current.some(s=>s.teamId===t.id)?current.filter(s=>s.teamId!==t.id):
    [...current,{teamId:t.id,teamName:t.name,amount:0,actual:d.actual===null?null:0}];
   const amounts=equally(d.total,next.length);
   const spent=d.actual===null?[]:weighted(d.actual,amounts);
   return {...d,teamShares:next.map((s,i)=>({...s,amount:amounts[i],actual:d.actual===null?null:spent[i]}))};
 });
 const availableTeams=teams.filter(t=>shares.some(s=>s.teamId===t.id)||draft.clients.some(c=>eligible(c).some(v=>v.id===t.id)));
 return <div className="activity-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section className="activity-modal" role="dialog" aria-modal="true" aria-label={draft.id?"تعديل النشاط":"نشاط جديد"}>
   <header className="activity-modal-header">
    <div><small>Dar Al Dawa • 2027</small><h2>{draft.id?"إدارة النشاط":"إنشاء نشاط جديد"}</h2><p>توزيع الميزانية والفعلي على الفرق فقط</p></div>
    <button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={24}/></button>
   </header>
   <div className="activity-modal-body">
    <fieldset disabled={!canEdit||busy} className="activity-form">
     <section className="activity-form-card">
      <h3>01 / بيانات النشاط</h3>
      <div className="activity-form-grid">
       <label className="field"><span>نوع النشاط</span><select value={draft.type} onChange={e=>update({type:e.target.value})}>
        <option value="">اختر النوع</option>{[...new Set([...types,...(draft.type?[draft.type]:[])])].map(t=><option key={t}>{t}</option>)}
       </select></label>
       <label className="field"><span>تاريخ النشاط</span><input type="date" min="2027-01-01" max="2027-12-31" value={draft.date} onChange={e=>update({date:e.target.value})}/></label>
       <label className="field"><span>الميزانية المخططة (USD)</span><input type="number" min="0" step=".01" dir="ltr" value={draft.total?draft.total/100:""}
         onChange={e=>{try{let v=read(e.target.value);setDraft(d=>{
          const allocations=equally(v,d.teamShares.length);
          return {...d,total:v,teamShares:d.teamShares.map((s,i)=>({...s,amount:allocations[i]}))};
         });}catch{}}}/></label>
       <label className="field"><span>حالة النشاط</span><select value={draft.status} onChange={e=>update({status:e.target.value})}>
        <option value="planned">مخطط / قيد المتابعة</option><option value="executed">منفذ</option>
        {canCancel&&draft.id&&<option value="cancelled">ملغي</option>}
       </select></label>
      </div>
     </section>
     <section className="activity-form-card">
      <div className="activity-form-heading"><h3>02 / العملاء المشاركون</h3><button type="button" className="text-button" onClick={onPick}><Plus size={17}/> إضافة عميل</button></div>
      <div className="activity-client-grid">
       {draft.clients.map(c=><div className="activity-client-item" key={c.code}>
        <span>{renderName(c)}<small>{c.code} • {c.specialty||"بدون تخصص"}</small></span>
        <button type="button" className="icon-button" onClick={()=>setDraft(d=>({...d,clients:d.clients.filter(x=>x.code!==c.code)}))}><X size={16}/></button>
       </div>)}
      </div>
      {!draft.clients.length&&<p className="warning-text">اختر عميلا واحدا على الأقل</p>}
     </section>
     <section className="activity-form-card">
      <div className="activity-form-heading"><h3>03 / الميزانية موزعة على الفرق</h3><button type="button" className="text-button" onClick={()=>distribute("amount")} disabled={!shares.length}><SquaresFour size={17}/> توزيع بالتساوي</button></div>
      <div className="activity-team-options">{availableTeams.map(t=><label key={t.id} className="check-line"><input type="checkbox" checked={shares.some(s=>s.teamId===t.id)} onChange={()=>chooseTeam(t)}/>{t.name}</label>)}</div>
      <div className="activity-share-grid">
       {shares.map(s=><div className="activity-share-row" key={s.teamId}>
        <b>{teams.find(t=>t.id===s.teamId)?.name||s.teamName}</b>
        <label><span>المخطط USD</span><input type="number" min="0" step=".01" dir="ltr" value={s.amount/100} onChange={e=>{try{changeShare(s.teamId,{amount:read(e.target.value)})}catch{}}}/></label>
        {draft.actual!==null&&<label><span>الفعلي USD</span><input type="number" min="0" step=".01" dir="ltr" value={(s.actual||0)/100} onChange={e=>{try{changeShare(s.teamId,{actual:read(e.target.value)})}catch{}}}/></label>}
       </div>)}
      </div>
      <div className={`activity-reconcile ${planned===draft.total?"":"invalid"}`}><CheckCircle size={17}/> حصص الفرق: <b dir="ltr">{money(planned)} USD</b><span>الفرق: {money(draft.total-planned)} USD</span></div>
     </section>
     <section className="activity-form-card">
      <div className="activity-form-heading"><h3>04 / الفعلي والمتابعة</h3><button className="text-button" type="button" disabled={draft.actual===null||!shares.length} onClick={()=>distribute("actual")}>توزيع فعلي بنسبة المخطط</button></div>
      <div className="activity-form-grid"><label className="field"><span>المصروف الفعلي الإجمالي (USD)</span>
       <input type="number" min="0" step=".01" dir="ltr" placeholder="لم يسجل بعد" value={draft.actual===null?"":draft.actual/100}
       onChange={e=>{try{const n=e.target.value===""?null:read(e.target.value);setDraft(d=>{
        const portions=n===null?[]:weighted(n,d.teamShares.map(s=>s.amount));
        return {...d,actual:n,teamShares:d.teamShares.map((s,i)=>({...s,actual:n===null?null:portions[i]}))};
       });}catch{}}}/>
      </label><p className="hint">عند التنفيذ، المصروف الفعلي يحل مكان المخطط المحجوز. ويمكن حفظ فعلي مبدئي مع بقاء النشاط مخططا.</p></div>
      {draft.actual!==null&&<div className={`activity-reconcile ${actual===draft.actual?"":"invalid"}`}><CheckCircle size={17}/> فعلي الفرق: {money(actual)} USD <span>الفرق: {money(draft.actual-actual)} USD</span></div>}
     </section>
     <section className="activity-form-card"><label className="field"><span>ملاحظات</span><textarea maxLength={3000} rows={3} value={draft.notes} onChange={e=>update({notes:e.target.value})}/></label></section>
    </fieldset>
   </div>
   <footer className="activity-modal-footer"><small>{canEdit?"حتى 8 عملاء و8 فرق • USD":"للقراءة فقط"}</small><div>
    {canEdit&&onDelete&&<button type="button" disabled={busy} className="danger-text" onClick={onDelete}><Trash size={16}/> حذف</button>}
    <button type="button" onClick={onClose}>إغلاق</button>
    {canEdit&&<button type="button" className="primary" disabled={busy||!draft.clients.length||!shares.length} onClick={onSave}><FloppyDisk size={18}/>{busy?"جار الحفظ…":"حفظ النشاط"}</button>}
   </div></footer>
  </section>
 </div>;
}
