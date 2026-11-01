import {AZHAR_HEADERS} from "./azhar-report.js";
import {isDoctorClient} from "./activity-presence.js";

// The source Azhar Report counts distinct activities, not individual doctors.
// Master Report expands each activity/team combination into one auditable line.
// Team costs are NEVER allocated to doctors or repeated per participant.
export const MASTER_HEADERS=AZHAR_HEADERS;

export function masterReportRows(filteredRows,teams=[],customers=[]){
 const teamNames=new Map(teams.map(t=>[t.id,t.name]));
 const customerNames=new Map(customers.map(c=>[String(c.code),c]));
 const seen=new Set();
 const result=[];
 for(const row of filteredRows){
  const a=row.activity;
  if(!a||a.status===`cancelled`)continue;
  const teamId=row.team||row.share?.teamId;
  if(!teamId)continue;
  const id=String(a.id);
  const key=JSON.stringify([id,teamId]);
  if(seen.has(key))continue;
  seen.add(key);
  const selected=(a.teamShares||[]).find(s=>s.teamId===teamId);
  const amount=selected?selected.amount:(a.clients||[]).reduce((sum,c)=>sum+(c.shares||[]).filter(s=>s.teamId===teamId).reduce((v,s)=>v+(s.amount||0),0),0);
  const specs=[...new Set((a.clients||[]).map(c=>String(c.specialty||``).trim()).filter(Boolean))];
  const specialty=specs.length>1?`Multiple Specialties`:specs[0]||`Not Specified`;
  const date=String(a.date||``);
  const month=/^2027-(0[1-9]|1[0-2])(?:-\d{2})?$/.exec(date)?.[1];
  const quarter=month?`Q${Math.ceil(Number(month)/3)}`:`Unscheduled`;
  const base=(a.costItems||[]).map(item=>[item.category,item.label].filter(Boolean).join(`: `)).filter(Boolean).join(` + `)||String(a.notes||``).trim();
  const known=new Set();
  const doctors=[];
  const otherCustomers=[];
  for(const client of a.clients||[]){
   const code=String(client.code??``).trim();
   const saved=customerNames.get(code);
   const name=String(client.name||saved?.name||``).trim();
   const identity=code||name;
   if(!identity||known.has(identity))continue;
   known.add(identity);
   const label=name||(code?`Code: ${code}`:``);
   if(!label)continue;
   (isDoctorClient({...saved,...client,name:client.name||saved?.name||``})?doctors:otherCustomers).push(label);
  }
  const suffix=[
   doctors.length?`Doctor: ${doctors.join(`, `)}`:`` ,
   otherCustomers.length?`Customer: ${otherCustomers.join(`, `)}`:`` ,
  ].filter(Boolean).join(` | `);
  const description=[base,suffix].filter(Boolean).join(` | `);
  result.push({
   team:teamNames.get(teamId)||selected?.teamName||teamId,
   activity:String(a.type||``),description,country:`Jordan`,specialty,quarter,
   location:String(a.location||a.venue||a.place||``).trim(),
   number:1,totalCost:Number(amount||0)/100,
   id,
  });
 }
 return result.sort((a,b)=>a.team.localeCompare(b.team,`en`)||a.quarter.localeCompare(b.quarter,`en`)||a.activity.localeCompare(b.activity,`en`)||a.specialty.localeCompare(b.specialty,`en`)||a.id.localeCompare(b.id,`en`));
}

export async function downloadMasterReport(rows){
 const {default:ExcelJS}=await import(`exceljs`);
 const book=new ExcelJS.Workbook();book.creator=`Dar Al Dawa`;
 const sheet=book.addWorksheet(`Master Report`,{views:[{state:`frozen`,ySplit:4}]});
 sheet.mergeCells(`A1:I1`);sheet.getCell(`A1`).value=`MASTER REPORT | ACTION PLAN 2027`;
 sheet.getCell(`A1`).font={name:`Arial`,size:18,bold:true,color:{argb:`FFFFFFFF`}};
 sheet.getCell(`A1`).fill={type:`pattern`,pattern:`solid`,fgColor:{argb:`FF113C65`}};
 sheet.getRow(1).height=38;
 sheet.mergeCells(`A2:I2`);sheet.getCell(`A2`).value=`PLANNED COSTS  •  JORDAN  •  ${rows.length} ACTIVITIES`;
 sheet.getRow(2).height=24;
 sheet.getRow(4).values=MASTER_HEADERS;
 sheet.getRow(4).height=28;
 sheet.getRow(4).eachCell(c=>{c.font={bold:true,color:{argb:`FFFFFFFF`}};c.fill={type:`pattern`,pattern:`solid`,fgColor:{argb:`FF099999`}};});
 for(const [index,r] of rows.entries()){
  const entry=[r.team,r.activity,r.description,r.country,r.specialty,r.quarter,r.location,r.number,r.totalCost];
  const line=sheet.addRow(entry);
  line.height=Math.min(66,Math.max(25,Math.ceil((r.description||``).length/62)*17));
  line.getCell(3).alignment={vertical:`middle`,wrapText:true};
  if(index%2===0)line.eachCell(c=>{c.fill={type:`pattern`,pattern:`solid`,fgColor:{argb:`FFF0F7FA`}};});
 }
 sheet.addRow([`TOTAL`,``,``,``,``,``,``,rows.reduce((n,r)=>n+r.number,0),rows.reduce((n,r)=>n+r.totalCost,0)]);
 const total=sheet.lastRow;total.font={bold:true,color:{argb:`FFFFFFFF`}};
 total.eachCell(c=>{c.fill={type:`pattern`,pattern:`solid`,fgColor:{argb:`FF113C65`}};});
 [23,28,64,16,26,16,28,29,20].forEach((width,i)=>sheet.getColumn(i+1).width=width);
 sheet.getColumn(9).numFmt=`#,##0.00;[Red](#,##0.00)`;
 sheet.getColumn(8).numFmt=`0`;
 sheet.autoFilter={from:{row:4,column:1},to:{row:Math.max(4,rows.length+4),column:9}};
 const blob=new Blob([await book.xlsx.writeBuffer()],{type:`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`});
 const url=URL.createObjectURL(blob);const a=document.createElement(`a`);a.href=url;a.download=`Master_Report_2027.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
