import test from "node:test";
import assert from "node:assert/strict";
import {directoryKeys,reportKeys,matchingRows,facetOptions,selectedOptions} from "../src/data/cascading-filters.js";
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
