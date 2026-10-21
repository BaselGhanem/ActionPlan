import test from "node:test";
import assert from "node:assert/strict";
import { buildRosterTemplate, readRosterTemplate } from "../src/roster-template.js";

const team = { id: `cardio-2`, name: `Cardio Team 2` };
const fileOf = async (workbook) => ({
  name: `ActionPlan_Customers.xlsx`,
  arrayBuffer: async () => await workbook.xlsx.writeBuffer(),
});
const customer = {
  code: `000123`,
  name: `طبيب اختبار`,
  kind: `طبيب`,
  specialty: `قلب`,
  area: `عمان`,
  classification: `A`,
};

test(`team-specific template retains code as text and round-trips all six fields`, async () => {
  const wb = await buildRosterTemplate(team, [customer]);
  assert.equal(wb.getWorksheet(`العملاء`).getCell(`A6`).numFmt, `@`);
  const result = await readRosterTemplate(await fileOf(wb), team.id);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(
    Object.fromEntries(Object.keys(customer).map((key) => [key, result.rows[0][key]])),
    customer,
  );
  assert.equal(result.rows[0].rowNumber, 6);
});
test(`rejects wrong-team and untrusted files`, async () => {
  const wb = await buildRosterTemplate(team, [customer]);
  await assert.rejects(
    readRosterTemplate(await fileOf(wb), `another-team`),
    /خاص بفريق آخر/,
  );
  const untrusted = await buildRosterTemplate(team, [customer]);
  untrusted.getWorksheet(`_ActionPlan`).getCell(`A1`).value = `untrusted`;
  await assert.rejects(
    readRosterTemplate(await fileOf(untrusted), team.id),
    /ليس قالب/,
  );
});
test(`detects duplicate, missing customer name, and numeric codes`, async () => {
  const wb = await buildRosterTemplate(team, [customer, { ...customer, name: `` }]);
  const ws = wb.getWorksheet(`العملاء`);
  ws.getCell(`A8`).value = 123;
  ws.getCell(`B8`).value = `عميل ثالث`;
  const result = await readRosterTemplate(await fileOf(wb), team.id);
  assert.equal(result.rows.length, 3);
  assert.ok(result.issues.some((v) => v.includes(`مكرر`)));
  assert.ok(result.issues.some((v) => v.includes(`إلزاميان`)));
  assert.ok(result.issues.some((v) => v.includes(`رقمي`)));
});
test(`rejects altered headers, blank templates, and CSV files`, async () => {
  const wb = await buildRosterTemplate(team);
  await assert.rejects(readRosterTemplate(await fileOf(wb), team.id), /القالب فارغ/);
  wb.getWorksheet(`العملاء`).getCell(`A5`).value = `غير متوقع`;
  await assert.rejects(readRosterTemplate(await fileOf(wb), team.id), /عناوين/);
  await assert.rejects(readRosterTemplate({ name: `customers.csv` }, team.id), /Excel/);
});
