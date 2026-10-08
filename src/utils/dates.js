/** @param {Date} date */
export function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

/** A calendar day in the device's timezone, rather than UTC. @param {Date} date */
export function toLocalDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
