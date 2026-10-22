// Customer roster snapshots are cached per authenticated identity, visibility and roster epoch.
// Stored only in this browser, never shared between accounts, and gracefully fall back to network.
const DB="ActionPlanLocalDirectory",STORE="snapshots",TTL=24*60*60*1000;
function openDB(){
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==="undefined")return resolve(null);
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>resolve(request.result);
 });
}
async function transaction(mode,fn){
 const db=await openDB();if(!db)return null;
 return new Promise((resolve,reject)=>{
  const t=db.transaction(STORE,mode),store=t.objectStore(STORE);
  let value;
  const r=fn(store);
  r.onsuccess=()=>{value=r.result;};
  r.onerror=()=>{db.close();reject(r.error);};
  t.oncomplete=()=>{db.close();resolve(value);};
  t.onerror=()=>{db.close();reject(t.error);};
 });
}
export const rosterCacheKey=({project,uid,teamId,restricted,epoch})=>
 [project,uid,teamId||"all",restricted?"private":"shared",epoch||0].join("::");
export async function readRosterCache(key){
 try{const data=await transaction("readonly",store=>store.get(key));
  return data && Date.now()-data.at<TTL && Array.isArray(data.rows)?data.rows:null;
 }catch{return null;}
}
export async function writeRosterCache(key,rows){
 try{await transaction("readwrite",store=>store.put({at:Date.now(),rows},key));}catch{}
}
export function downloadLocalDirectory(rows){
 const header=["Code","Name","Kind","Specialty","Area","Teams"];
 const csv=[header,...rows.map(c=>[
   c.code,c.name,c.kind||"",c.specialty||"",c.area||"",c.visitingTeams?.join("; ")||""
 ])].map(r=>r.map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(",")).join("\r\n");
 const blob=new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob),anchor=document.createElement("a");
 anchor.href=url;anchor.download="ActionPlan_Customers_2027.csv";document.body.appendChild(anchor);
 anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
