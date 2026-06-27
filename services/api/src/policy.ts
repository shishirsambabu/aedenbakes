export type AuthRole = 'owner' | 'manager' | 'production' | 'delivery' | 'accounts' | 'support' | 'customer';

export type AuthPermission = 'canEditOrders' | 'canCaptureReturns' | 'canSyncErp';

export type SessionPolicyUser = {
  role: AuthRole;
  customerId?: string;
};

export const ROLE_PERMISSIONS: Record<AuthRole, Record<AuthPermission, boolean>> = {
  owner: { canEditOrders: true, canCaptureReturns: true, canSyncErp: true },
  manager: { canEditOrders: true, canCaptureReturns: true, canSyncErp: true },
  production: { canEditOrders: false, canCaptureReturns: false, canSyncErp: false },
  delivery: { canEditOrders: false, canCaptureReturns: true, canSyncErp: false },
  accounts: { canEditOrders: true, canCaptureReturns: false, canSyncErp: false },
  support: { canEditOrders: false, canCaptureReturns: false, canSyncErp: false },
  customer: { canEditOrders: false, canCaptureReturns: false, canSyncErp: false },
};

export function hasAnyRole(user: SessionPolicyUser, roles: readonly AuthRole[]) {
  return roles.includes(user.role);
}

export function hasPermission(user: SessionPolicyUser, permission: AuthPermission) {
  return ROLE_PERMISSIONS[user.role][permission];
}

export function canAccessCustomerResource(user: SessionPolicyUser, resourceCustomerId: string) {
  return user.role !== 'customer' || user.customerId === resourceCustomerId;
}
