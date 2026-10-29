import React,{useMemo,useState,useRef,useLayoutEffect} from "react";
import {Target,UsersThree,MagnifyingGlass,Check,Plus,ArrowClockwise,ShieldCheck,Link,User} from "@phosphor-icons/react";
import {visibleStandaloneGroups,matchStandAlone,eligibleDoctor,STANDALONE_CAMPAIGNS,selectionLabelsByCustomer,selectionStatusByCustomer,specialtyMatches} from "../data/standalone.js";

export function Standalone({data,busy,onChoose,onInit,mode="standalone"}){
 const listRef=useRef(null),savedScroll=useRef(null);
 const [allSpecialties,setAllSpecialties]=useState(false);
 const [specialtyFilter,setSpecialtyFilter]=useState(`all`);
 const [active,setActive]=useState("");
 const [statusFilter,setStatusFilter]=useState(`all`);
 const [search,setSearch]=useState("");
 const [onlySelected,setOnlySelected]=useState(false);
 const profile=data.profile,privileged=[`admin`,`manager`].includes(profile.role);
 const groups=useMemo(()=>visibleStandaloneGroups(data.teams,profile).filter(g=>mode==="pedia"?g.id==="pedia":mode==="advisory"?g.id==="advisory":g.id!=="pedia"&&g.id!=="advisory"),[data.teams,profile,mode]);
 const enabled=new Map((data.standalone?.quotas||[]).map(q=>[q.campaign+"__"+q.teamId,q]));
 const choices=data.standalone?.choices||[];
 useLayoutEffect(()=>{if(savedScroll.current!==null&&listRef.current){listRef.current.scrollTop=savedScroll.current;savedScroll.current=null;}},[choices]);
 const selectionLabels=useMemo(()=>selectionLabelsByCustomer(choices),[choices]);
 const selectedKey=groups.some(g=>g.key===active)?active:groups[0]?.key;
 const current=groups.find(g=>g.key===selectedKey);
 const myChoices=choices.filter(c=>c.campaign===current?.id&&c.teamId===current?.teamId);
 const selectedCodes=new Set(myChoices.map(c=>c.code));
 const roster=new Set(data.rosters.find(r=>r.teamId===current?.teamId)?.rows.map(c=>c.code)||[]);
 const participants=data.customers.filter(c=>
  current&&roster.has(c.code)&&(selectedCodes.has(c.code)||eligibleDoctor(current.id,{...c,visitingTeams:c.visitingTeams||[current.teamId]},current.teamId,current.teamName))&&
  (mode!==`standalone`|| (current.id===`gastro`||allSpecialties||specialtyMatches(current.id,c.specialty)||selectedCodes.has(c.code))));
 const specialtyOptions=[...new Set(participants.map(c=>String(c.specialty||``).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,`ar`));
 const statuses=useMemo(()=>selectionStatusByCustomer(choices,current?.id,current?.teamId,privileged&&data.standalone?.complete!==false),[choices,current?.id,current?.teamId,privileged,data.standalone?.complete]);
 const canClassify=privileged&&data.standalone?.complete!==false;
 const showMatching=mode===`standalone`;
 const matchingCount=[...statuses.values()].filter(s=>s.status===`matching`).length;
 const uniqueCount=[...statuses.values()].filter(s=>s.status===`unique`).length;
 const listed=participants.filter(c=>(current?.id!==`gastro`||specialtyFilter===`all`||String(c.specialty||``).trim()===specialtyFilter)&&(!showMatching||statusFilter===`all`||statuses.get(String(c.code))?.status===statusFilter)&&(!onlySelected||selectedCodes.has(c.code))&&
  (!search.trim()||[c.code,c.name,c.specialty,c.area].join(" ").toLocaleLowerCase().includes(search.toLocaleLowerCase().trim())))
  .sort((a,b)=>a.name.localeCompare(b.name,`ar`)||String(a.code).localeCompare(String(b.code)));
 const quota=enabled.get(current?.key),count=quota?.count||0;
 const matched=useMemo(()=>matchStandAlone(choices,groups),[choices,groups]);
 return <div className="standalone-page">
  <div className="section-heading">
   <div><h2>{mode==="pedia"?"Pedia Activity":mode==="advisory"?"Advisory Board":"Stand Alone"}</h2><p>مسارات اختيار مستقلة للأطباء، دون تأثير على الأنشطة المالية أو ميزانيات الفرق</p></div>
   {privileged&&<button className="primary" disabled={busy} onClick={onInit}><ShieldCheck size={17}/> تهيئة مسارات الاختيار</button>}
  </div>
  <div className="standalone-campaign-tabs">
   {STANDALONE_CAMPAIGNS.filter(c=>groups.some(g=>g.id===c.id)).map(c=>
    <div className={`standalone-campaign ${c.id===`pedia`?`pedia`:``}`} key={c.id}>
     <div className="standalone-campaign-title"><span className="standalone-campaign-icon"><Target size={17} weight="bold"/></span><b>{c.title}</b></div>
     <small>{c.id===`ent-chest`?`Azord + Matador • ENT 30 لكل فريق`:c.id===`gastro`?`Matador فقط • 30 اختيارا من جميع تخصصات أطباء الفريق`:c.id===`uro`?`URO + Matador • 25 لكل فريق`:c.id===`advisory`?`Azord + Matador + URO • Advisory Board (URO specialty for URO team)`:`Azord + Clavodar + Mixif • بدون حصة محددة`}</small>
     <div>{groups.filter(g=>g.id===c.id).map(g=>
      <button type="button" key={g.key} aria-pressed={selectedKey===g.key} className={selectedKey===g.key?"active":""} onClick={()=>{setActive(g.key);setSearch("");setOnlySelected(false);setStatusFilter(`all`);setAllSpecialties(false);setSpecialtyFilter(`all`)}}>
       {g.teamName}
       <span>{enabled.get(g.key)?.count||0}{g.quota>0?` / ${g.quota}`:``}</span>
      </button>)}</div>
    </div>)}
  </div>
  {current?<section className="surface standalone-selector">
   <div className="standalone-selected-title">
    <div><h3>{current.title} — {current.teamName}</h3><p>{current.quota>0?`المستهدف ${current.quota} طبيبا لهذا الفريق بشكل مستقل`:`اختيار أطباء الأطفال لهذا الفريق بدون عدد مستهدف محدد`}</p></div>
    <strong className="standalone-quota">{count}{current.quota>0&&<small> / {current.quota}</small>}</strong>
   </div>
   {current.quota>0&&<div className="standalone-meter"><div style={{width:`${Math.min(100,count/current.quota*100)}%`}}/></div>}
   {!quota&&<p className="standalone-notice" role="status">يلزم تهيئة المسار بواسطة الأدمن قبل بدء اختيار الأطباء</p>}
   {mode===`standalone`&&current.id!==`gastro`&&<div className="standalone-extra-specialty">
    <button type="button" className="text-button" aria-pressed={allSpecialties} disabled={busy} onClick={()=>{setAllSpecialties(v=>!v);setSearch(``);setOnlySelected(false);setStatusFilter(`all`);}}><Plus size={17}/>{allSpecialties?`العودة للقائمة الرئيسية`:`اضافة من تخصص آخر`}</button>
    {allSpecialties&&<small role="status">كل عملاء فريقك بجميع التخصصات، ضمن حصة المسار الحالية</small>}
   </div>}
   {current.id===`gastro`&&<label className="standalone-gastro-specialty">فلتر التخصص <select value={specialtyFilter} onChange={e=>setSpecialtyFilter(e.target.value)}><option value="all">جميع التخصصات ({participants.length})</option>{specialtyOptions.map(spec=><option key={spec} value={spec}>{spec} ({participants.filter(c=>String(c.specialty||``).trim()===spec).length})</option>)}{participants.some(c=>!String(c.specialty||``).trim())&&<option value="">بدون تخصص</option>}</select></label>}
   <div className="standalone-toolbar">
    <label className="search"><MagnifyingGlass size={17}/><input placeholder="ابحث بالاسم أو الكود أو التخصص" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <label className="check-line"><input type="checkbox" checked={onlySelected} onChange={e=>setOnlySelected(e.target.checked)}/> المختارون فقط ({selectedCodes.size})</label>
   </div>
   {showMatching&&<div className="standalone-status-bar">
    <div className="standalone-status-filters" role="group" aria-label="تصفية حسب المطابقة">
     {[{id:`all`,label:`الكل`,count:participants.length},{id:`matching`,label:`Matching`,count:matchingCount},{id:`unique`,label:`Unique`,count:uniqueCount}].map(f=><button key={f.id} type="button" disabled={!canClassify&&f.id!==`all`} aria-pressed={statusFilter===f.id} className={`status-filter ${f.id} ${statusFilter===f.id?`active`:``}`} onClick={()=>setStatusFilter(f.id)}>{f.id===`matching`?<Link size={16}/>:f.id===`unique`?<User size={16}/>:<UsersThree size={16}/>}<span>{f.label}</span><b>{canClassify||f.id===`all`?f.count:`—`}</b></button>)}
    </div>
    <small>{canClassify?`المطابقة للمختارين ضمن هذا المسار فقط`:privileged?`يلزم نشر قواعد Firestore المحدثة لتفعيل قراءة المطابقة`:`المطابقة متاحة للادمن ومدير التسويق فقط حسب صلاحيات قراءة اختيارات الفرق الحالية`}</small>
   </div>}
   <div className="standalone-list" ref={listRef}>{listed.map(c=>{
    const chosen=selectedCodes.has(c.code);
    const classification=showMatching?statuses.get(String(c.code)):null;
    const otherNames=classification?.otherTeams.map(id=>data.teams.find(t=>t.id===id)?.name||id).join(` + `);
    return <div key={c.code} className={`standalone-doctor ${chosen?`selected`:``} ${classification?`is-${classification.status}`:``}`}>
     <div className="standalone-doctor-details"><div className="standalone-doctor-name-line"><b>{c.name}</b>{classification&&<span className={`standalone-status-label ${classification.status}`} title={otherNames?`مختار ايضا لدى ${otherNames}`:`مختار لدى هذا الفريق فقط ضمن المسار`}>
      {classification.status===`matching`?<Link size={13} weight="bold"/>:<User size={13} weight="bold"/>}
      <span dir="ltr">{classification.status===`matching`?`Matching`:`Unique`}</span>{otherNames&&<span className="standalone-matching-team">مع <bdi>{otherNames}</bdi></span>}
     </span>}{(selectionLabels.get(String(c.code))||[]).map(label=><span key={label} className={`client-selection-label ${label===`Pedia Activity`?`is-pedia`:`is-standalone`}`}>{label}</span>)}</div><small>{c.code} • {c.specialty||`بدون تخصص`} • {c.area||"—"}</small></div>
     <button type="button" disabled={busy||!quota||(!chosen&&current.quota>0&&count>=current.quota)} onClick={()=>{savedScroll.current=listRef.current?.scrollTop??null;onChoose({campaign:current.id,teamId:current.teamId,code:c.code,selected:!chosen});}} className={chosen?"standalone-remove":"standalone-add"}>
      {chosen?<><Check size={16}/> إزالة الاختيار</>:<><Plus size={16}/> اختيار</>}
     </button>
    </div>;
   })}
   {!listed.length&&<p className="standalone-empty">لا يوجد أطباء مطابقون للبحث أو التخصص المخصص لهذا المسار</p>}
   </div>
  </section>:<p className="standalone-notice">لم يتم العثور على اي فريق مخول لمسارات الاختيار المتاحة</p>}
  {canClassify&&<section className="surface standalone-matching">
   <h3><UsersThree size={21}/> Matching — للأدمن والإدارة فقط</h3>
   <p>اختيارات الفرق مستقلة، ويُحسب الطبيب المشترك مرة واحدة ضمن إجمالي الأطباء الفريدين.</p>
   {matched.filter(m=>groups.some(g=>g.id===m.id)).map(m=><div key={m.id} className="standalone-match-block">
    <div className="standalone-match-head"><b>{m.title}</b>
     <span>أطباء فريدون: <strong>{m.unique}</strong> • مشتركون: <strong>{m.matches.length}</strong></span></div>
    <div className="standalone-match-stats">{m.byTeam.map(t=><span key={t.teamId}>{data.teams.find(x=>x.id===t.teamId)?.name}: <b>{t.count}</b>{m.quota>0?` / ${m.quota}`:``}</span>)}</div>
    {m.matches.length?<div className="standalone-matched-doctors">
     {m.matches.map(x=><div key={x.code}><div className="standalone-matched-name"><b>{data.customers.find(c=>c.code===x.code)?.name||x.code}</b>{(selectionLabels.get(String(x.code))||[]).map(label=><span key={label} className={`client-selection-label ${label===`Pedia Activity`?`is-pedia`:`is-standalone`}`}>{label}</span>)}</div><small>{x.code} • {x.teams.map(t=>data.teams.find(z=>z.id===t)?.name||t).join(" + ")}</small></div>)}
    </div>:<p className="standalone-empty">لا يوجد تطابق بين اختيارات الفرق في هذا المسار بعد</p>}
   </div>)}
  </section>}
 </div>;
}
