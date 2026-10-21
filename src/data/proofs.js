import {doc,setDoc,getDoc,serverTimestamp} from 'firebase/firestore';
export async function prepareProofs(db,body,{owner,baseRev,rosterEpoch,proofId}){
 const profile=(await getDoc(doc(db,`users/${owner}`))).data();
 const authz={role:profile.role,teamId:profile.teamId||null,accountId:profile.accountId||owner};
 const proposal={authz,owner,baseRev,rosterEpoch,activityId:body.id||body.activityId,body:{...body,updatedAt:0},createdAt:serverTimestamp()};
 delete proposal.body.id;delete proposal.body.activityId;
 await setDoc(doc(db,`proposals/${proofId}`),proposal);
 await Promise.all([...body.clientKeys.map(key=>setDoc(doc(db,`proposals/${proofId}/rows/${key}`),{ok:true})),...body.teamIds.map(key=>setDoc(doc(db,`proposals/${proofId}/totals/${key}`),{ok:true}))]);
 await Promise.all([setDoc(doc(db,`proposals/${proofId}/checks/rows`),{ok:true}),setDoc(doc(db,`proposals/${proofId}/checks/totals`),{ok:true})]);
 return proposal.body;
}
