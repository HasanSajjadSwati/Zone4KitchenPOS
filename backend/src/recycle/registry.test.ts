import { describe, it, expect } from 'vitest';
import { RECYCLE_TABLES } from '../constants/recycle';
import { RECYCLE_TYPES, getTypeDef, RecycleTypeDef } from './registry';

const allChecks = (d: RecycleTypeDef) => [
  ...d.history, ...d.liveDependents, ...d.openWork, ...d.binParents, ...d.binChildren,
];

describe('recycle registry', () => {
  it('defines all 12 types', () => {
    expect(Object.keys(RECYCLE_TYPES).sort()).toEqual([...RECYCLE_TABLES].sort());
    for (const [type, def] of Object.entries(RECYCLE_TYPES)) {
      expect(def.type).toBe(type);
      expect(def.table).toBe(type);
    }
  });

  it('every check has exactly one ? placeholder', () => {
    for (const def of Object.values(RECYCLE_TYPES)) {
      for (const c of allChecks(def)) {
        expect(c.sql.split('?').length - 1, `${def.type}: ${c.label}`).toBe(1);
        expect(c.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("getTypeDef('nope') is null", () => {
    expect(getTypeDef('nope')).toBeNull();
    expect(getTypeDef('menuItems')?.label).toBe('Menu item');
  });

  it('only expenses has no name column', () => {
    const none = Object.values(RECYCLE_TYPES).filter((d) => d.nameColumn === null).map((d) => d.type);
    expect(none).toEqual(['expenses']);
  });

  it('history for users covers the 13 columns listed in the plan', () => {
    const cols = new Set(
      RECYCLE_TYPES.users.history.map((c) => {
        const m = /FROM (\w+) WHERE (\w+) = \?/.exec(c.sql);
        return `${m![1]}.${m![2]}`;
      }),
    );
    expect(cols).toEqual(new Set([
      'orders.createdBy', 'orders.completedBy', 'pastOrders.createdBy', 'pastOrders.completedBy',
      'payments.receivedBy', 'pastPayments.receivedBy', 'auditLogs.userId',
      'registerSessions.openedBy', 'registerSessions.closedBy', 'expenses.createdBy',
      'kotPrints.printedBy', 'riderReceipts.printedBy', 'employeeLoans.issuedBy',
    ]));
  });

  it('binChildren mirror binParents', () => {
    expect(RECYCLE_TYPES.categories.binChildren.map((c) => c.label).sort())
      .toEqual(['deals', 'menu items', 'subcategories']);
    expect(RECYCLE_TYPES.roles.binChildren).toHaveLength(1);
    expect(RECYCLE_TYPES.users.binParents).toHaveLength(1);
  });
});
