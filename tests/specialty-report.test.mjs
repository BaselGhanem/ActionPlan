import test from "node:test";
import assert from "node:assert/strict";
import { groupBySpecialty } from "../src/data/specialty-report.js";

const activity = (id, status = `planned`) => ({ id, status });
const entry = (id, specialty, amount, actual = null, status = `planned`) => ({
  activity: activity(id, status),
  client: { code: `doctor-${id}`, specialty },
  specialty: specialty || ``,
  share: { teamId: `cardio`, amount, actual },
});

test(`specialty report counts a shared multi-team activity once and sums shares exactly`, () => {
  const rows = [
    entry(`a1`, `Cardiology`, 45000, 30000, `executed`),
    { ...entry(`a1`, `Cardiology`, 55000, 40000, `executed`),
      share: { teamId: `primary`, amount: 55000, actual: 40000 } },
    entry(`a2`, `Cardiology`, 5000),
    entry(`a3`, `Neurology`, 20000),
  ];
  const groups = groupBySpecialty(rows);
  assert.equal(groups.size, 2);
  assert.equal(groups.get(`Cardiology`).count.size, 2);
  assert.equal(groups.get(`Cardiology`).planned, 105000);
  assert.equal(groups.get(`Cardiology`).actual, 70000);
  assert.equal(groups.get(`Neurology`).planned, 20000);
  assert.equal([...groups.values()].reduce((n, g) => n + g.planned, 0), rows.reduce((n, r) => n + r.share.amount, 0));
});

test(`mixed specialties keep amounts assigned to actual client rows without duplication`, () => {
  const rows = [
    entry(`mixed`, `Cardiology`, 60000),
    entry(`mixed`, `Neurology`, 40000),
  ];
  const groups = groupBySpecialty(rows);
  assert.equal(groups.get(`Cardiology`).planned, 60000);
  assert.equal(groups.get(`Neurology`).planned, 40000);
  assert.equal(groups.get(`Cardiology`).count.size, 1);
  assert.equal(groups.get(`Neurology`).count.size, 1);
  assert.equal([...groups.values()].reduce((n,g) => n + g.planned,0), 100000);
});

test(`empty specialties form one label and cancelled activities preserve actual only`, () => {
  const rows = [
    entry(`a1`, ``, 10000),
    entry(`a2`, null, 20000),
    entry(`a3`, `   `, 30000, 5000, `cancelled`),
  ];
  const groups = groupBySpecialty(rows);
  assert.equal(groups.size, 1);
  const noSpecialty = [...groups.values()][0];
  assert.equal(noSpecialty.name, `بدون تخصص`);
  assert.equal(noSpecialty.count.size, 3);
  assert.equal(noSpecialty.planned, 30000);
  assert.equal(noSpecialty.actual, 5000);
});
