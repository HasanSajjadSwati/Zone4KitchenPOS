import { describe, expect, it } from 'vitest';
import { compareReports } from './compareReports.mjs';

const base = () => [{ itemId: 'a', itemName: 'Zinger', totalSales: 1200.5, orderCount: 4 }];

describe('compareReports', () => {
  it('accepts identical trees', () => {
    expect(compareReports(base(), base())).toEqual([]);
  });
  it('accepts a name that gained (Deleted) when it is in the renamed set', () => {
    const after = base();
    after[0].itemName = 'Zinger (Deleted)';
    expect(compareReports(base(), after, new Set(['Zinger']))).toEqual([]);
  });
  it('rejects the same rename when the record was not forever-deleted', () => {
    const after = base();
    after[0].itemName = 'Zinger (Deleted)';
    const diffs = compareReports(base(), after, new Set());
    expect(diffs).toHaveLength(1);
    expect(diffs[0].path).toBe('$[0].itemName');
  });
  it('rejects any other string change', () => {
    const after = base();
    after[0].itemName = 'Zinger Burger';
    const diffs = compareReports(base(), after, new Set(['Zinger']));
    expect(diffs.map((d) => d.path)).toEqual(['$[0].itemName']);
  });
  it('rejects a number change with its path', () => {
    const after = base();
    after[0].totalSales = 1200.51;
    const diffs = compareReports(base(), after);
    expect(diffs).toEqual([{ path: '$[0].totalSales', before: 1200.5, after: 1200.51, reason: 'number changed' }]);
  });
  it('rejects a missing and an added key', () => {
    const missing = base();
    delete missing[0].orderCount;
    expect(compareReports(base(), missing)[0].reason).toBe('key missing after');
    const added = base();
    added[0].extra = 1;
    expect(compareReports(base(), added)[0].reason).toBe('key added after');
  });
  it('rejects a changed array length and a type change', () => {
    expect(compareReports(base(), [])[0].reason).toBe('array length changed');
    expect(compareReports({ a: 1 }, { a: '1' })[0].reason).toContain('type changed');
  });
});

describe('compareReports: removable zero-sales categories', () => {
  const zero = (id) => ({ categoryId: id, categoryName: id, totalSales: 0, totalQuantity: 0, orderCount: 0, averagePrice: 0 });
  const sold = (id) => ({ ...zero(id), totalSales: 5, totalQuantity: 1, orderCount: 1, averagePrice: 5 });
  const tree = (...subs) => [{ categoryId: 'm', totalSales: 5, subCategories: subs }];

  it('allows removal of an all-zero entry for a deleted category id', () => {
    expect(compareReports(tree(sold('a'), zero('b')), tree(sold('a')), new Set(), new Set(['b']))).toEqual([]);
  });
  it('rejects removal of an all-zero entry for a non-deleted id', () => {
    expect(compareReports(tree(sold('a'), zero('b')), tree(sold('a')), new Set(), new Set(['x']))).not.toEqual([]);
  });
  it('rejects removal of a deleted category entry that has sales', () => {
    expect(compareReports(tree(sold('a'), sold('b')), tree(sold('a')), new Set(), new Set(['b']))).not.toEqual([]);
  });
  it('still compares the remaining entries', () => {
    const changed = { ...sold('a'), totalSales: 6 };
    expect(compareReports(tree(sold('a'), zero('b')), tree(changed), new Set(), new Set(['b']))).toHaveLength(1);
  });
});
