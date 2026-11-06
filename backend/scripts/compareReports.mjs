// Deep comparison of two report captures, used by verify-recycle-bin.mjs.
//
// Every number, boolean, null, key and array length must be equal. A string may differ in exactly
// one way: after === before + ' (Deleted)' AND `before` is in the `renamed` set (the names of the
// records that were deleted forever and kept as a tombstone). Returns a list of differences, each
// { path, before, after, reason }; an empty list means "the same, apart from allowed renames".
export const TOMBSTONE_SUFFIX = ' (Deleted)';

export function compareReports(before, after, renamed = new Set(), path = '$', out = []) {
  const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
  const tb = typeOf(before);
  const ta = typeOf(after);
  if (tb !== ta) {
    out.push({ path, before, after, reason: `type changed ${tb} -> ${ta}` });
    return out;
  }
  if (tb === 'array') {
    if (before.length !== after.length) {
      out.push({ path, before: `array(${before.length})`, after: `array(${after.length})`, reason: 'array length changed' });
      return out;
    }
    before.forEach((item, i) => compareReports(item, after[i], renamed, `${path}[${i}]`, out));
    return out;
  }
  if (tb === 'object') {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const p = `${path}.${key}`;
      if (!(key in after)) out.push({ path: p, before: before[key], after: undefined, reason: 'key missing after' });
      else if (!(key in before)) out.push({ path: p, before: undefined, after: after[key], reason: 'key added after' });
      else compareReports(before[key], after[key], renamed, p, out);
    }
    return out;
  }
  if (tb === 'string') {
    if (before === after) return out;
    if (renamed.has(before) && after === before + TOMBSTONE_SUFFIX) return out;
    out.push({ path, before, after, reason: 'string changed' });
    return out;
  }
  if (!Object.is(before, after)) out.push({ path, before, after, reason: `${tb} changed` });
  return out;
}
