import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { fail, validateActivity, charges } from "./domain.js";
initializeApp();
const db = getFirestore(),
  auth = getAuth();
const clean = (v, max = 200) =>
  String(v ?? ``)
    .trim()
    .slice(0, max);
const safeId = (v) => /^[A-Za-z0-9_-]{1,100}$/.test(v);
const event = (tx, uid, action, before, after) =>
  tx.set(db.collection(`audit`).doc(), {
    uid,
    action,
    before: before || null,
    after: after || null,
    at: FieldValue.serverTimestamp(),
  });
const list = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
async function profile(uid) {
  const d = await db.doc(`users/${uid}`).get();
  fail(d.exists && d.data().active, `الحساب غير مفعل`);
  return d.data();
}
const admin = (p) => fail(p.role === `admin`, `هذه العملية للمسؤول فقط`);
const manager = (p) =>
  fail([`admin`, `manager`].includes(p.role), `هذه العملية للإدارة فقط`);
export const action = onCall(
  {
    region: `europe-west1`,
    maxInstances: 10,
    timeoutSeconds: 120,
    memory: `512MiB`,
  },
  async (req) => {
    try {
      fail(req.auth, `سجل الدخول أولا`);
      const uid = req.auth.uid,
        p = await profile(uid),
        { op, payload = {} } = req.data || {};
      if (op === `load`) {
        const [t, c, a, s, u] = await Promise.all([
          db.collection(`teams`).get(),
          db.collection(`customers`).get(),
          db.collection(`activities`).where(`year`, `==`, 2027).get(),
          db.doc(`settings/main`).get(),
          p.role === `admin` ? db.collection(`users`).get() : null,
        ]);
        const teams = list(t);
        const rosters = await Promise.all(
          teams
            .filter((t) => t.roster)
            .map(async (t) => ({
              teamId: t.id,
              rows: list(await db.collection(`imports/${t.roster}/rows`).get()),
            })),
        );
        return {
          profile: p,
          teams,
          customers: list(c),
          activities: list(a),
          settings: s.data() || { types: [] },
          users: u ? list(u) : [],
          rosters,
        };
      }
      if (op === `saveActivity` || op === `deleteActivity`) {
        const id = payload.id || db.collection(`activities`).doc().id;
        fail(safeId(id), `معرف النشاط غير صالح`);
        const ref = db.doc(`activities/${id}`);
        await db.runTransaction(async (tx) => {
          const prev = await tx.get(ref),
            old = prev.exists ? prev.data() : null;
          fail(
            p.role !== `team` || (old ? old.creator === uid : true),
            `يمكن تعديل الأنشطة التي أنشأتها فقط`,
          );
          if (op === `deleteActivity`) {
            fail(old, `النشاط غير موجود`);
            fail(
              old.actual === null && old.status === `planned`,
              `لا يمكن حذف نشاط له مصروف فعلي أو نشاط مغلق`,
            );
          }
          let next = null;
          if (op === `saveActivity`) {
            next = {
              year: 2027,
              type: clean(payload.type),
              total: payload.total,
              actual: payload.actual ?? null,
              status: payload.status,
              date: payload.date || ``,
              notes: clean(payload.notes, 3000),
              clients: payload.clients,
              creator: old?.creator || uid,
              createdAt: old?.createdAt || Date.now(),
              updatedAt: Date.now(),
            };
            validateActivity(next);
            const settings = await tx.get(db.doc(`settings/main`));
            fail(
              settings.data()?.types?.includes(next.type) ||
                old?.type === next.type,
              `نوع النشاط غير معتمد`,
            );
            if (next.status === `cancelled`) {
              manager(p);
              fail(old, `احفظ النشاط قبل إلغائه`);
            }
            if (old?.status === `cancelled`) manager(p);

            if (p.role === `team`) {
              const memberships = await Promise.all(
                next.clients
                  .filter((c) => !old?.clients?.some((x) => x.code === c.code))
                  .map(async (c) => {
                    const team = await tx.get(db.doc(`teams/${p.teamId}`));
                    return team.data()?.roster
                      ? await tx.get(
                          db.doc(
                            `imports/${team.data().roster}/rows/${encodeURIComponent(c.code)}`,
                          ),
                        )
                      : null;
                  }),
              );
              fail(
                memberships.every((d) => d?.exists),
                `لا يمكنك إنشاء نشاط إلا لعملاء يزورهم فريقك`,
              );
            }
            for (const c of next.clients) {
              fail(
                typeof c.code === `string` &&
                  c.code.length > 0 &&
                  !c.code.includes(`/`),
                `كود العميل غير صالح`,
              );
              const customer = await tx.get(
                db.doc(`customers/${encodeURIComponent(c.code)}`),
              );
              fail(customer.exists, `العميل غير موجود`);
              c.name = customer.data().name;
              c.specialty = customer.data().specialty || ``;
              c.area = customer.data().area || ``;
              c.kind = customer.data().kind || ``;
              for (const s of c.shares) {
                fail(safeId(s.teamId), `معرف الفريق غير صالح`);
                const team = await tx.get(db.doc(`teams/${s.teamId}`));
                fail(team.exists, `الفريق غير موجود`);
                const existing = old?.clients?.some(
                  (x) =>
                    x.code === c.code &&
                    x.shares.some((y) => y.teamId === s.teamId),
                );
                if (!existing) {
                  const member = team.data().roster
                    ? await tx.get(
                        db.doc(
                          `imports/${team.data().roster}/rows/${encodeURIComponent(c.code)}`,
                        ),
                      )
                    : null;
                  fail(member?.exists, `أحد الفرق لا يزور العميل حاليا`);
                }
                s.teamName = team.data().name;
              }
            }
            if (old && next.status === `cancelled` && old.actual !== null)
              fail(next.actual !== null, `يجب الاحتفاظ بالمصروف الفعلي`);
          }
          const before = charges(old),
            after = charges(next),
            ids = [...new Set([...Object.keys(before), ...Object.keys(after)])];
          const teamDocs = await Promise.all(
            ids.map((id) => tx.get(db.doc(`teams/${id}`))),
          );
          ids.forEach((id, i) => {
            const t = teamDocs[i].data();
            fail(t, `الفريق غير موجود`);
            const used = (t.used || 0) - (before[id] || 0) + (after[id] || 0);
            const projectedActual =
              next?.actual !== null && next?.actual !== undefined
                ? (t.used || 0) -
                  (before[id] || 0) +
                  (charges({ ...next, status: `executed` })[id] || 0)
                : used;
            fail(
              used >= 0 && used <= t.budget && projectedActual <= t.budget,
              `ميزانية ${t.name} لا تكفي — زد الميزانية أولا`,
            );
          });
          ids.forEach((id, i) =>
            tx.update(teamDocs[i].ref, {
              used:
                (teamDocs[i].data().used || 0) -
                (before[id] || 0) +
                (after[id] || 0),
            }),
          );
          if (next) tx.set(ref, next);
          else tx.delete(ref);
          event(tx, uid, op, old, next);
        });
        return { id };
      }
      if (op === `saveTeam`) {
        manager(p);
        const id = payload.id || db.collection(`teams`).doc().id;
        fail(safeId(id), `معرف غير صحيح`);
        const budget = payload.budget;
        fail(
          Number.isSafeInteger(budget) && budget >= 0 && budget <= 100000000000,
          `ميزانية غير صحيحة`,
        );
        const name = clean(payload.name);
        fail(name, `أدخل اسم الفريق`);
        await db.runTransaction(async (tx) => {
          const r = db.doc(`teams/${id}`),
            old = await tx.get(r);
          fail(
            !old.exists || budget >= (old.data().used || 0),
            `الميزانية أقل من المبلغ المحجوز والمصروف`,
          );
          const data = {
            name,
            budget,
            used: old.data()?.used || 0,
            roster: old.data()?.roster || null,
            userId: old.data()?.userId || null,
          };
          tx.set(r, data);
          event(tx, uid, op, old.data(), data);
        });
        return { id };
      }
      if (op === `saveTypes`) {
        manager(p);
        const types = [
          ...new Set(
            (payload.types || []).map((t) => clean(t)).filter(Boolean),
          ),
        ];
        fail(types.length <= 200, `عدد الأنواع كبير`);
        await db.runTransaction(async (tx) => {
          const r = db.doc(`settings/main`),
            old = await tx.get(r);
          tx.set(r, { types });
          event(tx, uid, op, old.data(), { types });
        });
        return {};
      }
      if (op === `createUser`) {
        admin(p);
        const username = clean(payload.username).toLowerCase();
        fail(
          /^[a-z0-9._-]{3,40}$/.test(username),
          `اسم المستخدم: 3–40 حرفا إنجليزيا أو رقما أو . _ -`,
        );
        fail(
          [`team`, `manager`, `admin`].includes(payload.role),
          `دور غير صحيح`,
        );
        if (payload.role === `team`) {
          fail(safeId(payload.teamId), `اختر الفريق`);
          fail(
            (await db.doc(`teams/${payload.teamId}`).get()).exists,
            `الفريق غير موجود`,
          );
          const same = await db
            .collection(`users`)
            .where(`teamId`, `==`, payload.teamId)
            .get();
          fail(
            !same.docs.some((d) => d.data().active),
            `يوجد حساب مفعل لهذا الفريق`,
          );
        }
        fail(
          typeof payload.password === `string` && payload.password.length >= 8,
          `كلمة المرور 8 أحرف على الأقل`,
        );
        const u = await auth.createUser({
          email: `${username}@users.dadactionplan.app`,
          password: payload.password,
          displayName: clean(payload.name) || username,
        });
        try {
          await db.runTransaction(async (tx) => {
            let teamRef = null,
              td = null;
            if (payload.role === `team`) {
              teamRef = db.doc(`teams/${payload.teamId}`);
              td = await tx.get(teamRef);
              if (td.data()?.userId) {
                const linked = await tx.get(
                  db.doc(`users/${td.data().userId}`),
                );
                fail(!linked.data()?.active, `يوجد حساب مفعل لهذا الفريق`);
              }
            }
            tx.set(db.doc(`users/${u.uid}`), {
              username,
              name: clean(payload.name) || username,
              role: payload.role,
              teamId: payload.role === `team` ? payload.teamId : null,
              active: true,
            });
            if (teamRef) tx.update(teamRef, { userId: u.uid });
          });
        } catch (e) {
          await auth.deleteUser(u.uid);
          throw e;
        }
        await db
          .collection(`audit`)
          .add({
            uid,
            action: op,
            after: { userId: u.uid, username, role: payload.role },
            at: FieldValue.serverTimestamp(),
          });
        return {};
      }
      if (op === `updateUser`) {
        admin(p);
        fail(safeId(payload.id), `معرف غير صحيح`);
        fail(payload.id !== uid, `لا يمكنك تعطيل حسابك من هذه الشاشة`);
        if (payload.password) {
          fail(payload.password.length >= 8, `كلمة المرور 8 أحرف على الأقل`);
          await auth.updateUser(payload.id, { password: payload.password });
          await auth.revokeRefreshTokens(payload.id);
        }
        if (typeof payload.active === `boolean`) {
          if (payload.active) {
            await db.runTransaction(async (tx) => {
              const ur = db.doc(`users/${payload.id}`),
                ud = await tx.get(ur);
              fail(ud.exists, `الحساب غير موجود`);
              if (ud.data().role === `team`) {
                const tr = db.doc(`teams/${ud.data().teamId}`),
                  td = await tx.get(tr);
                if (td.data()?.userId && td.data().userId !== payload.id) {
                  const other = await tx.get(
                    db.doc(`users/${td.data().userId}`),
                  );
                  fail(!other.data()?.active, `يوجد حساب مفعل آخر لهذا الفريق`);
                }
                tx.update(tr, { userId: payload.id });
              }
              tx.update(ur, { active: true });
            });
          }
          await auth.updateUser(payload.id, { disabled: !payload.active });
          await db
            .doc(`users/${payload.id}`)
            .update({ active: payload.active });
          await auth.revokeRefreshTokens(payload.id);
        }
        await db
          .collection(`audit`)
          .add({
            uid,
            action: op,
            after: {
              userId: payload.id,
              active: payload.active ?? null,
              passwordChanged: Boolean(payload.password),
            },
            at: FieldValue.serverTimestamp(),
          });
        return {};
      }
      if (op === `startImport`) {
        admin(p);
        fail(safeId(payload.teamId), `اختر الفريق`);
        fail(
          (await db.doc(`teams/${payload.teamId}`).get()).exists,
          `الفريق غير موجود`,
        );
        const r = db.collection(`imports`).doc();
        await r.set({
          teamId: payload.teamId,
          uid,
          state: `staging`,
          createdAt: Date.now(),
        });
        return { id: r.id };
      }
      if (op === `importChunk`) {
        admin(p);
        fail(safeId(payload.id), `معرف غير صحيح`);
        const r = db.doc(`imports/${payload.id}`);
        const imp = await r.get();
        fail(imp.data()?.state === `staging`, `عملية رفع غير متاحة`);
        fail(
          Array.isArray(payload.rows) && payload.rows.length <= 200,
          `حد الدفعة 200 عميل`,
        );
        const batch = db.batch();
        for (const raw of payload.rows) {
          const c = {
            code: clean(raw.code, 100),
            name: clean(raw.name),
            kind: clean(raw.kind) || `طبيب`,
            specialty: clean(raw.specialty),
            area: clean(raw.area),
            classification: clean(raw.classification),
          };
          fail(
            c.code && c.name && !c.code.includes(`/`),
            `كود واسم العميل إلزاميان، ولا يسمح بالشرطة / في الكود`,
          );
          batch.set(r.collection(`rows`).doc(encodeURIComponent(c.code)), c);
        }
        await batch.commit();
        return {};
      }
      if (op === `finishImport`) {
        admin(p);
        fail(safeId(payload.id), `معرف غير صحيح`);
        const r = db.doc(`imports/${payload.id}`),
          imp = await r.get();
        fail(imp.data()?.state === `staging`, `عملية رفع غير متاحة`);
        const rows = list(await r.collection(`rows`).get());
        fail(rows.length > 0, `القائمة فارغة`);
        // Canonical customer fields use the last successfully processed upload. Relationships switch atomically below.
        for (let i = 0; i < rows.length; i += 200) {
          const batch = db.batch();
          for (const c of rows.slice(i, i + 200)) {
            const { id, classification, ...data } = c;
            batch.set(db.doc(`customers/${encodeURIComponent(c.code)}`), {
              ...data,
              updatedAt: Date.now(),
            });
          }
          await batch.commit();
        }
        await db.runTransaction(async (tx) => {
          const im = await tx.get(r);
          fail(im.data()?.state === `staging`, `تم اعتماد الرفع سابقا`);
          const t = db.doc(`teams/${imp.data().teamId}`),
            old = await tx.get(t);
          fail(old.exists, `الفريق غير موجود`);
          tx.update(t, { roster: payload.id });
          tx.update(r, { state: `active`, count: rows.length });
          event(
            tx,
            uid,
            op,
            { roster: old.data().roster || null },
            {
              teamId: imp.data().teamId,
              roster: payload.id,
              count: rows.length,
            },
          );
        });
        return { count: rows.length };
      }
      if (op === `audit`) {
        manager(p);
        return {
          rows: list(
            await db.collection(`audit`).orderBy(`at`, `desc`).limit(100).get(),
          ),
        };
      }
      throw new Error(`عملية غير معروفة`);
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      throw new HttpsError(
        `failed-precondition`,
        e.message || `تعذر تنفيذ العملية`,
      );
    }
  },
);
