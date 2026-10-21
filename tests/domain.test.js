import test from "node:test";
import assert from "node:assert/strict";
import {
  cents,
  equally,
  weighted,
  validateActivity,
  charges,
} from "../src/data/domain.js";
const valid = () => ({
  type: `ندوة`,
  status: `planned`,
  date: ``,
  total: 10001,
  actual: null,
  clients: [
    {
      code: `001`,
      amount: 10001,
      shares: [
        { teamId: `a`, amount: 5001 },
        { teamId: `b`, amount: 5000 },
      ],
    },
  ],
});
test(`equal distribution preserves cents including small totals`, () => {
  for (let n = 0; n < 100; n++)
    for (let k = 1; k < 15; k++) {
      const a = equally(n, k);
      assert.equal(
        a.reduce((s, x) => s + x, 0),
        n,
      );
      assert.ok(Math.max(...a) - Math.min(...a) <= 1);
    }
});
test(`weighted distribution preserves all cents and respects zero weights`, () => {
  for (let n = 0; n < 500; n++) {
    const a = weighted(n, [5, 2, 0]);
    assert.equal(
      a.reduce((s, x) => s + x, 0),
      n,
    );
    assert.equal(a[2], 0);
  }
  assert.deepEqual(weighted(10, [1, 1, 1]), [4, 3, 3]);
});
test(`money rejects hidden rounding, negative and invalid input`, () => {
  assert.equal(cents(`12.34`), 1234);
  for (const n of [-1, `1.001`, `abc`, null, ``]) assert.throws(() => cents(n));
});
test(`multi-client activity totals cannot duplicate or drift`, () => {
  const a = valid();
  assert.doesNotThrow(() => validateActivity(a));
  a.clients[0].shares[0].amount++;
  assert.throws(() => validateActivity(a));
  const b = valid();
  b.clients.push(structuredClone(b.clients[0]));
  b.total *= 2;
  assert.throws(() => validateActivity(b));
});
test(`planned holds are replaced by actual at close, cancellation releases unused budget`, () => {
  const a = valid();
  assert.deepEqual(charges(a), { a: 5001, b: 5000 });
  a.actual = 8000;
  a.clients[0].actual = 8000;
  a.clients[0].shares[0].actual = 4000;
  a.clients[0].shares[1].actual = 4000;
  assert.doesNotThrow(() => validateActivity(a));
  assert.deepEqual(charges(a), { a: 5001, b: 5000 });
  a.status = `executed`;
  assert.deepEqual(charges(a), { a: 4000, b: 4000 });
  a.status = `cancelled`;
  assert.deepEqual(charges(a), { a: 4000, b: 4000 });
  a.actual = null;
  a.clients[0].shares.forEach((s) => (s.actual = null));
  assert.deepEqual(charges(a), { a: 0, b: 0 });
});
test(`invalid and out of year dates are rejected`, () => {
  for (const date of [`2026-01-01`, `2027-02-30`, `2027-13-01`])
    assert.throws(() => validateActivity({ ...valid(), date }));
  assert.doesNotThrow(() =>
    validateActivity({ ...valid(), date: `2027-12-31` }),
  );
});
test(`executed activity requires actual and reconciled actual shares`, () => {
  let a = valid();
  a.status = `executed`;
  assert.throws(() => validateActivity(a));
  a.actual = 10;
  a.clients[0].actual = 10;
  a.clients[0].shares[0].actual = 8;
  a.clients[0].shares[1].actual = 1;
  assert.throws(() => validateActivity(a));
  a.clients[0].shares[1].actual = 2;
  assert.doesNotThrow(() => validateActivity(a));
});
