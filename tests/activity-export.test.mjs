import test from "node:test";
import assert from "node:assert/strict";
import {activityExportMetadata} from "../src/files.js";

test("Excel activity metadata shows one quarter and all participating teams and specialties",()=>{
 const a={date:"2027-07-14",clients:[{specialty:"Cardiology"},{specialty:"ENT"},{specialty:"Cardiology"}],teamShares:[{teamId:"a"},{teamId:"b",teamName:"Matador"}]};
 assert.deepEqual(activityExportMetadata(a,[{id:"a",name:"Azord"}]),{speciality:"Cardiology / ENT",team:"Azord / Matador",quarter:"Q3"});
});
test("Unscheduled activities have blank Quarter and preserve single row aggregation",()=>{
 assert.deepEqual(activityExportMetadata({date:"",clients:[],teamShares:[]},[]),{speciality:"",team:"",quarter:""});
 assert.equal(activityExportMetadata({date:"2027-12-31",clients:[],teamShares:[]},[]).quarter,"Q4");
 assert.equal(activityExportMetadata({date:"2027-01-10",clients:[],teamShares:[]},[]).quarter,"Q1");
});
