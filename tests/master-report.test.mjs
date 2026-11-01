import test from "node:test";
import assert from "node:assert/strict";
import {AZHAR_HEADERS,azharReportRows} from "../src/data/azhar-report.js";
import {MASTER_HEADERS,masterReportRows} from "../src/data/master-report.js";

const teams=[{id:`a`,name:`Azord`},{id:`m`,name:`Matador`}];
const customers=[{code:`101`,name:`Dr. Ahmad`,kind:`doctor`,specialty:`GP`},{code:`102`,name:`Dr. Sara`,kind:`doctor`,specialty:`GP`}];
const activity=(id,amount,client)=>({id,type:`Group Meeting`,status:`planned`,schema:3,date:`2027-02-18`,
 location:`Amman`,costItems:[{category:`client`,label:`Honorarium`},{category:`meal`,label:`Lunch`}],
 clients:[client],teamShares:[{teamId:`a`,amount}]});
const r=(a,team=`a`)=>({activity:a,team,share:a.teamShares?.find(s=>s.teamId===team)});

test(`uses original Azhar headers without modifying Azhar behavior`,()=>{
 assert.deepEqual(MASTER_HEADERS,AZHAR_HEADERS);
 const a=activity(`1`,50000,customers[0]),b=activity(`2`,47000,customers[1]);
 const input=[r(a),r(b)];
 const grouped=azharReportRows(input,teams);
 const detail=masterReportRows(input,teams,customers);
 assert.equal(grouped.length,1);
 assert.equal(grouped[0].number,2);
 assert.equal(grouped[0].totalCost,970);
 assert.equal(detail.length,2);
 assert.deepEqual(detail.map(x=>x.number),[1,1]);
 assert.deepEqual(detail.map(x=>x.totalCost),[500,470]);
 assert.ok(detail.some(x=>x.description===`client: Honorarium + meal: Lunch | Doctor: Dr. Ahmad`));
 assert.ok(detail.some(x=>x.description.endsWith(`Doctor: Dr. Sara`)));
 assert.equal(detail.reduce((sum,x)=>sum+x.totalCost,0),grouped[0].totalCost);
});

test(`one shared activity with multiple doctors stays one row per team without repeating money`,()=>{
 const a={...activity(`shared`,97000,customers[0]),clients:customers,teamShares:[{teamId:`a`,amount:60000},{teamId:`m`,amount:37000}]};
 const detail=masterReportRows([r(a,`a`),r(a,`a`),r(a,`m`)],teams,customers);
 assert.equal(detail.length,2);
 assert.ok(detail.every(x=>x.description.includes(`Dr. Ahmad`)&&x.description.includes(`Dr. Sara`)));
 assert.ok(detail.every(x=>x.number===1));
 assert.equal(detail.reduce((sum,x)=>sum+x.totalCost,0),970);
});

test(`legacy shares are summed once per team and names resolve from directory`,()=>{
 const a={id:`legacy`,type:`Visit`,date:`2027-10-01`,status:`planned`,
  clients:[{code:`101`,specialty:`GP`,shares:[{teamId:`a`,amount:4000}]},{code:`102`,specialty:`GP`,shares:[{teamId:`a`,amount:6000}]}]};
 const detail=masterReportRows([{activity:a,team:`a`},{activity:a,team:`a`}],teams,customers);
 assert.equal(detail.length,1);
 assert.equal(detail[0].totalCost,100);
 assert.equal(detail[0].number,1);
 assert.equal(detail[0].quarter,`Q4`);
 assert.ok(detail[0].description.includes(`Dr. Ahmad`));
 assert.ok(detail[0].description.includes(`Dr. Sara`));
});

test(`cancelled activities excluded and missing customer names use their real code`,()=>{
 const a=activity(`x`,12500,{code:`999`,kind:`doctor`,specialty:`GP`});
 const detail=masterReportRows([r(a),r({...a,id:`cancel`,status:`cancelled`})],teams,customers);
 assert.equal(detail.length,1);
 assert.equal(detail[0].totalCost,125);
 assert.ok(detail[0].description.includes(`Doctor: Code: 999`));
});

test(`filtered input is respected before expansion`,()=>{
 const a=activity(`1`,20000,customers[0]),b=activity(`2`,30000,customers[1]);
 assert.deepEqual(masterReportRows([r(a)],teams,customers).map(x=>x.totalCost),[200]);
 assert.equal(masterReportRows([r(a),r(b)],teams,customers).length,2);
});
