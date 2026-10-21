import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { createInterface } from "node:readline/promises";
initializeApp({ credential: applicationDefault(), projectId: `dadactionplan` });
const db = getFirestore(),
  auth = getAuth(),
  rl = createInterface({ input: process.stdin, output: process.stdout });
try {
  const username = (
    await rl.question(
      `Admin username (English letters/numbers, 3–40 characters): `,
    )
  )
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(username))
    throw new Error(`Invalid username`);
  const email = `${username}@users.dadactionplan.app`;
  // Create this account's password in Firebase Authentication; no password is read or printed here.
  const user = await auth.getUserByEmail(email);
  const existing = await db
    .collection(`users`)
    .where(`role`, `==`, `admin`)
    .get();
  if (existing.docs.some((d) => d.data().active))
    throw new Error(
      `An active Admin already exists. Use admin.html to manage accounts.`,
    );
  await db
    .doc(`users/${user.uid}`)
    .set({
      username,
      name: `مسؤول النظام`,
      role: `admin`,
      active: true,
      teamId: null,
    });
  await db
    .doc(`settings/main`)
    .set(
      {
        types: [
          `ندوة علمية`,
          `مؤتمر طبي`,
          `اجتماع علمي`,
          `ورشة عمل`,
          `رعاية تعليمية`,
        ],
      },
      { merge: true },
    );
  console.log(
    `Admin profile created successfully. Sign in using your username.`,
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  rl.close();
}
