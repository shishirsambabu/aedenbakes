import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeCutoverSnapshot, repairMissingOrderBranches, resolveLocalDatabasePath } from '../dist/cutover-rehearsal.js';

test('cutover rehearsal reports counts and totals for a clean snapshot', () => {
  const report = analyzeCutoverSnapshot(
    {
      customers: [{ id: 'cust_1', creditLimit: 1000, outstandingBalance: 250 }],
      customerBranches: [{ id: 'branch_1', customerId: 'cust_1' }],
      customerUsers: [{ id: 'user_1', customerId: 'cust_1', branchId: 'branch_1' }],
      products: [{ id: 'prod_1' }],
      capacities: [{ id: 'cap_1', productId: 'prod_1', capacity: 50, bookedQuantity: 10 }],
      slots: [{ id: 'slot_1' }],
      orders: [
        {
          id: 'order_1',
          customerId: 'cust_1',
          branchId: 'branch_1',
          slotId: 'slot_1',
          amountTotal: 200,
          items: [{ productId: 'prod_1', quantity: 2, unitPrice: 100 }],
        },
      ],
    },
    { authCounts: { authPrincipals: 1, activeAuthPrincipals: 1, authSessions: 0 }, generatedAt: '2026-06-27T00:00:00.000Z' },
  );

  assert.equal(report.gate.okToImport, true);
  assert.equal(report.counts.customers, 1);
  assert.equal(report.counts.orderLines, 1);
  assert.equal(report.totals.orderAmountTotal, 200);
  assert.equal(report.totals.orderLineComputedTotal, 200);
});

test('cutover rehearsal blocks orphaned business records and legacy auth snapshots', () => {
  const report = analyzeCutoverSnapshot({
    customers: [{ id: 'cust_1' }],
    customerBranches: [{ id: 'branch_1', customerId: 'missing_customer' }],
    products: [{ id: 'prod_1' }],
    slots: [{ id: 'slot_1' }],
    customerAuthRecords: [{ id: 'legacy_customer_login' }],
    orders: [
      {
        id: 'order_1',
        customerId: 'cust_1',
        branchId: 'missing_branch',
        slotId: 'slot_1',
        amountTotal: 100,
        items: [{ productId: 'missing_product', quantity: 1, unitPrice: 100 }],
      },
    ],
  });

  assert.equal(report.gate.okToImport, false);
  assert.ok(report.gate.blockers >= 4);
  assert.ok(report.issues.some((issue) => issue.area === 'auth'));
  assert.ok(report.issues.some((issue) => issue.message.includes('missing branch')));
  assert.ok(report.issues.some((issue) => issue.message.includes('missing product')));
});

test('cutover rehearsal refuses to read postgres as the local source database', () => {
  assert.throws(() => resolveLocalDatabasePath('postgres://user:pass@example.com/db'), /local SQLite/);
  assert.equal(resolveLocalDatabasePath('file:data/example.sqlite'), 'data/example.sqlite');
});

test('cutover repair fills missing order branches from the customer active branch', () => {
  const snapshot = {
    customerBranches: [
      { id: 'branch_paused', customerId: 'cust_1', status: 'paused' },
      { id: 'branch_active', customerId: 'cust_1', status: 'active' },
    ],
    orders: [{ id: 'order_1', customerId: 'cust_1', branchId: '' }],
  };

  const result = repairMissingOrderBranches(snapshot);
  assert.equal(result.repaired, 1);
  assert.equal(result.skipped.length, 0);
  assert.equal(snapshot.orders[0].branchId, 'branch_active');
});

test('cutover repair creates a default branch when historical orders predate branch-wise ordering', () => {
  const snapshot = {
    customers: [{ id: 'cust_1', name: 'Test Cafe', deliveryZone: 'North' }],
    customerBranches: [],
    orders: [{ id: 'order_1', customerId: 'cust_1', branchId: '' }],
  };

  const result = repairMissingOrderBranches(snapshot);
  assert.equal(result.repaired, 1);
  assert.equal(result.createdBranches, 1);
  assert.equal(snapshot.customerBranches.length, 1);
  assert.equal(snapshot.customerBranches[0].customerId, 'cust_1');
  assert.equal(snapshot.customerBranches[0].status, 'active');
  assert.equal(snapshot.orders[0].branchId, snapshot.customerBranches[0].id);
});
