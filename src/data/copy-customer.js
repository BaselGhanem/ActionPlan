export function copyCustomerMembership(customer,finance,{sourceTeamId,targetTeamId,classification}){
 const reject=message=>{throw new Error(message)};
 if(!sourceTeamId||!targetTeamId||sourceTeamId===targetTeamId)reject(`اختر فريقين مختلفين`);
 if(!finance.teams?.[sourceTeamId]||!finance.teams?.[targetTeamId])reject(`الفريق غير موجود`);
 if((finance.pausedTeams||[]).length||Object.keys(finance.uploads||{}).length)reject(`اكمل رفع قوائم العملاء قبل النسخ`);
 if(!customer||customer.deleted===true||!customer.visitingTeams?.includes(sourceTeamId))reject(`العميل غير موجود في الفريق المصدر`);
 if(customer.visitingTeams.includes(targetTeamId))reject(`العميل موجود بالفعل في الفريق الهدف`);
 if(![`A`,`B`,`C`].includes(classification))reject(`اختر تصنيف العميل للفريق الهدف`);
 return {visitingTeams:[...customer.visitingTeams,targetTeamId],visits:{...(customer.visits||{}),[targetTeamId]:{classification,roster:finance.teams[targetTeamId].roster||null}}};
}
