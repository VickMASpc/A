/** @typedef {Record<string, unknown> & { id?: string, type?: string }} SyncItem */

/** @param {SyncItem[]} localItems @param {SyncItem[]} remoteItems Produces a deterministic, non-destructive sync plan from local and remote content. */
export function createSyncPlan(localItems, remoteItems) {
  const remote = new Map(remoteItems.map((item) => [item.id, item]));
  /** @type {{ scanned: number, create: SyncItem[], update: SyncItem[], unchanged: SyncItem[], errors: string[] }} */
  const plan = { scanned: localItems.length, create: [], update: [], unchanged: [], errors: [] };
  for (const item of localItems) {
    if (!item.id || !item.type) { plan.errors.push('Cannot sync an item without id and type.'); continue; }
    const existing = remote.get(item.id);
    if (!existing) plan.create.push(item);
    else if (stableStringify(item) !== stableStringify(existing)) plan.update.push(item);
    else plan.unchanged.push(item);
  }
  return plan;
}

/** @param {unknown} value @returns {string} */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = /** @type {Record<string, unknown>} */ (value);
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
