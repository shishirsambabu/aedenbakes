'use client';

import { useEffect, useMemo, useState } from 'react';

const API_BASE_URL = 'http://127.0.0.1:4000';

type PortalRole = 'owner' | 'manager' | 'production' | 'delivery' | 'accounts' | 'support';

type Permissions = {
  canEditOrders: boolean;
  canCaptureReturns: boolean;
  canSyncErp: boolean;
};

type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: PortalRole;
};

type SessionPayload = {
  user: AuthUser;
  permissions: Permissions;
  expiresAt: string;
};

type CustomerAccount = {
  id: string;
  name: string;
  tier: string;
  creditLimit: number;
  outstandingBalance: number;
  riskState: 'healthy' | 'watch' | 'block_soon' | 'blocked';
  deliveryZone: string;
};

type Product = {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
  defaultCutoffTime: string;
  active: boolean;
};

type ProductDayCapacity = {
  id: string;
  productId: string;
  serviceDate: string;
  capacity: number;
  bookedQuantity: number;
  status: 'open' | 'throttled' | 'closed';
  version: number;
};

type DeliverySlot = {
  id: string;
  serviceDate: string;
  zone: string;
  label: string;
  maxOrders: number;
  bookedOrders: number;
  status: 'open' | 'nearly_full' | 'full' | 'locked';
};

type Order = {
  id: string;
  customerId: string;
  serviceDate: string;
  slotId: string;
  paymentMode: 'prepaid' | 'part-pay' | 'credit';
  status:
    | 'draft'
    | 'confirmed'
    | 'locked'
    | 'in_production'
    | 'out_for_delivery'
    | 'delivered'
    | 'partial_delivery'
    | 'failed_delivery'
    | 'cancelled';
  source: 'customer_app' | 'admin' | 'standing_order';
  amountTotal: number;
  createdAt: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
};

type CustomerNote = {
  id: string;
  customerId: string;
  noteType: 'support' | 'accounts' | 'delivery' | 'production' | 'general';
  note: string;
  createdBy: string;
  createdAt: string;
};

type CustomerTimelineEvent = {
  id: string;
  customerId: string;
  eventType:
    | 'order_created'
    | 'order_returned'
    | 'support_case_opened'
    | 'support_case_updated'
    | 'note_added'
    | 'account_flagged'
    | 'delivery_exception';
  referenceId: string;
  summary: string;
  createdAt: string;
};

type SupportCase = {
  id: string;
  customerId: string;
  orderId?: string;
  status: 'open' | 'investigating' | 'waiting_customer' | 'waiting_internal' | 'resolved' | 'closed' | 'escalated';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  subject: string;
  openedBy: string;
  assignedTo: string | null;
  createdAt: string;
  closedAt: string | null;
  lastUpdatedAt: string;
};

type Customer360Response = {
  customer: CustomerAccount;
  auth: {
    id: string;
    customerId: string;
    loginId: string;
    displayName: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    defaultAddress?: string;
    deliveryZone?: string;
    phone?: string;
  } | null;
  notes: CustomerNote[];
  timeline: CustomerTimelineEvent[];
  supportCases: SupportCase[];
  orders: Order[];
};

type AuditEvent = {
  id: string;
  kind:
    | 'order_adjusted'
    | 'return_captured'
    | 'erp_sync_triggered'
    | 'erp_sync_completed'
    | 'approval_queued'
    | 'approval_approved'
    | 'approval_rejected';
  actor: string;
  summary: string;
  referenceId: string;
  createdAt: string;
};

type ApprovalRequest = {
  id: string;
  action: 'order_adjustment' | 'return_capture';
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

type ErpSyncStatus = {
  provider: 'vasy';
  state: 'healthy' | 'degraded' | 'down';
  lastAttemptAt: string;
  lastSuccessAt: string | null;
  pendingCount: number;
  failedCount: number;
};

type VasyErpContractPreview = {
  provider: 'vasy';
  exportedAt: string;
  orderCount: number;
  batchCount: number;
  orders: Array<{
    orderId: string;
    customerCode: string;
    serviceDate: string;
    deliverySlotCode: string;
    paymentMode: 'prepaid' | 'part-pay' | 'credit';
    status:
      | 'draft'
      | 'confirmed'
      | 'locked'
      | 'in_production'
      | 'out_for_delivery'
      | 'delivered'
      | 'partial_delivery'
      | 'failed_delivery'
      | 'cancelled';
    totalAmount: number;
    lines: Array<{
      sku: string;
      name: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
  }>;
  batches: Array<{
    batchId: string;
    serviceDate: string;
    status: 'draft' | 'locked' | 'in_progress' | 'completed';
    lines: Array<{
      sku: string;
      deliverySlotCode: string;
      quantity: number;
    }>;
  }>;
};

type AppState = {
  customers: CustomerAccount[];
  products: Product[];
  capacities: ProductDayCapacity[];
  slots: DeliverySlot[];
  orders: Order[];
  auditEvents: AuditEvent[];
  erpSyncStatus: ErpSyncStatus | null;
  approvals: ApprovalRequest[];
  supportCases: SupportCase[];
  erpContractPreview: VasyErpContractPreview | null;
};

const initialAppState: AppState = {
  customers: [],
  products: [],
  capacities: [],
  slots: [],
  orders: [],
  auditEvents: [],
  erpSyncStatus: null,
  approvals: [],
  supportCases: [],
  erpContractPreview: null,
};

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loginUsername, setLoginUsername] = useState('owner');
  const [loginPassword, setLoginPassword] = useState('owner123');
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState>(initialAppState);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer360Response | null>(null);
  const [supportCaseDraft, setSupportCaseDraft] = useState('');
  const [supportNoteDraft, setSupportNoteDraft] = useState('');
  const [activeSection, setActiveSection] = useState<'overview' | 'customers' | 'production' | 'delivery' | 'operations'>('overview');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = window.localStorage.getItem('aeden-bakes-session-token');
    if (!savedToken) {
      setLoadingAuth(false);
      return;
    }

    setToken(savedToken);
    void bootstrapSession(savedToken).finally(() => setLoadingAuth(false));
  }, []);

  const permissions = session?.permissions ?? { canEditOrders: false, canCaptureReturns: false, canSyncErp: false };
  const role = session?.user.role ?? null;
  const metrics = useMemo(() => buildMetrics(appState), [appState]);
  const allowedSections = useMemo(() => getAllowedSections(role, permissions), [role, permissions]);
  const visibleSection = allowedSections.includes(activeSection) ? activeSection : allowedSections[0];
  const canApprove = role === 'owner' || role === 'manager';

  async function bootstrapSession(sessionToken: string) {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: authHeaders(sessionToken),
    });

    if (!response.ok) {
      window.localStorage.removeItem('aeden-bakes-session-token');
      setToken(null);
      setSession(null);
      return;
    }

    const payload = (await response.json()) as SessionPayload;
    setSession(payload);
    await refreshAppState(sessionToken, payload.permissions.canSyncErp);
  }

  async function refreshAppState(sessionToken = token, canSyncErp = session?.permissions.canSyncErp ?? false) {
    const [customersRes, catalogRes, ordersRes, operationsRes, supportRes] = await Promise.all([
      fetch(`${API_BASE_URL}/customers`),
      fetch(`${API_BASE_URL}/catalog`),
      fetch(`${API_BASE_URL}/orders`),
      sessionToken ? fetch(`${API_BASE_URL}/admin/operations`, { headers: authHeaders(sessionToken) }) : Promise.resolve(null),
      sessionToken ? fetch(`${API_BASE_URL}/support/cases`, { headers: authHeaders(sessionToken) }) : Promise.resolve(null),
    ]);

    if (!customersRes.ok || !catalogRes.ok || !ordersRes.ok) {
      throw new Error('Could not refresh live data.');
    }

    const [customersJson, catalogJson, ordersJson] = await Promise.all([
      customersRes.json(),
      catalogRes.json(),
      ordersRes.json(),
    ]);

    let auditEvents: AuditEvent[] = [];
    let approvals: ApprovalRequest[] = [];
    let supportCases: SupportCase[] = [];
    let erpSyncStatus: ErpSyncStatus | null = null;
    let erpContractPreview: VasyErpContractPreview | null = null;

    if (operationsRes) {
      if (!operationsRes.ok) {
        throw new Error('Could not refresh operations feed.');
      }
      const operationsJson = await operationsRes.json();
      auditEvents = operationsJson.auditEvents ?? [];
      approvals = operationsJson.approvals ?? [];
      erpSyncStatus = operationsJson.erpSyncStatus ?? null;
    }

    if (supportRes) {
      if (!supportRes.ok) {
        throw new Error('Could not refresh support inbox.');
      }
      const supportJson = await supportRes.json();
      supportCases = supportJson.supportCases ?? [];
    }

    if (sessionToken && canSyncErp) {
      const contractResponse = await fetch(`${API_BASE_URL}/erp/vasy/contract`, {
        headers: authHeaders(sessionToken),
      });
      if (contractResponse.ok) {
        erpContractPreview = (await contractResponse.json()) as VasyErpContractPreview;
      }
    }

    setAppState({
      customers: customersJson.customers ?? [],
      products: catalogJson.products ?? [],
      capacities: catalogJson.capacities ?? [],
      slots: catalogJson.slots ?? [],
      orders: ordersJson.orders ?? [],
      auditEvents,
      erpSyncStatus,
      approvals,
      supportCases,
      erpContractPreview,
    });
  }

  async function login() {
    setLoginError(null);
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loginUsername, password: loginPassword }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error ?? 'Login failed');
    }

    const payload = (await response.json()) as { token: string; user: AuthUser };
    window.localStorage.setItem('aeden-bakes-session-token', payload.token);
    setToken(payload.token);

    const meResponse = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: authHeaders(payload.token),
    });
    const mePayload = (await meResponse.json()) as SessionPayload;
    setSession(mePayload);
    await refreshAppState(payload.token, mePayload.permissions.canSyncErp);
    setActionMessage(`Signed in as ${payload.user.displayName}.`);
  }

  async function logout() {
    if (token) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: authHeaders(token),
      }).catch(() => undefined);
    }

    window.localStorage.removeItem('aeden-bakes-session-token');
    setToken(null);
    setSession(null);
    setAppState(initialAppState);
    setSelectedCustomer(null);
    setActiveSection('overview');
    setActionMessage(null);
  }

  async function performAction(
    endpoint: string,
    body: Record<string, string | number>,
    successMessage: string,
  ) {
    if (!token) {
      throw new Error('You must sign in first.');
    }

    setActionMessage(null);
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok && response.status !== 202) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error ?? `Action failed with status ${response.status}`);
    }

    const payload = (await response.json().catch(() => ({}))) as { approval?: { id: string } };
    await refreshAppState(token);
    setActionMessage(
      response.status === 202 && payload.approval
        ? `${successMessage} Pending approval: ${payload.approval.id}.`
        : successMessage,
    );
  }

  async function loadCustomerDetail(customerId: string) {
    if (!token) {
      throw new Error('You must sign in first.');
    }

    const response = await fetch(`${API_BASE_URL}/customers/${customerId}/360`, {
      headers: authHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Could not load customer detail.');
    }

    const json = (await response.json()) as Customer360Response;
    setSelectedCustomer(json);
  }

  async function addCustomerNote() {
    if (!selectedCustomer || !token || !supportNoteDraft.trim()) {
      return;
    }

    await performAction(
      `/customers/${selectedCustomer.customer.id}/notes`,
      {
        noteType: 'support',
        note: supportNoteDraft.trim(),
      },
      'Customer note added.',
    );
    setSupportNoteDraft('');
    await loadCustomerDetail(selectedCustomer.customer.id);
  }

  async function openSupportCase() {
    if (!selectedCustomer || !token || !supportCaseDraft.trim()) {
      return;
    }

    await performAction(
      '/support/cases',
      {
        customerId: selectedCustomer.customer.id,
        orderId: selectedCustomer.orders[0]?.id ?? '',
        subject: supportCaseDraft.trim(),
        priority: 'medium',
      },
      'Support case opened.',
    );
    setSupportCaseDraft('');
    await loadCustomerDetail(selectedCustomer.customer.id);
  }

  if (loadingAuth) {
    return <LoadingScreen message="Checking session..." />;
  }

  if (!session) {
    return (
      <LoginScreen
        username={loginUsername}
        password={loginPassword}
        error={loginError}
        onUsernameChange={setLoginUsername}
        onPasswordChange={setLoginPassword}
        onSubmit={() =>
          login().catch((loginFailure) => setLoginError((loginFailure as Error).message))
        }
      />
    );
  }

  const roleLabel = session.user.role;
  const { customers, products, capacities, slots, orders, auditEvents, erpSyncStatus, approvals, supportCases, erpContractPreview } = appState;
  const latestEvents = auditEvents.slice(0, 4);
  const selectedCustomerOrders = selectedCustomer?.orders ?? [];
  const pendingApprovals = approvals.filter((approval) => approval.status === 'pending');
  const supportInbox = supportCases.filter((supportCase) => supportCase.status !== 'closed');

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,210,172,.35),_transparent_28%),linear-gradient(180deg,#fff8f0_0%,#f6eadc_100%)] text-stone-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="grid gap-4 rounded-[2rem] border border-stone-200/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(87,50,20,.12)] backdrop-blur lg:grid-cols-[1.45fr_.95fr]">
          <div className="space-y-4">
            <div className="text-xs font-black uppercase tracking-[0.24em] text-orange-700">
              Aeden Bakes super admin
            </div>
            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-stone-950 sm:text-5xl">
              Customer drill-down, production control, ledger visibility, and ERP oversight in one
              place.
            </h1>
            <p className="max-w-3xl text-base leading-7 text-stone-600">
              This is the operational brain: inspect a single account, edit orders with audit
              trace, watch receivables, and keep production and delivery aligned with Vasy ERP.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-stone-500">
                Active session
              </div>
              <div className="rounded-full bg-stone-950 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-stone-50">
                {session.user.displayName} | {roleLabel}
              </div>
              <button
                type="button"
                onClick={() => {
                  logout().catch((logoutError) => setError((logoutError as Error).message));
                }}
                className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-stone-700"
              >
                Sign out
              </button>
            </div>
            {actionMessage ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {actionMessage}
              </div>
            ) : null}
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                API error: {error}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 rounded-[1.5rem] bg-stone-950 p-5 text-stone-50">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-stone-300">Today</p>
              <div className="mt-2 text-4xl font-black">Rs. {metrics.outstanding.toLocaleString()}</div>
              <p className="mt-1 text-sm text-stone-300">Outstanding across active accounts</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Orders" value={String(metrics.orders)} />
              <Metric label="Capacity" value={`${metrics.capacityFill}%`} />
              <Metric label="Routes" value={`${metrics.routeFill}%`} />
              <Metric label="Customers" value={String(customers.length)} />
            </div>
          </div>
        </header>

        <nav className="flex flex-wrap gap-2 rounded-[1.6rem] border border-stone-200/70 bg-white/80 p-3 shadow-[0_16px_48px_rgba(87,50,20,.08)]">
          {allowedSections.map((section) => (
            <button
              key={section}
              type="button"
              onClick={() => setActiveSection(section)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                visibleSection === section
                  ? 'bg-stone-950 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {section}
            </button>
          ))}
        </nav>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
          <div className="space-y-6">
            {visibleSection === 'overview' ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Customer access" subtitle="Open accounts and inspect context.">
                  {session.permissions.canEditOrders || session.user.role === 'owner' ? (
                    <div className="space-y-3">
                      {customers.slice(0, 3).map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => {
                            loadCustomerDetail(customer.id).catch((detailError) =>
                              setError((detailError as Error).message),
                            );
                          }}
                          className="grid w-full gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-left md:grid-cols-[1fr_auto_auto]"
                        >
                          <div>
                            <div className="font-extrabold text-stone-950">{customer.name}</div>
                            <div className="text-sm text-stone-500">{customer.tier}</div>
                          </div>
                          <InfoBlock label="Outstanding" value={`Rs. ${customer.outstandingBalance.toLocaleString()}`} />
                          <InfoBlock label="Risk" value={customer.riskState.replace('_', ' ')} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <GateMessage message="This role does not have customer visibility." />
                  )}
                </Card>

                <Card title="Guardrails" subtitle="The checks that keep operations honest.">
                  <div className="space-y-3">
                    {buildAlerts(customers, capacities).map((alert) => (
                      <div key={alert} className="rounded-2xl bg-orange-50 px-4 py-3 text-sm text-orange-950">
                        {alert}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            ) : null}

            {visibleSection === 'customers' ? (
              <Card title="Customer list" subtitle="Click one account for a live drill-down.">
                <div className="space-y-3">
                      {customers.map((customer) => (
                        <button
                      key={customer.id}
                      type="button"
                      onClick={() => {
                        loadCustomerDetail(customer.id).catch((detailError) =>
                          setError((detailError as Error).message),
                        );
                      }}
                      className="grid w-full gap-4 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4 text-left md:grid-cols-[1fr_auto_auto_auto]"
                    >
                      <div>
                        <div className="text-lg font-extrabold text-stone-950">{customer.name}</div>
                        <div className="text-sm text-stone-500">{customer.tier}</div>
                      </div>
                      <InfoBlock label="Outstanding" value={`Rs. ${customer.outstandingBalance.toLocaleString()}`} />
                      <InfoBlock label="Risk" value={customer.riskState.replace('_', ' ')} />
                      <InfoBlock label="Zone" value={customer.deliveryZone} />
                    </button>
                      ))}
                </div>
              </Card>
            ) : null}

            {visibleSection === 'production' ? (
              <Card title="Production board" subtitle="What the floor needs to make next.">
                <div className="overflow-hidden rounded-[1.5rem] border border-stone-200">
                  <div className="grid grid-cols-3 bg-stone-950 px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-stone-200">
                    <span>Item</span>
                    <span>Capacity</span>
                    <span>Booked</span>
                  </div>
                  {products.map((product) => {
                    const capacity = capacities.find((entry) => entry.productId === product.id);
                    return (
                      <div
                        key={product.id}
                        className="grid grid-cols-3 border-t border-stone-200 bg-stone-50 px-4 py-4 text-sm"
                      >
                        <span className="font-semibold text-stone-950">{product.name}</span>
                        <span>{capacity ? capacity.capacity : '-'}</span>
                        <span>{capacity ? capacity.bookedQuantity : '-'}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : null}

            {visibleSection === 'delivery' ? (
              <Card title="Route manifest" subtitle="Driver-facing stop order and load.">
                <div className="space-y-3">
                  {slots.map((slot) => (
                    <div key={slot.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-stone-950">{slot.label}</div>
                          <div className="text-sm text-stone-500">{slot.zone} zone</div>
                        </div>
                        <div className="text-sm font-black text-stone-700">
                          {slot.bookedOrders} / {slot.maxOrders}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}

            {visibleSection === 'operations' ? (
              <Card title="Control actions" subtitle="Only permitted roles can use these levers.">
                <div className="space-y-3">
                  <ActionButton
                    enabled={permissions.canEditOrders && Boolean(orders[0])}
                    label="Edit order quantity"
                    onClick={() => {
                      if (!orders[0]) return;
                      performAction(
                        `/admin/orders/${orders[0].id}/adjust`,
                        {
                          actor: session.user.role,
                          productId: orders[0].items[0]?.productId ?? '',
                          quantityDelta: -2,
                          note: 'Adjusted from admin portal.',
                        },
                        'Order adjustment recorded and production state refreshed.',
                      ).catch((actionError) => setError((actionError as Error).message));
                    }}
                  />
                  <ActionButton
                    enabled={permissions.canCaptureReturns && Boolean(orders[0])}
                    label="Register return"
                    onClick={() => {
                      if (!orders[0]) return;
                      performAction(
                        `/admin/orders/${orders[0].id}/returns`,
                        {
                          actor: session.user.role,
                          quantity: 3,
                          note: 'Return captured from failed doorstep delivery.',
                        },
                        'Return captured and audit trail updated.',
                      ).catch((actionError) => setError((actionError as Error).message));
                    }}
                  />
                  <ActionButton
                    enabled={permissions.canSyncErp}
                    label="Trigger ERP sync"
                    onClick={() => {
                      performAction(
                        '/erp/sync/trigger',
                        { actor: session.user.role },
                        'Vasy ERP sync triggered and completed.',
                      ).catch((actionError) => setError((actionError as Error).message));
                    }}
                  />
                </div>
              </Card>
            ) : null}
          </div>

          <aside className="space-y-6">
              <Card title="Customer 360" subtitle="Open one account to inspect orders, notes, timeline, and support work.">
              {selectedCustomer ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="text-lg font-black text-stone-950">{selectedCustomer.customer.name}</div>
                    <div className="mt-1 text-sm text-stone-500">{selectedCustomer.customer.tier}</div>
                    {selectedCustomer.auth ? (
                      <div className="mt-2 text-xs text-stone-500">
                        Login {selectedCustomer.auth.loginId} | {selectedCustomer.auth.defaultAddress ?? 'No address'}
                      </div>
                    ) : null}
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <InfoBlock
                        label="Credit limit"
                        value={`Rs. ${selectedCustomer.customer.creditLimit.toLocaleString()}`}
                      />
                      <InfoBlock
                        label="Outstanding"
                        value={`Rs. ${selectedCustomer.customer.outstandingBalance.toLocaleString()}`}
                      />
                      <InfoBlock label="Risk state" value={selectedCustomer.customer.riskState.replace('_', ' ')} />
                      <InfoBlock label="Delivery zone" value={selectedCustomer.customer.deliveryZone} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-bold uppercase tracking-[0.18em] text-stone-400">
                      Support notes
                    </div>
                    {selectedCustomer.notes.length > 0 ? (
                      selectedCustomer.notes.map((note) => (
                        <div key={note.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-stone-950">{note.noteType}</div>
                            <div className="text-xs text-stone-500">{note.createdAt}</div>
                          </div>
                          <div className="mt-1 text-sm text-stone-600">{note.note}</div>
                        </div>
                      ))
                    ) : (
                      <GateMessage message="No notes have been added yet." />
                    )}
                    <div className="grid gap-2">
                      <Field
                        label="Add note"
                        value={supportNoteDraft}
                        onChange={setSupportNoteDraft}
                        placeholder="Add a support note for this customer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          addCustomerNote().catch((noteError) => setError((noteError as Error).message));
                        }}
                        className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-bold text-white"
                      >
                        Save note
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-bold uppercase tracking-[0.18em] text-stone-400">
                      Support cases
                    </div>
                    {selectedCustomer.supportCases.length > 0 ? (
                      selectedCustomer.supportCases.map((supportCase) => (
                        <div key={supportCase.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-semibold text-stone-950">{supportCase.subject}</div>
                              <div className="text-xs text-stone-500">{supportCase.priority} | {supportCase.status}</div>
                            </div>
                            <div className="text-xs text-stone-500">{supportCase.lastUpdatedAt}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <GateMessage message="No support cases are open for this account." />
                    )}
                    <div className="grid gap-2">
                      <Field
                        label="Open support case"
                        value={supportCaseDraft}
                        onChange={setSupportCaseDraft}
                        placeholder="Describe the customer issue or follow-up"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          openSupportCase().catch((caseError) => setError((caseError as Error).message));
                        }}
                        className="rounded-2xl bg-orange-700 px-4 py-3 text-sm font-bold text-white"
                      >
                        Open case
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-bold uppercase tracking-[0.18em] text-stone-400">
                      Timeline
                    </div>
                    {selectedCustomer.timeline.length > 0 ? (
                      selectedCustomer.timeline.map((event) => (
                        <div key={event.id} className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-stone-400">{event.eventType}</div>
                          <div className="mt-1 text-sm font-semibold text-stone-900">{event.summary}</div>
                          <div className="mt-1 text-xs text-stone-500">{event.createdAt}</div>
                        </div>
                      ))
                    ) : (
                      <GateMessage message="No timeline events yet." />
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-bold uppercase tracking-[0.18em] text-stone-400">
                      Recent orders
                    </div>
                    {selectedCustomerOrders.length > 0 ? (
                      selectedCustomerOrders.map((order) => (
                        <div key={order.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold text-stone-950">{order.id}</div>
                            <div className="text-xs uppercase tracking-[0.18em] text-stone-500">{order.status}</div>
                          </div>
                          <div className="mt-1 text-sm text-stone-600">
                            Rs. {order.amountTotal.toLocaleString()} | {order.serviceDate} | slot {order.slotId}
                          </div>
                        </div>
                      ))
                    ) : (
                      <GateMessage message="No orders found for this account." />
                    )}
                  </div>
                </div>
              ) : (
                <GateMessage message="Select a customer to inspect their notes, cases, and operational history." />
              )}
            </Card>

            <Card title="ERP sync" subtitle="Vasy integration status and reconciliation view.">
              {erpSyncStatus ? (
                <div className="space-y-3">
                  <StatusRow label="Provider" value={erpSyncStatus.provider} tone="good" />
                  <StatusRow
                    label="Sync state"
                    value={erpSyncStatus.state}
                    tone={erpSyncStatus.state === 'healthy' ? 'good' : erpSyncStatus.state === 'degraded' ? 'warn' : 'bad'}
                  />
                  <StatusRow
                    label="Invoice queue"
                    value={`${erpSyncStatus.pendingCount} pending`}
                    tone="warn"
                  />
                  <StatusRow
                    label="Retry failures"
                    value={`${erpSyncStatus.failedCount} needs review`}
                    tone="bad"
                  />
                  {erpContractPreview ? (
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-stone-400">
                        Contract preview
                      </div>
                      <div className="mt-1 text-sm font-semibold text-stone-900">
                        {erpContractPreview.orderCount} orders, {erpContractPreview.batchCount} batches
                      </div>
                      <div className="mt-1 text-xs text-stone-500">
                        Exported {erpContractPreview.exportedAt}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <GateMessage message="Operations feed not loaded yet." />
              )}
            </Card>

            <Card title="Operations feed" subtitle="The latest audit trail from admin actions.">
              {latestEvents.length > 0 ? (
                <div className="space-y-3">
                  {latestEvents.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-stone-400">{event.kind}</div>
                      <div className="mt-1 text-sm font-semibold text-stone-900">{event.summary}</div>
                      <div className="mt-1 text-xs text-stone-500">
                        {event.actor} | {event.createdAt}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <GateMessage message="No admin events yet." />
              )}
            </Card>

            <Card title="Approval inbox" subtitle="Risky changes waiting for a green light.">
              {pendingApprovals.length > 0 ? (
                <div className="space-y-3">
                  {pendingApprovals.map((approval) => (
                    <div key={approval.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-extrabold text-stone-950">{approval.action}</div>
                          <div className="text-xs text-stone-500">Target: {approval.targetId}</div>
                        </div>
                        <div className="text-xs uppercase tracking-[0.18em] text-stone-400">
                          {approval.status}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-stone-700">{approval.reason}</div>
                      <div className="mt-2 text-xs text-stone-500">Requested by {approval.requestedBy}</div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={!canApprove}
                          onClick={() => {
                            if (!token) return;
                            fetch(`${API_BASE_URL}/admin/approvals/${approval.id}/decide`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                ...authHeaders(token),
                              },
                              body: JSON.stringify({ decision: 'approve', actor: session.user.role }),
                            })
                              .then(async (response) => {
                                if (!response.ok) {
                                  const payload = (await response.json().catch(() => ({}))) as { error?: string };
                                  throw new Error(payload.error ?? 'Could not approve request.');
                                }
                                await refreshAppState(token);
                                setActionMessage(`Approved ${approval.id}.`);
                              })
                              .catch((approvalError) => setError((approvalError as Error).message));
                          }}
                          className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-white disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={!canApprove}
                          onClick={() => {
                            if (!token) return;
                            fetch(`${API_BASE_URL}/admin/approvals/${approval.id}/decide`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                ...authHeaders(token),
                              },
                              body: JSON.stringify({ decision: 'reject', actor: session.user.role }),
                            })
                              .then(async (response) => {
                                if (!response.ok) {
                                  const payload = (await response.json().catch(() => ({}))) as { error?: string };
                                  throw new Error(payload.error ?? 'Could not reject request.');
                                }
                                await refreshAppState(token);
                                setActionMessage(`Rejected ${approval.id}.`);
                              })
                              .catch((approvalError) => setError((approvalError as Error).message));
                          }}
                          className="rounded-full bg-stone-200 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-stone-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <GateMessage message="No approvals are waiting." />
              )}
            </Card>

            <Card title="Vasy export" subtitle="The live contract we can send to ERP.">
              {erpContractPreview ? (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-700">
                    <div className="font-semibold text-stone-950">Orders ready for export</div>
                    <div>{erpContractPreview.orderCount}</div>
                  </div>
                  <div className="rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-700">
                    <div className="font-semibold text-stone-950">Batches ready for export</div>
                    <div>{erpContractPreview.batchCount}</div>
                  </div>
                  <button
                    type="button"
                    disabled={!canApprove}
                    onClick={() => {
                      if (!token) return;
                      fetch(`${API_BASE_URL}/erp/vasy/push`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          ...authHeaders(token),
                        },
                        body: JSON.stringify({
                          entries: erpContractPreview.orders.map((order) => ({
                            orderId: order.orderId,
                            status: order.status,
                          })),
                        }),
                      })
                        .then(async (response) => {
                          if (!response.ok) {
                            const payload = (await response.json().catch(() => ({}))) as { error?: string };
                            throw new Error(payload.error ?? 'Could not push ERP payload.');
                          }
                          await refreshAppState(token);
                          setActionMessage('Vasy export submitted.');
                        })
                        .catch((pushError) => setError((pushError as Error).message));
                    }}
                    className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Push export preview
                  </button>
                </div>
              ) : (
                <GateMessage message="ERP export preview is available only for sync-enabled roles." />
              )}
            </Card>

            <Card title="Role scope" subtitle="What this role can touch right now.">
              <div className="space-y-2 text-sm text-stone-700">
                {describeAccess(session.user.role, permissions).map((line) => (
                  <div key={line} className="rounded-2xl bg-stone-50 px-4 py-3">
                    {line}
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Support inbox" subtitle="Open cases waiting on the customer or bakery team.">
              {supportInbox.length > 0 ? (
                <div className="space-y-3">
                  {supportInbox.map((supportCase) => (
                    <div key={supportCase.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-extrabold text-stone-950">{supportCase.subject}</div>
                          <div className="text-xs text-stone-500">{supportCase.customerId}</div>
                        </div>
                        <div className="text-xs uppercase tracking-[0.18em] text-stone-400">{supportCase.status}</div>
                      </div>
                      <div className="mt-2 text-sm text-stone-700">
                        Priority: {supportCase.priority} | Assigned to {supportCase.assignedTo ?? 'unassigned'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <GateMessage message="No support cases are waiting." />
              )}
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function buildMetrics(state: AppState) {
  const outstanding = state.customers.reduce((sum, customer) => sum + customer.outstandingBalance, 0);
  const bookedCapacity = state.capacities.reduce((sum, capacity) => sum + capacity.bookedQuantity, 0);
  const totalCapacity = state.capacities.reduce((sum, capacity) => sum + capacity.capacity, 0);
  const bookedRoutes = state.slots.reduce((sum, slot) => sum + slot.bookedOrders, 0);
  const totalRoutes = state.slots.reduce((sum, slot) => sum + slot.maxOrders, 0);

  return {
    outstanding,
    orders: state.orders.length,
    capacityFill: totalCapacity === 0 ? 0 : Math.round((bookedCapacity / totalCapacity) * 100),
    routeFill: totalRoutes === 0 ? 0 : Math.round((bookedRoutes / totalRoutes) * 100),
  };
}

function getAllowedSections(
  role: PortalRole | null,
  permissions: Permissions,
): Array<'overview' | 'customers' | 'production' | 'delivery' | 'operations'> {
  const sections: Array<'overview' | 'customers' | 'production' | 'delivery' | 'operations'> = ['overview'];

  if (role && role !== 'production') {
    sections.push('customers');
  }
  if (role === 'owner' || role === 'manager' || role === 'production') {
    sections.push('production');
  }
  if (role === 'owner' || role === 'manager' || role === 'delivery' || role === 'support') {
    sections.push('delivery');
  }
  if (permissions.canEditOrders || permissions.canCaptureReturns || permissions.canSyncErp) {
    sections.push('operations');
  }

  return sections;
}

function describeRole(role: PortalRole) {
  switch (role) {
    case 'owner':
      return 'Full access across customers, operations, production, delivery, and ERP controls.';
    case 'manager':
      return 'Can manage orders, returns, and sync checks with broad oversight.';
    case 'production':
      return 'Production-only view focused on batch sheets and line readiness.';
    case 'delivery':
      return 'Route-focused view for stops, POD capture, and return handling.';
    case 'accounts':
      return 'Finance-focused access for customer risk and receivables.';
    case 'support':
      return 'Support view for customer help and controlled issue resolution.';
  }
}

function describeAccess(role: PortalRole, permissions: Permissions) {
  return [
    role === 'production' ? 'Customer records are hidden.' : 'Customer records are visible.',
    role === 'delivery' ? 'Production sheets are hidden.' : 'Production sheets are visible.',
    role === 'accounts' ? 'Delivery routes are hidden.' : 'Delivery routes are visible.',
    permissions.canEditOrders ? 'Order edits are allowed.' : 'Order edits are blocked.',
    permissions.canCaptureReturns ? 'Return capture is allowed.' : 'Return capture is blocked.',
    permissions.canSyncErp ? 'ERP sync can be triggered.' : 'ERP sync is blocked.',
  ];
}

function buildAlerts(customers: CustomerAccount[], capacities: ProductDayCapacity[]) {
  const alerts: string[] = [];

  const watchedCustomers = customers.filter(
    (customer) => customer.riskState === 'watch' || customer.riskState === 'block_soon',
  );
  if (watchedCustomers.length > 0) {
    alerts.push(`${watchedCustomers.length} customers are in watch or block-soon state.`);
  }

  const throttledCapacity = capacities.filter((capacity) => capacity.status === 'throttled').length;
  if (throttledCapacity > 0) {
    alerts.push(`${throttledCapacity} production lines are throttled for tomorrow.`);
  }

  if (alerts.length === 0) {
    alerts.push('No active guardrail alerts right now.');
  }

  return alerts;
}

function LoginScreen({
  username,
  password,
  error,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: {
  username: string;
  password: string;
  error: string | null;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,210,172,.35),_transparent_28%),linear-gradient(180deg,#fff8f0_0%,#f6eadc_100%)] px-4 py-10 text-stone-900">
      <div className="mx-auto flex min-h-[80vh] max-w-xl items-center">
        <div className="w-full rounded-[2rem] border border-stone-200/70 bg-white/90 p-8 shadow-[0_24px_80px_rgba(87,50,20,.12)]">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-orange-700">
            Aeden Bakes super admin
          </div>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-stone-950">Sign in</h1>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Use a role account to open the operations console.
          </p>
          <div className="mt-6 grid gap-4">
            <Field label="Username" value={username} onChange={onUsernameChange} />
            <Field label="Password" value={password} onChange={onPasswordChange} type="password" />
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                {error}
              </div>
            ) : null}
            <button
              type="button"
              onClick={onSubmit}
              className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-bold text-white"
            >
              Sign in
            </button>
            <div className="rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-600">
              Demo accounts: owner / owner123, manager / manager123, production / production123,
              delivery / delivery123, accounts / accounts123, support / support123
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(180deg,#fff8f0_0%,#f6eadc_100%)] text-stone-700">
      <div className="rounded-2xl border border-stone-200 bg-white px-6 py-4 shadow">
        {message}
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-[0.18em] text-stone-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none focus:border-orange-500"
      />
    </label>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-stone-200/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(87,50,20,.1)]">
      <SectionTitle title={title} subtitle={subtitle} />
      <div className="mt-5">{children}</div>
    </div>
  );
}

function GateMessage({ message }: { message: string }) {
  return <div className="rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-600">{message}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3">
      <div className="text-xs uppercase tracking-[0.18em] text-stone-300">{label}</div>
      <div className="mt-1 text-lg font-extrabold">{value}</div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-2xl font-black tracking-tight text-stone-950">{title}</h2>
      <p className="text-sm leading-6 text-stone-600">{subtitle}</p>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-stone-400">{label}</div>
      <div className="mt-1 font-bold text-stone-900">{value}</div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'good' | 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'good'
      ? 'bg-emerald-100 text-emerald-900'
      : tone === 'warn'
        ? 'bg-amber-100 text-amber-900'
        : 'bg-rose-100 text-rose-900';

  return (
    <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm">
      <span className="font-semibold text-stone-700">{label}</span>
      <span className={`rounded-full px-3 py-1 text-xs font-black ${toneClass}`}>{value}</span>
    </div>
  );
}

function ActionButton({
  enabled,
  label,
  onClick,
}: {
  enabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onClick}
      className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-left text-sm font-semibold text-stone-900 transition hover:-translate-y-0.5 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {enabled ? label : `${label} (blocked by role)`}
    </button>
  );
}
