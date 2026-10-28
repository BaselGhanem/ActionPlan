// Azhar Report: one record per team / activity type / specialty / quarter.
// Every activity contributes its full planned share once per participating team.
export const AZHAR_HEADERS=Object.freeze(["Team","Activity","Description","Country","Specialty","Date","Location","Number (Units / Customers)","Total Cost"]);
export function azharReportRows(filteredRows,teams=[]){
 const teamNames=new Map(teams.map(t=>[t.id,t.name]));
 const activityTeam=new Map();
 for(const row of filteredRows){
  const a=row.activity;
  if(!a||a.status==="cancelled")continue;
  const teamId=row.team||row.share?.teamId;
  if(!teamId)continue;
  const key=String(a.id)+"\u001f"+String(teamId);
  if(activityTeam.has(key))continue;
  const namedShares=a.teamShares||[];
  const selected=namedShares.find(s=>s.teamId===teamId);
  const amount=selected?selected.amount:(a.clients||[]).reduce((sum,c)=>sum+(c.shares||[]).filter(s=>s.teamId===teamId).reduce((v,s)=>v+(s.amount||0),0),0);
  const specList=[...new Set((a.clients||[]).map(c=>String(c.specialty||"").trim()).filter(Boolean))];
  const specialty=specList.length>1?"Multiple Specialties":specList[0]||"Not Specified";
  const date=String(a.date||"");
  const month=/^2027-(0[1-9]|1[0-2])(?:-\d{2})?$/.exec(date)?.[1];
  const quarter=month?"Q"+Math.ceil(Number(month)/3):"Unscheduled";
  const description=(a.costItems||[]).map(item=>[item.category,item.label].filter(Boolean).join(": ")).filter(Boolean).join(" + ")||String(a.notes||"").trim();
  const location=String(a.location||a.venue||a.place||"").trim();
  activityTeam.set(key,{id:String(a.id),team:teamNames.get(teamId)||selected?.teamName||teamId,activity:String(a.type||""),specialty,quarter,description,location,cost:Number(amount||0)});
 }
 const groups=new Map();
 for(const r of activityTeam.values()){
  const key=JSON.stringify([r.team,r.activity,r.specialty,r.quarter]);
  const g=groups.get(key)||{...r,ids:new Set(),number:0,cost:0,descriptions:new Set(),locations:new Set()};
  g.ids.add(r.id);g.cost+=r.cost; if(r.description)g.descriptions.add(r.description);if(r.location)g.locations.add(r.location);
  groups.set(key,g);
 }
 return [...groups.values()].map(g=>({
  team:g.team,activity:g.activity,description:[...g.descriptions].join(" | "),
  country:"Jordan",specialty:g.specialty,quarter:g.quarter,
  location:g.locations.size===1?[...g.locations][0]:g.locations.size>1?"Multiple Locations":"",
  number:g.ids.size,totalCost:g.cost/100,
 })).sort((a,b)=>a.team.localeCompare(b.team,"en")||a.quarter.localeCompare(b.quarter,"en")||a.activity.localeCompare(b.activity,"en")||a.specialty.localeCompare(b.specialty,"en"));
}
export async function downloadAzharReport(rows){
 const {default:ExcelJS}=await import("exceljs");
 const book=new ExcelJS.Workbook();book.creator="Dar Al Dawa";
 const sheet=book.addWorksheet("Azhar Report",{views:[{state:"frozen",ySplit:4}]});
 sheet.mergeCells("A1:I1");sheet.getCell("A1").value="AZHAR REPORT | ACTION PLAN 2027";
 sheet.getCell("A1").font={name:"Arial",size:18,bold:true,color:{argb:"FFFFFFFF"}};
 sheet.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF113C65"}};
 sheet.getRow(1).height=38;
 sheet.mergeCells("A2:I2");sheet.getCell("A2").value="PLANNED COSTS  •  JORDAN  •  "+rows.length+" GROUPS";
 sheet.getRow(2).height=24;
 sheet.getRow(4).values=AZHAR_HEADERS;
 sheet.getRow(4).height=28;
 sheet.getRow(4).eachCell(c=>{c.font={bold:true,color:{argb:"FFFFFFFF"}};c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF099999"}};});
 for(const [index,r] of rows.entries()){
  const entry=[r.team,r.activity,r.description,r.country,r.specialty,r.quarter,r.location,r.number,r.totalCost];
  const line=sheet.addRow(entry);line.height=25;
  if(index%2===0)line.eachCell(c=>{c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF0F7FA"}};});
 }
 sheet.addRow(["TOTAL","","","","","","",rows.reduce((n,r)=>n+r.number,0),rows.reduce((n,r)=>n+r.totalCost,0)]);
 const total=sheet.lastRow;total.font={bold:true,color:{argb:"FFFFFFFF"}};
 total.eachCell(c=>{c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF113C65"}};});
 [23,28,48,16,26,16,28,29,20].forEach((width,i)=>sheet.getColumn(i+1).width=width);
 sheet.getColumn(9).numFmt='#,##0.00;[Red](#,##0.00)';
 sheet.getColumn(8).numFmt='0';
 sheet.autoFilter={from:{row:4,column:1},to:{row:Math.max(4,rows.length+4),column:9}};
 const blob=new Blob([await book.xlsx.writeBuffer()],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
 const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="Azhar_Report_2027.xlsx";a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
