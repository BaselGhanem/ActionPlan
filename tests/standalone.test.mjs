import test from "node:test";
import assert from "node:assert/strict";
import {eligibleDoctor,visibleStandaloneGroups,matchStandAlone,specialtyMatches} from "../src/data/standalone.js";
test("configured quotas and team permissions",()=>{
 const teams=[{id:"A",name:"Azord"},{id:"M",name:"Matador"},{id:"U",name:"URO"}];
 const admin=visibleStandaloneGroups(teams,{role:"admin"});
 assert.deepEqual(admin.map(g=>[g.id,g.teamName,g.quota]),[["ent-chest","Azord",35],["ent-chest","Matador",35],["uro","Matador",25],["uro","URO",25]]);
 assert.deepEqual(visibleStandaloneGroups(teams,{role:"team",teamId:"M"}).map(g=>g.id),["ent-chest","uro"]);
 assert.deepEqual(visibleStandaloneGroups(teams,{role:"team",teamId:"A"}).map(g=>g.id),["ent-chest"]);
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
});
test("matching deduplicates doctors by code in each campaign",()=>{
 const teams=[{id:"A",name:"Azord"},{id:"M",name:"Matador"},{id:"U",name:"URO"}];
 const groups=visibleStandaloneGroups(teams,{role:"admin"});
 const choices=[
  {campaign:"ent-chest",teamId:"A",code:"C1"},
  {campaign:"ent-chest",teamId:"M",code:"C1"},
  {campaign:"ent-chest",teamId:"M",code:"C2"},
  {campaign:"uro",teamId:"U",code:"C3"},
  {campaign:"uro",teamId:"M",code:"C3"},
 ];
 const match=matchStandAlone(choices,groups);
 assert.equal(match[0].unique,2);
 assert.equal(match[0].matches.length,1);
 assert.deepEqual(match[0].byTeam.map(g=>g.count),[1,2]);
 assert.equal(match[1].unique,1);
 assert.equal(match[1].matches.length,1);
});