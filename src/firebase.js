import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
const firebaseConfig = {
  apiKey: `AIzaSyD2HgEyn6Y4AEeTZVxdw6Sg2-iAk4APK1A`,
  authDomain: `dadactionplan.firebaseapp.com`,
  projectId: `dadactionplan`,
  storageBucket: `dadactionplan.firebasestorage.app`,
  messagingSenderId: `83696158470`,
  appId: `1:83696158470:web:f67e808ad90fd8313b0087`,
  measurementId: `G-SVLF09EKE4`,
};
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const call = httpsCallable(getFunctions(app, `europe-west1`), `action`, {
  timeout: 120000,
});
export const request = async (op, payload = {}) =>
  (await call({ op, payload })).data;
