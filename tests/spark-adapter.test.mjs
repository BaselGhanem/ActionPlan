import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {readFile} from 'node:fs/promises';
import {doc,setDoc,getDoc} from 'firebase/firestore';
import {createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut} from 'firebase/auth';
process.env.ACTIONPLAN_EMULATORS=`1`;
const {request,resolveLogin,auth,db}=await import('../src/firebase.js');
test(`Spark adapter: bootstrap, provisioning, imports, distribution, reset and ownership`,async()=>{
 const env=await initializeTestEnvironment({projectId:`demo-actionplan`,firestore:{rules:await readFile(new URL(`../firestore.rules`,import.meta.url),`utf8`)}});
 try{
 await env.clearFirestore();
 const email=`admin-${Date.now()}@users.dadactionplan.app`,pass=`LocalTest-Password-42`,admin=(await createUserWithEmailAndPassword(auth,email,pass)).user;
 await assert.rejects(request(`load`),/setup\/bootstrap غير موجود/);
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),`setup/bootstrap`),{adminUid:`different-uid`}));
 await assert.rejects(request(`load`),/different-uid/);
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),`setup/bootstrap`),{adminUid:admin.uid}));
 let data=await request(`load`);assert.equal(data.profile.role,`admin`);assert.equal(data.teams.length,0);
 const t1=(await request(`saveTeam`,{name:`Cardio`,budget:100000})).id,t2=(await request(`saveTeam`,{name:`Primary`,budget:100000})).id;
 await request(`createUser`,{name:`فريق القلب`,username:`team1`,password:pass,role:`team`,teamId:t1});
 assert.equal(auth.currentUser.uid,admin.uid,`secondary Auth must not replace Admin session`);
 await assert.rejects(request(`createUser`,{name:`Duplicate`,username:`team1b`,password:pass,role:`team`,teamId:t1}));
 async function upload(t,rows){const {id}=await request(`startImport`,{teamId:t});await request(`importChunk`,{id,rows});await request(`finishImport`,{id});}
 const c1={code:`001`,name:`طبيب أول`,kind:`طبيب`,specialty:`قلب`,area:`عمان`,classification:`A`},c2={...c1,code:`002`,name:`طبيب ثان`};
 await upload(t1,[c1,c2]);await upload(t2,[{...c1,name:`الاسم المعتمد الأخير`,classification:`B`}]);
 data=await request(`load`);assert.equal(data.customers.length,2);assert.equal(data.customers.find(c=>c.code===`001`).name,`الاسم المعتمد الأخير`);assert.equal(data.rosters.find(r=>r.teamId===t2).rows[0].classification,`B`);
 const oldUser=data.users.find(u=>u.username===`team1`),oldEmail=await resolveLogin(`team1`);
 await signOut(auth);await signInWithEmailAndPassword(auth,oldEmail,pass);data=await request(`load`);assert.equal(data.profile.role,`team`);
 const d={type:data.settings.types[0],status:`planned`,total:10000,actual:null,date:``,notes:``,clients:[{...data.customers.find(c=>c.code===`001`),amount:10000,actual:null,shares:[{teamId:t1,amount:5000,actual:null},{teamId:t2,amount:5000,actual:null}]}]};
 const a=(await request(`saveActivity`,d)).id;data=await request(`load`);assert.equal(data.teams.find(t=>t.id===t1).used,5000);
 await assert.rejects(request(`saveActivity`,{...d,total:300000,clients:d.clients.map(c=>({...c,amount:300000,shares:c.shares.map(s=>({...s,amount:150000}))}))}));
 const earlyModern={id:null,type:d.type,status:`planned`,total:10000,actual:null,date:`2027-05-14`,notes:`initial conversion`,
  clients:[{code:`001`,name:`الاسم المعتمد الأخير`,kind:`طبيب`,specialty:`قلب`,area:`عمان`}],
  teamShares:[{teamId:t1,amount:6500,actual:null},{teamId:t2,amount:3500,actual:null}],
  costItems:[{id:`demo-client`,category:`client`,label:`تكلفة مرتبطة بالعميل`,amount:7000},{id:`demo-meal`,category:`meal`,label:`غداء`,amount:3000}],
  honorariumShares:[{code:`001`,amount:7000}]};
 const trial=(await request(`saveActivity`,earlyModern)).id;
 assert.equal((await request(`load`)).activities.find(x=>x.id===trial).costItems.length,2);
 assert.equal((await request(`load`)).activities.find(x=>x.id===trial).honorariumShares[0].amount,7000);
 await request(`deleteActivity`,{id:trial});
 await signOut(auth);await signInWithEmailAndPassword(auth,email,pass);
 await request(`updateUser`,{id:oldUser.id,password:`NewLocal-Password-43`,active:true});assert.equal(auth.currentUser.uid,admin.uid);
 const newEmail=await resolveLogin(`team1`);assert.notEqual(newEmail,oldEmail);
 await signOut(auth);await signInWithEmailAndPassword(auth,oldEmail,pass);await assert.rejects(request(`load`));
 await signOut(auth);await signInWithEmailAndPassword(auth,newEmail,`NewLocal-Password-43`);
 data=await request(`load`);assert.equal(data.profile.accountId,oldUser.accountId);
 await request(`saveActivity`,{...d,id:a,notes:`التعديل بعد إعادة كلمة المرور`});
 await signOut(auth);await signInWithEmailAndPassword(auth,email,pass);
 await upload(t1,[c2]);data=await request(`load`);assert.ok(!data.rosters.find(r=>r.teamId===t1).rows.some(c=>c.code===`001`));assert.equal(data.activities.length,1);
 await request(`archiveCustomers`,{rows:[{code:`001`,name:`الاسم المعتمد الأخير`,specialty:`قلب`,area:`عمان`}]});
 data=await request(`load`);
 assert.equal(data.customers.length,1);
 assert.equal(data.activities.length,1);
 assert.ok(!data.rosters.some(r=>r.rows.some(c=>c.code===`001`)));
 assert.equal((await getDoc(doc(db,`customers/001`))).data().deleted,true);
 await assert.rejects(request(`archiveCustomers`,{rows:[{code:`002`,name:`خاطئ`,specialty:`قلب`,area:`عمان`}]}),/تغيرت بيانات/);

 await signOut(auth);await signInWithEmailAndPassword(auth,newEmail,`NewLocal-Password-43`);
 await assert.rejects(request(`saveActivity`,d));await request(`saveActivity`,{...d,id:a,notes:`بقاء النشاط التاريخي بعد الاستبدال`});
 }finally{await signOut(auth);await env.cleanup();}
});
