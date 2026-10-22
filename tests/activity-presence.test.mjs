import test from "node:test";
import assert from "node:assert/strict";
import {activityCountsByCustomer,isDoctorClient,hasCustomerActivity} from "../src/data/activity-presence.js";
test(`counts per customer code across teams and excludes deleted activities`,()=>{
 const map=activityCountsByCustomer([
  {status:`planned`,clients:[{code:`001`,shares:[{teamId:`A`},{teamId:`B`}]},{code:`001`}]},
  {status:`executed`,clients:[{code:`001`}]},
  {status:`cancelled`,clients:[{code:`002`}]},
  {status:`deleted`,clients:[{code:`003`}]},
 ]);
 assert.equal(map.get(`001`),2);
 assert.equal(map.get(`002`),1);
 assert.equal(map.has(`003`),false);
 assert.equal(hasCustomerActivity(map,`001`),true);
 assert.equal(hasCustomerActivity(map,`0001`),false);
 assert.equal(hasCustomerActivity(map,1),false);
});
test(`doctor badges are not shown for pharmacies or hospitals`,()=>{
 assert.equal(isDoctorClient({kind:`طبيب`,name:`أحمد`}),true);
 assert.equal(isDoctorClient({kind:`Doctor`,name:`Ahmed`}),true);
 assert.equal(isDoctorClient({name:`د. موسى`}),true);
 assert.equal(isDoctorClient({kind:`طبيبة`,name:`ليلى`}),true);
 assert.equal(isDoctorClient({kind:`مستشفى`,name:`د. مركز`}),false);
 assert.equal(isDoctorClient({kind:`صيدلية`,name:`د. صيدلية`}),false);
 assert.equal(isDoctorClient({name:`مجهول`},`doctor`),true);
});
