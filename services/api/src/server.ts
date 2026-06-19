import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  capacities,
  customers,
  orders,
  productionBatches,
  products,
  slots,
} from './data.js';
import type {
  AuditEvent,
  CustomerAccount,
  Customer360Response,
  CustomerDashboardResponse,
  CustomerNote,
  CustomerTimelineEvent,
  CustomerOnboardingRequest,
  CustomerOrderCreateRequest,
  CustomerPortalAuthRecord,
  CustomerServiceabilityCapacity,
  CustomerServiceabilitySlot,
  CustomerServiceabilitySummary,
  ErpSyncStatus,
  DeliverySlot,
  Order,
  OrderStatus,
  PaymentMode,
  Product,
  ProductDayCapacity,
  ProductionBatchLine,
  SupportCase,
  VasyErpContractPreview,
  VasyErpPushResult,
} from '@aeden-bakes/shared';

const app = express();
app.use(
  cors({
    origin: true,
  }),
);
app.use(express.json());

type AuthRole = 'owner' | 'manager' | 'production' | 'delivery' | 'accounts' | 'support' | 'customer';

type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  role: AuthRole;
  customerId?: string;
};

type AuthRecord = SessionUser & {
  password: string;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
  loginId?: string;
  phone?: string;
  defaultAddress?: string;
  deliveryZone?: string;
};

type Session = {
  token: string;
  user: SessionUser;
  createdAt: string;
  expiresAt: string;
};

type ApprovalAction = 'order_adjustment' | 'return_capture';

type ApprovalRequest = {
  id: string;
  action: ApprovalAction;
  targetId: string;
  payload: {
    productId?: string;
    quantityDelta?: number;
    quantity?: number;
    actor: string;
    note: string;
  };
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
};

type DeliveryWritebackAction = 'pod_completed' | 'delivery_failed' | 'return_captured';

type DeliveryWritebackEvent = {
  eventId: string;
  orderId: string;
  slotId: string;
  action: DeliveryWritebackAction;
  note: string;
  capturedAt: string;
};

type ApiStateSnapshot = {
  customers: typeof customers;
  customerAuthRecords: AuthRecord[];
  customerNotes: CustomerNote[];
  supportCases: SupportCase[];
  products: typeof products;
  capacities: typeof capacities;
  slots: typeof slots;
  orders: typeof orders;
  productionBatches: typeof productionBatches;
  auditEvents: AuditEvent[];
  erpSyncStatus: ErpSyncStatus;
  sessions: Session[];
  approvals: ApprovalRequest[];
  deliveryEventIds: string[];
};

const authUsers: AuthRecord[] = [
  { id: 'user_owner', username: 'owner', displayName: 'Owner', role: 'owner', password: 'owner123' },
  { id: 'user_manager', username: 'manager', displayName: 'Manager', role: 'manager', password: 'manager123' },
  { id: 'user_production', username: 'production', displayName: 'Production Lead', role: 'production', password: 'production123' },
  { id: 'user_delivery', username: 'delivery', displayName: 'Delivery Lead', role: 'delivery', password: 'delivery123' },
  { id: 'user_accounts', username: 'accounts', displayName: 'Accounts Lead', role: 'accounts', password: 'accounts123' },
  { id: 'user_support', username: 'support', displayName: 'Support Lead', role: 'support', password: 'support123' },
];

let customerAuthRecords: AuthRecord[] = [
  {
    id: 'cust_auth_cafe_nook',
    username: '9000000001',
    loginId: '9000000001',
    displayName: 'Cafe Nook',
    role: 'customer',
    password: 'nook123',
    customerId: 'cust_cafe_nook',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    phone: '9000000001',
    defaultAddress: 'Cafe Nook, North Industrial Estate',
    deliveryZone: 'North',
  },
  {
    id: 'cust_auth_hotel_lotus',
    username: '9000000002',
    loginId: '9000000002',
    displayName: 'Hotel Lotus',
    role: 'customer',
    password: 'lotus123',
    customerId: 'cust_hotel_lotus',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    phone: '9000000002',
    defaultAddress: 'Hotel Lotus, Central Market Road',
    deliveryZone: 'Central',
  },
];

const stateFilePath = join(process.cwd(), 'data', 'api-state.json');
const sessions = new Map<string, Session>();
let auditEvents: AuditEvent[] = [];
let approvals: ApprovalRequest[] = [];
let customerNotes: CustomerNote[] = [
  {
    id: 'note_cafe_nook_1',
    customerId: 'cust_cafe_nook',
    noteType: 'support',
    note: 'Prefers morning drops before 8:00 AM.',
    createdBy: 'support',
    createdAt: '2026-06-19T08:10:00+05:30',
  },
  {
    id: 'note_hotel_lotus_1',
    customerId: 'cust_hotel_lotus',
    noteType: 'accounts',
    note: 'Watch for part-pay requests during month end.',
    createdBy: 'accounts',
    createdAt: '2026-06-19T08:12:00+05:30',
  },
];
let supportCases: SupportCase[] = [
  {
    id: 'case_cafe_nook_1',
    customerId: 'cust_cafe_nook',
    orderId: 'AB-1041',
    status: 'investigating',
    priority: 'medium',
    subject: 'Confirm tomorrow morning drop and loaf count',
    openedBy: 'support',
    assignedTo: 'support',
    createdAt: '2026-06-19T08:00:00+05:30',
    closedAt: null,
    lastUpdatedAt: '2026-06-19T08:10:00+05:30',
  },
];
const processedDeliveryEventIds = new Set<string>();
let erpSyncStatus: ErpSyncStatus = {
  provider: 'vasy',
  state: 'healthy',
  lastAttemptAt: new Date().toISOString(),
  lastSuccessAt: new Date().toISOString(),
  pendingCount: 1,
  failedCount: 0,
};
await loadState();
rebuildOperationalState();
await persistState();

const rolePermissions: Record<
  AuthRole,
  {
    canEditOrders: boolean;
    canCaptureReturns: boolean;
    canSyncErp: boolean;
  }
> = {
  owner: { canEditOrders: true, canCaptureReturns: true, canSyncErp: true },
  manager: { canEditOrders: true, canCaptureReturns: true, canSyncErp: true },
  production: { canEditOrders: false, canCaptureReturns: false, canSyncErp: false },
  delivery: { canEditOrders: false, canCaptureReturns: true, canSyncErp: false },
  accounts: { canEditOrders: true, canCaptureReturns: false, canSyncErp: false },
  support: { canEditOrders: false, canCaptureReturns: false, canSyncErp: false },
  customer: { canEditOrders: false, canCaptureReturns: false, canSyncErp: false },
};

function findAuthRecord(username: string, password: string) {
  const staffRecord = authUsers.find(
    (entry) => entry.username === username && entry.password === password && entry.active !== false,
  );
  if (staffRecord) {
    return staffRecord;
  }

  return customerAuthRecords.find(
    (entry) => entry.loginId === username && entry.password === password && entry.active !== false,
  );
}

function toSessionUser(record: AuthRecord): SessionUser {
  return {
    id: record.id,
    username: record.username,
    displayName: record.displayName,
    role: record.role,
    customerId: record.customerId,
  };
}

function issueSession(user: SessionUser) {
  const token = crypto.randomUUID();
  const session: Session = {
    token,
    user,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString(),
  };
  sessions.set(token, session);
  return session;
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'aeden-bakes-api',
    persistence: 'json',
    sessions: sessions.size,
  });
});

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }

  const record = findAuthRecord(username, password);
  if (!record) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const session = issueSession(toSessionUser(record));
  persistStateSoon();

  res.json({
    token: session.token,
    user: {
      id: session.user.id,
      username: session.user.username,
      displayName: session.user.displayName,
      role: session.user.role,
      customerId: session.user.customerId,
    },
  });
});

app.post('/auth/logout', authenticate, (req, res) => {
  const token = getToken(req);
  if (token) {
    sessions.delete(token);
    persistStateSoon();
  }

  res.json({ ok: true });
});

app.get('/auth/me', authenticate, (req, res) => {
  const session = req.session!;
  res.json({
    user: {
      id: session.user.id,
      username: session.user.username,
      displayName: session.user.displayName,
      role: session.user.role,
      customerId: session.user.customerId,
    },
    permissions: rolePermissions[session.user.role],
    expiresAt: session.expiresAt,
  });
});

app.post('/customer/onboard', (req, res) => {
  const input = req.body as Partial<CustomerOnboardingRequest>;
  const name = input.name?.trim();
  const deliveryZone = input.deliveryZone?.trim();
  const loginId = input.loginId?.trim();
  const password = input.password?.trim();
  const defaultAddress = input.defaultAddress?.trim();

  if (!name || !deliveryZone || !loginId || !password || !defaultAddress) {
    res.status(400).json({ error: 'name, deliveryZone, loginId, password, and defaultAddress are required' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'password must be at least 6 characters long' });
    return;
  }

  const existingAuthByLogin = customerAuthRecords.find(
    (entry) => entry.username === loginId && entry.active !== false,
  );
  const requestedCustomerId = input.customerId?.trim();
  const existingCustomerById = requestedCustomerId
    ? customers.find((entry) => entry.id === requestedCustomerId)
    : undefined;

  if (existingAuthByLogin || existingCustomerById) {
    res.status(409).json({
      error: 'Customer onboarding requires a new loginId and customer record',
    });
    return;
  }

  const customer: CustomerAccount = {
    id: requestedCustomerId || `cust_${crypto.randomUUID().slice(0, 8)}`,
    name,
    tier: input.tier?.trim() || 'Tier C',
    creditLimit: Number.isFinite(input.creditLimit) ? Math.max(0, Number(input.creditLimit)) : 0,
    outstandingBalance: 0,
    riskState: 'healthy',
    deliveryZone,
  };
  refreshCustomerRisk(customer);

  customers.unshift(customer);

  const now = new Date().toISOString();
  const authRecord: AuthRecord = {
    id: `cust_auth_${crypto.randomUUID()}`,
    username: loginId,
    loginId,
    displayName: name,
    role: 'customer',
    password,
    customerId: customer.id,
    active: true,
    createdAt: now,
    updatedAt: now,
    phone: loginId,
    defaultAddress,
    deliveryZone,
  };
  customerAuthRecords.unshift(authRecord);

  const session = issueSession(toSessionUser(authRecord));
  recordAudit({
    kind: 'customer_onboarded',
    actor: loginId,
    summary: `Created customer portal profile for ${customer.id}.`,
    referenceId: customer.id,
  });
  rebuildOperationalState();
  persistStateSoon();

  res.status(201).json({
    token: session.token,
    user: {
      id: session.user.id,
      username: session.user.username,
      displayName: session.user.displayName,
      role: session.user.role,
      customerId: session.user.customerId,
    },
    dashboard: buildCustomerDashboard(customer.id),
  });
});

app.get('/customer/dashboard', authenticate, requireAnyRole(['customer']), (req, res) => {
  const customerId = req.session?.user.customerId;
  if (!customerId) {
    res.status(400).json({ error: 'Customer session is missing a customer link' });
    return;
  }

  res.json(buildCustomerDashboard(customerId));
});

app.get('/customer/orders', authenticate, requireAnyRole(['customer']), (req, res) => {
  const customerId = req.session?.user.customerId;
  if (!customerId) {
    res.status(400).json({ error: 'Customer session is missing a customer link' });
    return;
  }

  res.json({
    orders: orders.filter((entry) => entry.customerId === customerId),
  });
});

app.post('/customer/orders', authenticate, requireAnyRole(['customer']), (req, res) => {
  const customerId = req.session?.user.customerId;
  if (!customerId) {
    res.status(400).json({ error: 'Customer session is missing a customer link' });
    return;
  }

  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer) {
    res.status(404).json({ error: 'Customer account not found' });
    return;
  }

  const attemptId = `cust_order_attempt_${crypto.randomUUID()}`;
  const body = req.body as Partial<CustomerOrderCreateRequest>;
  const serviceDate = body.serviceDate?.trim() || getDefaultServiceDate(customer);
  const slotId = body.slotId?.trim();
  const paymentMode = body.paymentMode ?? 'prepaid';
  const items = Array.isArray(body.items) ? body.items : [];

  const validationError = validateCustomerOrderDraft(customer, {
    serviceDate,
    slotId,
    paymentMode,
    items,
  });
  if (validationError) {
    recordCustomerOrderRejection(customer, attemptId, validationError);
    persistStateSoon();
    res.status(400).json({ error: validationError });
    return;
  }

  const slot = slots.find((entry) => entry.id === slotId)!;
  const resolvedSlotId = slot.id;
  const orderItems = items.map((item) => {
    const product = products.find((entry) => entry.id === item.productId)!;
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: product.unitPrice,
    };
  });
  const amountTotal = recalculateItemsTotal(orderItems);
  const exposureAmount = paymentMode === 'credit' ? amountTotal : paymentMode === 'part-pay' ? Math.ceil(amountTotal / 2) : 0;

  if (paymentMode !== 'prepaid' && customer.outstandingBalance + exposureAmount > customer.creditLimit) {
    const reason = `Credit limit guardrail blocked this order. Exposure of Rs. ${exposureAmount} would raise the balance to Rs. ${customer.outstandingBalance + exposureAmount}, above the limit of Rs. ${customer.creditLimit}.`;
    recordCustomerOrderRejection(customer, attemptId, reason);
    persistStateSoon();
    res.status(400).json({ error: reason });
    return;
  }

  const order = {
    id: `ord_${crypto.randomUUID()}`,
    customerId: customer.id,
    serviceDate,
    slotId: resolvedSlotId,
    paymentMode,
    status: 'confirmed' as OrderStatus,
    source: 'customer_app' as const,
    amountTotal,
    createdAt: new Date().toISOString(),
    items: orderItems,
  };

  orders.unshift(order);
  if (exposureAmount > 0) {
    customer.outstandingBalance += exposureAmount;
    refreshCustomerRisk(customer);
  }
  recordAudit({
    kind: 'customer_order_placed',
    actor: req.session!.user.username,
    summary: `Placed customer order ${order.id} for ${customer.id} on ${serviceDate} in ${resolvedSlotId}.`,
    referenceId: order.id,
  });
  rebuildOperationalState();
  persistStateSoon();

  res.status(201).json({
    order,
    dashboard: buildCustomerDashboard(customer.id),
  });
});

app.get('/catalog', (_req, res) => {
  res.json({ products, capacities, slots });
});

app.get('/customers', (_req, res) => {
  res.json({ customers });
});

app.get('/customers/:id', (req, res) => {
  const customerId = readRouteParam(req.params.id);
  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  res.json({
    customer,
    orders: orders.filter((entry) => entry.customerId === customer.id),
    productionBatches,
  });
});

app.get('/customers/:id/360', authenticate, requireAnyRole(['owner', 'manager', 'support', 'accounts']), (req, res) => {
  const customerId = readRouteParam(req.params.id);
  const snapshot = buildCustomer360(customerId);
  res.json(snapshot);
});

app.get('/support/cases', authenticate, requireAnyRole(['owner', 'manager', 'support', 'accounts']), (_req, res) => {
  res.json({
    supportCases,
  });
});

app.post('/support/cases', authenticate, requireAnyRole(['owner', 'manager', 'support']), (req, res) => {
  const { customerId, orderId, subject, priority = 'medium', assignedTo = req.session?.user.role ?? 'support' } = req.body as {
    customerId?: string;
    orderId?: string;
    subject?: string;
    priority?: SupportCase['priority'];
    assignedTo?: string;
  };

  if (!customerId || !subject?.trim()) {
    res.status(400).json({ error: 'customerId and subject are required' });
    return;
  }

  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  const now = new Date().toISOString();
  const supportCase: SupportCase = {
    id: `case_${crypto.randomUUID()}`,
    customerId,
    orderId: orderId?.trim() || undefined,
    status: 'open',
    priority: priority ?? 'medium',
    subject: subject.trim(),
    openedBy: req.session?.user.role ?? 'support',
    assignedTo: assignedTo ?? null,
    createdAt: now,
    closedAt: null,
    lastUpdatedAt: now,
  };

  supportCases.unshift(supportCase);
  recordAudit({
    kind: 'support_case_opened',
    actor: req.session?.user.role ?? 'support',
    summary: `Opened support case ${supportCase.id} for ${customerId}. ${supportCase.subject}`,
    referenceId: supportCase.id,
  });
  persistStateSoon();

  res.status(201).json({ supportCase, supportCases, customer: buildCustomer360(customerId) });
});

app.post('/support/cases/:id/transition', authenticate, requireAnyRole(['owner', 'manager', 'support']), (req, res) => {
  const id = readRouteParam(req.params.id);
  const { status, note } = req.body as { status?: SupportCase['status']; note?: string };
  const supportCase = supportCases.find((entry) => entry.id === id);
  if (!supportCase) {
    res.status(404).json({ error: 'Support case not found' });
    return;
  }

  const allowedTransitions: Record<SupportCase['status'], SupportCase['status'][]> = {
    open: ['investigating', 'waiting_customer', 'waiting_internal', 'resolved', 'escalated', 'closed'],
    investigating: ['waiting_customer', 'waiting_internal', 'resolved', 'escalated', 'closed'],
    waiting_customer: ['investigating', 'resolved', 'closed', 'escalated'],
    waiting_internal: ['investigating', 'resolved', 'closed', 'escalated'],
    resolved: ['closed', 'investigating'],
    closed: [],
    escalated: ['investigating', 'resolved', 'closed'],
  };

  if (!status || !allowedTransitions[supportCase.status].includes(status)) {
    res.status(400).json({ error: `Cannot move support case from ${supportCase.status} to ${status ?? 'unknown'}` });
    return;
  }

  supportCase.status = status;
  supportCase.lastUpdatedAt = new Date().toISOString();
  if (status === 'closed') {
    supportCase.closedAt = supportCase.closedAt ?? supportCase.lastUpdatedAt;
  }
  recordAudit({
    kind: 'support_case_updated',
    actor: req.session?.user.role ?? 'support',
    summary: `Support case ${supportCase.id} moved to ${status}. ${note ?? ''}`.trim(),
    referenceId: supportCase.id,
  });
  persistStateSoon();

  res.json({ supportCase, supportCases, customer: buildCustomer360(supportCase.customerId) });
});

app.post('/customers/:id/notes', authenticate, requireAnyRole(['owner', 'manager', 'support', 'accounts']), (req, res) => {
  const id = readRouteParam(req.params.id);
  const { note, noteType = 'general' } = req.body as { note?: string; noteType?: CustomerNote['noteType'] };
  const customer = customers.find((entry) => entry.id === id);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  if (!note?.trim()) {
    res.status(400).json({ error: 'note is required' });
    return;
  }

  const customerNote: CustomerNote = {
    id: `note_${crypto.randomUUID()}`,
    customerId: id,
    noteType,
    note: note.trim(),
    createdBy: req.session?.user.role ?? 'support',
    createdAt: new Date().toISOString(),
  };
  customerNotes.unshift(customerNote);
  recordAudit({
    kind: 'customer_note_added',
    actor: req.session?.user.role ?? 'support',
    summary: `Added customer note for ${id}. ${customerNote.note}`,
    referenceId: customerNote.id,
  });
  persistStateSoon();

  res.status(201).json({ note: customerNote, customer: buildCustomer360(id) });
});

app.get('/orders', (_req, res) => {
  res.json({ orders });
});

app.get('/production/batches', (_req, res) => {
  res.json({ productionBatches });
});

app.post('/production/batches/:id/lock', authenticate, requireAnyRole(['owner', 'manager', 'production']), (req, res) => {
  updateBatchStatus(req, res, 'locked', 'batch_locked', 'Locked production batch.');
});

app.post('/production/batches/:id/start', authenticate, requireAnyRole(['owner', 'manager', 'production']), (req, res) => {
  updateBatchStatus(req, res, 'in_progress', 'batch_started', 'Started production batch.');
});

app.post('/production/batches/:id/complete', authenticate, requireAnyRole(['owner', 'manager', 'production']), (req, res) => {
  updateBatchStatus(req, res, 'completed', 'batch_completed', 'Completed production batch.');
});

app.post('/production/batches/:id/unlock', authenticate, requireAnyRole(['owner', 'manager']), (req, res) => {
  updateBatchStatus(req, res, 'draft', 'batch_unlocked', 'Unlocked production batch.');
});

app.get('/delivery/manifest', (_req, res) => {
  res.json({
    routes: slots.map((slot) => ({
      slotId: slot.id,
      label: slot.label,
      zone: slot.zone,
      orderCount: orders.filter((order) => order.slotId === slot.id).length,
      completedOrders: orders.filter((order) => order.slotId === slot.id && order.status === 'delivered').length,
      failedOrders: orders.filter((order) => order.slotId === slot.id && order.status === 'failed_delivery').length,
    })),
  });
});

app.post('/delivery/writeback', authenticate, requireAnyRole(['owner', 'manager', 'delivery']), (req, res) => {
  const { events } = req.body as { events?: DeliveryWritebackEvent[] };

  if (!Array.isArray(events) || events.length === 0) {
    res.status(400).json({ error: 'events array is required' });
    return;
  }

  const result = {
    accepted: 0,
    rejected: 0,
    duplicates: 0,
  };
  const acceptedEventIds: string[] = [];
  const rejectedEventIds: string[] = [];
  const duplicateEventIds: string[] = [];

  for (const event of events) {
    if (
      !event ||
      typeof event.eventId !== 'string' ||
      typeof event.orderId !== 'string' ||
      typeof event.slotId !== 'string' ||
      typeof event.action !== 'string' ||
      typeof event.note !== 'string'
    ) {
      result.rejected += 1;
      rejectedEventIds.push(event?.eventId ?? `invalid_${result.rejected}`);
      continue;
    }

    if (processedDeliveryEventIds.has(event.eventId)) {
      result.duplicates += 1;
      duplicateEventIds.push(event.eventId);
      continue;
    }

    const order = orders.find((entry) => entry.id === event.orderId);
    if (!order || order.slotId !== event.slotId) {
      result.rejected += 1;
      continue;
    }

    processedDeliveryEventIds.add(event.eventId);
    acceptedEventIds.push(event.eventId);

    if (event.action === 'pod_completed') {
      order.status = 'delivered';
      recordAudit({
        kind: 'delivery_pod_completed',
        actor: 'delivery',
        summary: `POD completed for ${order.id}. ${event.note}`.trim(),
        referenceId: order.id,
      });
    } else if (event.action === 'delivery_failed') {
      order.status = 'failed_delivery';
      recordAudit({
        kind: 'delivery_failed',
        actor: 'delivery',
        summary: `Delivery failed for ${order.id}. ${event.note}`.trim(),
        referenceId: order.id,
      });
    } else {
      order.status = 'partial_delivery';
      recordAudit({
        kind: 'delivery_returned',
        actor: 'delivery',
        summary: `Return captured for ${order.id}. ${event.note}`.trim(),
        referenceId: order.id,
      });
    }

    result.accepted += 1;
  }

  rebuildOperationalState();
  persistStateSoon();

  res.json({
    ...result,
    total: events.length,
    acceptedEventIds,
    rejectedEventIds,
    duplicateEventIds,
    orders,
  });
});

app.get('/admin/operations', authenticate, requireAnyRole(['owner', 'manager', 'accounts', 'support']), (_req, res) => {
  res.json({
    auditEvents,
    erpSyncStatus,
    approvals,
  });
});

app.post('/admin/approvals/:id/decide', authenticate, requireAnyRole(['owner', 'manager']), (req, res) => {
  const { id } = req.params;
  const { decision = 'approve', actor = 'owner' } = req.body as {
    decision?: 'approve' | 'reject';
    actor?: string;
  };

  const approval = approvals.find((entry) => entry.id === id);
  if (!approval) {
    res.status(404).json({ error: 'Approval request not found' });
    return;
  }

  if (approval.status !== 'pending') {
    res.status(400).json({ error: 'Approval request already resolved' });
    return;
  }

  approval.status = decision === 'approve' ? 'approved' : 'rejected';
  approval.decidedAt = new Date().toISOString();
  approval.decidedBy = actor;

  if (decision === 'approve') {
    applyApproval(approval);
    recordAudit({
      kind: 'approval_approved',
      actor,
      summary: `Approved ${approval.action} for ${approval.targetId}. ${approval.reason}`.trim(),
      referenceId: approval.targetId,
    });
  } else {
    recordAudit({
      kind: 'approval_rejected',
      actor,
      summary: `Rejected ${approval.action} for ${approval.targetId}. ${approval.reason}`.trim(),
      referenceId: approval.targetId,
    });
  }

  rebuildOperationalState();
  persistStateSoon();

  res.json({ approval, approvals, auditEvents, erpSyncStatus });
});

app.post('/admin/orders/:id/adjust', authenticate, requirePermission('canEditOrders'), (req, res) => {
  const { id } = req.params;
  const { actor = 'manager', note = '', productId, quantityDelta } = req.body as {
    actor?: string;
    note?: string;
    productId?: string;
    quantityDelta?: number;
  };

  if (
    !productId ||
    typeof quantityDelta !== 'number' ||
    !Number.isInteger(quantityDelta) ||
    quantityDelta === 0
  ) {
    res.status(400).json({ error: 'productId and non-zero integer quantityDelta are required' });
    return;
  }

  const safeQuantityDelta = quantityDelta as number;
  const order = orders.find((entry) => entry.id === id);

  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  const item = order.items.find((entry) => entry.productId === productId);
  if (!item) {
    res.status(404).json({ error: 'Order item not found' });
    return;
  }

  const itemImpact = Math.abs(safeQuantityDelta) * item.unitPrice;
  const requiresApproval = Math.abs(safeQuantityDelta) >= 3 || itemImpact >= 500;

  if (requiresApproval) {
    if (note.trim().length < 10) {
      res.status(400).json({ error: 'Approval requests require a note of at least 10 characters' });
      return;
    }

    const approval = queueApproval({
      action: 'order_adjustment',
      targetId: order.id,
      payload: {
        actor,
        note,
        productId,
        quantityDelta: safeQuantityDelta,
      },
      requestedBy: actor,
      reason: `Adjustment of ${safeQuantityDelta} units on ${item.productId} changes the order by Rs. ${itemImpact}.`,
    });
    persistStateSoon();
    res.status(202).json({ approval, approvals, auditEvents, erpSyncStatus });
    return;
  }

  const nextQuantity = item.quantity + safeQuantityDelta;
  if (nextQuantity <= 0) {
    res.status(400).json({ error: 'Adjusted item quantity must stay above zero' });
    return;
  }

  item.quantity = nextQuantity;
  order.amountTotal = recalculateOrderTotal(order);
  recordAudit({
    kind: 'order_adjusted',
    actor,
    summary: `Adjusted ${productId} on ${order.id} by ${safeQuantityDelta}. ${note}`.trim(),
    referenceId: order.id,
  });
  rebuildOperationalState();
  persistStateSoon();

  res.json({ order, auditEvents, erpSyncStatus });
});

app.post('/admin/orders/:id/returns', authenticate, requirePermission('canCaptureReturns'), (req, res) => {
  const { id } = req.params;
  const { actor = 'delivery', note = '', quantity } = req.body as {
    actor?: string;
    note?: string;
    quantity?: number;
  };

  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
    res.status(400).json({ error: 'quantity must be a positive integer' });
    return;
  }

  const safeQuantity = quantity as number;
  const order = orders.find((entry) => entry.id === id);

  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const requiresApproval = safeQuantity >= 2 || safeQuantity >= Math.ceil(totalUnits * 0.25);

  if (requiresApproval) {
    if (note.trim().length < 10) {
      res.status(400).json({ error: 'Approval requests require a note of at least 10 characters' });
      return;
    }

    const approval = queueApproval({
      action: 'return_capture',
      targetId: order.id,
      payload: {
        actor,
        note,
        quantity: safeQuantity,
      },
      requestedBy: actor,
      reason: `Return capture of ${safeQuantity} units on order ${order.id} affects ${Math.round((safeQuantity / totalUnits) * 100)}% of the ticket.`,
    });
    persistStateSoon();
    res.status(202).json({ approval, approvals, auditEvents, erpSyncStatus });
    return;
  }

  const nextStatus: OrderStatus = safeQuantity >= totalUnits ? 'failed_delivery' : 'partial_delivery';
  order.status = nextStatus;

  recordAudit({
    kind: 'return_captured',
    actor,
    summary: `Captured return for ${order.id} with ${safeQuantity} units. ${note}`.trim(),
    referenceId: order.id,
  });
  rebuildOperationalState();
  persistStateSoon();

  res.json({ order, auditEvents, erpSyncStatus });
});

app.post('/erp/sync/trigger', authenticate, requirePermission('canSyncErp'), (req, res) => {
  const { actor = 'system' } = req.body as { actor?: string };
  const now = new Date().toISOString();

  erpSyncStatus.lastAttemptAt = now;
  erpSyncStatus.pendingCount = Math.max(0, erpSyncStatus.pendingCount - 1);
  erpSyncStatus.failedCount = 0;
  erpSyncStatus.state = 'healthy';
  recordAudit({
    kind: 'erp_sync_triggered',
    actor,
    summary: 'Triggered a Vasy ERP sync run.',
    referenceId: 'vasy',
  });
  recordAudit({
    kind: 'erp_sync_completed',
    actor,
    summary: 'Vasy ERP sync completed successfully.',
    referenceId: 'vasy',
  });
  erpSyncStatus.lastSuccessAt = now;
  persistStateSoon();

  res.json({ erpSyncStatus, auditEvents });
});

app.get('/erp/vasy/contract', authenticate, requirePermission('canSyncErp'), (_req, res) => {
  res.json(buildVasyContractPreview());
});

app.post('/erp/vasy/push', authenticate, requirePermission('canSyncErp'), (req, res) => {
  const { entries } = req.body as {
    entries?: Array<{
      orderId?: string;
      status?: string;
    }>;
  };

  const accepted = entries?.filter((entry) => typeof entry.orderId === 'string' && typeof entry.status === 'string').length ?? 0;
  const rejected = Math.max(0, (entries?.length ?? 0) - accepted);

  const result: VasyErpPushResult = {
    provider: 'vasy',
    accepted,
    rejected,
    message: accepted > 0 ? 'Vasy payload accepted.' : 'No valid payload rows were provided.',
    receivedAt: new Date().toISOString(),
  };

  recordAudit({
    kind: 'erp_sync_triggered',
    actor: 'system',
    summary: `Vasy push received with ${accepted} accepted and ${rejected} rejected rows.`,
    referenceId: 'vasy',
  });
  persistStateSoon();

  res.json(result);
});

const port = Number(process.env.PORT ?? 4000);
await persistState();

app.listen(port, () => {
  console.log(`Aeden Bakes API listening on http://localhost:${port}`);
});

function recordAudit(entry: Omit<AuditEvent, 'id' | 'createdAt'>) {
  auditEvents.unshift({
    id: `audit_${auditEvents.length + 1}`,
    createdAt: new Date().toISOString(),
    ...entry,
  });
}

function queueApproval(input: Omit<ApprovalRequest, 'id' | 'status' | 'createdAt' | 'decidedAt' | 'decidedBy'>) {
  const approval: ApprovalRequest = {
    id: `apr_${crypto.randomUUID()}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
    decidedAt: null,
    decidedBy: null,
    ...input,
  };

  approvals.unshift(approval);
  recordAudit({
    kind: 'approval_queued',
    actor: input.payload.actor,
    summary: `Queued approval ${approval.id} for ${approval.action} on ${approval.targetId}. ${approval.reason}`.trim(),
    referenceId: approval.id,
  });
  return approval;
}

function applyApproval(approval: ApprovalRequest) {
  if (approval.action === 'order_adjustment') {
    const order = orders.find((entry) => entry.id === approval.targetId);
    if (!order || approval.payload.quantityDelta == null || !approval.payload.productId) {
      return;
    }

    const item = order.items.find((entry) => entry.productId === approval.payload.productId);
    if (!item) {
      return;
    }

    item.quantity += approval.payload.quantityDelta;
    order.amountTotal = recalculateOrderTotal(order);
    return;
  }

  if (approval.action === 'return_capture') {
    const order = orders.find((entry) => entry.id === approval.targetId);
    if (!order || approval.payload.quantity == null) {
      return;
    }

    const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
    order.status = approval.payload.quantity >= totalUnits ? 'failed_delivery' : 'partial_delivery';
  }
}

function updateBatchStatus(
  req: express.Request,
  res: express.Response,
  nextStatus: (typeof productionBatches)[number]['status'],
  auditKind: 'batch_locked' | 'batch_started' | 'batch_completed' | 'batch_unlocked',
  summaryText: string,
) {
  const { id } = req.params;
  const batch = productionBatches.find((entry) => entry.id === id);
  if (!batch) {
    res.status(404).json({ error: 'Production batch not found' });
    return;
  }

  const currentStatus = batch.status;
  const allowedTransitions: Record<typeof batch.status, Array<typeof batch.status>> = {
    draft: ['locked'],
    locked: ['in_progress', 'draft'],
    in_progress: ['completed'],
    completed: [],
  };

  if (!allowedTransitions[currentStatus].includes(nextStatus)) {
    res.status(400).json({
      error: `Cannot move batch from ${currentStatus} to ${nextStatus}`,
    });
    return;
  }

  batch.status = nextStatus;
  const now = new Date().toISOString();
  if (nextStatus === 'locked') {
    batch.generatedAt = batch.generatedAt ?? now;
    batch.lockedAt = now;
  }
  if (nextStatus === 'in_progress') {
    batch.generatedAt = batch.generatedAt ?? now;
  }
  if (nextStatus === 'completed') {
    batch.completedAt = now;
  }
  if (nextStatus === 'draft') {
    batch.lines = buildProductionBatchLines(batch.serviceDate);
    batch.generatedAt = now;
    batch.lockedAt = undefined;
    batch.completedAt = undefined;
  }
  recordAudit({
    kind: auditKind,
    actor: req.session?.user.role ?? 'system',
    summary: `${summaryText} ${batch.id}`.trim(),
    referenceId: batch.id,
  });
  persistStateSoon();
  res.json({ batch, productionBatches });
}

function buildVasyContractPreview(): VasyErpContractPreview {
  return {
    provider: 'vasy',
    exportedAt: new Date().toISOString(),
    orderCount: orders.length,
    batchCount: productionBatches.length,
    orders: orders.map((order) => ({
      orderId: order.id,
      customerCode: order.customerId,
      serviceDate: order.serviceDate,
      deliverySlotCode: order.slotId,
      paymentMode: order.paymentMode,
      status: order.status,
      totalAmount: order.amountTotal,
      lines: order.items.map((item) => {
        const product = products.find((entry) => entry.id === item.productId);
        return {
          sku: item.productId,
          name: product?.name ?? item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.quantity * item.unitPrice,
        };
      }),
    })),
    batches: productionBatches.map((batch) => ({
      batchId: batch.id,
      serviceDate: batch.serviceDate,
      status: batch.status,
      lines: batch.lines.map((line) => ({
        sku: line.productId,
        deliverySlotCode: line.slotId,
        quantity: line.actualQuantity ?? line.plannedQuantity ?? line.quantity,
      })),
    })),
  };
}

function buildCustomerDashboard(customerId: string): CustomerDashboardResponse {
  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer) {
    throw new Error(`Customer ${customerId} not found`);
  }

  const auth = customerAuthRecords.find((entry) => entry.customerId === customer.id && entry.active !== false);
  if (!auth) {
    throw new Error(`Customer auth record for ${customerId} not found`);
  }

  const defaultServiceDate = getDefaultServiceDate(customer);
  return {
    customer,
    auth: {
      id: auth.id,
      customerId: auth.customerId ?? customer.id,
      loginId: auth.username,
      displayName: auth.displayName,
      active: auth.active !== false,
      createdAt: auth.createdAt ?? auth.updatedAt ?? new Date().toISOString(),
      updatedAt: auth.updatedAt ?? auth.createdAt ?? new Date().toISOString(),
      defaultAddress: auth.defaultAddress,
      deliveryZone: auth.deliveryZone,
      phone: auth.phone,
    },
    orders: orders
      .filter((entry) => entry.customerId === customer.id)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    catalog: {
      products,
      capacities,
      slots,
    },
    serviceability: buildCustomerServiceability(customer, defaultServiceDate),
    defaultServiceDate,
  };
}

function buildCustomer360(customerId: string): Customer360Response {
  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer) {
    throw new Error(`Customer ${customerId} not found`);
  }

  const auth = customerAuthRecords.find((entry) => entry.customerId === customer.id && entry.active !== false);
  const notes = customerNotes.filter((entry) => entry.customerId === customer.id).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const supportCasesForCustomer = supportCases.filter((entry) => entry.customerId === customer.id).sort((left, right) => right.lastUpdatedAt.localeCompare(left.lastUpdatedAt));
  const timeline = buildCustomerTimeline(customer.id);
  return {
    customer,
    auth: auth
      ? {
          id: auth.id,
          customerId: auth.customerId ?? customer.id,
          loginId: auth.username,
          displayName: auth.displayName,
          active: auth.active !== false,
          createdAt: auth.createdAt ?? auth.updatedAt ?? new Date().toISOString(),
          updatedAt: auth.updatedAt ?? auth.createdAt ?? new Date().toISOString(),
          defaultAddress: auth.defaultAddress,
          deliveryZone: auth.deliveryZone,
          phone: auth.phone,
        }
      : null,
    notes,
    timeline,
    supportCases: supportCasesForCustomer,
    orders: orders.filter((entry) => entry.customerId === customer.id).sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  };
}

function readRouteParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) {
    return param[0] ?? '';
  }

  return param ?? '';
}

function buildCustomerTimeline(customerId: string): CustomerTimelineEvent[] {
  const events: CustomerTimelineEvent[] = [];

  for (const order of orders.filter((entry) => entry.customerId === customerId)) {
    events.push({
      id: `timeline_order_${order.id}`,
      customerId,
      eventType: 'order_created',
      referenceId: order.id,
      summary: `Order ${order.id} created for ${order.serviceDate} in ${order.slotId}.`,
      createdAt: order.createdAt,
    });

    if (order.status === 'partial_delivery' || order.status === 'failed_delivery') {
      events.push({
        id: `timeline_delivery_${order.id}`,
        customerId,
        eventType: 'delivery_exception',
        referenceId: order.id,
        summary: `Order ${order.id} ended in ${order.status.replace('_', ' ')}.`,
        createdAt: order.createdAt,
      });
    }
  }

  for (const note of customerNotes.filter((entry) => entry.customerId === customerId)) {
    events.push({
      id: `timeline_note_${note.id}`,
      customerId,
      eventType: 'note_added',
      referenceId: note.id,
      summary: `${note.noteType} note added: ${note.note}`,
      createdAt: note.createdAt,
    });
  }

  for (const supportCase of supportCases.filter((entry) => entry.customerId === customerId)) {
    events.push({
      id: `timeline_case_${supportCase.id}`,
      customerId,
      eventType: supportCase.status === 'open' ? 'support_case_opened' : 'support_case_updated',
      referenceId: supportCase.id,
      summary: `Support case ${supportCase.subject} is ${supportCase.status}.`,
      createdAt: supportCase.lastUpdatedAt,
    });
  }

  if (customerId) {
    const customer = customers.find((entry) => entry.id === customerId);
    if (customer && customer.riskState !== 'healthy') {
      events.push({
        id: `timeline_risk_${customer.id}`,
        customerId,
        eventType: 'account_flagged',
        referenceId: customer.id,
        summary: `Account risk state is ${customer.riskState}.`,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return events.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function buildCustomerServiceability(customer: CustomerAccount, defaultServiceDate: string): CustomerServiceabilitySummary {
  const serviceSlots = slots.filter((slot) => slot.serviceDate === defaultServiceDate);
  const serviceCapacities = capacities.filter((capacity) => capacity.serviceDate === defaultServiceDate);
  const slotSummaries: CustomerServiceabilitySlot[] = serviceSlots.map((slot) => ({
    slotId: slot.id,
    label: slot.label,
    zone: slot.zone,
    serviceDate: slot.serviceDate,
    maxOrders: slot.maxOrders,
    bookedOrders: slot.bookedOrders,
    status: slot.status,
    available: slot.zone === customer.deliveryZone && slot.status !== 'full' && slot.status !== 'locked',
  }));
  const capacitySummaries: CustomerServiceabilityCapacity[] = serviceCapacities.map((capacity) => {
    const product = products.find((entry) => entry.id === capacity.productId);
    const remainingQuantity = Math.max(0, capacity.capacity - capacity.bookedQuantity);
    return {
      productId: capacity.productId,
      productName: product?.name ?? capacity.productId,
      serviceDate: capacity.serviceDate,
      capacity: capacity.capacity,
      bookedQuantity: capacity.bookedQuantity,
      remainingQuantity,
      status: capacity.status,
      active: product?.active !== false,
      cutoffTime: product?.defaultCutoffTime ?? '--:--',
    };
  });

  const reasons: string[] = [];
  if (customer.riskState === 'blocked') {
    reasons.push('Account is blocked.');
  }
  if (slotSummaries.every((slot) => !slot.available)) {
    reasons.push(`No open delivery slot matches the ${customer.deliveryZone} zone on ${defaultServiceDate}.`);
  }
  if (capacitySummaries.every((capacity) => !capacity.active || capacity.remainingQuantity <= 0)) {
    reasons.push(`No product capacity is available on ${defaultServiceDate}.`);
  }

  return {
    customerId: customer.id,
    customerZone: customer.deliveryZone,
    defaultServiceDate,
    canOrder: reasons.length === 0,
    reasons,
    slots: slotSummaries,
    capacities: capacitySummaries,
  };
}

function getDefaultServiceDate(customer: CustomerAccount) {
  const allDates = [...new Set([...slots, ...capacities].map((entry) => entry.serviceDate))].sort();
  const today = getZoneDate('Asia/Kolkata').date;
  const eligible = allDates.find((serviceDate) => serviceDate >= today && hasCustomerRouteForDate(customer, serviceDate));
  return eligible ?? allDates[0] ?? today;
}

function hasCustomerRouteForDate(customer: CustomerAccount, serviceDate: string) {
  const hasSlot = slots.some(
    (slot) => slot.serviceDate === serviceDate && slot.zone === customer.deliveryZone && slot.status !== 'full' && slot.status !== 'locked',
  );
  const hasCapacity = capacities.some((capacity) => {
    const product = products.find((entry) => entry.id === capacity.productId);
    return (
      capacity.serviceDate === serviceDate &&
      capacity.bookedQuantity < capacity.capacity &&
      product?.active !== false
    );
  });
  return hasSlot && hasCapacity;
}

function validateCustomerOrderDraft(
  customer: CustomerAccount,
  draft: {
    serviceDate: string;
    slotId: string | undefined;
    paymentMode: PaymentMode;
    items: Array<{ productId?: string; quantity?: number }>;
  },
) {
  if (!draft.slotId) {
    return 'slotId is required';
  }

  if (!Array.isArray(draft.items) || draft.items.length === 0) {
    return 'At least one order item is required';
  }

  if (!['prepaid', 'part-pay', 'credit'].includes(draft.paymentMode)) {
    return 'Invalid payment mode';
  }

  const slot = slots.find((entry) => entry.id === draft.slotId);
  if (!slot) {
    return 'Selected slot was not found';
  }

  if (slot.serviceDate !== draft.serviceDate) {
    return 'Selected slot does not belong to the requested service date';
  }

  if (slot.zone !== customer.deliveryZone) {
    return `Selected slot is in ${slot.zone} zone, but customer is assigned to ${customer.deliveryZone}.`;
  }

  if (slot.status === 'full' || slot.status === 'locked') {
    return 'Selected slot is not available';
  }

  const { date: today, minutes: currentMinutes } = getZoneDate('Asia/Kolkata');
  if (draft.serviceDate < today) {
    return 'Cannot place orders for past service dates';
  }

  let total = 0;
  for (const item of draft.items) {
    if (!item.productId || !Number.isInteger(item.quantity ?? NaN) || (item.quantity ?? 0) <= 0) {
      return 'Each item needs a valid productId and positive integer quantity';
    }

    const product = products.find((entry) => entry.id === item.productId);
    if (!product || !product.active) {
      return `Product ${item.productId} is not available`;
    }

    if (draft.serviceDate === today && currentMinutes >= parseClockToMinutes(product.defaultCutoffTime)) {
      return `${product.name} is past its cutoff time for ${draft.serviceDate}`;
    }

    const capacity = capacities.find(
      (entry) => entry.productId === item.productId && entry.serviceDate === draft.serviceDate,
    );
    if (!capacity) {
      return `No capacity is configured for ${product.name} on ${draft.serviceDate}`;
    }

    const remainingQuantity = capacity.capacity - capacity.bookedQuantity;
    if (item.quantity! > remainingQuantity) {
      return `Only ${remainingQuantity} units remain for ${product.name} on ${draft.serviceDate}`;
    }

    total += item.quantity! * product.unitPrice;
  }

  const exposureAmount =
    draft.paymentMode === 'credit' ? total : draft.paymentMode === 'part-pay' ? Math.ceil(total / 2) : 0;
  if (draft.paymentMode !== 'prepaid' && customer.outstandingBalance + exposureAmount > customer.creditLimit) {
    return `Credit limit exceeded. Exposure of Rs. ${exposureAmount} would raise the balance to Rs. ${customer.outstandingBalance + exposureAmount}, above Rs. ${customer.creditLimit}.`;
  }

  return null;
}

function recordCustomerOrderRejection(customer: CustomerAccount, attemptId: string, reason: string) {
  recordAudit({
    kind: 'customer_order_rejected',
    actor: customer.id,
    summary: `${reason} [slot gate]`,
    referenceId: attemptId,
  });
}

function refreshCustomerRisk(customer: CustomerAccount) {
  if (customer.creditLimit <= 0) {
    customer.riskState = customer.outstandingBalance > 0 ? 'blocked' : 'healthy';
    return;
  }

  const exposureRatio = customer.outstandingBalance / customer.creditLimit;
  if (exposureRatio >= 1) {
    customer.riskState = 'blocked';
  } else if (exposureRatio >= 0.9) {
    customer.riskState = 'block_soon';
  } else if (exposureRatio >= 0.75) {
    customer.riskState = 'watch';
  } else {
    customer.riskState = 'healthy';
  }
}

function recalculateItemsTotal(items: Array<{ quantity: number; unitPrice: number }>) {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function getZoneDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

function parseClockToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map((entry) => Number(entry));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 24 * 60;
  }
  return hours * 60 + minutes;
}

let persistTimer: NodeJS.Timeout | null = null;

function persistStateSoon() {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }

  persistTimer = setTimeout(() => {
    void persistState();
  }, 100);
}

async function persistState() {
  const snapshot: ApiStateSnapshot = {
    customers,
    customerAuthRecords,
    customerNotes,
    supportCases,
    products,
    capacities,
    slots,
    orders,
    productionBatches,
    auditEvents,
    erpSyncStatus,
    sessions: [...sessions.values()],
    approvals,
    deliveryEventIds: [...processedDeliveryEventIds],
  };

  await mkdir(dirname(stateFilePath), { recursive: true });
  await writeFile(stateFilePath, JSON.stringify(snapshot, null, 2), 'utf8');
}

async function loadState(): Promise<ApiStateSnapshot> {
  try {
    const raw = await readFile(stateFilePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ApiStateSnapshot>;

    const snapshot: ApiStateSnapshot = {
      customers: parsed.customers ?? customers,
      customerAuthRecords: parsed.customerAuthRecords ?? customerAuthRecords,
      customerNotes: parsed.customerNotes ?? customerNotes,
      supportCases: parsed.supportCases ?? supportCases,
      products: parsed.products ?? products,
      capacities: parsed.capacities ?? capacities,
      slots: parsed.slots ?? slots,
      orders: parsed.orders ?? orders,
      productionBatches: parsed.productionBatches ?? productionBatches,
      auditEvents: parsed.auditEvents ?? [],
      erpSyncStatus:
        parsed.erpSyncStatus ??
        ({
          provider: 'vasy',
          state: 'healthy',
          lastAttemptAt: new Date().toISOString(),
          lastSuccessAt: new Date().toISOString(),
          pendingCount: 1,
          failedCount: 0,
        } satisfies ErpSyncStatus),
      sessions: parsed.sessions ?? [],
      approvals: parsed.approvals ?? [],
      deliveryEventIds: parsed.deliveryEventIds ?? [],
    };

    rehydrateState(snapshot);
    return snapshot;
  } catch {
    const snapshot: ApiStateSnapshot = {
      customers,
      customerAuthRecords,
      customerNotes,
      supportCases,
      products,
      capacities,
      slots,
      orders,
      productionBatches,
      auditEvents: [],
      erpSyncStatus: {
        provider: 'vasy',
        state: 'healthy',
        lastAttemptAt: new Date().toISOString(),
        lastSuccessAt: new Date().toISOString(),
        pendingCount: 1,
        failedCount: 0,
      },
      sessions: [],
      approvals: [],
      deliveryEventIds: [],
    };

    rehydrateState(snapshot);
    return snapshot;
  }
}

function rehydrateState(snapshot: ApiStateSnapshot) {
  customers.splice(0, customers.length, ...snapshot.customers);
  customerAuthRecords.splice(0, customerAuthRecords.length, ...snapshot.customerAuthRecords);
  customerNotes.splice(0, customerNotes.length, ...snapshot.customerNotes);
  supportCases.splice(0, supportCases.length, ...snapshot.supportCases);
  products.splice(0, products.length, ...snapshot.products);
  capacities.splice(0, capacities.length, ...snapshot.capacities);
  slots.splice(0, slots.length, ...snapshot.slots);
  orders.splice(0, orders.length, ...snapshot.orders);
  productionBatches.splice(0, productionBatches.length, ...snapshot.productionBatches);
  auditEvents.splice(0, auditEvents.length, ...snapshot.auditEvents);
  approvals.splice(0, approvals.length, ...snapshot.approvals);
  processedDeliveryEventIds.clear();
  for (const eventId of snapshot.deliveryEventIds) {
    processedDeliveryEventIds.add(eventId);
  }

  erpSyncStatus.provider = snapshot.erpSyncStatus.provider;
  erpSyncStatus.state = snapshot.erpSyncStatus.state;
  erpSyncStatus.lastAttemptAt = snapshot.erpSyncStatus.lastAttemptAt;
  erpSyncStatus.lastSuccessAt = snapshot.erpSyncStatus.lastSuccessAt;
  erpSyncStatus.pendingCount = snapshot.erpSyncStatus.pendingCount;
  erpSyncStatus.failedCount = snapshot.erpSyncStatus.failedCount;

  sessions.clear();
  for (const session of snapshot.sessions) {
    if (new Date(session.expiresAt).getTime() > Date.now()) {
      sessions.set(session.token, session);
    }
  }
}

function getToken(req: express.Request) {
  const authHeader = req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const tokenHeader = req.header('x-session-token');
  return tokenHeader ?? null;
}

function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = getToken(req);
  if (!token) {
    res.status(401).json({ error: 'Missing session token' });
    return;
  }

  const session = sessions.get(token);
  if (!session) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    sessions.delete(token);
    res.status(401).json({ error: 'Session expired' });
    return;
  }

  req.session = session;
  next();
}

function requireAnyRole(roles: AuthRole[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const session = req.session;
    if (!session) {
      res.status(401).json({ error: 'Missing session' });
      return;
    }

    if (!roles.includes(session.user.role)) {
      res.status(403).json({ error: 'Insufficient role access' });
      return;
    }

    next();
  };
}

function requirePermission(permission: 'canEditOrders' | 'canCaptureReturns' | 'canSyncErp') {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const session = req.session;
    if (!session) {
      res.status(401).json({ error: 'Missing session' });
      return;
    }

    if (!rolePermissions[session.user.role][permission]) {
      res.status(403).json({ error: 'Insufficient permission' });
      return;
    }

    next();
  };
}

function recalculateOrderTotal(order: Order) {
  return order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function buildProductionBatchLines(serviceDate: string) {
  const demandByProductSlot = new Map<string, { productId: string; slotId: string; quantity: number }>();

  for (const order of orders) {
    if (order.status === 'cancelled' || order.serviceDate !== serviceDate) {
      continue;
    }

    for (const item of order.items) {
      const key = `${item.productId}:${order.slotId}`;
      const nextQuantity = (demandByProductSlot.get(key)?.quantity ?? 0) + item.quantity;
      demandByProductSlot.set(key, {
        productId: item.productId,
        slotId: order.slotId,
        quantity: nextQuantity,
      });
    }
  }

  return [...demandByProductSlot.values()]
    .map((entry) => {
      const capacity = capacities.find(
        (item) => item.productId === entry.productId && item.serviceDate === serviceDate,
      );
      const shortQuantity = Math.max(0, entry.quantity - (capacity?.capacity ?? entry.quantity));
      const actualQuantity = entry.quantity - shortQuantity;
      return {
        productId: entry.productId,
        slotId: entry.slotId,
        quantity: entry.quantity,
        plannedQuantity: entry.quantity,
        actualQuantity,
        shortQuantity,
        note:
          shortQuantity > 0
            ? `Short by ${shortQuantity} against service-date capacity`
            : 'Fully covered by capacity',
      } satisfies ProductionBatchLine;
    })
    .sort((left, right) => {
      const leftProduct = products.find((item) => item.id === left.productId)?.name ?? left.productId;
      const rightProduct = products.find((item) => item.id === right.productId)?.name ?? right.productId;
      if (leftProduct !== rightProduct) {
        return leftProduct.localeCompare(rightProduct);
      }
      return left.slotId.localeCompare(right.slotId);
    });
}

function rebuildOperationalState() {
  const productTotals = new Map<string, number>();
  const slotCounts = new Map<string, number>();

  for (const order of orders) {
    if (order.status === 'cancelled') {
      continue;
    }

    slotCounts.set(order.slotId, (slotCounts.get(order.slotId) ?? 0) + 1);

    for (const item of order.items) {
      productTotals.set(item.productId, (productTotals.get(item.productId) ?? 0) + item.quantity);
    }
  }

  for (const capacity of capacities) {
    const bookedQuantity = productTotals.get(capacity.productId) ?? 0;
    capacity.bookedQuantity = bookedQuantity;
    capacity.status = bookedQuantity >= capacity.capacity ? 'closed' : bookedQuantity >= capacity.capacity * 0.8 ? 'throttled' : 'open';
  }

  for (const slot of slots) {
    const bookedOrders = slotCounts.get(slot.id) ?? 0;
    slot.bookedOrders = bookedOrders;
    slot.status = bookedOrders >= slot.maxOrders ? 'full' : bookedOrders >= slot.maxOrders * 0.8 ? 'nearly_full' : 'open';
  }

  for (const batch of productionBatches) {
    if (batch.status === 'draft') {
      batch.lines = buildProductionBatchLines(batch.serviceDate);
      batch.generatedAt = batch.generatedAt ?? new Date().toISOString();
    }
  }
}

declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}
