import { initializeApp } from 'firebase/app';
import {getAuth,initializeAuth,inMemoryPersistence,createUserWithEmailAndPassword,deleteUser,signOut,connectAuthEmulator} from 'firebase/auth';
import {getFirestore,doc,getDoc,getDocs,collection,query,where,orderBy,limit,runTransaction,writeBatch,setDoc,serverTimestamp,connectFirestoreEmulator} from 'firebase/firestore';
import {fail,validateActivity} from './data/domain.js';
import {prepareProofs} from './data/proofs.js';
import {encodeActivity,decodeActivity,tombstone,wireCharges,activeVisit} from './data/activity-wire.js';
const localTests=typeof process!==`undefined`&&process.env.ACTIONPLAN_EMULATORS===`1`;
export const firebaseConfig={apiKey:`AIzaSyD2HgEyn6Y4AEeTZVxdw6Sg2-iAk4APK1A`,authDomain:`dadactionplan.firebaseapp.com`,projectId:localTests?`demo-actionplan`:`dadactionplan`,storageBucket:`dadactionplan.firebasestorage.app`,messagingSenderId:`83696158470`,appId:`1:83696158470:web:f67e808ad90fd8313b0087`,measurementId:`G-SVLF09EKE4`};
export const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const secondaryApp=initializeApp(firebaseConfig,`account-provisioning`),secondaryAuth=initializeAuth(secondaryApp,{persistence:inMemoryPersistence});
if(localTests){connectAuthEmulator(auth,`http://127.0.0.1:9099`,{disableWarnings:true});connectAuthEmulator(secondaryAuth,`http://127.0.0.1:9099`,{disableWarnings:true});connectFirestoreEmulator(db,`127.0.0.1`,8080);}
const financeRef=doc(db,`finance/2027`);
const list=s=>s.docs.map(d=>({id:d.id,...d.data()}));
const uid=()=>{fail(auth.currentUser,`سجل الدخول أولا`);return auth.currentUser.uid};
const clean=(v,n=200)=>String(v??``).trim().slice(0,n);
const id=()=>doc(collection(db,`ids`)).id;
async function profile(){const u=uid(),ref=doc(db,`users/${u}`);let s=await getDoc(ref);if(!s.exists()){const setup=await getDoc(doc(db,`setup/bootstrap`));if(setup.data()?.adminUid===u){await setDoc(ref,{name:`مسؤول النظام`,username:`admin`,role:`admin`,accountId:u,teamId:null,active:true,current:true});s=await getDoc(ref);}}
 fail(s.exists()&&s.data().active,`الحساب غير مفعل. تهيئة المسؤول الأول موضحة في setup.html`);
 const p={...s.data(),accountId:s.data().accountId||u};if(p.role===`admin`&&p.username){const l=doc(db,`logins/${p.username}`);await runTransaction(db,async tx=>{const old=await tx.get(l);if(!old.exists())tx.set(l,{uid:u,email:auth.currentUser.email,accountId:p.accountId});});}return p;}

const manager=p=>fail([`admin`,`manager`].includes(p.role),`هذه العملية للإدارة فقط`);
const admin=p=>fail(p.role===`admin`,`هذه العملية للمسؤول فقط`);
const event=(tx,kind,before,after,key=id())=>{tx.set(doc(db,`audit/${key}`),{kind,uid:uid(),before:before||null,after:after||null,at:serverTimestamp()});};
export async function resolveLogin(username){const name=username.trim().toLowerCase();fail(/^[a-z0-9._-]{3,40}$/.test(name),`اسم المستخدم غير صحيح`);const d=await getDoc(doc(db,`logins/${name}`));return d.exists()?d.data().email:`${name}@users.dadactionplan.app`;}
async function load(){const p=await profile();let f=await getDoc(financeRef);if(!f.exists()&&p.role===`admin`){await runTransaction(db,async tx=>{const s=await tx.get(financeRef);if(!s.exists())tx.set(financeRef,{teams:{},types:[`ندوة علمية`,`مؤتمر طبي`,`اجتماع علمي`,`ورشة عمل`],mutation:null,rosterEpoch:0,pausedTeams:[],uploads:{}});});f=await getDoc(financeRef);}
 fail(f.exists(),`يجب أن يدخل Admin أولا لتهيئة ميزانيات 2027`);
 const financial=f.data(),teams=Object.entries(financial.teams).map(([id,t])=>({id,...t,uploading:financial.pausedTeams?.includes(id)||false}));
 const [c,a,u]=await Promise.all([getDocs(collection(db,`customers`)),getDocs(query(collection(db,`activities`),where(`year`,`==`,2027))),p.role===`admin`?getDocs(collection(db,`users`)):null]);
 const customers=list(c),rosters=teams.map(t=>({teamId:t.id,rows:customers.flatMap(c=>{const v=activeVisit(c,t.id,financial.teams);return v?[{...c,classification:v.classification}]:[]})}));
 return {profile:p,teams,customers,rosters,activities:list(a).filter(a=>a.status!==`deleted`).map(a=>decodeActivity(a.id,a,teams)),settings:{types:financial.types},users:u?list(u).filter(u=>u.current!==false):[]};}
async function saveActivity(payload,deleting=false){const p=await profile(),activityId=payload.id||id(),r=doc(db,`activities/${activityId}`);
 const [initialFinance,initialActivity]=await Promise.all([getDoc(financeRef),getDoc(r)]);
 const preparedFinancial=initialFinance.data(),preparedOld=initialActivity.exists()?initialActivity.data():null;
 let preparedNext=null;
 if(!deleting){
 preparedNext=encodeActivity(payload,{accountId:p.accountId,uid:uid(),previous:preparedOld});preparedNext.proofId=id();
 const customers=await Promise.all(payload.clients.map(c=>getDoc(doc(db,`customers/${encodeURIComponent(c.code)}`))));
 payload.clients.forEach((c,i)=>{fail(customers[i].exists(),`العميل غير موجود`);for(const k of [`name`,`kind`,`specialty`,`area`])preparedNext.rows[encodeURIComponent(c.code)][k]=customers[i].data()[k]||``;});
 await prepareProofs(db,{...preparedNext,activityId},{owner:uid(),baseRev:preparedOld?.rev||0,rosterEpoch:preparedFinancial.rosterEpoch||0,proofId:preparedNext.proofId});
 }
 return runTransaction(db,async tx=>{
 const [f,prior]=await Promise.all([tx.get(financeRef),tx.get(r)]);fail(f.exists(),`لم تهيأ الميزانيات`);const financial=f.data(),old=prior.exists()?prior.data():null;
 fail(p.role!==`team`||!old||old.creator===p.accountId,`يمكن تعديل الأنشطة التي أنشأتها فقط`);
 let next;
 if(deleting){fail(old&&old.status===`planned`&&old.actual===null,`الحذف متاح للمخطط دون مصروف فعلي فقط`);next=tombstone(old,uid(),serverTimestamp());}
 else{fail((old?.rev||0)===(preparedOld?.rev||0),`تغير النشاط من جلسة أخرى، حدث الصفحة وأعد المحاولة`);fail((financial.rosterEpoch||0)===(preparedFinancial.rosterEpoch||0),`تغيرت قوائم العملاء أثناء الحفظ، أعد المحاولة`);next={...preparedNext,updatedAt:serverTimestamp()};}

 const before=wireCharges(old),after=wireCharges(next),projected=wireCharges(next,true),affected=[...new Set([...(old?.teamIds||[]),...next.teamIds])],teams={...financial.teams};
 affected.forEach(t=>{const team=teams[t];fail(team,`الفريق غير موجود`);const used=team.used-(before[t]||0)+(after[t]||0);fail(used>=0&&used<=team.budget&&team.used-(before[t]||0)+(projected[t]||0)<=team.budget,`ميزانية ${team.name} لا تكفي، زد الميزانية أولا`);teams[t]={...team,used};});
 fail(affected.length<=8,`يمكن إشراك أو تغيير حتى 8 فرق في الحفظ الواحد`);
 const mutation={affectedTeams:affected,kind:deleting?`deleteActivity`:`saveActivity`,uid:uid(),activityId,rev:next.rev,before:old,after:next,at:serverTimestamp()};
 tx.set(r,next);for(const t of affected)tx.set(doc(db,`budgets/${t}`),{budget:teams[t].budget,used:teams[t].used,mutation:{activityId,rev:next.rev,uid:uid(),at:serverTimestamp()}});tx.update(financeRef,{teams,mutation});tx.set(doc(db,`audit/${activityId}_${next.rev}`),mutation);return {id:activityId};});}
async function saveTeam(payload){const p=await profile();manager(p);const teamId=payload.id||id(),name=clean(payload.name),budget=payload.budget;fail(name&&Number.isSafeInteger(budget)&&budget>=0&&budget<=1e11,`اسم الفريق والميزانية غير صالحين`);await runTransaction(db,async tx=>{const [s,bs]=await Promise.all([tx.get(financeRef),tx.get(doc(db,`budgets/${teamId}`))]),f=s.data(),old=f.teams[teamId]||null;fail(!old||budget>=old.used,`الميزانية أقل من المبلغ المحجوز والمصروف`);const next={name,budget,used:old?.used||0,roster:old?.roster||null,accountId:old?.accountId||null};tx.set(doc(db,`budgets/${teamId}`),{budget,used:next.used,mutation:bs.data()?.mutation||null});tx.update(financeRef,{teams:{...f.teams,[teamId]:next},mutation:{kind:`saveTeam`,teamId,uid:uid(),at:serverTimestamp()}});event(tx,`saveTeam`,old,next);});return {id:teamId};}
async function provision(payload,replaceId=null){const p=await profile();admin(p);let previous=null;if(replaceId){const s=await getDoc(doc(db,`users/${replaceId}`));fail(s.exists(),`الحساب غير موجود`);previous=s.data();fail(replaceId!==uid(),`لتغيير كلمة مرور حسابك استخدم Firebase Authentication`);}
 const username=(previous?.username||clean(payload.username)).toLowerCase(),role=previous?.role||payload.role,teamId=previous?.teamId||payload.teamId||null,password=payload.password;
 fail(/^[a-z0-9._-]{3,40}$/.test(username),`اسم المستخدم: 3–40 حرفا إنجليزيا أو رقما أو . _ -`);fail([`admin`,`manager`,`team`].includes(role),`صلاحية غير صحيحة`);fail(typeof password===`string`&&password.length>=8,`كلمة المرور 8 أحرف على الأقل`);
 const email=`${username.slice(0,20)}.${crypto.randomUUID()}@users.dadactionplan.app`;let created;
 try{created=(await createUserWithEmailAndPassword(secondaryAuth,email,password)).user;
 await runTransaction(db,async tx=>{const [f,l]=await Promise.all([tx.get(financeRef),tx.get(doc(db,`logins/${username}`))]);const finance=f.data();fail(replaceId||!l.exists(),`اسم المستخدم مستخدم سابقا`);if(replaceId)fail(!l.exists()||l.data().uid===replaceId,`تم تغيير الحساب من جلسة أخرى، حدث الصفحة`);
 const accountId=previous?.accountId||replaceId||created.uid;
 if(role===`team`){const t=finance.teams[teamId];fail(t,`اختر الفريق`);if(t.accountId&&t.accountId!==accountId){const matches=await tx.get(doc(db,`accounts/${t.accountId}`));fail(!matches.exists()||!matches.data().active,`يوجد حساب مفعل لهذا الفريق`);}tx.update(financeRef,{teams:{...finance.teams,[teamId]:{...t,accountId}},mutation:{kind:`account`,teamId,uid:uid(),at:serverTimestamp()}});}
 const user={username,name:previous?.name||clean(payload.name)||username,role,teamId:role===`team`?teamId:null,accountId,active:payload.active??previous?.active??true,current:true};
 if(replaceId)tx.update(doc(db,`users/${replaceId}`),{active:false,current:false});
 tx.set(doc(db,`users/${created.uid}`),user);tx.set(doc(db,`logins/${username}`),{uid:created.uid,email,accountId});tx.set(doc(db,`accounts/${accountId}`),{uid:created.uid,active:user.active,username,role,teamId:user.teamId});event(tx,replaceId?`resetPassword`:`createUser`,replaceId?{uid:replaceId}:null,{uid:created.uid,username,role});});
 }catch(e){if(created)try{await deleteUser(created)}catch{}throw e;}finally{await signOut(secondaryAuth);}}
async function updateUser(payload){if(payload.password)return provision(payload,payload.id);const p=await profile();admin(p);fail(payload.id!==uid(),`لا يمكنك تعطيل حسابك`);await runTransaction(db,async tx=>{const ur=doc(db,`users/${payload.id}`),[u,f]=await Promise.all([tx.get(ur),tx.get(financeRef)]);fail(u.exists(),`الحساب غير موجود`);const old=u.data();if(payload.active&&old.role===`team`)fail(f.data().teams[old.teamId]?.accountId===old.accountId,`يوجد حساب آخر لهذا الفريق`);tx.update(ur,{active:Boolean(payload.active)});tx.set(doc(db,`accounts/${old.accountId}`),{uid:payload.id,active:Boolean(payload.active),username:old.username,role:old.role,teamId:old.teamId});event(tx,`updateUser`,{uid:payload.id,active:old.active},{uid:payload.id,active:Boolean(payload.active)});});}
export async function request(op,payload={}){if(op===`load`)return load();if(op===`saveActivity`)return saveActivity(payload);if(op===`deleteActivity`)return saveActivity(payload,true);if(op===`saveTeam`)return saveTeam(payload);if(op===`createUser`)return provision(payload);if(op===`updateUser`)return updateUser(payload);
 const p=await profile();
 if(op===`saveTypes`){manager(p);const types=[...new Set(payload.types.map(t=>clean(t)).filter(Boolean))];fail(types.length>0&&types.length<=200,`أدخل من نوع إلى 200 نوع`);await runTransaction(db,async tx=>{const f=await tx.get(financeRef);tx.update(financeRef,{types,mutation:{kind:`saveTypes`,uid:uid(),at:serverTimestamp()}});event(tx,`saveTypes`,{types:f.data().types},{types});});return {};}
 if(op===`audit`){manager(p);const s=await getDocs(query(collection(db,`audit`),orderBy(`at`,`desc`),limit(100)));return {rows:list(s).map(r=>({...r,action:r.kind,at:r.at?{_seconds:r.at.seconds}:null}))};}
 admin(p);
 if(op===`startImport`){const key=id();await runTransaction(db,async tx=>{const fs=await tx.get(financeRef),f=fs.data();fail(f.teams[payload.teamId],`اختر الفريق`);tx.set(doc(db,`imports/${key}`),{teamId:payload.teamId,state:`staging`,uid:uid(),createdAt:serverTimestamp()});tx.update(financeRef,{rosterEpoch:(f.rosterEpoch||0)+1,pausedTeams:[...new Set([...(f.pausedTeams||[]),payload.teamId])],uploads:{...(f.uploads||{}),[payload.teamId]:key},mutation:{kind:`startImport`,teamId:payload.teamId,uid:uid(),at:serverTimestamp()}});});return {id:key};}
 if(op===`importChunk`){fail(payload.rows.length<=150,`حد الدفعة 150 عميلا`);await updateRosterChunk(payload.id,payload.rows,false);return {};}
 if(op===`finishImport`){const r=doc(db,`imports/${payload.id}`),imp=await getDoc(r),all=await getDocs(collection(db,`imports/${payload.id}/rows`));fail(imp.exists()&&!all.empty,`القائمة فارغة`);const tid=imp.data().teamId,codes=new Set(all.docs.map(d=>d.data().code)),customers=await getDocs(collection(db,`customers`));const removed=customers.docs.map(d=>d.data()).filter(c=>c.visitingTeams?.includes(tid)&&!codes.has(c.code));for(let i=0;i<removed.length;i+=150)await updateRosterChunk(payload.id,removed.slice(i,i+150),true);
 await runTransaction(db,async tx=>{const [im,fs]=await Promise.all([tx.get(r),tx.get(financeRef)]),f=fs.data();fail(im.data()?.state===`staging`&&f.uploads?.[tid]===payload.id,`بدأ رفع أحدث لهذا الفريق، أعد تحميل القائمة`);const uploads={...(f.uploads||{})};delete uploads[tid];tx.update(financeRef,{teams:{...f.teams,[tid]:{...f.teams[tid],roster:payload.id}},rosterEpoch:(f.rosterEpoch||0)+1,pausedTeams:(f.pausedTeams||[]).filter(t=>t!==tid),uploads,mutation:{kind:`finishImport`,teamId:tid,uid:uid(),at:serverTimestamp()}});tx.update(r,{state:`active`,count:all.size});event(tx,`finishImport`,{roster:f.teams[tid].roster},{teamId:tid,roster:payload.id,count:all.size});});return {count:all.size};}
 throw new Error(`عملية غير معروفة`);
}

async function updateRosterChunk(importId,rows,remove){const r=doc(db,`imports/${importId}`),refs=rows.map(c=>doc(db,`customers/${encodeURIComponent(c.code)}`));await runTransaction(db,async tx=>{const [imp,fs,...existing]=await Promise.all([tx.get(r),tx.get(financeRef),...refs.map(ref=>tx.get(ref))]);const f=fs.data(),tid=imp.data()?.teamId;fail(imp.data()?.state===`staging`&&f.uploads?.[tid]===importId,`بدأ رفع أحدث لهذا الفريق، أعد رفع الملف`);for(let i=0;i<rows.length;i++){const raw=rows[i],old=existing[i].data()||{},visits={...(old.visits||{})},members=new Set(old.visitingTeams||[]);let next;if(remove){members.delete(tid);delete visits[tid];next={...old,visits,visitingTeams:[...members],updatedAt:serverTimestamp()};}else{const c=Object.fromEntries([`code`,`name`,`kind`,`area`,`specialty`].map(k=>[k,clean(raw[k],k===`code`?100:200)]));fail(c.code&&c.name&&!c.code.includes(`/`),`كود العميل واسمه إلزاميان`);members.add(tid);visits[tid]={classification:clean(raw.classification),roster:importId};next={...c,kind:c.kind||`طبيب`,visits,visitingTeams:[...members],updatedAt:serverTimestamp()};tx.set(doc(db,`imports/${importId}/rows/${encodeURIComponent(c.code)}`),{...c,classification:clean(raw.classification)});}tx.set(refs[i],next);}tx.update(financeRef,{rosterEpoch:(f.rosterEpoch||0)+1,mutation:{kind:`importChunk`,teamId:tid,uid:uid(),at:serverTimestamp()}});});}
