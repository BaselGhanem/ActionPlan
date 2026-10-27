import test from "node:test";
import assert from "node:assert/strict";
import {copyCustomerMembership} from "../src/data/copy-customer.js";
import {CUSTOMER_CLASSIFICATIONS} from "../src/data/customer-classifications.js";
const f={teams:{A:{roster:`a`},B:{roster:`b`},C:{roster:`c`}}};
const c={code:`007`,name:`Doctor`,visitingTeams:[`A`,`C`],visits:{A:{classification:`HH`,roster:`a`},C:{classification:`LL`,roster:`c`}}};
const p={sourceTeamId:`A`,targetTeamId:`B`,classification:`HM`};
test(`copy preserves all source memberships and uses target classification`,()=>{
 const n=copyCustomerMembership(c,f,p);
 assert.deepEqual(n.visitingTeams,[`A`,`C`,`B`]);
 assert.deepEqual(n.visits.A,c.visits.A);assert.deepEqual(n.visits.C,c.visits.C);
 assert.deepEqual(n.visits.B,{classification:`HM`,roster:`b`});
 assert.deepEqual(c.visitingTeams,[`A`,`C`]);
});
test(`duplicate, missing, archived, invalid classification and in-progress imports are blocked`,()=>{
 for(const args of [[c,f,{...p,targetTeamId:`A`}],[c,f,{...p,targetTeamId:`C`}],[c,f,{...p,targetTeamId:`X`}],[c,f,{...p,classification:``},{...p,classification:`A`},{...p,classification:`B`},{...p,classification:`C`}],[{...c,deleted:true},f,p],[c,{...f,pausedTeams:[`A`]},p],[c,{...f,uploads:{B:`upload`}},p]])assert.throws(()=>copyCustomerMembership(...args));
});

test(`copy accepts only the nine approved classifications for the target team`,()=>{
 for(const classification of CUSTOMER_CLASSIFICATIONS){
  const result=copyCustomerMembership(c,f,{...p,classification});
  assert.equal(result.visits.B.classification,classification);
 }
});
