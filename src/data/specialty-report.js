import { EMPTY_SPECIALTY } from "./cascading-filters.js";

/**
 * Aggregate amounts already allocated to customer/team shares by specialty.
 * Counts distinct activities once per specialty, including shared multi-team events.
 * No extra or invented allocation is performed.
 */
export function groupBySpecialty(rows) {
  const groups = new Map();
  for (const row of rows) {
    const specialty = String(row.client?.specialty ?? row.specialty ?? ``).trim();
    const key = specialty || EMPTY_SPECIALTY;
    const group = groups.get(key) || {
      key,
      name: specialty || `بدون تخصص`,
      planned: 0,
      actual: 0,
      count: new Set(),
    };
    group.planned += row.activity.status === `cancelled` ? 0 : row.share.amount;
    group.actual += row.share.actual || 0;
    group.count.add(row.activity.id);
    groups.set(key, group);
  }
  return groups;
}
