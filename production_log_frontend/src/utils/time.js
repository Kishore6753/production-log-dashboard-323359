/**
 * Time helpers for filtering and formatting.
 */

/**
 * PUBLIC_INTERFACE
 * Convert a local datetime-local input value (YYYY-MM-DDTHH:mm) to an ISO string.
 * @param {string} localValue datetime-local string.
 * @returns {string|null} ISO string or null if empty/invalid.
 */
export function localDateTimeToIso(localValue) {
  if (!localValue) return null;
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * PUBLIC_INTERFACE
 * Format an ISO timestamp for display in the user's locale.
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDateTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

/**
 * PUBLIC_INTERFACE
 * Check whether an ISO timestamp falls within [fromIso, toIso].
 * If fromIso or toIso is null, that side is unbounded.
 * @param {string|null|undefined} iso
 * @param {string|null} fromIso
 * @param {string|null} toIso
 * @returns {boolean}
 */
export function isWithinWindow(iso, fromIso, toIso) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;

  if (fromIso) {
    const fromT = new Date(fromIso).getTime();
    if (!Number.isNaN(fromT) && t < fromT) return false;
  }
  if (toIso) {
    const toT = new Date(toIso).getTime();
    if (!Number.isNaN(toT) && t > toT) return false;
  }
  return true;
}

