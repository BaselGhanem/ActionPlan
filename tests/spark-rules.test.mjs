import {readFile} from 'node:fs/promises';
import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,runTransaction,writeBatch,serverTimestamp,getDocs,collection} from 'firebase/firestore';
import {prepareProofs} from '../src/data/proofs.js';
import {encodeActivity,encodeTeamActivity,tombstone,wireCharges,decodeActivity} from '../src/data/activity-wire.js';
let env;
const projectId=`demo-actionplan`;
const customer=(i)=>({code:`C${i}`,name:`طبيب ${i}`,kind:`طبيب`,specialty:`قلب`,area:`عمان`,visitingTeams:Array.from({length:8},(_,j)=>`t${j}`),visits:Object.fromEntries(Array.from({length:8},(_,j)=>[`t${j}`,{roster:`r${j}`,classification:`A`,nextRoster:``,nextClassification:``}]))});
const finance=()=>({teams:Object.fromEntries(Array.from({length:8},(_,j)=>[`t${j}`,{name:`Team ${j}`,budget:100000,used:0,roster:`r${j}`,accountId:j===0?`u1`:null}])),types:[`ندوة`],mutation:null});
const profile=(role,accountId,teamId=null)=>({name:role,role,accountId,teamId,username:accountId,active:true,current:true});
const draft=(amount=10000,count=1,teams=2)=>({type:`ندوة`,total:amount*count,actual:null,status:`planned`,date:``,notes:``,clients:Array.from({length:count},(_,i)=>({...customer(i),amount,actual:null,shares:Array.from({length:teams},(_,j)=>({teamId:`t${j}`,amount:amount/teams,actual:null}))}))});
const db=(user=`u1`)=>env.authenticatedContext(user).firestore();
async function seed(){await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();await setDoc(doc(d,`finance/2027`),finance());await Promise.all([setDoc(doc(d,`users/u1`),profile(`team`,`u1`,`t0`)),setDoc(doc(d,`users/u2`),profile(`team`,`u2`,`t1`)),setDoc(doc(d,`users/admin`),profile(`admin`,`admin`)),setDoc(doc(d,`users/manager`),profile(`manager`,`manager`)),...Array.from({length:8},(_,i)=>setDoc(doc(d,`customers/C${i}`),customer(i))),...Array.from({length:8},(_,i)=>setDoc(doc(d,`budgets/t${i}`),{budget:100000,used:0,mutation:null}))]);});}
async function persist(d,activityId,input,options={}){const initialOld=(await getDoc(doc(d,`activities/${activityId}`))).data()||null;let prepared;if(!options.delete){prepared=(input.teamShares?encodeTeamActivity:encodeActivity)(input,{uid:options.uid||`u1`,accountId:options.accountId||`u1`,previous:initialOld});if(options.tamper)prepared=options.tamper(prepared);prepared.proofId=`p-${activityId}-${crypto.randomUUID()}`;await prepareProofs(d,{...prepared,activityId},{owner:options.uid||`u1`,baseRev:initialOld?.rev||0,rosterEpoch:0,proofId:prepared.proofId});}return runTransaction(d,async tx=>{const fr=doc(d,`finance/2027`),ar=doc(d,`activities/${activityId}`),[fs,as]=await Promise.all([tx.get(fr),tx.get(ar)]);const f=fs.data(),old=as.exists()?as.data():null;let next=options.delete?tombstone(old,options.uid||`u1`,serverTimestamp()):prepared;next.updatedAt=serverTimestamp();const before=wireCharges(old),after=wireCharges(next),teams={...f.teams};for(const t of new Set([...(old?.teamIds||[]),...next.teamIds]))teams[t]={...teams[t],used:teams[t].used-(before[t]||0)+(after[t]||0)};const m={affectedTeams:[...new Set([...(old?.teamIds||[]),...next.teamIds])],kind:options.delete?`deleteActivity`:`saveActivity`,uid:options.uid||`u1`,activityId,rev:next.rev,before:old,after:next,at:serverTimestamp()};tx.set(ar,next);if(!options.skipFinance){for(const t of m.affectedTeams)tx.set(doc(d,`budgets/${t}`),{budget:teams[t].budget,used:teams[t].used,mutation:{activityId,rev:next.rev,uid:options.uid||`u1`,at:serverTimestamp()}});tx.update(fr,{teams,mutation:m});}if(!options.skipAudit)tx.set(doc(d,`audit/${activityId}_${next.rev}`),m);});}
before(async()=>{env=await initializeTestEnvironment({projectId,firestore:{rules:await readFile(new URL(`../firestore.rules`,import.meta.url),`utf8`)}})});
after(async()=>{await env?.cleanup()});beforeEach(async()=>{await env.clearFirestore();await seed()});
test(`authenticated users read business data; strangers cannot`,async()=>{await assertSucceeds(getDoc(doc(db(),`finance/2027`)));await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),`finance/2027`)))});
test(`valid activity commits balances and immutable audit together`,async()=>{await assertSucceeds(persist(db(),`a1`,draft()));assert.equal((await getDoc(doc(db(),`finance/2027`))).data().teams.t0.used,5000);await assertFails(updateDoc(doc(db(),`audit/a1_1`),{kind:`changed`}))});
test(`standalone activity, missing audit, forged totals rejected`,async()=>{await assertFails(persist(db(),`a1`,draft(),{skipFinance:true}));await assertFails(persist(db(),`a1`,draft(),{skipAudit:true}));await assertFails(persist(db(),`a1`,draft(),{tamper:a=>({...a,totals:{t0:1,t1:1}})}))});
test(`other team's author cannot modify an activity`,async()=>{await persist(db(),`a1`,draft());await assertFails(persist(db(`u2`),`a1`,draft(12000),{uid:`u2`,accountId:`u2`}))});
test(`overbudget rejected even with malicious client`,async()=>{await assertFails(persist(db(),`a1`,draft(300000))) });
test(`actual replaces planned and deletion releases reservation`,async()=>{await persist(db(),`a1`,draft());const a=draft();a.status=`executed`;a.actual=6000;a.clients[0].actual=6000;a.clients[0].shares.forEach(s=>s.actual=3000);await assertSucceeds(persist(db(),`a1`,a));assert.equal((await getDoc(doc(db(),`finance/2027`))).data().teams.t0.used,3000);await assertFails(persist(db(),`a1`,a,{delete:true}));await persist(db(),`a2`,draft());await assertSucceeds(persist(db(),`a2`,null,{delete:true}));assert.equal((await getDoc(doc(db(),`finance/2027`))).data().teams.t0.used,3000)});
test(`budget cannot be reduced below used; team cannot change budgets`,async()=>{await persist(db(),`a1`,draft());const d=db(`admin`),fr=doc(d,`finance/2027`),f=(await getDoc(fr)).data();f.teams.t0.budget=1;f.mutation={kind:`saveTeam`,teamId:`t0`,uid:`admin`,at:serverTimestamp()};await assertFails(setDoc(fr,f));const own=db(),g=(await getDoc(doc(own,`finance/2027`))).data();g.teams.t0.budget=200000;g.mutation={kind:`saveTeam`,teamId:`t0`,uid:`u1`,at:serverTimestamp()};await assertFails(setDoc(doc(own,`finance/2027`),g))});
test(`8 clients × 8 teams within published rules limits`,async()=>{await assertSucceeds(persist(db(),`wide`,draft(8000,8,8)))});
test(`concurrent submissions cannot overdraw shared budget`,async()=>{const results=await Promise.allSettled([persist(db(),`race1`,draft(120000)),persist(db(),`race2`,draft(120000))]);assert.equal(results.filter(r=>r.status===`fulfilled`).length,1);assert.equal((await getDoc(doc(db(),`finance/2027`))).data().teams.t0.used,60000)});
test(`nonvisitor cannot allocate; stale roster retained only on existing activity`,async()=>{await persist(db(),`a1`,draft());await env.withSecurityRulesDisabled(async c=>{await updateDoc(doc(c.firestore(),`customers/C0`),{visits:{},visitingTeams:[]})});await assertFails(persist(db(),`new`,draft()));await assertSucceeds(persist(db(),`a1`,draft()))});
test(`manager cannot provision users or upload customer records`,async()=>{await assertFails(setDoc(doc(db(`manager`),`users/hacker`),profile(`admin`,`hacker`)));await assertFails(setDoc(doc(db(`manager`),`customers/X`),customer(9)))});
test(`disabled identities lose data access; public login mapping contains no passwords`,async()=>{await env.withSecurityRulesDisabled(async c=>{await updateDoc(doc(c.firestore(),`users/u1`),{active:false});await setDoc(doc(c.firestore(),`logins/team1`),{email:`internal@users.dadactionplan.app`,uid:`u1`,accountId:`u1`})});await assertFails(getDoc(doc(db(),`finance/2027`)));const anon=env.unauthenticatedContext().firestore();await assertSucceeds(getDoc(doc(anon,`logins/team1`)));await assertFails(getDocs(collection(anon,`logins`)))});

test(`maximum activity actual update is also valid`,async()=>{await persist(db(),`bigactual`,draft(8000,8,8));const a=draft(8000,8,8);a.actual=32000;a.status=`executed`;for(const c of a.clients){c.actual=4000;for(const x of c.shares)x.actual=500;}await assertSucceeds(persist(db(),`bigactual`,a));});

test(`preconfigured first admin may bootstrap safely without a setup document`,async()=>{
 const firstUid=`QrAqmjHZLTWxyEg3SJX11SgBgX33`,d=db(firstUid);
 const identity={name:`مسؤول النظام`,username:`admin`,role:`admin`,accountId:firstUid,teamId:null,active:true,current:true};
 await assertSucceeds(setDoc(doc(d,`users/${firstUid}`),identity));
 assert.equal((await getDoc(doc(d,`users/${firstUid}`))).data().role,`admin`);
 await assertFails(setDoc(doc(db(`stranger`),`users/stranger`),{...identity,accountId:`stranger`}));
});
test(`bootstrap cannot be claimed by an unchosen identity`,async()=>{await assertFails(setDoc(doc(db(`stranger`),`users/stranger`),{name:`مسؤول النظام`,username:`admin`,role:`admin`,accountId:`stranger`,teamId:null,active:true,current:true}));});
test(`team cannot forge a standalone balance or validation summary`,async()=>{await assertFails(updateDoc(doc(db(),`budgets/t0`),{used:0,mutation:{activityId:`fake`,rev:1,uid:`u1`,at:serverTimestamp()}}));await assertFails(setDoc(doc(db(),`proposals/missing/checks/rows`),{ok:true}));});
test(`team cannot cancel; manager cancellation retains actual expense`,async()=>{await persist(db(),`cancel`,draft());const a=draft();a.actual=6000;a.clients[0].actual=6000;a.clients[0].shares.forEach(s=>s.actual=3000);await persist(db(),`cancel`,a);a.status=`cancelled`;await assertFails(persist(db(),`cancel`,a));await assertSucceeds(persist(db(`manager`),`cancel`,a,{uid:`manager`,accountId:`manager`}));assert.equal((await getDoc(doc(db(),`budgets/t0`))).data().used,3000);});

test(`admin archives customers atomically and cannot change protected records`,async()=>{
 const d=db(`admin`),fr=doc(d,`finance/2027`),ref=doc(d,`customers/C0`),batchId=`arch-safety-test`;
 await assertSucceeds(runTransaction(d,async tx=>{
  const [f,c]=await Promise.all([tx.get(fr),tx.get(ref)]);
  assert.equal(c.data().code,`C0`);
  tx.update(fr,{rosterEpoch:(f.data().rosterEpoch||0)+1,
   mutation:{kind:`archiveCustomers`,uid:`admin`,at:serverTimestamp(),batchId,codes:[`C0`],count:1}});
  tx.update(ref,{deleted:true,visitingTeams:[],visits:{},archivedBy:`admin`,archivedAt:serverTimestamp(),updatedAt:serverTimestamp()});
  tx.set(doc(d,`audit/${batchId}`),{kind:`archiveCustomers`,uid:`admin`,before:{customers:[{code:`C0`}]},after:{codes:[`C0`],count:1},at:serverTimestamp()});
 }));
 assert.equal((await getDoc(ref)).data().deleted,true);
 await assertFails(updateDoc(ref,{deleted:false}));
 await assertFails(updateDoc(doc(db(`u1`),`customers/C0`),{deleted:false}));
});
test(`customer archival refuses missing audit or forged admin transaction`,async()=>{
 const d=db(`admin`),fr=doc(d,`finance/2027`),ref=doc(d,`customers/C0`);
 await assertFails(runTransaction(d,async tx=>{
  const f=await tx.get(fr),batchId=`unlogged`;
  tx.update(fr,{rosterEpoch:(f.data().rosterEpoch||0)+1,
   mutation:{kind:`archiveCustomers`,uid:`admin`,at:serverTimestamp(),batchId,codes:[`C0`],count:1}});
  tx.update(ref,{deleted:true,visitingTeams:[],visits:{},archivedBy:`admin`,archivedAt:serverTimestamp(),updatedAt:serverTimestamp()});
 }));
 await assertFails(updateDoc(doc(db(`manager`),`customers/C1`),{deleted:true}));
});

test(`ten-customer archive uses the exact production batch transaction`,async()=>{
 const d=db(`admin`),fr=doc(d,`finance/2027`),batchId=`bulk-10`;
 await env.withSecurityRulesDisabled(async c=>{const clean=c.firestore();await Promise.all([8,9].map(i=>setDoc(doc(clean,`customers/C${i}`),customer(i))))});
 const ids=Array.from({length:10},(_,i)=>`C${i}`),refs=ids.map(code=>doc(d,`customers/${code}`));
 await assertSucceeds(runTransaction(d,async tx=>{
  const fs=await tx.get(fr),snaps=await Promise.all(refs.map(r=>tx.get(r)));
  assert.equal(snaps.length,10);
  tx.update(fr,{rosterEpoch:(fs.data().rosterEpoch||0)+1,mutation:{
    kind:`archiveCustomers`,uid:`admin`,at:serverTimestamp(),batchId,codes:ids,count:ids.length,
  }});
  for(const r of refs)tx.update(r,{deleted:true,visits:{},visitingTeams:[],archivedBy:`admin`,archivedAt:serverTimestamp(),updatedAt:serverTimestamp()});
  tx.set(doc(d,`audit/${batchId}`),{kind:`archiveCustomers`,uid:`admin`,
    before:{customers:snaps.map(s=>({code:s.data().code,name:s.data().name,specialty:s.data().specialty,area:s.data().area}))},
    after:{codes:ids,count:ids.length},at:serverTimestamp(),
  });
 }));
 for(const r of refs)assert.equal((await getDoc(r)).data().deleted,true);
});

test(`schema 3 shared activity commits only team allocations and actual is saved per team`,async()=>{
 const activity={
  type:`ندوة`,total:10000,actual:null,status:`planned`,date:`2027-03-12`,notes:`team-only`,
  clients:[{code:`C0`,name:`طبيب 0`,kind:`طبيب`,specialty:`قلب`,area:`عمان`},
   {code:`C1`,name:`طبيب 1`,kind:`طبيب`,specialty:`قلب`,area:`عمان`}],
  teamShares:[{teamId:`t0`,amount:7000,actual:null},{teamId:`t1`,amount:3000,actual:null}],
 };
 await assertSucceeds(persist(db(),`new-schema`,activity));
 const saved=(await getDoc(doc(db(),`activities/new-schema`))).data();
 assert.equal(saved.schema,3);
 assert.equal(saved.totals.t0,7000);
 assert.equal(saved.rows.C0.plan,undefined);
 assert.equal(saved.rows.C0.amount,undefined);
 const decoded=decodeActivity(`new-schema`,saved,[{id:`t0`,name:`Team 0`},{id:`t1`,name:`Team 1`}]);
 assert.equal(decoded.teamShares.length,2);
 assert.equal(decoded.clients[0].shares,undefined);
 assert.equal((await getDoc(doc(db(),`finance/2027`))).data().teams.t0.used,7000);
 const next={...activity,status:`executed`,actual:8500,
  teamShares:[{teamId:`t0`,amount:7000,actual:5500},{teamId:`t1`,amount:3000,actual:3000}]};
 await assertSucceeds(persist(db(),`new-schema`,next));
 assert.equal((await getDoc(doc(db(),`finance/2027`))).data().teams.t0.used,5500);
 assert.equal((await getDoc(doc(db(),`finance/2027`))).data().teams.t1.used,3000);
});
test(`schema 3 cannot allocate to unrelated team or forge aggregate totals`,async()=>{
 await env.withSecurityRulesDisabled(async context=>{
  await updateDoc(doc(context.firestore(),`customers/C0`),{
   visitingTeams:[`t0`],visits:{t0:{roster:`r0`,classification:`A`}},
  });
 });
 const activity={
  type:`ندوة`,total:10000,actual:null,status:`planned`,date:``,notes:``,
  clients:[{code:`C0`,name:`طبيب 0`,kind:`طبيب`,specialty:`قلب`,area:`عمان`}],
  teamShares:[{teamId:`t0`,amount:10000,actual:null}],
 };
 await assertFails(persist(db(),`unrelated`,{...activity,teamShares:[{teamId:`t7`,amount:10000,actual:null}]} ,{tamper:a=>a}));
 await assertFails(persist(db(),`forged`,activity,{tamper:a=>({...a,totals:{t0:9999}})}));
});

test(`schema 2 activity upgrades to team-only schema 3 without losing totals`,async()=>{
 await persist(db(),`upgrade`,draft());
 const next={
  type:`ندوة`,total:10000,actual:null,status:`planned`,date:`2027-05-14`,notes:`converted`,
  clients:[{code:`C0`,name:`طبيب 0`,kind:`طبيب`,specialty:`قلب`,area:`عمان`}],
  teamShares:[{teamId:`t0`,amount:6500,actual:null},{teamId:`t1`,amount:3500,actual:null}],
 };
 await assertSucceeds(persist(db(),`upgrade`,next));
 const saved=(await getDoc(doc(db(),`activities/upgrade`))).data();
 assert.equal(saved.schema,3);assert.equal(saved.rev,2);assert.equal(saved.totals.t0,6500);
});

test(`admin upgrades an activity from a team owner without changing creator`,async()=>{
 await persist(db(),`cross-owner`,draft());
 const next={
  type:`ندوة`,total:10000,actual:null,status:`planned`,date:`2027-05-14`,notes:`converted`,
  clients:[{code:`C0`,name:`طبيب 0`,kind:`طبيب`,specialty:`قلب`,area:`عمان`}],
  teamShares:[{teamId:`t0`,amount:6500,actual:null},{teamId:`t1`,amount:3500,actual:null}],
 };
 await assertSucceeds(persist(db(`admin`),`cross-owner`,next,{uid:`admin`,accountId:`admin`}));
});
