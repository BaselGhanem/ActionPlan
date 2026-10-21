import {validateActivity,charges,fail} from './domain.js';
export const MAX_CLIENTS=8,MAX_TEAMS=8;
export function encodeActivity(draft,{accountId,uid,previous=null,now=Date.now()}){
 validateActivity(draft);
 const teamIds=[...new Set(draft.clients.flatMap(c=>c.shares.map(s=>s.teamId)))].sort();
 fail(draft.clients.length<=MAX_CLIENTS,`النشاط الواحد يدعم حتى ${MAX_CLIENTS} عملاء؛ قسم المجموعة الأكبر إلى أنشطة مرتبطة بالملاحظات`);
 fail(teamIds.length<=MAX_TEAMS,`النشاط الواحد يدعم حتى ${MAX_TEAMS} فرق مشاركة`);
 const rows={};
 for(const c of draft.clients){const key=encodeURIComponent(c.code);rows[key]={code:c.code,name:c.name,kind:c.kind||``,specialty:c.specialty||``,area:c.area||``,amount:c.amount,actual:draft.actual===null?0:c.actual,plan:Object.fromEntries(c.shares.map(s=>[s.teamId,s.amount])),spent:Object.fromEntries(c.shares.map(s=>[s.teamId,draft.actual===null?0:s.actual]))};}
 const totals=Object.fromEntries(teamIds.map(t=>[t,draft.clients.reduce((n,c)=>n+(c.shares.find(s=>s.teamId===t)?.amount||0),0)]));
 const actualTotals=Object.fromEntries(teamIds.map(t=>[t,draft.actual===null?0:draft.clients.reduce((n,c)=>n+(c.shares.find(s=>s.teamId===t)?.actual||0),0)]));
 return {schema:2,proofId:``,year:2027,creator:previous?.creator||accountId,createdAt:previous?.createdAt||now,updatedAt:now,editedBy:uid,rev:(previous?.rev||0)+1,status:draft.status,type:draft.type,total:draft.total,actual:draft.actual,date:draft.date||``,notes:draft.notes||``,teamIds,clientKeys:Object.keys(rows),rows,totals,actualTotals};
}
export function tombstone(previous,uid,now){return {...previous,rev:previous.rev+1,status:`deleted`,editedBy:uid,updatedAt:now};}
export function wireCharges(a,actualOnly=false){if(!a||a.status===`deleted`)return {};return a.status===`planned`&&!actualOnly?a.totals:(a.actual===null?Object.fromEntries(a.teamIds.map(t=>[t,0])):a.actualTotals);}
export function decodeActivity(id,a,teams=[]){return {...a,id,clients:a.clientKeys.map(k=>{const c=a.rows[k];return {...c,actual:a.actual===null?null:c.actual,shares:Object.entries(c.plan).map(([teamId,amount])=>({teamId,teamName:teams.find(t=>t.id===teamId)?.name||teamId,amount,actual:a.actual===null?null:c.spent[teamId]}))}})};}
export function activeVisit(customer,teamId,teams){if(!customer.visitingTeams?.includes(teamId))return null;return {classification:customer.visits?.[teamId]?.classification||``};}
