// Each facet respects every other selected dimension, excluding its own.
export const directoryKeys = [`team`, `specialty`, `area`, `kind`, `classification`];
export const reportKeys = [`team`, `month`, `type`, `status`, `area`, `specialty`, `classification`];
export function matchingRows(rows, filters, keys, exclude = ``) {
  return rows.filter(row => keys.every(k => k === exclude || !filters[k] || row[k] === filters[k]));
}
export function facetOptions(rows, filters, keys, target) {
  return [...new Set(matchingRows(rows, filters, keys, target).map(row => row[target]).filter(v => v !== null && v !== undefined && v !== ``))]
    .sort((a,b) => String(a).localeCompare(String(b), `ar`, {numeric: true}));
}
// Preserve selections when free-text search returns no matches.
export const selectedOptions = (list, current) => current && !list.includes(current) ? [current, ...list] : list;
