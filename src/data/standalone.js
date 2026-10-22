
export const STANDALONE_CAMPAIGNS=Object.freeze([
 {id:"ent-chest",title:"ENT + Chest",specialties:["ENT","Chest"],quota:35,teams:["azord","matador"]},
 {id:"uro",title:"URO",specialties:["URO"],quota:25,teams:["uro","matador"]},
]);
export const normalizeTeamName=s=>String(s||"").trim().toLocaleLowerCase();
export const teamForCampaign=(campaign,team)=>Boolean(
 campaign?.teams.includes(normalizeTeamName(team?.name))
);
export const specialtyMatches=(campaign,specialty)=>{
 const s=String(specialty||"").trim().toLocaleLowerCase();
 if(!s)return false;
 if(campaign==="ent-chest")return /\bent\b|chest|pulmon|thoracic|otorhin|ear.{0,8}nose|respiratory|اذن|أذن|انف|أنف|صدر/.test(s);
 if(campaign==="uro")return /\buro\b|urolog|مسالك|بولي|بولية/.test(s);
 return false;
};
export const isDoctor=(c)=>["doctor","physician","طبيب","طبيبة","دكتور","دكتورة"].includes(String(c?.kind||"").trim().toLocaleLowerCase());
export const eligibleDoctor=(campaign,c,teamId)=>Boolean(isDoctor(c)&&specialtyMatches(campaign,c.specialty)&&c.visitingTeams?.includes(teamId));
export function visibleStandaloneGroups(teams,profile){
 const privileged=["admin","manager"].includes(profile?.role);
 return STANDALONE_CAMPAIGNS.flatMap(c=>teams
  .filter(t=>teamForCampaign(c,t)&&(privileged||t.id===profile?.teamId))
  .map(t=>({...c,teamId:t.id,teamName:t.name,key:c.id+"__"+t.id})));
}
export function matchStandAlone(choices,groups){
 return STANDALONE_CAMPAIGNS.map(c=>{
  const members=groups.filter(g=>g.id===c.id).map(g=>g.teamId);
  const slots=members.map(teamId=>({
   teamId,
   selected:choices.filter(x=>x.campaign===c.id&&x.teamId===teamId).map(x=>x.code),
  }));
  const codeTeams=new Map();
  for(const slot of slots)for(const code of slot.selected){
   const set=codeTeams.get(code)||new Set();set.add(slot.teamId);codeTeams.set(code,set);
  }
  return {id:c.id,title:c.title,quota:c.quota,unique:codeTeams.size,
   byTeam:slots.map(s=>({...s,count:s.selected.length})),
   matches:[...codeTeams].filter(([,ts])=>ts.size>1).map(([code,ts])=>({code,teams:[...ts]}))};
 });
}
