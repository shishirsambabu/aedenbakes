import assert from 'node:assert/strict';
import test from 'node:test';
import { findCapacityViolation, findIdempotentOrderId } from '../dist/orders.js';

const DATE = '2026-07-10';

test('findCapacityViolation allows lines that fit and unconstrained products', () => {
  const capacities = [{ productId: 'p1', serviceDate: DATE, capacity: 100, bookedQuantity: 90 }];
  // Product without a capacity record is unconstrained.
  assert.equal(findCapacityViolation([{ productId: 'p2', quantity: 999 }], capacities, DATE), null);
  // Within remaining capacity (90 + 10 = 100).
  assert.equal(findCapacityViolation([{ productId: 'p1', quantity: 10 }], capacities, DATE), null);
});

test('findCapacityViolation rejects overbooking and aggregates lines per product', () => {
  const capacities = [{ productId: 'p1', serviceDate: DATE, capacity: 100, bookedQuantity: 90 }];
  // 90 + 11 > 100.
  assert.match(findCapacityViolation([{ productId: 'p1', quantity: 11 }], capacities, DATE), /Insufficient capacity/);
  // Two lines for the same product aggregate: 90 + 6 + 6 = 102 > 100.
  assert.match(
    findCapacityViolation([{ productId: 'p1', quantity: 6 }, { productId: 'p1', quantity: 6 }], capacities, DATE),
    /only 10 remaining/,
  );
});

test('findCapacityViolation is scoped to the requested service date', () => {
  const capacities = [{ productId: 'p1', serviceDate: '2026-07-09', capacity: 100, bookedQuantity: 100 }];
  // The full day is a different date, so the requested date is unconstrained.
  assert.equal(findCapacityViolation([{ productId: 'p1', quantity: 50 }], capacities, DATE), null);
});

test('findIdempotentOrderId matches only the same customer and key', () => {
  const keys = [
    { customerId: 'cust_a', key: 'k1', orderId: 'ord_1', createdAt: 'now' },
    { customerId: 'cust_b', key: 'k2', orderId: 'ord_2', createdAt: 'now' },
  ];
  assert.equal(findIdempotentOrderId(keys, 'cust_a', 'k1'), 'ord_1');
  assert.equal(findIdempotentOrderId(keys, 'cust_a', 'k2'), null); // key belongs to another customer
  assert.equal(findIdempotentOrderId(keys, 'cust_c', 'k1'), null);
  assert.equal(findIdempotentOrderId([], 'cust_a', 'k1'), null);
});
