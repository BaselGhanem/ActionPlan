// Explain cross-team charges without redistributing doctors' honoraria or budgets.
export function sourceTeam(activity,teams){
 const t=teams.find(t=>t.accountId&&t.accountId===activity.creator);
 return t?{id:t.id,name:t.name}:{id:null,name:"الإدارة / غير محدد"};
}
export function teamShare(activity,teamId) {
 return (activity.teamShares||[]).find(s=>s.teamId===teamId)||null;
}
export function teamExpense(activity,teamId){
 const share=teamShare(activity,teamId);
 if(!share)return null;
 const planned=share.amount||0,actual=share.actual??null;
 const charged=activity.status==="planned"?planned:(actual??0);
 return {planned,actual,charged};
}
export function externalTeamExpenses(activities,teamId,teams) {
 return (activities||[]).flatMap(a=>{
  if(!a||a.status==="deleted")return [];
  const share=teamExpense(a,teamId);if(!share)return [];
  const origin=a.creatorTeamId
   ?{id:a.creatorTeamId,name:a.creatorTeamName||a.creatorTeamId}
   :sourceTeam(a,teams);
  if(origin.id===teamId)return [];
  return [{activity:a,origin,teamId,...share}];
 }).sort((a,b)=>{
  const stamp=x=>x?.seconds?x.seconds*1000:x?._seconds?x._seconds*1000:Number(x||0);
  return stamp(b.activity.createdAt)-stamp(a.activity.createdAt);
 });
}
export function externalExpenseTotals(entries) {
 return entries.reduce((t,e)=>({planned:t.planned+e.planned,
  actual:t.actual+(e.actual??0),charged:t.charged+e.charged,
  activities:t.activities+1}),{planned:0,actual:0,charged:0,activities:0});
}
