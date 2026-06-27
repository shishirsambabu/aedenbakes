import assert from 'node:assert/strict';
import test from 'node:test';
import { ROLE_PERMISSIONS, canAccessCustomerResource, hasAnyRole, hasPermission } from '../dist/policy.js';

test('central policy keeps high-risk permissions limited to intended roles', () => {
  assert.equal(ROLE_PERMISSIONS.owner.canSyncErp, true);
  assert.equal(ROLE_PERMISSIONS.manager.canEditOrders, true);
  assert.equal(ROLE_PERMISSIONS.accounts.canEditOrders, true);
  assert.equal(ROLE_PERMISSIONS.delivery.canCaptureReturns, true);

  assert.equal(ROLE_PERMISSIONS.production.canEditOrders, false);
  assert.equal(ROLE_PERMISSIONS.delivery.canEditOrders, false);
  assert.equal(ROLE_PERMISSIONS.customer.canEditOrders, false);
  assert.equal(ROLE_PERMISSIONS.support.canSyncErp, false);
});

test('policy helpers enforce role and customer boundaries', () => {
  assert.equal(hasAnyRole({ role: 'owner' }, ['owner', 'manager']), true);
  assert.equal(hasAnyRole({ role: 'customer' }, ['owner', 'manager']), false);
  assert.equal(hasPermission({ role: 'delivery' }, 'canCaptureReturns'), true);
  assert.equal(hasPermission({ role: 'delivery' }, 'canSyncErp'), false);

  assert.equal(canAccessCustomerResource({ role: 'customer', customerId: 'cust_a' }, 'cust_a'), true);
  assert.equal(canAccessCustomerResource({ role: 'customer', customerId: 'cust_a' }, 'cust_b'), false);
  assert.equal(canAccessCustomerResource({ role: 'support' }, 'cust_b'), true);
});
