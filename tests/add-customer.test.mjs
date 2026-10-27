import test from `node:test`;
import assert from `node:assert/strict`;
import {prepareManualCustomer} from `../src/data/add-customer.js`;
const finance={teams:{azord:{roster:`r1`}},pausedTeams:[],uploads:{}};
const input={code:` 000123 `,name:` د. سارة `,teamId:`azord`,classification:`B`,kind:`طبيب`,specialty:`باطنية`,area:`عمان`};
test(`manual creation preserves leading zeros and normalizes strings`,()=>{
 const c=prepareManualCustomer(input,finance);
 assert.equal(c.code,`000123`);assert.equal(c.name,`د. سارة`);assert.equal(c.teamId,`azord`);assert.equal(c.classification,`B`);
});
test(`manual creation rejects invalid code, name, team and classification`,()=>{
 for(const bad of [{code:``},{code:`A/B`},{code:`A`.repeat(101)},{name:`  `},{teamId:`other`},{classification:`D`},{area:`X`.repeat(201)}]){
  assert.throws(()=>prepareManualCustomer({...input,...bad},finance));
 }
});
test(`manual creation is blocked during roster imports`,()=>{
 assert.throws(()=>prepareManualCustomer(input,{...finance,uploads:{azord:`current`}}));
 assert.throws(()=>prepareManualCustomer(input,{...finance,pausedTeams:[`azord`]}));
});
