import test from "node:test";
import assert from "node:assert/strict";
import {eligibleDoctor,visibleStandaloneGroups,matchStandAlone,specialtyMatches,selectionLabelsByCustomer} from "../src/data/standalone.js";
test("configured quotas and team permissions",()=>{
 const teams=[{id:"A",name:"Azord"},{id:"M",name:"Matador"},{id:"U",name:"URO"},{id:"C",name:"Clavodar"},{id:"X",name:"Mixif"}];
 const admin=visibleStandaloneGroups(teams,{role:"admin"});
 assert.deepEqual(visibleStandaloneGroups(teams,{role:"manager"}),admin);
 assert.deepEqual(admin.map(g=>[g.id,g.teamName,g.quota]),[
  ["ent-chest","Azord",30],["ent-chest","Matador",30],
  ["gastro","Matador",5],
  ["advisory","Azord",0],["advisory","Matador",0],["advisory","URO",0],
  ["uro","Matador",25],["uro","URO",25],
  ["pedia","Azord",0],["pedia","Clavodar",0],["pedia","Mixif",0]
 ]);
 assert.deepEqual(visibleStandaloneGroups(teams,{role:"team",teamId:"M"}).map(g=>g.id),["ent-chest","gastro","advisory","uro"]);
 assert.deepEqual(visibleStandaloneGroups(teams,{role:"team",teamId:"A"}).map(g=>g.id),["ent-chest","advisory","pedia"]);
 assert.deepEqual(visibleStandaloneGroups(teams,{role:"team",teamId:"U"}).map(g=>g.id),["advisory","uro"]);
});
test("ENT and Gastro doctors have separate pools; Advisory Board is for doctors only",()=>{
 for(const s of ["ENT","Otorhinolaryngology","انف واذن"])assert.ok(specialtyMatches("ent-chest",s),s);
 for(const s of ["Chest speciality","Pulmonology","أمراض الصدر"])assert.equal(specialtyMatches("ent-chest",s),false,s);
 for(const s of ["Gastroenterology","Digestive System","جهاز هضمي"])assert.ok(specialtyMatches("gastro",s),s);
 const doctor={kind:"طبيب",specialty:"ENT",visitingTeams:["A","M"]};
 assert.ok(eligibleDoctor("ent-chest",doctor,"A"));
 assert.ok(eligibleDoctor("advisory",doctor,"M"));
 assert.equal(eligibleDoctor("ent-chest",doctor,"U"),false);
 assert.equal(eligibleDoctor("gastro",doctor,"A"),true);
 assert.ok(eligibleDoctor("gastro",{...doctor,specialty:"Gastroenterology"},"A"));
 assert.equal(eligibleDoctor("ent-chest",{...doctor,kind:"صيدلية"},"A"),false);
 assert.equal(eligibleDoctor("advisory",{...doctor,kind:"صيدلية"},"A"),false);
 assert.equal(eligibleDoctor("uro",doctor,"A"),true);
 assert.ok(eligibleDoctor("pedia",{...doctor,specialty:"Pediatrics"},"A"));
 assert.equal(eligibleDoctor("pedia",doctor,"A"),false);
});
test("matching deduplicates doctors by code in each campaign",()=>{
 const teams=[{id:"A",name:"Azord"},{id:"M",name:"Matador"},{id:"U",name:"URO"},{id:"C",name:"Clavodar"},{id:"X",name:"Mixif"}];
 const groups=visibleStandaloneGroups(teams,{role:"admin"});
 const choices=[
  {campaign:"ent-chest",teamId:"A",code:"C1"},
  {campaign:"ent-chest",teamId:"M",code:"C1"},
  {campaign:"ent-chest",teamId:"M",code:"C2"},
  {campaign:"uro",teamId:"U",code:"C3"},
  {campaign:"uro",teamId:"M",code:"C3"},
  {campaign:`pedia`,teamId:`A`,code:`C4`},
  {campaign:`pedia`,teamId:`C`,code:`C4`},
  {campaign:`pedia`,teamId:`X`,code:`C5`},
 ];
 const match=matchStandAlone(choices,groups);
 assert.equal(match[0].unique,2);
 assert.equal(match[0].matches.length,1);
 assert.deepEqual(match[0].byTeam.map(g=>g.count),[1,2]);
 assert.equal(match.find(x=>x.id==="uro").unique,1);
 assert.equal(match.find(x=>x.id==="uro").matches.length,1);
 assert.equal(match.find(x=>x.id==="pedia").unique,2);
 assert.equal(match.find(x=>x.id==="pedia").matches.length,1);
 assert.deepEqual(match.find(x=>x.id==="pedia").byTeam.map(g=>g.count),[1,1,1]);
});
test(`selection badges deduplicate teams and keep Pedia separate from Standalone`,()=>{
 const badges=selectionLabelsByCustomer([
  {campaign:`ent-chest`,teamId:`A`,code:`007`},
  {campaign:`uro`,teamId:`M`,code:`007`},
  {campaign:`pedia`,teamId:`A`,code:`007`},
  {campaign:`pedia`,teamId:`C`,code:`008`},
 ]);
 assert.deepEqual(badges.get(`007`),[`Pedia Activity`,`Standalone`]);
 assert.deepEqual(badges.get(`008`),[`Pedia Activity`]);
 assert.equal(badges.has(`009`),false);
});
test(`selection classification isolates campaigns and never guesses from incomplete reads`,async()=>{
 const {selectionStatusByCustomer}=await import(`../src/data/standalone.js`);
 const choices=[{campaign:`uro`,teamId:`M`,code:`007`},{campaign:`uro`,teamId:`U`,code:`007`},{campaign:`uro`,teamId:`M`,code:`008`},{campaign:`ent-chest`,teamId:`A`,code:`008`}];
 const result=selectionStatusByCustomer(choices,`uro`,`M`,true);
 assert.deepEqual(result.get(`007`),{status:`matching`,otherTeams:[`U`]});
 assert.deepEqual(result.get(`008`),{status:`unique`,otherTeams:[]});
 assert.equal(result.has(`009`),false);
 assert.equal(selectionStatusByCustomer(choices,`uro`,`M`,false).size,0);
 assert.equal(selectionStatusByCustomer(choices.filter(c=>c.teamId!==`U`),`uro`,`M`,true).get(`007`).status,`unique`);
});

test("ENT and Gastro do not admit unrelated specialties; URO retains existing broad roster eligibility",()=>{
 for(const specialty of [undefined,null,"","   ","Cardiology"]){
  const doctor={kind:"طبيب",specialty,visitingTeams:["A"]};
  assert.equal(eligibleDoctor("ent-chest",doctor,"A"),false);
  assert.equal(eligibleDoctor("gastro",doctor,"A"),true);
  assert.ok(eligibleDoctor("uro",doctor,"A"));
  assert.equal(eligibleDoctor("pedia",doctor,"A"),false);
  assert.equal(eligibleDoctor("uro",doctor,"M"),false);
  assert.ok(eligibleDoctor("advisory",doctor,"A"));
 }
 assert.ok(eligibleDoctor("uro",{kind:"صيدلية",visitingTeams:["A"]},"A"));
 assert.equal(eligibleDoctor("advisory",{kind:"صيدلية",visitingTeams:["A"]},"A"),false);
});

test("URO Advisory Board restricts its roster to URO specialist doctors",()=>{
 const c={kind:"طبيب",specialty:"Urology",visitingTeams:["U"]};
 assert.equal(eligibleDoctor("advisory",c,"U","URO"),true);
 assert.equal(eligibleDoctor("advisory",{...c,specialty:"ENT"},"U","URO"),false);
 assert.equal(eligibleDoctor("advisory",{...c,specialty:"ENT"},"U","Azord"),true);
 assert.equal(eligibleDoctor("advisory",{...c,kind:"صيدلية"},"U","URO"),false);
});

test("Gastro is Matador-only and allows doctors from all specialties",()=>{
 const teams=[{id:"A",name:"Azord"},{id:"M",name:"Matador"}];
 assert.deepEqual(visibleStandaloneGroups(teams,{role:"admin"}).filter(g=>g.id==="gastro").map(g=>g.teamId),["M"]);
 for(const specialty of ["ENT","Cardiology","Gastroenterology",""])
  assert.equal(eligibleDoctor("gastro",{kind:"طبيب",specialty,visitingTeams:["M"]},"M"),true);
 assert.equal(eligibleDoctor("gastro",{kind:"صيدلية",visitingTeams:["M"]},"M"),false);
});
