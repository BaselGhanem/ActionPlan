import test from "node:test";
import assert from "node:assert/strict";
import {copyCustomerMembership} from "../src/data/copy-customer.js";
const f={teams:{A:{roster:`a`},B:{roster:`b`},C:{roster:`c`}}};
const c={code:`007`,name:`Doctor`,visitingTeams:[`A`,`C`],visits:{A:{classification:`A`,roster:`a`},C:{classification:`C`,roster:`c`}}};
const p={sourceTeamId:`A`,targetTeamId:`B`,classification:`B`};
test(`copy preserves all source memberships and uses target classification`,()=>{
 const n=copyCustomerMembership(c,f,p);
 assert.deepEqual(n.visitingTeams,[`A`,`C`,`B`]);
 assert.deepEqual(n.visits.A,c.visits.A);assert.deepEqual(n.visits.C,c.visits.C);
 assert.deepEqual(n.visits.B,{classification:`B`,roster:`b`});
 assert.deepEqual(c.visitingTeams,[`A`,`C`]);
});
test(`duplicate, missing, archived, invalid classification and in-progress imports are blocked`,()=>{
 for(const args of [[c,f,{...p,targetTeamId:`A`}],[c,f,{...p,targetTeamId:`C`}],[c,f,{...p,targetTeamId:`X`}],[c,f,{...p,classification:``}],[{...c,deleted:true},f,p],[c,{...f,pausedTeams:[`A`]},p],[c,{...f,uploads:{B:`upload`}},p]])assert.throws(()=>copyCustomerMembership(...args));
});
