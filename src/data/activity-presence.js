/**
 * Presence is based on a stable customer code across every team.
 * Cancelled activities remain historical; deleted records are ignored.
 */
export function activityCountsByCustomer(activities = []) {
  const counts = new Map();
  for (const activity of activities) {
    if (!activity || activity.status === `deleted`) continue;
    const keys = new Set((activity.clients || [])
      .map(client => client?.code == null ? `` : String(client.code))
      .filter(Boolean));
    for (const code of keys) counts.set(code, (counts.get(code) || 0) + 1);
  }
  return counts;
}
export function isDoctorClient(client, fallbackKind = ``) {
  if (!client) return false;
  const kind = String(client.kind || fallbackKind || ``).trim().toLocaleLowerCase();
  if ([`طبيب`, `طبيبة`, `دكتور`, `دكتورة`, `doctor`, `physician`, `dr`, `dr.`].includes(kind)) return true;
  return !kind && /^(?:د[.]|دكتور(?:ة)?\s|dr[.]\s|doctor\s)/i.test(String(client.name || ``).trim());
}
export function hasCustomerActivity(counts, code) {
  return code != null && (counts.get(String(code)) || 0) > 0;
}
