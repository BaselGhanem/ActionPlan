import test from "node:test";
import assert from "node:assert/strict";
import {AZHAR_HEADERS,azharReportRows} from "../src/data/azhar-report.js";
const teams=[{id:"a",name:"Azord"},{id:"m",name:"Matador"}];
const shared={id:"X",schema:3,type:"Meeting",date:"2027-04-18",status:"planned",location:"Amman",costItems:[{category:"honorarium",label:"Speaker"},{category:"hospitality",label:"Lunch"}],clients:[{code:"1",specialty:"ENT"},{code:"2",specialty:"Gastroenterology"}],teamShares:[{teamId:"a",amount:60000},{teamId:"m",amount:40000}]};
const row=(activity,team,share)=>({activity,team,share});
test("nine columns use exact supplied template order",()=>assert.deepEqual(AZHAR_HEADERS,["Team","Activity","Description","Country","Specialty","Date","Location","Number (Units / Customers)","Total Cost"]));
test("shared activity counts once per team and does not duplicate planned costs",()=>{
 const rows=azharReportRows([row(shared,"a",shared.teamShares[0]),row(shared,"a",shared.teamShares[0]),row(shared,"m",shared.teamShares[1])],teams);
 assert.equal(rows.length,2);assert.equal(rows.reduce((v,r)=>v+r.totalCost,0),1000);
 assert.equal(rows.reduce((v,r)=>v+r.number,0),2);
 assert.ok(rows.every(r=>r.specialty==="Multiple Specialties"&&r.quarter==="Q2"&&r.location==="Amman"&&r.country==="Jordan"));
 assert.ok(rows[0].description.includes("Speaker")&&rows[0].description.includes("Lunch"));
});
test("same group aggregates distinct activities but never actual amounts; cancelled excluded",()=>{
 const a={...shared,id:"Y",clients:[{specialty:"ENT"}],date:"2027-01-10",teamShares:[{teamId:"a",amount:25000,actual:999999}],actual:999999};
 const b={...a,id:"Z",teamShares:[{teamId:"a",amount:30000,actual:900000}]};
 const rows=azharReportRows([row(a,"a",a.teamShares[0]),row(b,"a",b.teamShares[0]),row({...a,id:"C",status:"cancelled"},"a",a.teamShares[0])],teams);
 assert.equal(rows.length,1);assert.equal(rows[0].number,2);assert.equal(rows[0].totalCost,550);assert.equal(rows[0].quarter,"Q1");
});
test("legacy customer shares are summed once for the selected team",()=>{
 const a={id:"legacy",type:"Visit",status:"executed",date:"2027-10-01",clients:[{specialty:"ENT",shares:[{teamId:"a",amount:10000}]},{specialty:"ENT",shares:[{teamId:"a",amount:5000}]}]};
 const rows=azharReportRows([row(a,"a",{amount:10000}),row(a,"a",{amount:5000})],teams);
 assert.equal(rows.length,1);assert.equal(rows[0].totalCost,150);assert.equal(rows[0].number,1);assert.equal(rows[0].quarter,"Q4");
});
test("filters are applied before aggregation and missing location remains blank",()=>{
 const a={...shared,location:"",date:"",teamShares:[{teamId:"a",amount:100}]};
 const rows=azharReportRows([row(a,"a",a.teamShares[0])],teams);
 assert.equal(rows.length,1);assert.equal(rows[0].location,"");assert.equal(rows[0].quarter,"Unscheduled");
});
