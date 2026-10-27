import test,{before,after,beforeEach} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {initializeTestEnvironment,assertSucceeds,assertFails} from "@firebase/rules-unit-testing";
import {doc,setDoc,updateDoc,getDoc,getDocs,deleteDoc,collection,query,where,runTransaction,serverTimestamp} from "firebase/firestore";
let env;
const db=(id)=>env.authenticatedContext(id).firestore();
const quota=(d,group)=>doc(d,"standaloneQuotas/"+group);
const choice=(d,group,code)=>doc(d,"standaloneChoices/"+group+"__"+code);
const docData=(code,specialty,kind="طبيب")=>({code,name:"طبيب "+code,kind,specialty,area:"عمان",
 visitingTeams:["A","M","U","C","X"],visits:{A:{roster:"rA",classification:"A"},M:{roster:"rM",classification:"B"},U:{roster:"rU",classification:"A"},C:{roster:"rC",classification:"A"},X:{roster:"rX",classification:"A"}}});
const budget=(name,id)=>({name,budget:1000000,used:0,roster:"r"+id,accountId:id});
const profile=(id,role,teamId=null)=>({name:id,username:id,role,accountId:id,teamId,active:true,current:true});
before(async()=>{env=await initializeTestEnvironment({projectId:"demo-standalone-security",
 firestore:{rules:await readFile(new URL("../firestore.rules",import.meta.url),"utf8")}});});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async ctx=>{
  const d=ctx.firestore();
  await Promise.all([
   setDoc(doc(d,"finance/2027"),{teams:{A:budget("Azord","A"),M:budget("Matador","M"),U:budget("URO","U"),C:budget(`Clavodar`,`C`),X:budget(`Mixif`,`X`)},types:["ندوة"],mutation:null}),
   setDoc(doc(d,"users/admin"),profile("admin","admin")),
   setDoc(doc(d,"users/manager"),profile("manager","manager")),
   setDoc(doc(d,"users/a"),profile("a","team","A")),
   setDoc(doc(d,"users/m"),profile("m","team","M")),
   setDoc(doc(d,"users/u"),profile("u","team","U")),
   setDoc(doc(d,`users/c`),profile(`c`,`team`,`C`)),
   setDoc(doc(d,`users/x`),profile(`x`,`team`,`X`)),
   setDoc(doc(d,"customers/C0"),docData("C0","ENT")),
   setDoc(doc(d,"customers/C1"),docData("C1","Chest")),
   setDoc(doc(d,"customers/C2"),docData("C2","Urology")),
   setDoc(doc(d,"customers/C3"),docData("C3","ENT","صيدلية")),
   setDoc(doc(d,`customers/C4`),docData(`C4`,`Pediatrics`)),
   setDoc(doc(d,`customers/C5`),docData(`C5`,`طب الأطفال`)),
  ]);
 });
});
const bootstrap=async()=>{
 const d=db("admin");
 for(const [campaign,t,limit] of [["ent-chest","A",35],["ent-chest","M",35],["uro","M",25],["uro","U",25],[`pedia`,`A`,0],[`pedia`,`C`,0],[`pedia`,`X`,0]])
  await assertSucceeds(setDoc(quota(d,campaign+"__"+t),{campaign,teamId:t,limit,count:0}));
};
async function toggle(identity,campaign,teamId,code,selected=true){
 const d=db(identity),group=campaign+"__"+teamId,ref=quota(d,group),c=choice(d,group,code);
 return runTransaction(d,async tx=>{
  const [current,old]=await Promise.all([tx.get(ref),tx.get(c)]);
  assert.ok(current.exists());
  if(selected===old.exists())return;
  const choiceId=group+"__"+code;
  if(selected)tx.set(c,{campaign,teamId,code,encodedCode:encodeURIComponent(code),actor:identity,at:serverTimestamp()});
  else tx.delete(c);
  tx.update(ref,{count:current.data().count+(selected?1:-1),mutation:{
   kind:selected?"add":"remove",choiceId,actor:identity,at:serverTimestamp()
  }});
 });
}
test("only admin can initialize a quota, no other team can list or fetch another team's choices",async()=>{
 await assertFails(setDoc(quota(db("a"),"ent-chest__A"),{campaign:"ent-chest",teamId:"A",limit:35,count:0}));
 await bootstrap();
 assert.equal((await getDoc(quota(db("a"),"ent-chest__A"))).data().limit,35);
 await assertFails(getDoc(quota(db("a"),"ent-chest__M")));
 await assertFails(getDocs(collection(db("a"),"standaloneQuotas")));
 const own=await assertSucceeds(getDocs(query(collection(db("a"),"standaloneQuotas"),where("teamId","==","A"))));
 assert.equal(own.docs.length,2);
});
test("Azord and Matador can select same ENT doctor without exposing each other's selections",async()=>{
 await bootstrap();
 await assertSucceeds(toggle("a","ent-chest","A","C0"));
 await assertSucceeds(toggle("m","ent-chest","M","C0"));
 assert.equal((await getDoc(quota(db("a"),"ent-chest__A"))).data().count,1);
 assert.equal((await getDoc(quota(db("m"),"ent-chest__M"))).data().count,1);
 const owned=await assertSucceeds(getDocs(query(collection(db("a"),"standaloneChoices"),where("teamId","==","A"))));
 assert.equal(owned.size,1);
 await assertFails(getDoc(choice(db("a"),"ent-chest__M","C0")));
 await assertFails(getDocs(collection(db("a"),"standaloneChoices")));
 const all=await assertSucceeds(getDocs(collection(db("admin"),"standaloneChoices")));
 assert.equal(all.size,2);
 await assertSucceeds(toggle("a","ent-chest","A","C0",false));
 assert.equal((await getDoc(quota(db("a"),"ent-chest__A"))).data().count,0);
});
test("specialty, type, team, quota, direct writes are guarded at Firestore level",async()=>{
 await bootstrap();
 await assertFails(toggle("a","ent-chest","A","C2"));
 await assertFails(toggle("a","ent-chest","A","C3"));
 await assertFails(toggle("a","ent-chest","M","C0"));
 await assertFails(toggle("u","ent-chest","U","C0"));
 await assertSucceeds(toggle("u","uro","U","C2"));
 await assertFails(toggle("u","uro","U","C0"));
 await assertFails(setDoc(choice(db("a"),"ent-chest__A","C0"),{campaign:"ent-chest",teamId:"A",code:"C0",encodedCode:"C0",actor:"a",at:serverTimestamp()}));
 await assertFails(updateDoc(quota(db("a"),"ent-chest__A"),{count:35}));
 await env.withSecurityRulesDisabled(async ctx=>{await updateDoc(quota(ctx.firestore(),"ent-chest__A"),{count:35});});
 await assertFails(toggle("a","ent-chest","A","C0"));
});

test(`Pedia Activity enforces exactly Azord, Clavodar and Mixif, with independent non-financial selections`,async()=>{
 await bootstrap();
 await assertSucceeds(toggle(`a`,`pedia`,`A`,`C4`));
 await assertSucceeds(toggle(`c`,`pedia`,`C`,`C4`));
 await assertSucceeds(toggle(`x`,`pedia`,`X`,`C5`));
 await assert.equal((await getDoc(quota(db(`c`),`pedia__C`))).data().count,1);
 await assert.equal((await getDoc(quota(db(`x`),`pedia__X`))).data().limit,0);
 await assertFails(toggle(`m`,`pedia`,`M`,`C4`));
 await assertFails(toggle(`u`,`pedia`,`U`,`C4`));
 await assertFails(toggle(`a`,`pedia`,`A`,`C0`));
 await assertFails(toggle(`a`,`pedia`,`A`,`C3`));
 await assertFails(getDoc(choice(db(`a`),`pedia__C`,`C4`)));
 const all=await assertSucceeds(getDocs(collection(db(`admin`),`standaloneChoices`)));
 assert.equal(all.size,3);
 await assertSucceeds(toggle(`c`,`pedia`,`C`,`C4`,false));
 assert.equal((await getDoc(quota(db(`c`),`pedia__C`))).data().count,0);
});

test("admin can independently restrict one team; Firestore blocks unrelated customers and activities",async()=>{
 const admin=db("admin"),azord=db("a"),matador=db("m");
 await assertSucceeds(setDoc(doc(admin,"teamVisibility/A"),{showOtherTeams:false,updatedBy:"admin",updatedAt:serverTimestamp()}));
 assert.equal((await getDoc(doc(azord,"teamVisibility/A"))).data().showOtherTeams,false);
 await assertFails(getDoc(doc(matador,"teamVisibility/A")));
 await assertFails(setDoc(doc(azord,"teamVisibility/A"),{showOtherTeams:true,updatedBy:"a",updatedAt:serverTimestamp()}));
 await env.withSecurityRulesDisabled(async ctx=>{
  const d=ctx.firestore();
  await setDoc(doc(d,"customers/F0"),{...docData("F0","ENT"),visitingTeams:["M"],visits:{M:{roster:"rM",classification:"B"}}});
  await setDoc(doc(d,"activities/only-m"),{year:2027,status:"planned",teamIds:["M"]});
  await setDoc(doc(d,"activities/shared-a-m"),{year:2027,status:"planned",teamIds:["A","M"]});
 });
 // The physician C0 belongs to both teams, so Azord can still use that physician.
 await assertSucceeds(getDoc(doc(azord,"customers/C0")));
 await assertFails(getDoc(doc(azord,"customers/F0")));
 await assertFails(getDocs(collection(azord,"customers")));
 const permitted=await assertSucceeds(getDocs(query(collection(azord,"customers"),where("visitingTeams","array-contains","A"))));
 assert.ok(permitted.docs.some(x=>x.id==="C0"));
 await assertFails(getDoc(doc(azord,"activities/only-m")));
 await assertSucceeds(getDoc(doc(azord,"activities/shared-a-m")));
 await assertFails(getDocs(collection(azord,"activities")));
 const myActivities=await assertSucceeds(getDocs(query(collection(azord,"activities"),where("teamIds","array-contains","A"))));
 assert.equal(myActivities.size,1);
 // Matador's configuration is independent, so it can still view the same data.
 await assertSucceeds(getDoc(doc(matador,"customers/C0")));
 await assertSucceeds(getDoc(doc(matador,"activities/shared-a-m")));
 await assertSucceeds(getDoc(doc(matador,"activities/only-m")));
 // Turning Azord's visibility back on preserves all existing records.
 await assertSucceeds(setDoc(doc(admin,"teamVisibility/A"),{showOtherTeams:true,updatedBy:"admin",updatedAt:serverTimestamp()}));
 await assertSucceeds(getDoc(doc(azord,"customers/F0")));
 await assertSucceeds(getDoc(doc(azord,"activities/only-m")));
});

test("admin and marketing manager can read cross-team matching; manager cannot change selections",async()=>{
 await bootstrap();
 await assertSucceeds(toggle("a","ent-chest","A","C0"));
 await assertSucceeds(getDocs(collection(db("manager"),"standaloneChoices")));
 await assertSucceeds(getDocs(collection(db("manager"),"standaloneQuotas")));
 await assertSucceeds(getDoc(choice(db("manager"),"ent-chest__A","C0")));
 await assertFails(toggle("manager","ent-chest","A","C0",false));
 await assertFails(setDoc(quota(db("manager"),"ent-chest__M"),{campaign:"ent-chest",teamId:"M",limit:35,count:0}));
 const visible=await assertSucceeds(getDocs(collection(db("admin"),"standaloneChoices")));
 assert.equal(visible.size,1);
});

test("standalone doctor IDs containing spaces use the real encoded customer Firestore path",async()=>{
 await bootstrap();
 await env.withSecurityRulesDisabled(async ctx=>{
  const code="22493 - 37594";
  const doctor={...docData(code,"ENT"),code};
  await setDoc(doc(ctx.firestore(),"customers/"+encodeURIComponent(code)),doctor);
 });
 const code="22493 - 37594";
 await assertSucceeds(toggle("a","ent-chest","A",code));
 const selected=(await getDoc(choice(db("a"),"ent-chest__A",code))).data();
 assert.equal(selected.code,code);
 assert.equal(selected.encodedCode,encodeURIComponent(code));
 await assertSucceeds(toggle("a","ent-chest","A",code,false));
});

test(`blank specialty doctors can join standalone within same quota, with no access to other specialties or teams`,async()=>{
 await bootstrap();
 await env.withSecurityRulesDisabled(async ctx=>{
  const d=ctx.firestore();
  await setDoc(doc(d,`customers/B0`),{...docData(`B0`,``),visitingTeams:[`A`,`U`]});
  await setDoc(doc(d,`customers/B1`),{...docData(`B1`,`   `),visitingTeams:[`A`]});
  await setDoc(doc(d,`customers/B2`),{...docData(`B2`,null),visitingTeams:[`A`]});
  await setDoc(doc(d,`customers/B3`),{...docData(`B3`,`Cardiology`),visitingTeams:[`A`]});
 });
 await assertSucceeds(toggle(`a`,`ent-chest`,`A`,`B0`));
 await assertSucceeds(toggle(`a`,`ent-chest`,`A`,`B1`));
 await assertSucceeds(toggle(`a`,`ent-chest`,`A`,`B2`));
 await assertSucceeds(toggle(`u`,`uro`,`U`,`B0`));
 await assertFails(toggle(`m`,`ent-chest`,`M`,`B0`));
 await assertFails(toggle(`a`,`ent-chest`,`A`,`B3`));
 await assertFails(toggle(`a`,`pedia`,`A`,`B0`));
 assert.equal((await getDoc(quota(db(`a`),`ent-chest__A`))).data().count,3);
 await assertSucceeds(toggle(`a`,`ent-chest`,`A`,`B0`,false));
 assert.equal((await getDoc(quota(db(`a`),`ent-chest__A`))).data().count,2);
});
