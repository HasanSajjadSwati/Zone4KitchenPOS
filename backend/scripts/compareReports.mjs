// Deep comparison of two report captures, used by verify-recycle-bin.mjs.
//
// Every number, boolean, null, key and array length must be equal. A string may differ in exactly
// one way: after === before + ' (Deleted)' AND `before` is in the `renamed` set (the names of the
// records that were deleted forever and kept as a tombstone). Returns a list of differences, each
// { path, before, after, reason }; an empty list means "the same, apart from allowed renames".
export const TOMBSTONE_SUFFIX = ' (Deleted)';

// True when every number inside the value (recursively) is 0.
const allZero = (v) =>
  v === null || v === undefined ? true
    : typeof v === 'number' ? v === 0
      : Array.isArray(v) ? v.every(allZero)
        : typeof v === 'object' ? Object.values(v).every(allZero)
          : true;

// One more allowed difference (ruling 10): an array element that is a category (has `categoryId`)
// in `removableIds`, with every number 0, may be absent from `after` (a deleted category with no
// sales leaves the detailed tree). Matched by categoryId, never by index.
function dropRemovable(before, after, removableIds) {
  if (removableIds.size === 0 || before.length <= after.length) return before;
  const afterIds = new Set(after.filter((e) => e && typeof e === 'object').map((e) => e.categoryId));
  return before.filter((e) => !(e && typeof e === 'object' && removableIds.has(e.categoryId) && !afterIds.has(e.categoryId) && allZero(e)));
}

export function compareReports(before, after, renamed = new Set(), removableIds = new Set(), path = '$', out = []) {
  const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
  const tb = typeOf(before);
  const ta = typeOf(after);
  if (tb !== ta) {
    out.push({ path, before, after, reason: `type changed ${tb} -> ${ta}` });
    return out;
  }
  if (tb === 'array') {
    before = dropRemovable(before, after, removableIds);
    if (before.length !== after.length) {
      out.push({ path, before: `array(${before.length})`, after: `array(${after.length})`, reason: 'array length changed' });
      return out;
    }
    before.forEach((item, i) => compareReports(item, after[i], renamed, removableIds, `${path}[${i}]`, out));
    return out;
  }
  if (tb === 'object') {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const p = `${path}.${key}`;
      if (!(key in after)) out.push({ path: p, before: before[key], after: undefined, reason: 'key missing after' });
      else if (!(key in before)) out.push({ path: p, before: undefined, after: after[key], reason: 'key added after' });
      else compareReports(before[key], after[key], renamed, removableIds, p, out);
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
