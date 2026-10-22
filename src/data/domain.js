import {validateCostItems} from "./cost-items.js";
export const fail = (condition, message) => {
  if (!condition) throw new Error(message);
};
export function cents(value) {
  fail(
    value !== null &&
      value !== undefined &&
      value !== `` &&
      Number.isFinite(Number(value)),
    `أدخل مبلغا صحيحا`,
  );
  const n = Number(value);
  fail(
    n >= 0 && n <= 1e9 && Math.abs(n * 100 - Math.round(n * 100)) < 0.0001,
    `المبلغ يجب أن يكون موجبا وبمنزلتين عشريتين كحد أقصى`,
  );
  return Math.round(n * 100);
}
export function equally(total, count) {
  if (!count) return [];
  const q = Math.floor(total / count),
    r = total % count;
  return Array.from({ length: count }, (_, i) => q + (i < r ? 1 : 0));
}
export function weighted(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return equally(total, weights.length);
  const raw = weights.map((w) => (total * w) / sum),
    out = raw.map(Math.floor);
  const indices = raw
    .map((v, i) => ({ i, remainder: v - out[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  const remaining = total - out.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remaining; i++) out[indices[i].i]++;
  return out;
}

function validateTeamActivity(a) {
  fail(Array.isArray(a.clients) && a.clients.length >= 1 && a.clients.length <= 8, `اختر من عميل إلى 8 عملاء`);
  fail(new Set(a.clients.map(c => String(c.code))).size === a.clients.length, `العميل مكرر`);
  fail(a.clients.every(c => String(c.code || ``).trim() && !String(c.code).includes(`/`)), `كود عميل غير صالح`);
  fail(Array.isArray(a.teamShares) && a.teamShares.length > 0 && a.teamShares.length <= 8, `اختر من فريق إلى 8 فرق`);
  fail(new Set(a.teamShares.map(s => s.teamId)).size === a.teamShares.length, `فريق مكرر`);
  fail(a.teamShares.every(s => typeof s.teamId === `string` && s.teamId && Number.isSafeInteger(s.amount) && s.amount >= 0), `حصص الفرق المخططة غير صحيحة`);
  fail(a.teamShares.reduce((n,s) => n+s.amount,0) === a.total, `مجموع حصص الفرق لا يطابق الميزانية المخططة`);
  if (a.actual !== null) {
    fail(Number.isSafeInteger(a.actual) && a.actual >= 0 && a.actual <= 100000000000, `المبلغ الفعلي غير صحيح`);
    fail(a.teamShares.every(s => Number.isSafeInteger(s.actual) && s.actual >= 0), `سجل الفعلي لكل فريق`);
    fail(a.teamShares.reduce((n,s) => n+s.actual,0) === a.actual, `مجموع الفعلي للفرق لا يطابق المبلغ الفعلي`);
  } else fail(a.teamShares.every(s => s.actual == null), `لا يمكن إدخال حصص فعلية قبل إجمالي الفعلي`);
}

export function validateActivity(a) {
  fail(
    [`planned`, `executed`, `cancelled`].includes(a.status),
    `حالة النشاط غير صحيحة`,
  );
  fail(
    typeof a.type === `string` && a.type.trim().length > 0,
    `اختر نوع النشاط`,
  );
  fail(
    Number.isSafeInteger(a.total) && a.total > 0 && a.total <= 100000000000,
    `أدخل إجمالي النشاط`,
  );
  validateCostItems(a.costItems,a.total);
  if(Array.isArray(a.teamShares)) validateTeamActivity(a);
  else {
  fail(
    Array.isArray(a.clients) && a.clients.length > 0 && a.clients.length <= 8,
    `اختر من عميل إلى 8 عملاء`,
  );
  fail(new Set(a.clients.flatMap(c=>c.shares.map(s=>s.teamId))).size<=8,`النشاط يدعم حتى 8 فرق مشاركة`);
  fail(
    new Set(a.clients.map((c) => c.code)).size === a.clients.length,
    `العميل مكرر في النشاط`,
  );
  fail(
    a.clients.reduce((s, c) => s + c.amount, 0) === a.total,
    `حصص العملاء لا تطابق الإجمالي`,
  );
  for (const c of a.clients) {
    fail(
      Number.isInteger(c.amount) && c.amount > 0,
      `حصة العميل يجب أن تكون أكبر من صفر`,
    );
    fail(Array.isArray(c.shares) && c.shares.length > 0, `اختر فرقا لكل عميل`);
    fail(
      new Set(c.shares.map((s) => s.teamId)).size === c.shares.length,
      `الفريق مكرر`,
    );
    fail(
      c.shares.every((s) => Number.isInteger(s.amount) && s.amount >= 0),
      `حصص الفرق غير صحيحة`,
    );
    fail(
      c.shares.reduce((s, x) => s + x.amount, 0) === c.amount,
      `حصص الفرق لا تطابق حصة العميل`,
    );
  }
  if (a.actual !== null) {
    fail(
      Number.isSafeInteger(a.actual) &&
        a.actual >= 0 &&
        a.actual <= 100000000000,
      `المبلغ الفعلي غير صحيح`,
    );
    fail(
      a.clients.every((c) => Number.isInteger(c.actual) && c.actual >= 0),
      `حدد الفعلي لكل عميل`,
    );
    fail(
      a.clients.reduce((s, c) => s + c.actual, 0) === a.actual,
      `حصص العملاء الفعلية لا تطابق الإجمالي`,
    );
    for (const c of a.clients)
      fail(
        c.shares.every((s) => Number.isInteger(s.actual) && s.actual >= 0) &&
          c.shares.reduce((s, x) => s + x.actual, 0) === c.actual,
        `حصص الفرق الفعلية لا تطابق حصة العميل`,
      );
  }
  }
  if (a.status === `executed`)
    fail(a.actual !== null, `سجل الفعلي قبل إغلاق النشاط`);
  fail(
    !a.date ||
      (/^2027-\d{2}-\d{2}$/.test(a.date) &&
        !Number.isNaN(Date.parse(a.date)) &&
        new Date(a.date).toISOString().slice(0, 10) === a.date),
    `التاريخ خارج سنة 2027 أو غير صالح`,
  );
}
export function charges(a) {
  const out = {};
  if (!a) return out;
  const actual = a.status !== `planned`;
  if (Array.isArray(a.teamShares)) {
    for (const s of a.teamShares)
      out[s.teamId] = (out[s.teamId] || 0) + (actual ? s.actual || 0 : s.amount);
  } else for (const c of a.clients)
    for (const s of c.shares)
      out[s.teamId] = (out[s.teamId] || 0) + (actual ? s.actual || 0 : s.amount);
  return out;
}
