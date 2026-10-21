// Each facet respects every other selected dimension, excluding its own.
// A dedicated value distinguishes "all specialties" from records with no specialty.
export const EMPTY_SPECIALTY = `__ACTIONPLAN_EMPTY_SPECIALTY__`;
export const directoryKeys = [`team`, `specialty`, `area`, `kind`, `classification`];
export const reportKeys = [`team`, `month`, `type`, `status`, `area`, `specialty`, `classification`];

const facetValue = (row, field) => {
  const value = row[field];
  return field === `specialty` && (value == null || String(value).trim() === ``)
    ? EMPTY_SPECIALTY
    : value;
};

export function matchingRows(rows, filters, keys, exclude = ``) {
  return rows.filter(row =>
    keys.every(key =>
      key === exclude || !filters[key] || facetValue(row, key) === filters[key],
    ),
  );
}

export function facetOptions(rows, filters, keys, target) {
  return [...new Set(
    matchingRows(rows, filters, keys, target)
      .map(row => facetValue(row, target))
      .filter(value => value !== null && value !== undefined && value !== ``),
  )].sort((a, b) =>
    a === EMPTY_SPECIALTY ? 1 : b === EMPTY_SPECIALTY ? -1
      : String(a).localeCompare(String(b), `ar`, { numeric: true }),
  );
}

// Preserve selections if a free-text search temporarily has no matches.
export const selectedOptions = (list, current) =>
  current && !list.includes(current) ? [current, ...list] : list;
