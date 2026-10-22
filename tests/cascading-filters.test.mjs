import test from "node:test";
import assert from "node:assert/strict";
import {EMPTY_SPECIALTY,directoryKeys,reportKeys,matchingRows,facetOptions,selectedOptions} from "../src/data/cascading-filters.js";
const dirs = [
 {team:`A`,specialty:`Cardio`,area:`Amman`,classification:`A`,kind:`Doctor`},
 {team:`B`,specialty:`Cardio`,area:`Amman`,classification:`B`,kind:`Doctor`},
 {team:`B`,specialty:`Neuro`,area:`Irbid`,classification:`A`,kind:`Doctor`},
 {team:`C`,specialty:`Neuro`,area:`Zarqa`,classification:`C`,kind:`Doctor`},
 {team:``,specialty:`Pediatric`,area:`Amman`,classification:``,kind:`Doctor`},
];
const df = Object.fromEntries(directoryKeys.map(k=>[k,``]));
test(`customer filters cascade bidirectionally`,()=>{
 const f={...df,team:`B`,area:`Amman`};
 assert.deepEqual(facetOptions(dirs,f,directoryKeys,`specialty`),[`Cardio`]);
 assert.deepEqual(facetOptions(dirs,f,directoryKeys,`classification`),[`B`]);
 assert.deepEqual(facetOptions(dirs,f,directoryKeys,`team`),[`A`,`B`]);
 assert.deepEqual(facetOptions(dirs,f,directoryKeys,`area`),[`Amman`,`Irbid`]);
});
test(`shared customers retain team-specific classification`,()=>{
 assert.deepEqual(facetOptions(dirs,{...df,team:`A`},directoryKeys,`classification`),[`A`]);
 assert.deepEqual(facetOptions(dirs,{...df,team:`B`,specialty:`Cardio`},directoryKeys,`classification`),[`B`]);
});
test(`unassigned customers and search-selected states`,()=>{
 assert.equal(matchingRows(dirs,df,directoryKeys).length,5);
 assert.equal(matchingRows(dirs,{...df,team:`A`},directoryKeys).length,1);
 assert.deepEqual(selectedOptions([],`Amman`),[`Amman`]);
});
const reports = [
 {team:`A`,month:`01`,type:`Seminar`,status:`planned`,area:`Amman`,specialty:`Cardio`,classification:`A`},
 {team:`B`,month:`01`,type:`Seminar`,status:`planned`,area:`Amman`,specialty:`Cardio`,classification:`B`},
 {team:`B`,month:`unscheduled`,type:`Congress`,status:`executed`,area:`Irbid`,specialty:`Neuro`,classification:`A`},
 {team:`C`,month:`02`,type:`Congress`,status:`cancelled`,area:`Zarqa`,specialty:`Pediatric`,classification:``},
];
const rf=Object.fromEntries(reportKeys.map(k=>[k,``]));
test(`report facets cascade through month, status, type and team`,()=>{
 const f={...rf,team:`B`,type:`Congress`};
 assert.deepEqual(facetOptions(reports,f,reportKeys,`month`),[`unscheduled`]);
 assert.deepEqual(facetOptions(reports,f,reportKeys,`status`),[`executed`]);
 assert.deepEqual(facetOptions(reports,f,reportKeys,`area`),[`Irbid`]);
 assert.deepEqual(facetOptions(reports,{...rf,month:`01`},reportKeys,`team`),[`A`,`B`]);
 assert.equal(matchingRows(reports,{...f,month:`unscheduled`},reportKeys).length,1);
});
test(`each facet ignores only its own current selection`,()=>{
 assert.deepEqual(facetOptions(reports,{...rf,team:`B`,month:`01`,status:`planned`},reportKeys,`team`),[`A`,`B`]);
});

test(`directory specialty filter shows and selects missing values, without losing cascading`,()=>{
 const entries=[
  ...dirs,
  {team:`A`,specialty:``,area:`Amman`,classification:`B`,kind:`Doctor`,code:`blank`},
  {team:`B`,specialty:null,area:`Irbid`,classification:`A`,kind:`Doctor`,code:`null`},
  {team:`B`,specialty:`   `,area:`Amman`,classification:`C`,kind:`Doctor`,code:`spaces`},
 ];
 assert.deepEqual(facetOptions(entries,{...df,team:`A`},directoryKeys,`specialty`),[`Cardio`,EMPTY_SPECIALTY]);
 const filtered=matchingRows(entries,{...df,specialty:EMPTY_SPECIALTY},directoryKeys);
 assert.deepEqual(filtered.map(c=>c.code),[`blank`,`null`,`spaces`]);
 assert.deepEqual(facetOptions(entries,{...df,team:`B`,specialty:EMPTY_SPECIALTY},directoryKeys,`area`),[`Amman`,`Irbid`]);
 assert.deepEqual(facetOptions(entries,{...df,area:`Amman`,specialty:EMPTY_SPECIALTY},directoryKeys,`team`),[`A`,`B`]);
 assert.deepEqual(facetOptions(entries,{...df,team:`B`,specialty:EMPTY_SPECIALTY},directoryKeys,`classification`),[`A`,`C`]);
 assert.equal(matchingRows(entries,{...df,team:`A`,specialty:EMPTY_SPECIALTY},directoryKeys).length,1);
});
test(`report specialty filter includes empty historical specialty`,()=>{
 const r=[
  ...reports,
  {team:`B`,month:`02`,type:`Seminar`,status:`planned`,area:`Amman`,specialty:``,classification:`A`},
  {team:`A`,month:`03`,type:`Congress`,status:`executed`,area:`Irbid`,specialty:null,classification:`C`},
 ];
 assert.ok(facetOptions(r,rf,reportKeys,`specialty`).includes(EMPTY_SPECIALTY));
 assert.equal(matchingRows(r,{...rf,specialty:EMPTY_SPECIALTY},reportKeys).length,2);
 assert.deepEqual(facetOptions(r,{...rf,team:`B`,specialty:EMPTY_SPECIALTY},reportKeys,`month`),[`02`]);
 assert.deepEqual(facetOptions(r,{...rf,status:`cancelled`},reportKeys,`specialty`),[`Pediatric`]);
});

test(`activity state cascades with team, specialty and classification`,()=>{
 const entries=[
  {team:`A`,specialty:`Cardio`,area:`Amman`,classification:`A`,kind:`Doctor`,activity:`with`},
  {team:`A`,specialty:`Cardio`,area:`Amman`,classification:`B`,kind:`Doctor`,activity:`without`},
  {team:`B`,specialty:`Neuro`,area:`Irbid`,classification:`C`,kind:`Doctor`,activity:`without`},
 ];
 const all={...df,activity:``};
 assert.deepEqual(facetOptions(entries,{...all,team:`A`},directoryKeys,`activity`),[`with`,`without`]);
 assert.deepEqual(facetOptions(entries,{...all,team:`A`,activity:`without`},directoryKeys,`classification`),[`B`]);
 assert.deepEqual(facetOptions(entries,{...all,activity:`without`,specialty:`Neuro`},directoryKeys,`team`),[`B`]);
 assert.equal(matchingRows(entries,{...all,team:`A`,activity:`without`},directoryKeys).length,1);
 assert.equal(matchingRows(entries,all,directoryKeys).length,3);
});
