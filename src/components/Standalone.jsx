import React,{useMemo,useState,useEffect} from "react";
import {Target,UsersThree,MagnifyingGlass,Check,Plus,ArrowClockwise,ShieldCheck} from "@phosphor-icons/react";
import {visibleStandaloneGroups,matchStandAlone,eligibleDoctor,STANDALONE_CAMPAIGNS,selectionLabelsByCustomer} from "../data/standalone.js";

export function Standalone({data,busy,onChoose,onInit,mode="standalone"}){
 const [active,setActive]=useState("");
 const [search,setSearch]=useState("");
 const [onlySelected,setOnlySelected]=useState(false);
 const profile=data.profile,privileged=profile.role==="admin";
 const groups=useMemo(()=>visibleStandaloneGroups(data.teams,profile).filter(g=>mode==="pedia"?g.id==="pedia":g.id!=="pedia"),[data.teams,profile,mode]);
 const enabled=new Map((data.standalone?.quotas||[]).map(q=>[q.campaign+"__"+q.teamId,q]));
 const choices=data.standalone?.choices||[];
 const selectionLabels=useMemo(()=>selectionLabelsByCustomer(choices),[choices]);
 const selectedKey=groups.some(g=>g.key===active)?active:groups[0]?.key;
 const current=groups.find(g=>g.key===selectedKey);
 const myChoices=choices.filter(c=>c.campaign===current?.id&&c.teamId===current?.teamId);
 const selectedCodes=new Set(myChoices.map(c=>c.code));
 const roster=new Set(data.rosters.find(r=>r.teamId===current?.teamId)?.rows.map(c=>c.code)||[]);
 const participants=data.customers.filter(c=>
  current&&eligibleDoctor(current.id,{...c,visitingTeams:c.visitingTeams||[current.teamId]},current.teamId)&&roster.has(c.code));
 const listed=participants.filter(c=>(!onlySelected||selectedCodes.has(c.code))&&
  (!search.trim()||[c.code,c.name,c.specialty,c.area].join(" ").toLocaleLowerCase().includes(search.toLocaleLowerCase().trim())))
  .sort((a,b)=>Number(selectedCodes.has(b.code))-Number(selectedCodes.has(a.code))||a.name.localeCompare(b.name,"ar"));
 const quota=enabled.get(current?.key),count=quota?.count||0;
 const matched=useMemo(()=>matchStandAlone(choices,groups),[choices,groups]);
 return <div className="standalone-page">
  <div className="section-heading">
   <div><h2>{mode==="pedia"?"Pedia Activity":"Stand Alone"}</h2><p>مسارات اختيار مستقلة للأطباء، دون تأثير على الأنشطة المالية أو ميزانيات الفرق</p></div>
   {profile.role==="admin"&&<button className="primary" disabled={busy} onClick={onInit}><ShieldCheck size={17}/> تهيئة مسارات الاختيار</button>}
  </div>
  <div className="standalone-campaign-tabs">
   {STANDALONE_CAMPAIGNS.filter(c=>groups.some(g=>g.id===c.id)).map(c=>
    <div className={`standalone-campaign ${c.id===`pedia`?`pedia`:``}`} key={c.id}>
     <div className="standalone-campaign-title"><span className="standalone-campaign-icon"><Target size={17} weight="bold"/></span><b>{c.title}</b></div>
     <small>{c.id===`ent-chest`?`Azord + Matador • 35 لكل فريق`:c.id===`uro`?`URO + Matador • 25 لكل فريق`:`Azord + Clavodar + Mixif • بدون حصة محددة`}</small>
     <div>{groups.filter(g=>g.id===c.id).map(g=>
      <button type="button" key={g.key} aria-pressed={selectedKey===g.key} className={selectedKey===g.key?"active":""} onClick={()=>{setActive(g.key);setSearch("");setOnlySelected(false)}}>
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
   <div className="standalone-toolbar">
    <label className="search"><MagnifyingGlass size={17}/><input placeholder="ابحث بالاسم أو الكود أو التخصص" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <label className="check-line"><input type="checkbox" checked={onlySelected} onChange={e=>setOnlySelected(e.target.checked)}/> المختارون فقط ({selectedCodes.size})</label>
   </div>
   <div className="standalone-list">{listed.map(c=>{
    const chosen=selectedCodes.has(c.code);
    return <div key={c.code} className={`standalone-doctor ${chosen?"selected":""}`}>
     <div className="standalone-doctor-details"><div className="standalone-doctor-name-line"><b>{c.name}</b>{(selectionLabels.get(String(c.code))||[]).map(label=><span key={label} className={`client-selection-label ${label===`Pedia Activity`?`is-pedia`:`is-standalone`}`}>{label}</span>)}</div><small>{c.code} • {c.specialty} • {c.area||"—"}</small></div>
     <button type="button" disabled={busy||!quota||(!chosen&&current.quota>0&&count>=current.quota)} onClick={()=>onChoose({campaign:current.id,teamId:current.teamId,code:c.code,selected:!chosen})} className={chosen?"standalone-remove":"standalone-add"}>
      {chosen?<><Check size={16}/> مختار</>:<><Plus size={16}/> اختيار</>}
     </button>
    </div>;
   })}
   {!listed.length&&<p className="standalone-empty">لا يوجد أطباء مطابقون للبحث أو التخصص المخصص لهذا المسار</p>}
   </div>
  </section>:<p className="standalone-notice">لم يتم العثور على اي فريق مخول لمسارات الاختيار المتاحة</p>}
  {privileged&&<section className="surface standalone-matching">
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
