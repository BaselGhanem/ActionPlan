import test from "node:test";
import assert from "node:assert/strict";
import {externalTeamExpenses,externalExpenseTotals,sourceTeam} from "../src/data/external-expenses.js";
import {rosterCacheKey,readRosterCache,writeRosterCache} from "../src/data/customer-cache.js";
const teams=[
 {id:"X",name:"X",accountId:"account-x"},
 {id:"Y",name:"Y",accountId:"account-y"},
 {id:"Z",name:"Z",accountId:"account-z"},
];
test("another team entering an activity on X is visible with source and only X's booked amount",()=>{
 const activities=[
  {id:"shared",creator:"account-y",createdAt:3,status:"planned",total:150000,actual:null,
    teamShares:[{teamId:"X",amount:40000,actual:null},{teamId:"Y",amount:110000,actual:null}]},
  {id:"executed",creator:"account-z",createdAt:2,status:"executed",total:200000,actual:180000,
    teamShares:[{teamId:"X",amount:90000,actual:80000},{teamId:"Z",amount:110000,actual:100000}]},
  {id:"own",creator:"account-x",createdAt:1,status:"planned",total:50000,actual:null,
    teamShares:[{teamId:"X",amount:50000,actual:null}]},
  {id:"no-X",creator:"account-y",createdAt:0,status:"planned",total:60000,actual:null,
    teamShares:[{teamId:"Y",amount:60000,actual:null}]},
 ];
 const incoming=externalTeamExpenses(activities,"X",teams);
 assert.deepEqual(incoming.map(x=>x.origin.name),["Y","Z"]);
 assert.deepEqual(incoming.map(x=>x.planned),[40000,90000]);
 const totals=externalExpenseTotals(incoming);
 assert.deepEqual(totals,{planned:130000,actual:80000,charged:120000,activities:2});
 assert.equal(sourceTeam(activities[0],teams).id,"Y");
});
test("scoped incoming entries use explicit original author and recipient share, not invented doctor estimates",()=>{
 const only={id:"incoming",creatorTeamId:"Y",creatorTeamName:"Y",total:20000,
 status:"planned",teamShares:[{teamId:"X",amount:10000,actual:null}],clients:[{code:"22493 - 37594"}]};
 const row=externalTeamExpenses([only],"X",[{id:"X",name:"X"}])[0];
 assert.equal(row.origin.name,"Y");
 assert.equal(row.planned,10000);
 assert.equal(row.activity.total,20000);
});
test("customer local cache is keyed by identity visibility and roster epoch and safely disabled without IndexedDB",async()=>{
 const base={project:"test",uid:"first",teamId:"X",restricted:true,epoch:10};
 assert.notEqual(rosterCacheKey(base),rosterCacheKey({...base,uid:"second"}));
 assert.notEqual(rosterCacheKey(base),rosterCacheKey({...base,restricted:false}));
 assert.notEqual(rosterCacheKey(base),rosterCacheKey({...base,epoch:11}));
 assert.equal(await readRosterCache(rosterCacheKey(base)),null);
 await writeRosterCache(rosterCacheKey(base),[{code:"C0"}]);
});
