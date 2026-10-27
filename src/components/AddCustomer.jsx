import React,{useState} from `react`;
import {UserPlus,CheckCircle,WarningCircle} from `@phosphor-icons/react`;

const initial={code:``,name:``,teamId:``,classification:`A`,kind:`طبيب`,specialty:``,area:``};
export function AddCustomer({data,busy,onAdd}){
 const [form,setForm]=useState(initial);
 const set=(key,value)=>setForm(prev=>({...prev,[key]:value}));
 const code=form.code.trim();
 const duplicate=Boolean(code&&data.customers.some(c=>String(c.code)===code));
 const importing=data.teams.some(team=>team.uploading);
 const canSubmit=Boolean(code&&form.name.trim()&&form.teamId&&!duplicate&&!importing&&!busy);
 const save=async e=>{
  e.preventDefault();
  if(!canSubmit)return;
  const ok=await onAdd({...form,code,name:form.name.trim(),specialty:form.specialty.trim(),area:form.area.trim()});
  if(ok)setForm(prev=>({...prev,code:``,name:``,specialty:``,area:``}));
 };
 return <section className=`surface manual-customer-panel`>
  <div className=`section-heading`><div><h3><UserPlus size={22}/> إضافة عميل جديد</h3>
   <p>إضافة عميل إلى قائمة فريق واحد مباشرة، دون استبدال القائمة الحالية أو التأثير على الأنشطة السابقة</p></div></div>
  <form onSubmit={save}>
   <div className=`manual-customer-fields`>
    <label>الفريق <span className=`manual-required`>*</span><select required disabled={busy} value={form.teamId} onChange={e=>set(`teamId`,e.target.value)}><option value=``>اختر الفريق</option>{data.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <label>كود العميل <span className=`manual-required`>*</span><input required maxLength={100} disabled={busy} value={form.code} onChange={e=>set(`code`,e.target.value)} placeholder=`مثال: 000123` autoComplete=`off` dir=`ltr` /></label>
    <label>اسم العميل <span className=`manual-required`>*</span><input required maxLength={200} disabled={busy} value={form.name} onChange={e=>set(`name`,e.target.value)} placeholder=`اسم الطبيب أو المؤسسة` /></label>
    <label>التصنيف <span className=`manual-required`>*</span><select disabled={busy} value={form.classification} onChange={e=>set(`classification`,e.target.value)}>{[`A`,`B`,`C`].map(x=><option key={x}>{x}</option>)}</select></label>
    <label>نوع العميل<select disabled={busy} value={form.kind} onChange={e=>set(`kind`,e.target.value)}>{[`طبيب`,`مركز`,`مستشفى`,`صيدلية`,`أخرى`].map(x=><option key={x}>{x}</option>)}</select></label>
    <label>التخصص<input maxLength={200} disabled={busy} value={form.specialty} onChange={e=>set(`specialty`,e.target.value)} placeholder=`التخصص الطبي (اختياري)` /></label>
    <label>المنطقة<input maxLength={200} disabled={busy} value={form.area} onChange={e=>set(`area`,e.target.value)} placeholder=`المنطقة (اختياري)` /></label>
   </div>
   {duplicate&&<p className=`manual-customer-warning` role=`alert`><WarningCircle size={18}/> هذا الكود موجود بالفعل. لإضافته إلى فريق آخر، استخدم «نسخ عميل بين الفرق»</p>}
   {importing&&<p className=`manual-customer-warning` role=`status`><WarningCircle size={18}/> يوجد استيراد قوائم قيد التنفيذ. أكمله قبل إضافة عميل</p>}
   {form.teamId&&!duplicate&&<div className=`manual-customer-preview`><CheckCircle size={20}/><span>سيضاف العميل إلى <b>{data.teams.find(t=>t.id===form.teamId)?.name}</b> بتصنيف <b>{form.classification}</b> دون تعديل أي قائمة أخرى</span></div>}
   <div className=`manual-customer-footer`><small>يحفظ كود العميل كنص للحفاظ على الأصفار الأولى. جميع الحقول المميزة بـ * إلزامية</small>
    <button className=`primary` type=`submit` disabled={!canSubmit}><UserPlus size={19}/>{busy?`جار الإضافة…`:`حفظ العميل`}</button></div>
  </form>
 </section>;
}
