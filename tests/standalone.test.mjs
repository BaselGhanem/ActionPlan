import test from "node:test";
import assert from "node:assert/strict";
import {eligibleDoctor,visibleStandaloneGroups,matchStandAlone,specialtyMatches,selectionLabelsByCustomer} from "../src/data/standalone.js";
test("configured quotas and team permissions",()=>{
 const teams=[{id:"A",name:"Azord"},{id:"M",name:"Matador"},{id:"U",name:"URO"},{id:"C",name:"Clavodar"},{id:"X",name:"Mixif"}];
 const admin=visibleStandaloneGroups(teams,{role:"admin"});
 assert.deepEqual(admin.map(g=>[g.id,g.teamName,g.quota]),[["ent-chest","Azord",35],["ent-chest","Matador",35],["uro","Matador",25],["uro","URO",25],["pedia","Azord",0],["pedia","Clavodar",0],["pedia","Mixif",0]]);
 assert.deepEqual(visibleStandaloneGroups(teams,{role:"team",teamId:"M"}).map(g=>g.id),["ent-chest","uro"]);
 assert.deepEqual(visibleStandaloneGroups(teams,{role:"team",teamId:"A"}).map(g=>g.id),["ent-chest","pedia"]);
});
test("eligibility requires specialist doctor on team's roster",()=>{
 for(const s of ["ENT","Chest speciality","Pulmonology","انف واذن","أمراض الصدر"])assert.ok(specialtyMatches("ent-chest",s),s);
 for(const s of ["URO","Urology","المسالك البولية"])assert.ok(specialtyMatches("uro",s),s);
 const doctor={kind:"طبيب",specialty:"ENT",visitingTeams:["A","M"]};
 assert.ok(eligibleDoctor("ent-chest",doctor,"A"));
 assert.ok(eligibleDoctor("ent-chest",doctor,"M"));
 assert.equal(eligibleDoctor("ent-chest",doctor,"U"),false);
 assert.equal(eligibleDoctor("uro",doctor,"A"),false);
 assert.equal(eligibleDoctor("ent-chest",{...doctor,kind:"صيدلية"},"A"),false);
 for(const specialty of [`Pedia`,`Pediatrics`,`Paediatrics`,`طب الأطفال`,`اطفال`])assert.ok(specialtyMatches(`pedia`,specialty),specialty);
 assert.equal(eligibleDoctor(`pedia`,{...doctor,specialty:`Pediatric`},`A`),true);
 assert.equal(eligibleDoctor(`pedia`,doctor,`A`),false);
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
 assert.equal(match[1].unique,1);
 assert.equal(match[1].matches.length,1);
 assert.equal(match[2].unique,2);
 assert.equal(match[2].matches.length,1);
 assert.deepEqual(match[2].byTeam.map(g=>g.count),[1,1,1]);
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
