'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:4000';
const SHOW_DEMO_ACCESS = process.env.NODE_ENV !== 'production';

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

type CustomerBranch = {
  id: string;
  customerId: string;
  name: string;
  code: string;
  status: 'active' | 'paused' | 'service_hold' | 'closed';
  serviceZone: string;
  deliveryNotes?: string;
  createdAt: string;
  updatedAt: string;
};

type CustomerUserMembership = {
  id: string;
  customerId: string;
  branchId: string | null;
  displayName: string;
  role: 'admin' | 'buyer' | 'manager' | 'viewer';
  status: 'invited' | 'active' | 'revoked';
  phone?: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
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
  branchId?: string | null;
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
    | 'standing_order_created'
    | 'standing_order_updated'
    | 'standing_order_paused'
    | 'standing_order_resumed'
    | 'standing_order_run_generated'
    | 'note_added'
    | 'account_flagged'
    | 'delivery_exception';
  referenceId: string;
  summary: string;
  createdAt: string;
};

type StandingOrderItem = {
  productId: string;
  quantity: number;
};

type StandingOrderSchedule = {
  deliveryDays: number[];
  slotId: string;
  paymentMode: 'prepaid' | 'part-pay' | 'credit';
  items: StandingOrderItem[];
  notes?: string;
};

type StandingOrder = {
  id: string;
  customerId: string;
  status: 'draft' | 'active' | 'paused' | 'cancelled';
  schedule: StandingOrderSchedule;
  createdAt: string;
  updatedAt: string;
};

type StandingOrderRun = {
  id: string;
  standingOrderId: string;
  serviceDate: string;
  status: 'generated' | 'skipped' | 'failed';
  generatedOrderId: string | null;
  reason?: string;
  createdAt: string;
};

type StandingOrderPause = {
  id: string;
  standingOrderId: string;
  startDate: string;
  endDate: string | null;
  reason: string;
  createdAt: string;
};

type RecurrenceRule = {
  id: string;
  customerId: string | null;
  branchId: string | null;
  ruleCode: string;
  cadence: 'daily' | 'weekly' | 'custom';
  status: 'active' | 'paused';
  payload: {
    deliveryDays: number[];
    slotId: string;
    notes?: string;
    branchScoped: boolean;
  };
  createdAt: string;
  updatedAt: string;
};

type StandingOrderChange = {
  id: string;
  standingOrderId: string;
  customerId: string;
  branchId: string | null;
  changeType: 'schedule_update' | 'pause' | 'resume' | 'branch_move' | 'cancel';
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'applied';
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  reason: string;
};

type CustomerPricingRule = {
  id: string;
  customerId: string | null;
  branchId: string | null;
  productId: string | null;
  price: number;
  pricingMode: 'fixed' | 'discount_percent';
  status: 'active' | 'paused';
  reason?: string;
  createdAt: string;
  updatedAt: string;
};

type CreditLedgerEntry = {
  id: string;
  customerId: string;
  branchId: string | null;
  entryType: 'invoice' | 'payment' | 'credit_note' | 'adjustment' | 'hold' | 'release';
  amount: number;
  balanceAfter: number;
  referenceType: string;
  referenceId: string;
  note?: string;
  createdAt: string;
};

type CreditHoldEvent = {
  id: string;
  customerId: string;
  branchId: string | null;
  status: 'active' | 'released';
  reason: string;
  createdAt: string;
  releasedAt: string | null;
};

type SubstitutionRule = {
  id: string;
  customerId: string | null;
  branchId: string | null;
  productId: string;
  substituteProductId: string;
  status: 'active' | 'paused';
  reason: string;
  createdAt: string;
  updatedAt: string;
};

type SubstitutionEvent = {
  id: string;
  customerId: string;
  branchId: string | null;
  orderId: string | null;
  productId: string;
  substituteProductId: string;
  status: 'proposed' | 'approved' | 'applied' | 'rejected';
  reason: string;
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
  branches: CustomerBranch[];
  users: CustomerUserMembership[];
  notes: CustomerNote[];
  timeline: CustomerTimelineEvent[];
  supportCases: SupportCase[];
  standingOrders: StandingOrder[];
  recurrenceRules: RecurrenceRule[];
  standingOrderChanges: StandingOrderChange[];
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
  | 'approval_rejected'
  | 'standing_order_created'
  | 'standing_order_updated'
  | 'standing_order_paused'
  | 'standing_order_resumed'
  | 'standing_order_run_generated';
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

type NotificationJob = {
  id: string;
  channel: 'sms' | 'whatsapp' | 'email' | 'in_app';
  templateCode: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'retrying';
  correlationKey: string;
  recipient: string;
  subject: string;
  createdAt: string;
  sentAt: string | null;
  provider: 'push' | 'whatsapp' | 'sms' | 'internal';
};

type NotificationDelivery = {
  id: string;
  jobId: string;
  recipient: string;
  providerMessageId: string | null;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'retrying';
  attemptNo: number;
  createdAt: string;
  gateway: 'push' | 'whatsapp' | 'sms' | 'internal';
  errorMessage: string | null;
};

type NotificationTemplate = {
  code: string;
  name: string;
  channelPriority: Array<NotificationJob['channel']>;
  subject: string;
  body: string;
  retryable: boolean;
};

type NotificationPreference = {
  customerId: string;
  pushEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  phone?: string;
  whatsappNumber?: string;
  updatedAt: string;
};

type DocumentRecord = {
  id: string;
  customerId: string;
  documentType: 'gst' | 'credit' | 'proof' | 'invoice' | 'other';
  status: 'draft' | 'uploaded' | 'verified' | 'archived';
  title: string;
  fileName: string;
  mimeType: string;
  downloadUrl: string;
  tags: string[];
  createdAt: string;
  verifiedAt: string | null;
};

type InvoiceExport = {
  id: string;
  customerId: string;
  invoiceNumber: string;
  fileName: string;
  status: 'ready' | 'downloaded' | 'emailed' | 'archived';
  amount: number;
  createdAt: string;
  downloadUrl: string;
};

type AccountHealthSnapshot = {
  id: string;
  customerId: string;
  healthState: 'healthy' | 'watch' | 'block_soon' | 'blocked';
  riskScore: number;
  exposure: number;
  reasonJson: string[];
  createdAt: string;
};

type AccountAction = {
  id: string;
  customerId: string;
  actionType: string;
  reason: string;
  createdBy: string;
  approvedBy: string | null;
  createdAt: string;
};

type AlertRule = {
  id: string;
  ruleCode: string;
  thresholdJson: Record<string, unknown>;
  active: boolean;
  createdAt: string;
};

type AlertEvent = {
  id: string;
  ruleId: string;
  severity: 'info' | 'warn' | 'critical';
  payloadJson: Record<string, unknown>;
  createdAt: string;
  acknowledgedAt: string | null;
};

type AnalyticsSnapshot = {
  id: string;
  snapshotTime: string;
  status: 'building' | 'ready' | 'published';
  payloadJson: Record<string, unknown>;
  createdAt: string;
};

type KpiRollup = {
  id: string;
  metricCode: string;
  serviceDate: string;
  value: number;
  createdAt: string;
};

type AnalyticsSnapshotPayload = {
  snapshotTime: string;
  totals: {
    customers: number;
    activeCustomers: number;
    repeatCustomers: number;
    repeatPurchaseRate: number;
    orders: number;
    revenue: number;
    averageOrderValue: number;
    supportOpen: number;
    activeStandingOrders: number;
    watchCustomers: number;
    deliverySuccessRate: number;
    returnOrders: number;
    returnQuantity: number;
    failedDeliveries: number;
    partialDeliveries: number;
    creditExposure: number;
  };
  customers: {
    segments: {
      newCustomers: number;
      repeatCustomers: number;
      dormantCustomers: number;
      highValueCustomers: number;
      watchCustomers: number;
    };
    definitions: Array<{
      code: string;
      name: string;
      description: string;
      active: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
    memberships: Array<{
      id: string;
      segmentCode: string;
      customerId: string;
      createdAt: string;
    }>;
    topCustomers: Array<{
      customerId: string;
      customerName: string;
      orderCount: number;
      revenue: number;
      outstandingBalance: number;
      riskState: string;
      tier: string;
    }>;
  };
  branches: {
    totalBranches: number;
    activeBranches: number;
    performance: Array<{
      branchId: string;
      branchName: string;
      customerId: string;
      status: string;
      orderCount: number;
      revenue: number;
      returnCount: number;
      failureCount: number;
      deliverySuccessRate: number;
      averageOrderValue: number;
    }>;
  };
  capacity: {
    booked: number;
    total: number;
    fillRate: number;
  };
  delivery: {
    delivered: number;
    partialDeliveries: number;
    failedDeliveries: number;
    returnedOrders: number;
    returnedQuantity: number;
    deliverySuccessRate: number;
    returnRate: number;
  };
  credit: {
    exposure: number;
    utilizationRate: number;
    buckets: {
      healthy: number;
      watch: number;
      blockSoon: number;
      blocked: number;
    };
    watchCustomers: Array<{
      customerId: string;
      customerName: string;
      riskState: string;
      outstandingBalance: number;
      creditLimit: number;
    }>;
  };
  pricing: {
    orderMix: {
      prepaid: number;
      partPay: number;
      credit: number;
    };
    pricingRules: number;
    branchOverrides: number;
    customerOverrides: number;
    averageOrderValue: number;
  };
  margin: {
    revenue: number;
    estimatedCost: number;
    grossMargin: number;
    grossMarginRate: number;
    productBreakdown: Array<{
      productId: string;
      productName: string;
      category: string;
      revenue: number;
      estimatedCost: number;
      grossMargin: number;
      grossMarginRate: number;
    }>;
    branchBreakdown: Array<{
      branchId: string;
      branchName: string;
      revenue: number;
      estimatedCost: number;
      grossMargin: number;
      grossMarginRate: number;
    }>;
  };
};

type CustomerRequest = {
  id: string;
  customerId: string;
  requestType: 'address_change' | 'reorder' | 'support_follow_up' | 'delivery_note';
  status: 'draft' | 'submitted' | 'in_review' | 'completed' | 'rejected';
  reason: string;
  createdAt: string;
  decidedAt: string | null;
};

type SavedAddress = {
  id: string;
  customerId: string;
  label: string;
  addressLine: string;
  deliveryZone: string;
  active: boolean;
};

type ReportExport = {
  id: string;
  reportCode: string;
  createdBy: string;
  createdAt: string;
  status: 'queued' | 'generated' | 'delivered';
  generatedAt: string | null;
  deliveredAt: string | null;
  payloadJson: Record<string, unknown>;
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
  standingOrders: StandingOrder[];
  standingOrderRuns: StandingOrderRun[];
  standingOrderPauses: StandingOrderPause[];
  recurrenceRules: RecurrenceRule[];
  standingOrderChanges: StandingOrderChange[];
  customerPricingRules: CustomerPricingRule[];
  creditLedgerEntries: CreditLedgerEntry[];
  creditHoldEvents: CreditHoldEvent[];
  substitutionRules: SubstitutionRule[];
  substitutionEvents: SubstitutionEvent[];
  erpContractPreview: VasyErpContractPreview | null;
  notifications: {
    jobs: NotificationJob[];
    deliveries: NotificationDelivery[];
    templates: NotificationTemplate[];
    preferences: NotificationPreference[];
  };
  documents: DocumentRecord[];
  invoiceExports: InvoiceExport[];
  accountHealth: {
    snapshots: AccountHealthSnapshot[];
    actions: AccountAction[];
  };
  analytics: {
    latest: AnalyticsSnapshot | null;
    snapshots: AnalyticsSnapshot[];
    rollups: KpiRollup[];
    insights: AnalyticsSnapshotPayload | null;
  };
  customerRequests: CustomerRequest[];
  savedAddresses: SavedAddress[];
  alertRules: AlertRule[];
  alertEvents: AlertEvent[];
  reportExports: ReportExport[];
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
  standingOrders: [],
  standingOrderRuns: [],
  standingOrderPauses: [],
  recurrenceRules: [],
  standingOrderChanges: [],
  customerPricingRules: [],
  creditLedgerEntries: [],
  creditHoldEvents: [],
  substitutionRules: [],
  substitutionEvents: [],
  erpContractPreview: null,
  notifications: { jobs: [], deliveries: [], templates: [], preferences: [] },
  documents: [],
  invoiceExports: [],
  accountHealth: { snapshots: [], actions: [] },
  analytics: { latest: null, snapshots: [], rollups: [], insights: null },
  customerRequests: [],
  savedAddresses: [],
  alertRules: [],
  alertEvents: [],
  reportExports: [],
};

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loginUsername, setLoginUsername] = useState(SHOW_DEMO_ACCESS ? 'owner' : '');
  const [loginPassword, setLoginPassword] = useState(SHOW_DEMO_ACCESS ? 'owner123' : '');
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState>(initialAppState);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer360Response | null>(null);
  const [supportCaseDraft, setSupportCaseDraft] = useState('');
  const [supportNoteDraft, setSupportNoteDraft] = useState('');
  const [standingOrderCustomerId, setStandingOrderCustomerId] = useState('cust_cafe_nook');
  const [standingOrderSlotId, setStandingOrderSlotId] = useState('slot_morning');
  const [standingOrderDaysDraft, setStandingOrderDaysDraft] = useState('1,2,3,4,5');
  const [standingOrderPaymentMode, setStandingOrderPaymentMode] = useState<'prepaid' | 'part-pay' | 'credit'>('credit');
  const [standingOrderItemsDraft, setStandingOrderItemsDraft] = useState('[{"productId":"prod_loaf","quantity":12}]');
  const [standingOrderNotesDraft, setStandingOrderNotesDraft] = useState('Weekday breakfast repeat.');
  const [standingOrderRunDate, setStandingOrderRunDate] = useState(new Date().toISOString().slice(0, 10));
  const [recurrenceRuleCustomerId, setRecurrenceRuleCustomerId] = useState('cust_cafe_nook');
  const [recurrenceRuleBranchId, setRecurrenceRuleBranchId] = useState('branch_cafe_nook_main');
  const [recurrenceRuleCode, setRecurrenceRuleCode] = useState('weekday_breakfast_repeat');
  const [recurrenceRuleDaysDraft, setRecurrenceRuleDaysDraft] = useState('1,2,3,4,5');
  const [recurrenceRuleSlotId, setRecurrenceRuleSlotId] = useState('slot_morning');
  const [recurrenceRuleNotes, setRecurrenceRuleNotes] = useState('Auto-generate weekday breakfast runs.');
  const [pricingRuleCustomerId, setPricingRuleCustomerId] = useState('cust_cafe_nook');
  const [pricingRuleBranchId, setPricingRuleBranchId] = useState('branch_cafe_nook_main');
  const [pricingRuleProductId, setPricingRuleProductId] = useState('prod_loaf');
  const [pricingRulePrice, setPricingRulePrice] = useState('88');
  const [pricingRuleReason, setPricingRuleReason] = useState('Contract price for weekday breakfast.');
  const [creditHoldCustomerId, setCreditHoldCustomerId] = useState('cust_hotel_lotus');
  const [creditHoldReason, setCreditHoldReason] = useState('Credit review pending after month-end exposure.');
  const [subRuleCustomerId, setSubRuleCustomerId] = useState('');
  const [subRuleBranchId, setSubRuleBranchId] = useState('');
  const [subRuleProductId, setSubRuleProductId] = useState('prod_loaf');
  const [subRuleReplacementId, setSubRuleReplacementId] = useState('prod_danish');
  const [subRuleReason, setSubRuleReason] = useState('Fallback substitute when the main item is tight.');
  const [notificationCustomerId, setNotificationCustomerId] = useState('cust_cafe_nook');
  const [notificationTemplateCode, setNotificationTemplateCode] = useState('order_confirmed');
  const [notificationChannel, setNotificationChannel] = useState<'in_app' | 'sms' | 'whatsapp' | 'email'>('whatsapp');
  const [notificationSubject, setNotificationSubject] = useState('Order confirmed');
  const [notificationBody, setNotificationBody] = useState('We have locked your order and the bakery team is preparing your batch.');
  const [documentCustomerId, setDocumentCustomerId] = useState('cust_cafe_nook');
  const [documentTitle, setDocumentTitle] = useState('GST certificate');
  const [documentFileName, setDocumentFileName] = useState('gst-certificate.pdf');
  const [documentType, setDocumentType] = useState<DocumentRecord['documentType']>('gst');
  const [invoiceCustomerId, setInvoiceCustomerId] = useState('cust_cafe_nook');
  const [invoiceNumber, setInvoiceNumber] = useState('INV-2402');
  const [invoiceAmount, setInvoiceAmount] = useState('12640');
  const [activeSection, setActiveSection] = useState<'overview' | 'customers' | 'production' | 'delivery' | 'operations'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearSession = useCallback(() => {
    window.sessionStorage.removeItem('aeden-bakes-session-token');
    setToken(null);
    setSession(null);
    setSelectedCustomer(null);
  }, []);

  const refreshAppState = useCallback(
    async (
      sessionToken = token,
      canSyncErp = session?.permissions.canSyncErp ?? false,
      role = session?.user.role ?? null,
    ) => {
      if (!sessionToken) {
        setAppState(initialAppState);
        return;
      }

      const canViewOps = role ? ['owner', 'manager', 'accounts', 'support'].includes(role) : false;
      const canViewStanding = role ? ['owner', 'manager', 'accounts', 'production', 'support'].includes(role) : false;
      const canViewCommercial = role ? ['owner', 'manager', 'accounts', 'support'].includes(role) : false;
      const [
        customersRes,
        catalogRes,
        ordersRes,
        operationsRes,
        supportRes,
        standingRes,
        commercialRes,
      notificationsRes,
      accountHealthRes,
      analyticsRes,
      customerRequestsRes,
      savedAddressesRes,
      alertRulesRes,
      reportsRes,
      documentsRes,
      invoicesRes,
      ] = await Promise.all([
        sessionToken
          ? fetchWithTimeout(`${API_BASE_URL}/customers`, { headers: authHeaders(sessionToken) })
          : Promise.resolve(null),
        sessionToken
          ? fetchWithTimeout(`${API_BASE_URL}/catalog`, { headers: authHeaders(sessionToken) })
          : Promise.resolve(null),
        sessionToken
          ? fetchWithTimeout(`${API_BASE_URL}/orders`, { headers: authHeaders(sessionToken) })
          : Promise.resolve(null),
        sessionToken && canViewOps ? fetchWithTimeout(`${API_BASE_URL}/admin/operations`, { headers: authHeaders(sessionToken) }) : Promise.resolve(null),
        sessionToken && canViewOps ? fetchWithTimeout(`${API_BASE_URL}/support/cases`, { headers: authHeaders(sessionToken) }) : Promise.resolve(null),
        sessionToken && canViewStanding ? fetchWithTimeout(`${API_BASE_URL}/standing-orders`, { headers: authHeaders(sessionToken) }) : Promise.resolve(null),
        sessionToken && canViewCommercial ? fetchWithTimeout(`${API_BASE_URL}/commercial/overview`, { headers: authHeaders(sessionToken) }) : Promise.resolve(null),
        sessionToken && canViewCommercial ? fetchWithTimeout(`${API_BASE_URL}/notifications`, { headers: authHeaders(sessionToken) }) : Promise.resolve(null),
        sessionToken && canViewCommercial ? fetchWithTimeout(`${API_BASE_URL}/account-health`, { headers: authHeaders(sessionToken) }) : Promise.resolve(null),
        sessionToken && canViewCommercial ? fetchWithTimeout(`${API_BASE_URL}/analytics/overview`, { headers: authHeaders(sessionToken) }) : Promise.resolve(null),
        sessionToken ? fetchWithTimeout(`${API_BASE_URL}/customer/requests`, { headers: authHeaders(sessionToken) }) : Promise.resolve(null),
        sessionToken ? fetchWithTimeout(`${API_BASE_URL}/customer/addresses`, { headers: authHeaders(sessionToken) }) : Promise.resolve(null),
        sessionToken && canViewCommercial ? fetchWithTimeout(`${API_BASE_URL}/alert-rules`, { headers: authHeaders(sessionToken) }) : Promise.resolve(null),
        sessionToken && canViewCommercial ? fetchWithTimeout(`${API_BASE_URL}/reports`, { headers: authHeaders(sessionToken) }) : Promise.resolve(null),
        sessionToken && canViewCommercial ? fetchWithTimeout(`${API_BASE_URL}/documents`, { headers: authHeaders(sessionToken) }) : Promise.resolve(null),
        sessionToken && canViewCommercial ? fetchWithTimeout(`${API_BASE_URL}/invoices`, { headers: authHeaders(sessionToken) }) : Promise.resolve(null),
      ]);

      if (!customersRes || !catalogRes || !ordersRes || !customersRes.ok || !catalogRes.ok || !ordersRes.ok) {
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
      let standingOrders: StandingOrder[] = [];
      let standingOrderRuns: StandingOrderRun[] = [];
      let standingOrderPauses: StandingOrderPause[] = [];
      let recurrenceRules: RecurrenceRule[] = [];
      let standingOrderChanges: StandingOrderChange[] = [];
      let customerPricingRules: CustomerPricingRule[] = [];
      let creditLedgerEntries: CreditLedgerEntry[] = [];
      let creditHoldEvents: CreditHoldEvent[] = [];
      let substitutionRules: SubstitutionRule[] = [];
      let substitutionEvents: SubstitutionEvent[] = [];
      let erpSyncStatus: ErpSyncStatus | null = null;
      let erpContractPreview: VasyErpContractPreview | null = null;
      let notifications: AppState['notifications'] = { jobs: [], deliveries: [], templates: [], preferences: [] };
      let accountHealth: AppState['accountHealth'] = { snapshots: [], actions: [] };
      let analytics: AppState['analytics'] = { latest: null, snapshots: [], rollups: [], insights: null };
      let customerRequests: CustomerRequest[] = [];
      let savedAddresses: SavedAddress[] = [];
      let alertRules: AlertRule[] = [];
      let alertEvents: AlertEvent[] = [];
      let reportExports: ReportExport[] = [];
      let documents: DocumentRecord[] = [];
      let invoiceExports: InvoiceExport[] = [];

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

      if (standingRes) {
        if (!standingRes.ok) {
          throw new Error('Could not refresh recurring orders.');
        }
        const standingJson = await standingRes.json();
        standingOrders = standingJson.standingOrders ?? [];
        standingOrderRuns = standingJson.standingOrderRuns ?? [];
        standingOrderPauses = standingJson.standingOrderPauses ?? [];
        recurrenceRules = standingJson.recurrenceRules ?? [];
        standingOrderChanges = standingJson.standingOrderChanges ?? [];
      }

      if (commercialRes) {
        if (!commercialRes.ok) {
          throw new Error('Could not refresh commercial controls.');
        }
        const commercialJson = await commercialRes.json();
        customerPricingRules = commercialJson.pricingRules ?? [];
        creditLedgerEntries = commercialJson.creditLedgerEntries ?? [];
        creditHoldEvents = commercialJson.creditHoldEvents ?? [];
        substitutionRules = commercialJson.substitutionRules ?? [];
        substitutionEvents = commercialJson.substitutionEvents ?? [];
      }

      if (notificationsRes) {
        if (!notificationsRes.ok) {
          throw new Error('Could not refresh notifications.');
        }
        const notificationsJson = await notificationsRes.json();
        notifications = {
          jobs: notificationsJson.jobs ?? [],
          deliveries: notificationsJson.deliveries ?? [],
          templates: notificationsJson.templates ?? [],
          preferences: notificationsJson.preferences ?? [],
        };
      }

      if (accountHealthRes) {
        if (!accountHealthRes.ok) {
          throw new Error('Could not refresh account health.');
        }
        const accountHealthJson = await accountHealthRes.json();
        accountHealth = {
          snapshots: accountHealthJson.snapshots ?? [],
          actions: accountHealthJson.actions ?? [],
        };
      }

      if (analyticsRes) {
        if (!analyticsRes.ok) {
          throw new Error('Could not refresh analytics.');
        }
        const analyticsJson = await analyticsRes.json();
        analytics = {
          latest: analyticsJson.latest ?? null,
          snapshots: analyticsJson.snapshots ?? [],
          rollups: analyticsJson.rollups ?? [],
          insights: analyticsJson.insights ?? null,
        };
      }

      if (customerRequestsRes) {
        if (!customerRequestsRes.ok) {
          throw new Error('Could not refresh customer requests.');
        }
        const customerRequestsJson = await customerRequestsRes.json();
        customerRequests = customerRequestsJson.requests ?? [];
      }

      if (savedAddressesRes) {
        if (!savedAddressesRes.ok) {
          throw new Error('Could not refresh saved addresses.');
        }
        const savedAddressesJson = await savedAddressesRes.json();
        savedAddresses = savedAddressesJson.addresses ?? [];
      }

      if (alertRulesRes) {
        if (!alertRulesRes.ok) {
          throw new Error('Could not refresh alert rules.');
        }
        const alertRulesJson = await alertRulesRes.json();
        alertRules = alertRulesJson.alertRules ?? [];
        alertEvents = alertRulesJson.alertEvents ?? [];
      }

      if (reportsRes) {
        if (!reportsRes.ok) {
          throw new Error('Could not refresh report exports.');
        }
        const reportsJson = await reportsRes.json();
        reportExports = reportsJson.reportExports ?? [];
      }

      if (documentsRes) {
        if (!documentsRes.ok) {
          throw new Error('Could not refresh documents.');
        }
        const documentsJson = await documentsRes.json();
        documents = documentsJson.documents ?? [];
      }

      if (invoicesRes) {
        if (!invoicesRes.ok) {
          throw new Error('Could not refresh invoices.');
        }
        const invoicesJson = await invoicesRes.json();
        invoiceExports = invoicesJson.invoiceExports ?? [];
      }

      if (sessionToken && canSyncErp) {
        const contractResponse = await fetchWithTimeout(`${API_BASE_URL}/erp/vasy/contract`, {
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
        standingOrders,
        standingOrderRuns,
        standingOrderPauses,
        recurrenceRules,
        standingOrderChanges,
        customerPricingRules,
        creditLedgerEntries,
        creditHoldEvents,
        substitutionRules,
        substitutionEvents,
        erpContractPreview,
        notifications,
        accountHealth,
        analytics,
        customerRequests,
        savedAddresses,
        alertRules,
        alertEvents,
        reportExports,
        documents,
        invoiceExports,
      });
    },
    [session?.permissions.canSyncErp, session?.user.role, token],
  );

  useEffect(() => {
    const savedToken = window.sessionStorage.getItem('aeden-bakes-session-token');
    const timer = window.setTimeout(() => {
      if (!savedToken) {
        setLoadingAuth(false);
        return;
      }

      setToken(savedToken);
      void (async () => {
        const response = await fetchWithTimeout(`${API_BASE_URL}/auth/me`, {
          headers: authHeaders(savedToken),
        });

        if (!response.ok) {
          throw new Error('Session expired');
        }

        const payload = (await response.json()) as SessionPayload;
        setSession(payload);
        await refreshAppState(savedToken, payload.permissions.canSyncErp, payload.user.role);
      })()
        .catch(() => {
          clearSession();
        })
        .finally(() => setLoadingAuth(false));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [clearSession, refreshAppState]);

  const permissions = useMemo(
    () => session?.permissions ?? { canEditOrders: false, canCaptureReturns: false, canSyncErp: false },
    [session],
  );
  const role = session?.user.role ?? null;
  const metrics = useMemo(() => buildMetrics(appState), [appState]);
  const allowedSections = useMemo(() => getAllowedSections(role, permissions), [role, permissions]);
  const visibleSection = allowedSections.includes(activeSection) ? activeSection : allowedSections[0];
  const canApprove = role === 'owner' || role === 'manager';
  const {
    customers,
    products,
    capacities,
    slots,
    orders,
    auditEvents,
    erpSyncStatus,
    approvals,
    supportCases,
    standingOrders,
    standingOrderRuns,
    standingOrderPauses,
    recurrenceRules,
    standingOrderChanges,
    customerPricingRules,
    creditLedgerEntries,
    creditHoldEvents,
    substitutionRules,
    substitutionEvents,
    erpContractPreview,
    notifications,
    analytics,
    documents,
    invoiceExports,
  } = appState;
  const analyticsPayload = analytics.insights;
  const latestEvents = auditEvents.slice(0, 4);
  const selectedCustomerOrders = selectedCustomer?.orders ?? [];
  const pendingApprovals = approvals.filter((approval) => approval.status === 'pending');
  const supportInbox = supportCases.filter((supportCase) => supportCase.status !== 'closed');
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredCustomers = useMemo(() => {
    if (!normalizedQuery) {
      return customers;
    }

    return customers.filter((customer) =>
      [
        customer.name,
        customer.tier,
        customer.deliveryZone,
        customer.riskState,
        customer.id,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [customers, normalizedQuery]);
  const filteredSupportInbox = useMemo(() => {
    if (!normalizedQuery) {
      return supportInbox;
    }

    return supportInbox.filter((supportCase) =>
      [
        supportCase.subject,
        supportCase.customerId,
        supportCase.status,
        supportCase.priority,
        supportCase.id,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [normalizedQuery, supportInbox]);
  const filteredEvents = useMemo(() => {
    if (!normalizedQuery) {
      return latestEvents;
    }

    return latestEvents.filter((event) =>
      [event.summary, event.actor, event.kind, event.referenceId].join(' ').toLowerCase().includes(normalizedQuery),
    );
  }, [latestEvents, normalizedQuery]);
  const topCustomers = filteredCustomers.slice(0, 4);
  const sectionLabel = {
    overview: 'Command center',
    customers: 'Customer directory',
    production: 'Production board',
    delivery: 'Delivery network',
    operations: 'Operations control',
  }[visibleSection];
  const sectionSubtitle = {
    overview: 'Live overview for Aeden Bakes',
    customers: 'Accounts, risk, and service context',
    production: 'Capacity, mix, and line readiness',
    delivery: 'Route load, stops, and timing',
    operations: 'Approvals, returns, and ERP sync',
  }[visibleSection];
  const sessionInitials = session?.user.displayName
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AB';

  async function publishAnalyticsSnapshot() {
    if (!token) {
      return;
    }
    const response = await fetchWithTimeout(`${API_BASE_URL}/analytics/publish`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Could not publish analytics snapshot.');
    }
    await refreshAppState();
  }

  async function queueManagementReport() {
    if (!token) {
      return;
    }
    const response = await fetchWithTimeout(`${API_BASE_URL}/reports/export`, {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reportCode: 'management_intelligence' }),
    });
    if (!response.ok) {
      throw new Error('Could not queue report export.');
    }
    await refreshAppState();
  }

  async function generateLatestReport() {
    if (!token || appState.reportExports.length === 0) {
      return;
    }
    const latestReport = appState.reportExports[0];
    const response = await fetchWithTimeout(`${API_BASE_URL}/reports/${latestReport.id}/generate`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Could not generate report.');
    }
    await refreshAppState();
  }

  async function deliverLatestReport() {
    if (!token || appState.reportExports.length === 0) {
      return;
    }
    const latestReport = appState.reportExports[0];
    const response = await fetchWithTimeout(`${API_BASE_URL}/reports/${latestReport.id}/deliver`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Could not deliver report.');
    }
    await refreshAppState();
  }

  async function queueNotificationFromAdmin() {
    if (!token) {
      return;
    }

    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/notifications/queue`, {
        method: 'POST',
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: notificationCustomerId,
          channel: notificationChannel,
          templateCode: notificationTemplateCode,
          subject: notificationSubject,
          body: notificationBody,
          correlationKey: `admin:${notificationTemplateCode}:${notificationCustomerId}:${Date.now()}`,
        }),
      });
      if (!response.ok) {
        throw new Error('Could not queue notification.');
      }
      setActionMessage('Notification queued.');
      await refreshAppState();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Could not queue notification.');
    }
  }

  async function retryFirstFailedNotification() {
    if (!token) {
      return;
    }

    const failed = appState.notifications.jobs.find((job) => job.status === 'failed');
    if (!failed) {
      setActionMessage('No failed notification to retry.');
      return;
    }

    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/notifications/${failed.id}/retry`, {
        method: 'POST',
        headers: authHeaders(token),
      });
      if (!response.ok) {
        throw new Error('Could not retry notification.');
      }
      setActionMessage('Retry queued.');
      await refreshAppState();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Could not retry notification.');
    }
  }

  async function createDocumentRecord() {
    await performAction(
      '/documents',
      {
        customerId: documentCustomerId,
        documentType,
        title: documentTitle,
        fileName: documentFileName,
        mimeType: 'application/pdf',
        tags: [documentType, 'support'],
      },
      'Document added to vault.',
    );
  }

  async function exportInvoiceRecord() {
    await performAction(
      '/invoices/export',
      {
        customerId: invoiceCustomerId,
        invoiceNumber,
        amount: Number(invoiceAmount) || 0,
        fileName: `${invoiceNumber}.pdf`,
      },
      'Invoice export created.',
    );
  }

  async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 6000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timer);
    }
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
    window.sessionStorage.setItem('aeden-bakes-session-token', payload.token);
    setToken(payload.token);

    const meResponse = await fetchWithTimeout(`${API_BASE_URL}/auth/me`, {
      headers: authHeaders(payload.token),
    });
    if (!meResponse.ok) {
      clearSession();
      throw new Error('Session expired');
    }
    const mePayload = (await meResponse.json()) as SessionPayload;
    setSession(mePayload);
    await refreshAppState(payload.token, mePayload.permissions.canSyncErp, mePayload.user.role);
    setActionMessage(`Signed in as ${payload.user.displayName}.`);
  }

  async function logout() {
    if (token) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: authHeaders(token),
      }).catch(() => undefined);
    }

    clearSession();
    setAppState(initialAppState);
    setSelectedCustomer(null);
    setActiveSection('overview');
    setActionMessage(null);
  }

  async function performAction(
    endpoint: string,
    body: Record<string, unknown>,
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

  async function createStandingOrder() {
    if (!token) {
      return;
    }

    const customerId = standingOrderCustomerId.trim();
    const slotId = standingOrderSlotId.trim();
    const days = standingOrderDaysDraft
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));

    let items: Array<{ productId: string; quantity: number }>;
    try {
      items = JSON.parse(standingOrderItemsDraft) as Array<{ productId: string; quantity: number }>;
    } catch {
      throw new Error('Standing order items must be valid JSON.');
    }

    await performAction(
      '/standing-orders',
      {
        customerId,
        status: 'draft',
        deliveryDays: days,
        slotId,
        paymentMode: standingOrderPaymentMode,
        items,
        notes: standingOrderNotesDraft.trim(),
      },
      'Standing order created.',
    );
  }

  async function createRecurrenceRule() {
    if (!token) {
      return;
    }

    const customerId = recurrenceRuleCustomerId.trim() || null;
    const branchId = recurrenceRuleBranchId.trim() || null;
    const days = recurrenceRuleDaysDraft
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));

    await performAction(
      '/recurrence-rules',
      {
        customerId,
        branchId,
        ruleCode: recurrenceRuleCode.trim(),
        cadence: 'weekly',
        status: 'active',
        deliveryDays: days,
        slotId: recurrenceRuleSlotId.trim(),
        notes: recurrenceRuleNotes.trim(),
        branchScoped: true,
      },
      'Recurrence rule created.',
    );
  }

  async function updateStandingOrderStatus(standingOrderId: string, nextStatus: 'paused' | 'active') {
    if (!token) {
      return;
    }

    if (nextStatus === 'paused') {
      await performAction(
        `/standing-orders/${standingOrderId}/pause`,
        {
          reason: 'Paused from super admin portal.',
          startDate: standingOrderRunDate,
        },
        'Standing order paused.',
      );
      return;
    }

    await performAction(`/standing-orders/${standingOrderId}/resume`, {}, 'Standing order resumed.');
  }

  async function skipStandingOrder(standingOrderId: string) {
    if (!token) {
      return;
    }

    await performAction(
      `/standing-orders/${standingOrderId}/skip`,
      { serviceDate: standingOrderRunDate, reason: 'Skipped from super admin portal.' },
      'Standing order skipped for the selected day.',
    );
  }

  async function decideStandingOrderChange(changeId: string, decision: 'approve' | 'reject') {
    if (!token) {
      return;
    }

    await performAction(
      `/standing-order-changes/${changeId}/${decision}`,
      {},
      decision === 'approve' ? 'Standing order change approved.' : 'Standing order change rejected.',
    );
  }

  async function createPricingRule() {
    if (!token) {
      return;
    }

    await performAction(
      '/pricing-rules',
      {
        customerId: pricingRuleCustomerId.trim() || null,
        branchId: pricingRuleBranchId.trim() || null,
        productId: pricingRuleProductId.trim(),
        price: Number(pricingRulePrice),
        pricingMode: 'fixed',
        status: 'active',
        reason: pricingRuleReason.trim(),
      },
      'Pricing rule created.',
    );
  }

  async function createCreditHold() {
    if (!token) {
      return;
    }

    await performAction(
      '/credit-holds',
      {
        customerId: creditHoldCustomerId.trim(),
        branchId: null,
        reason: creditHoldReason.trim(),
      },
      'Credit hold created.',
    );
  }

  async function createSubstitutionRule() {
    if (!token) {
      return;
    }

    await performAction(
      '/substitution-rules',
      {
        customerId: subRuleCustomerId.trim() || null,
        branchId: subRuleBranchId.trim() || null,
        productId: subRuleProductId.trim(),
        substituteProductId: subRuleReplacementId.trim(),
        reason: subRuleReason.trim(),
      },
      'Substitution rule created.',
    );
  }

  async function generateStandingOrderRuns() {
    if (!token) {
      return;
    }

    await performAction(
      '/standing-orders/generate-runs',
      { serviceDate: standingOrderRunDate },
      'Recurring order runs generated.',
    );
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

  const sessionData = session;
  const roleLabel = describeRole(sessionData.user.role);
  function renderAimsPortalShell() {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,.14),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(124,63,18,.10),transparent_28%),linear-gradient(180deg,#fcf7f0_0%,#f6eadc_100%)] text-slate-900">
        <div className="min-h-screen">
          <aside className="relative border-b border-slate-800/70 bg-[linear-gradient(180deg,#241207_0%,#4a2a16_58%,#7c3f12_100%)] text-slate-100 shadow-[0_30px_70px_rgba(8,15,34,.22)] lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-72 lg:flex-col lg:border-b-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,.2),transparent_30%),linear-gradient(180deg,rgba(255,255,255,.06),transparent_45%)]" />
            <div className="relative flex items-center gap-3 px-5 py-5 lg:px-6">
              <BrandMark />
              <div>
                <div className="text-[1.35rem] font-black tracking-tight">Aeden Bakes</div>
                <div className="text-sm text-slate-300">Super-admin portal</div>
              </div>
            </div>

            <div className="relative px-5 lg:px-6">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_40px_rgba(3,7,18,.18)] backdrop-blur">
                <div className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-amber-200">Session</div>
                <div className="mt-2 text-lg font-semibold text-white">{sessionData.user.displayName}</div>
                <div className="mt-1 text-sm text-slate-300">{roleLabel}</div>
                <button
                  type="button"
                  onClick={() => {
                    logout().catch((logoutError) => setError((logoutError as Error).message));
                  }}
                  className="mt-4 inline-flex h-11 items-center justify-center rounded-full border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Sign out
                </button>
              </div>
            </div>

            <nav className="relative mt-5 flex-1 space-y-2 px-3 pb-4 lg:px-4">
              {allowedSections.map((section) => {
                const active = visibleSection === section;
                const meta =
                  {
                    overview: { label: 'Dashboard', hint: 'Command center' },
                    customers: { label: 'Customers', hint: `${customers.length} accounts` },
                    production: { label: 'Production', hint: `${capacities.length} lines` },
                    delivery: { label: 'Delivery', hint: `${slots.length} routes` },
                    operations: { label: 'Operations', hint: `${pendingApprovals.length} approvals` },
                  }[section];

                return (
                  <button
                    key={section}
                    type="button"
                    onClick={() => setActiveSection(section)}
                    className={`flex w-full items-center gap-3 rounded-[1.35rem] border px-4 py-3 text-left transition ${
                      active
                        ? 'border-amber-400/50 bg-amber-500/20 text-white shadow-[0_14px_32px_rgba(14,116,144,.28)]'
                        : 'border-transparent bg-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border ${
                        active ? 'border-amber-300/35 bg-white/15' : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <SidebarGlyph kind={section} active={active} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold uppercase tracking-[0.18em]">
                        {meta.label}
                      </span>
                      <span className="block text-xs text-slate-300">{meta.hint}</span>
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="relative px-5 py-5 lg:px-6">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/8 p-4 backdrop-blur">
                <div className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-amber-200">Access</div>
                <div className="mt-3 space-y-2 text-sm text-slate-200">
                  {describeAccess(sessionData.user.role, permissions)
                    .slice(0, 4)
                    .map((line) => (
                      <div key={line} className="flex items-start gap-2">
                        <span className="mt-1 h-2 w-2 rounded-full bg-amber-300/90" />
                        <span>{line}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </aside>

          <div className="flex min-h-screen flex-col lg:pl-72">
            <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
              <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8 xl:flex-row xl:items-center">
                <div className="space-y-1">
                  <div className="text-[0.7rem] font-black uppercase tracking-[0.28em] text-amber-700">
                    Aeden Bakes super-admin
                  </div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-950">{sectionLabel}</h1>
                  <p className="text-sm text-slate-500">{sectionSubtitle}</p>
                </div>

                <div className="flex-1" />

                <div className="flex w-full flex-col gap-3 xl:max-w-5xl xl:flex-row xl:items-center">
                  <label className="relative flex-1">
                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[2]">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
                      </svg>
                    </span>
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search customers, orders, cases, or events..."
                      className="h-14 w-full rounded-full border border-slate-200 bg-white px-12 py-3 text-sm text-slate-900 shadow-[0_10px_30px_rgba(36,18,7,.06)] outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                    />
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!token) return;
                        refreshAppState(token, permissions.canSyncErp).catch((refreshError) =>
                          setError((refreshError as Error).message),
                        );
                      }}
                      className="inline-flex h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
                    >
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('operations')}
                      className="inline-flex h-12 items-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(36,18,7,.22)] transition hover:-translate-y-0.5"
                    >
                      Open operations
                    </button>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700 shadow-sm">
                      {sessionInitials}
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <div className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
              <div className="space-y-5">
                {actionMessage ? (
                  <div className="rounded-[1.4rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm">
                    {actionMessage}
                  </div>
                ) : null}
                {error ? (
                  <div className="rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 shadow-sm">
                    API error: {error}
                  </div>
                ) : null}

                <section className="grid gap-5 xl:grid-cols-[1.25fr_.9fr]">
                  <div className="relative overflow-hidden rounded-[2.4rem] border border-slate-200/80 bg-[linear-gradient(135deg,#241207_0%,#7c3f12_45%,#d97706_100%)] p-6 text-white shadow-[0_28px_80px_rgba(36,18,7,.18)] sm:p-8">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,.16),transparent_32%),linear-gradient(180deg,rgba(255,255,255,.05),transparent_45%)]" />
                    <div className="relative space-y-5">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.26em] text-amber-100">
                        Aeden command desk
                      </div>
                      <h2 className="max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">
                        Every batch, order, and route stays visible from planning to delivery.
                      </h2>
                      <p className="max-w-2xl text-base leading-7 text-slate-200/90">
                        Enterprise operations workspace for Aeden Bakes: customer risk, production
                        capacity, delivery timing, and approvals in one place.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => setActiveSection('operations')}
                          className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-950/20 transition hover:-translate-y-0.5"
                        >
                          Open workbench
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSection('customers')}
                          className="rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/15"
                        >
                          Review customers
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
                          Role: {sessionData.user.role}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
                          {permissions.canEditOrders ? 'Order edits enabled' : 'Order edits restricted'}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
                          {permissions.canSyncErp ? 'ERP sync enabled' : 'ERP sync restricted'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                    <Metric label="Live orders" value={String(metrics.orders)} />
                    <Metric label="Receivables" value={`₹${metrics.outstanding.toLocaleString()}`} />
                    <Metric label="Production fill" value={`${metrics.capacityFill}%`} />
                    <Metric label="Route fill" value={`${metrics.routeFill}%`} />
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(36,18,7,.08)]">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">ERP sync</div>
                    {erpSyncStatus ? (
                      <div className="mt-3 space-y-2">
                        <StatusRow label="Provider" value={erpSyncStatus.provider} tone="good" />
                        <StatusRow
                          label="Sync state"
                          value={erpSyncStatus.state}
                          tone={erpSyncStatus.state === 'healthy' ? 'good' : erpSyncStatus.state === 'degraded' ? 'warn' : 'bad'}
                        />
                        <StatusRow label="Queued" value={`${erpSyncStatus.pendingCount} pending`} tone="warn" />
                        <StatusRow label="Failures" value={`${erpSyncStatus.failedCount} needs review`} tone="bad" />
                      </div>
                    ) : (
                      <GateMessage message="ERP feed is not loaded yet." />
                    )}
                  </div>
                </section>

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-[1.5rem] border-t-4 border-amber-500 bg-white p-5 shadow-[0_18px_50px_rgba(36,18,7,.08)]">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Live orders</div>
                    <div className="mt-3 text-3xl font-black text-slate-950">{metrics.orders}</div>
                    <div className="mt-2 text-sm text-slate-500">Orders flowing through the system today.</div>
                  </div>
                  <div className="rounded-[1.5rem] border-t-4 border-emerald-500 bg-white p-5 shadow-[0_18px_50px_rgba(36,18,7,.08)]">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Receivables</div>
                    <div className="mt-3 text-3xl font-black text-slate-950">₹{metrics.outstanding.toLocaleString()}</div>
                    <div className="mt-2 text-sm text-slate-500">Outstanding balance across active accounts.</div>
                  </div>
                  <div className="rounded-[1.5rem] border-t-4 border-amber-500 bg-white p-5 shadow-[0_18px_50px_rgba(36,18,7,.08)]">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Production fill</div>
                    <div className="mt-3 text-3xl font-black text-slate-950">{metrics.capacityFill}%</div>
                    <div className="mt-2 text-sm text-slate-500">Booked against available capacity.</div>
                  </div>
                  <div className="rounded-[1.5rem] border-t-4 border-violet-500 bg-white p-5 shadow-[0_18px_50px_rgba(36,18,7,.08)]">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Route fill</div>
                    <div className="mt-3 text-3xl font-black text-slate-950">{metrics.routeFill}%</div>
                    <div className="mt-2 text-sm text-slate-500">Dispatch load across today’s slots.</div>
                  </div>
                  <div className="rounded-[1.5rem] border-t-4 border-rose-500 bg-white p-5 shadow-[0_18px_50px_rgba(36,18,7,.08)]">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Approvals</div>
                    <div className="mt-3 text-3xl font-black text-slate-950">{pendingApprovals.length}</div>
                    <div className="mt-2 text-sm text-slate-500">Pending manager or owner decisions.</div>
                  </div>
                </section>

                {visibleSection === 'overview' ? (
                  <section className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
                    <Card title="Operations workbench" subtitle="Role-aware next actions for the admin queue.">
                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl bg-slate-50 px-4 py-3">
                            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Queue</div>
                            <div className="mt-1 text-2xl font-black text-slate-950">{pendingApprovals.length}</div>
                            <div className="text-sm text-slate-500">Items waiting on a decision.</div>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-4 py-3">
                            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Open cases</div>
                            <div className="mt-1 text-2xl font-black text-slate-950">{supportInbox.length}</div>
                            <div className="text-sm text-slate-500">Support work that still needs attention.</div>
                          </div>
                        </div>
                        {topCustomers.length > 0 ? (
                          <div className="space-y-3">
                            {topCustomers.map((customer) => (
                              <button
                                key={customer.id}
                                type="button"
                                onClick={() => {
                                  loadCustomerDetail(customer.id).catch((detailError) =>
                                    setError((detailError as Error).message),
                                  );
                                }}
                                className="grid w-full gap-3 rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-4 text-left md:grid-cols-[1fr_auto_auto]"
                              >
                                <div>
                                  <div className="font-extrabold text-slate-950">{customer.name}</div>
                                  <div className="text-sm text-slate-500">{customer.tier}</div>
                                </div>
                                <InfoBlock
                                  label="Outstanding"
                                  value={`₹${customer.outstandingBalance.toLocaleString()}`}
                                />
                                <InfoBlock label="Risk" value={customer.riskState.replace('_', ' ')} />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <GateMessage message="No customers match the current search." />
                        )}
                      </div>
                    </Card>

                    <Card title="Guardrail watch" subtitle="Live exceptions and recent activity.">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          {buildAlerts(customers, capacities).map((alert) => (
                            <div
                              key={alert}
                              className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                            >
                              {alert}
                            </div>
                          ))}
                        </div>
                        <div className="space-y-3">
                          {filteredEvents.length > 0 ? (
                            filteredEvents.map((event) => (
                              <div key={event.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                <div className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-slate-400">
                                  {event.kind}
                                </div>
                                <div className="mt-1 text-sm font-semibold text-slate-950">{event.summary}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {event.actor} | {event.createdAt}
                                </div>
                              </div>
                            ))
                          ) : (
                            <GateMessage message="No audit events matched this view." />
                          )}
                        </div>
                      </div>
                    </Card>
                  </section>
                ) : null}

                {visibleSection === 'customers' ? (
                  <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
                    <Card title="Customer directory" subtitle="Click any account for a live drill-down.">
                      <div className="space-y-3">
                        {filteredCustomers.length > 0 ? (
                          filteredCustomers.map((customer) => (
                            <button
                              key={customer.id}
                              type="button"
                              onClick={() => {
                                loadCustomerDetail(customer.id).catch((detailError) =>
                                  setError((detailError as Error).message),
                                );
                              }}
                              className="grid w-full gap-4 rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-4 text-left md:grid-cols-[1fr_auto_auto_auto]"
                            >
                              <div>
                                <div className="text-lg font-extrabold text-slate-950">{customer.name}</div>
                                <div className="text-sm text-slate-500">{customer.tier}</div>
                              </div>
                              <InfoBlock
                                label="Outstanding"
                                value={`₹${customer.outstandingBalance.toLocaleString()}`}
                              />
                              <InfoBlock label="Risk" value={customer.riskState.replace('_', ' ')} />
                              <InfoBlock label="Zone" value={customer.deliveryZone} />
                            </button>
                          ))
                        ) : (
                          <GateMessage message="No customer records matched the search." />
                        )}
                      </div>
                    </Card>

                    <Card title="Customer 360" subtitle="Open one account to inspect orders, notes, timeline, and support work.">
                      {selectedCustomer ? (
                        <div className="space-y-5">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="text-lg font-black text-slate-950">{selectedCustomer.customer.name}</div>
                            <div className="mt-1 text-sm text-slate-500">{selectedCustomer.customer.tier}</div>
                            {selectedCustomer.auth ? (
                              <div className="mt-2 text-xs text-slate-500">
                                Login {selectedCustomer.auth.loginId} | {selectedCustomer.auth.defaultAddress ?? 'No address'}
                              </div>
                            ) : null}
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <InfoBlock
                                label="Credit limit"
                                value={`₹${selectedCustomer.customer.creditLimit.toLocaleString()}`}
                              />
                              <InfoBlock
                                label="Outstanding"
                                value={`₹${selectedCustomer.customer.outstandingBalance.toLocaleString()}`}
                              />
                              <InfoBlock label="Risk state" value={selectedCustomer.customer.riskState.replace('_', ' ')} />
                              <InfoBlock label="Delivery zone" value={selectedCustomer.customer.deliveryZone} />
                              <InfoBlock label="Branches" value={String(selectedCustomer.branches.length)} />
                              <InfoBlock label="Users" value={String(selectedCustomer.users.length)} />
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Branches</div>
                            {selectedCustomer.branches.length > 0 ? (
                              selectedCustomer.branches.map((branch) => (
                                <div key={branch.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <div className="text-sm font-semibold text-slate-950">{branch.name}</div>
                                      <div className="text-xs text-slate-500">
                                        {branch.code} | {branch.serviceZone} zone
                                      </div>
                                    </div>
                                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{branch.status}</div>
                                  </div>
                                  {branch.deliveryNotes ? (
                                    <div className="mt-2 text-sm text-slate-600">{branch.deliveryNotes}</div>
                                  ) : null}
                                </div>
                              ))
                            ) : (
                              <GateMessage message="No branches are attached to this customer yet." />
                            )}
                          </div>

                          <div className="space-y-3">
                            <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Customer users</div>
                            {selectedCustomer.users.length > 0 ? (
                              selectedCustomer.users.map((user) => (
                                <div key={user.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <div className="text-sm font-semibold text-slate-950">{user.displayName}</div>
                                      <div className="text-xs text-slate-500">
                                        {user.role} | {user.branchId ?? 'account-wide'}
                                      </div>
                                    </div>
                                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{user.status}</div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <GateMessage message="No customer users have been invited yet." />
                            )}
                          </div>

                          <div className="space-y-3">
                            <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">
                              Support notes
                            </div>
                            {selectedCustomer.notes.length > 0 ? (
                              selectedCustomer.notes.map((note) => (
                                <div key={note.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-semibold text-slate-950">{note.noteType}</div>
                                    <div className="text-xs text-slate-500">{note.createdAt}</div>
                                  </div>
                                  <div className="mt-1 text-sm text-slate-600">{note.note}</div>
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
                                className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"
                              >
                                Save note
                              </button>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">
                              Support case
                            </div>
                            <Field
                              label="Open case"
                              value={supportCaseDraft}
                              onChange={setSupportCaseDraft}
                              placeholder="Issue summary"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                openSupportCase().catch((caseError) => setError((caseError as Error).message));
                              }}
                              className="rounded-2xl bg-amber-600 px-4 py-3 text-sm font-bold text-white"
                            >
                              Open case
                            </button>
                          </div>

                          <div className="space-y-3">
                            <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Orders</div>
                            {selectedCustomerOrders.length > 0 ? (
                              selectedCustomerOrders.map((order) => (
                                <div key={order.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                  <div className="flex items-center justify-between gap-3">
                                  <div className="font-semibold text-slate-950">{order.id}</div>
                                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{order.status}</div>
                                </div>
                                <div className="mt-1 text-sm text-slate-600">
                                    {order.serviceDate} | {order.paymentMode} | ₹{order.amountTotal.toLocaleString()}
                                    {order.branchId ? ` | Branch ${order.branchId}` : ''}
                                </div>
                              </div>
                            ))
                            ) : (
                              <GateMessage message="No orders found for this customer." />
                            )}
                          </div>
                        </div>
                      ) : (
                        <GateMessage message="Pick any customer to open a full 360 view." />
                      )}
                    </Card>
                  </section>
                ) : null}

                {visibleSection === 'production' ? (
                  <section className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
                    <Card title="Production board" subtitle="What the floor needs to make next.">
                      <div className="overflow-hidden rounded-[1.35rem] border border-slate-200">
                        <div className="grid grid-cols-3 bg-slate-950 px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-200">
                          <span>Item</span>
                          <span>Capacity</span>
                          <span>Booked</span>
                        </div>
                        {products.map((product) => {
                          const capacity = capacities.find((entry) => entry.productId === product.id);
                          return (
                            <div
                              key={product.id}
                              className="grid grid-cols-3 border-t border-slate-200 bg-slate-50 px-4 py-4 text-sm"
                            >
                              <span className="font-semibold text-slate-950">{product.name}</span>
                              <span>{capacity ? capacity.capacity : '-'}</span>
                              <span>{capacity ? capacity.bookedQuantity : '-'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </Card>

                    <Card title="Capacity ledger" subtitle="Line health and booked order pressure.">
                      <div className="space-y-3">
                        {capacities.length > 0 ? (
                          capacities.map((capacity) => (
                            <div key={capacity.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-slate-950">
                                    {products.find((product) => product.id === capacity.productId)?.name ?? capacity.productId}
                                  </div>
                                  <div className="text-sm text-slate-500">
                                    {capacity.serviceDate} | version {capacity.version}
                                  </div>
                                </div>
                                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{capacity.status}</div>
                              </div>
                              <div className="mt-2 text-sm text-slate-600">
                                {capacity.bookedQuantity} booked of {capacity.capacity}
                              </div>
                            </div>
                          ))
                        ) : (
                          <GateMessage message="No capacity records are available yet." />
                        )}
                      </div>
                    </Card>
                  </section>
                ) : null}

                {visibleSection === 'delivery' ? (
                  <section className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
                    <Card title="Route manifest" subtitle="Driver-facing stop order and load.">
                      <div className="space-y-3">
                        {slots.length > 0 ? (
                          slots.map((slot) => (
                            <div key={slot.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-slate-950">{slot.label}</div>
                                  <div className="text-sm text-slate-500">{slot.zone} zone</div>
                                </div>
                                <div className="text-sm font-black text-slate-700">
                                  {slot.bookedOrders} / {slot.maxOrders}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <GateMessage message="No route slots have been configured." />
                        )}
                      </div>
                    </Card>

                    <Card title="Delivery exceptions" subtitle="Live issues that need an operations response.">
                      <div className="space-y-3">
                        {filteredSupportInbox.length > 0 ? (
                          filteredSupportInbox.map((supportCase) => (
                            <div key={supportCase.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-slate-950">{supportCase.subject}</div>
                                  <div className="text-xs text-slate-500">{supportCase.customerId}</div>
                                </div>
                                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{supportCase.status}</div>
                              </div>
                              <div className="mt-2 text-sm text-slate-700">
                                {supportCase.priority} priority | updated {supportCase.lastUpdatedAt}
                              </div>
                            </div>
                          ))
                        ) : (
                          <GateMessage message="No open support cases matched the search." />
                        )}
                      </div>
                    </Card>
                  </section>
                ) : null}

                {visibleSection === 'operations' ? (
                  <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
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
                                actor: sessionData.user.role,
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
                                actor: sessionData.user.role,
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
                              { actor: sessionData.user.role },
                              'Vasy ERP sync triggered and completed.',
                            ).catch((actionError) => setError((actionError as Error).message));
                          }}
                        />

                        <div className="space-y-3 pt-2">
                          <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Approvals</div>
                          {pendingApprovals.length > 0 ? (
                            pendingApprovals.map((approval) => (
                              <div key={approval.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-extrabold text-slate-950">{approval.action}</div>
                                    <div className="text-xs text-slate-500">Target: {approval.targetId}</div>
                                  </div>
                                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{approval.status}</div>
                                </div>
                                <div className="mt-2 text-sm text-slate-700">{approval.reason}</div>
                                <div className="mt-2 text-xs text-slate-500">Requested by {approval.requestedBy}</div>
                                <div className="mt-3 flex gap-2">
                                  <button
                                    type="button"
                                    disabled={!canApprove}
                                    onClick={() => {
                                      performAction(
                                        `/approvals/${approval.id}/approve`,
                                        { actor: sessionData.user.role },
                                        'Approval accepted.',
                                      ).catch((approvalError) => setError((approvalError as Error).message));
                                    }}
                                    className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canApprove}
                                    onClick={() => {
                                      performAction(
                                        `/approvals/${approval.id}/reject`,
                                        { actor: sessionData.user.role },
                                        'Approval rejected.',
                                      ).catch((approvalError) => setError((approvalError as Error).message));
                                    }}
                                    className="rounded-full bg-slate-200 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <GateMessage message="No approvals are waiting right now." />
                          )}
                        </div>
                      </div>
                    </Card>

                    <Card title="Recurring orders" subtitle="Create standing demand, pause it, or batch-generate runs.">
                      <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <Field label="Customer" value={standingOrderCustomerId} onChange={setStandingOrderCustomerId} />
                          <Field label="Slot" value={standingOrderSlotId} onChange={setStandingOrderSlotId} />
                          <Field
                            label="Days"
                            value={standingOrderDaysDraft}
                            onChange={setStandingOrderDaysDraft}
                            placeholder="1,2,3,4,5"
                          />
                          <label className="grid gap-2">
                            <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                              Payment mode
                            </span>
                            <select
                              value={standingOrderPaymentMode}
                              onChange={(event) =>
                                setStandingOrderPaymentMode(event.target.value as 'prepaid' | 'part-pay' | 'credit')
                              }
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-amber-400"
                            >
                              <option value="prepaid">prepaid</option>
                              <option value="part-pay">part-pay</option>
                              <option value="credit">credit</option>
                            </select>
                          </label>
                        </div>
                        <Field
                          label="Items JSON"
                          value={standingOrderItemsDraft}
                          onChange={setStandingOrderItemsDraft}
                          placeholder='[{"productId":"prod_loaf","quantity":12}]'
                        />
                        <Field
                          label="Notes"
                          value={standingOrderNotesDraft}
                          onChange={setStandingOrderNotesDraft}
                          placeholder="Weekday breakfast repeat."
                        />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Field
                            label="Run date"
                            value={standingOrderRunDate}
                            onChange={setStandingOrderRunDate}
                            type="date"
                          />
                          <div className="flex items-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                createStandingOrder().catch((actionError) => setError((actionError as Error).message));
                              }}
                              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"
                            >
                              Create standing order
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                generateStandingOrderRuns().catch((actionError) => setError((actionError as Error).message));
                              }}
                              className="rounded-2xl bg-amber-600 px-4 py-3 text-sm font-bold text-white"
                            >
                              Generate runs
                            </button>
                          </div>
                        </div>
                        <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4">
                          <div className="text-sm font-black uppercase tracking-[0.18em] text-amber-700">
                            Recurrence rule builder
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <Field label="Customer" value={recurrenceRuleCustomerId} onChange={setRecurrenceRuleCustomerId} />
                            <Field label="Branch" value={recurrenceRuleBranchId} onChange={setRecurrenceRuleBranchId} />
                            <Field label="Rule code" value={recurrenceRuleCode} onChange={setRecurrenceRuleCode} />
                            <Field label="Slot" value={recurrenceRuleSlotId} onChange={setRecurrenceRuleSlotId} />
                            <Field
                              label="Days"
                              value={recurrenceRuleDaysDraft}
                              onChange={setRecurrenceRuleDaysDraft}
                              placeholder="1,2,3,4,5"
                            />
                            <Field
                              label="Notes"
                              value={recurrenceRuleNotes}
                              onChange={setRecurrenceRuleNotes}
                              placeholder="Auto-generate weekday breakfast runs."
                            />
                          </div>
                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                createRecurrenceRule().catch((actionError) => setError((actionError as Error).message));
                              }}
                              className="rounded-2xl bg-amber-700 px-4 py-3 text-sm font-bold text-white"
                            >
                              Create rule
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                              Active recurrence rules
                            </div>
                            <div className="mt-3 space-y-2">
                              {recurrenceRules.length > 0 ? (
                                recurrenceRules.slice(0, 4).map((rule) => (
                                  <div key={rule.id} className="rounded-2xl bg-slate-50 px-3 py-2">
                                    <div className="text-sm font-semibold text-slate-950">{rule.ruleCode}</div>
                                    <div className="text-xs text-slate-500">
                                      {rule.status} | {rule.cadence} | slot {rule.payload.slotId}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <GateMessage message="No recurrence rules configured yet." />
                              )}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                              Pending change requests
                            </div>
                            <div className="mt-3 space-y-2">
                              {standingOrderChanges.length > 0 ? (
                                standingOrderChanges.slice(0, 4).map((change) => (
                                  <div key={change.id} className="rounded-2xl bg-slate-50 px-3 py-2">
                                    <div className="text-sm font-semibold text-slate-950">{change.changeType}</div>
                                    <div className="text-xs text-slate-500">
                                      {change.status} | {change.reason}
                                    </div>
                                    <div className="mt-2 flex gap-2">
                                      <button
                                        type="button"
                                        disabled={!canApprove}
                                        onClick={() => {
                                          decideStandingOrderChange(change.id, 'approve').catch((actionError) =>
                                            setError((actionError as Error).message),
                                          );
                                        }}
                                        className="rounded-full bg-emerald-600 px-3 py-1.5 text-[0.7rem] font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        disabled={!canApprove}
                                        onClick={() => {
                                          decideStandingOrderChange(change.id, 'reject').catch((actionError) =>
                                            setError((actionError as Error).message),
                                          );
                                        }}
                                        className="rounded-full bg-slate-200 px-3 py-1.5 text-[0.7rem] font-black uppercase tracking-[0.18em] text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <GateMessage message="No pending standing order changes." />
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {standingOrders.length > 0 ? (
                            standingOrders.slice(0, 6).map((standingOrder) => (
                              <div key={standingOrder.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="font-semibold text-slate-950">{standingOrder.id}</div>
                                    <div className="text-xs text-slate-500">
                                      {customers.find((customer) => customer.id === standingOrder.customerId)?.name ??
                                        standingOrder.customerId}
                                    </div>
                                  </div>
                                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{standingOrder.status}</div>
                                </div>
                                <div className="mt-2 text-sm text-slate-600">
                                  Days {standingOrder.schedule.deliveryDays.join(', ')} | slot {standingOrder.schedule.slotId}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateStandingOrderStatus(
                                        standingOrder.id,
                                        standingOrder.status === 'paused' ? 'active' : 'paused',
                                      ).catch((actionError) => setError((actionError as Error).message));
                                    }}
                                    className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-white"
                                    >
                                      {standingOrder.status === 'paused' ? 'Resume' : 'Pause'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      skipStandingOrder(standingOrder.id).catch((actionError) =>
                                        setError((actionError as Error).message),
                                      );
                                    }}
                                    className="rounded-full bg-amber-600 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-white"
                                  >
                                    Skip day
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <GateMessage message="No standing orders are configured yet." />
                          )}
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                          Runs created: {standingOrderRuns.length} | Pauses: {standingOrderPauses.length}
                        </div>
                        {erpContractPreview ? (
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">ERP contract preview</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">
                              {erpContractPreview.orderCount} orders, {erpContractPreview.batchCount} batches
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Exported {erpContractPreview.exportedAt}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </Card>
                  </section>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return renderAimsPortalShell();

  /*
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
                {sessionData.user.displayName} | {roleLabel}
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
                  {sessionData.permissions.canEditOrders || sessionData.user.role === 'owner' ? (
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
              <div className="space-y-6">
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
                            actor: sessionData.user.role,
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
                            actor: sessionData.user.role,
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
                          { actor: sessionData.user.role },
                          'Vasy ERP sync triggered and completed.',
                        ).catch((actionError) => setError((actionError as Error).message));
                      }}
                    />
                  </div>
                </Card>

                <Card title="Recurring orders" subtitle="Create standing demand, pause it, or batch-generate runs.">
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Customer" value={standingOrderCustomerId} onChange={setStandingOrderCustomerId} />
                      <Field label="Slot" value={standingOrderSlotId} onChange={setStandingOrderSlotId} />
                      <Field
                        label="Days"
                        value={standingOrderDaysDraft}
                        onChange={setStandingOrderDaysDraft}
                        placeholder="1,2,3,4,5"
                      />
                      <label className="grid gap-2">
                        <span className="text-xs font-black uppercase tracking-[0.18em] text-stone-500">
                          Payment mode
                        </span>
                        <select
                          value={standingOrderPaymentMode}
                          onChange={(event) =>
                            setStandingOrderPaymentMode(event.target.value as 'prepaid' | 'part-pay' | 'credit')
                          }
                          className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none focus:border-orange-500"
                        >
                          <option value="prepaid">prepaid</option>
                          <option value="part-pay">part-pay</option>
                          <option value="credit">credit</option>
                        </select>
                      </label>
                    </div>
                    <Field
                      label="Items JSON"
                      value={standingOrderItemsDraft}
                      onChange={setStandingOrderItemsDraft}
                      placeholder='[{"productId":"prod_loaf","quantity":12}]'
                    />
                    <Field
                      label="Notes"
                      value={standingOrderNotesDraft}
                      onChange={setStandingOrderNotesDraft}
                      placeholder="Weekday breakfast repeat."
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Run date" value={standingOrderRunDate} onChange={setStandingOrderRunDate} type="date" />
                      <div className="flex items-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            createStandingOrder().catch((actionError) => setError((actionError as Error).message));
                          }}
                          className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-bold text-white"
                        >
                          Create standing order
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            generateStandingOrderRuns().catch((actionError) => setError((actionError as Error).message));
                          }}
                          className="rounded-2xl bg-orange-700 px-4 py-3 text-sm font-bold text-white"
                          >
                            Generate runs
                          </button>
                      </div>
                    </div>
                    <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4">
                      <div className="text-sm font-black uppercase tracking-[0.18em] text-amber-700">
                        Recurrence rule builder
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <Field label="Customer" value={recurrenceRuleCustomerId} onChange={setRecurrenceRuleCustomerId} />
                        <Field label="Branch" value={recurrenceRuleBranchId} onChange={setRecurrenceRuleBranchId} />
                        <Field label="Rule code" value={recurrenceRuleCode} onChange={setRecurrenceRuleCode} />
                        <Field label="Slot" value={recurrenceRuleSlotId} onChange={setRecurrenceRuleSlotId} />
                        <Field
                          label="Days"
                          value={recurrenceRuleDaysDraft}
                          onChange={setRecurrenceRuleDaysDraft}
                          placeholder="1,2,3,4,5"
                        />
                        <Field
                          label="Notes"
                          value={recurrenceRuleNotes}
                          onChange={setRecurrenceRuleNotes}
                          placeholder="Auto-generate weekday breakfast runs."
                        />
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            createRecurrenceRule().catch((actionError) => setError((actionError as Error).message));
                          }}
                          className="rounded-2xl bg-amber-700 px-4 py-3 text-sm font-bold text-white"
                        >
                          Create rule
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-stone-200 bg-white p-4">
                        <div className="text-sm font-black uppercase tracking-[0.18em] text-stone-400">
                          Active recurrence rules
                        </div>
                        <div className="mt-3 space-y-2">
                          {recurrenceRules.length > 0 ? (
                            recurrenceRules.slice(0, 4).map((rule) => (
                              <div key={rule.id} className="rounded-2xl bg-stone-50 px-3 py-2">
                                <div className="text-sm font-semibold text-stone-950">{rule.ruleCode}</div>
                                <div className="text-xs text-stone-500">
                                  {rule.status} | {rule.cadence} | slot {rule.payload.slotId}
                                </div>
                              </div>
                            ))
                          ) : (
                            <GateMessage message="No recurrence rules configured yet." />
                          )}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-stone-200 bg-white p-4">
                        <div className="text-sm font-black uppercase tracking-[0.18em] text-stone-400">
                          Pending change requests
                        </div>
                        <div className="mt-3 space-y-2">
                          {standingOrderChanges.length > 0 ? (
                            standingOrderChanges.slice(0, 4).map((change) => (
                              <div key={change.id} className="rounded-2xl bg-stone-50 px-3 py-2">
                                <div className="text-sm font-semibold text-stone-950">{change.changeType}</div>
                                <div className="text-xs text-stone-500">
                                  {change.status} | {change.reason}
                                </div>
                                <div className="mt-2 flex gap-2">
                                  <button
                                    type="button"
                                    disabled={!canApprove}
                                    onClick={() => {
                                      decideStandingOrderChange(change.id, 'approve').catch((actionError) =>
                                        setError((actionError as Error).message),
                                      );
                                    }}
                                    className="rounded-full bg-emerald-600 px-3 py-1.5 text-[0.7rem] font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canApprove}
                                    onClick={() => {
                                      decideStandingOrderChange(change.id, 'reject').catch((actionError) =>
                                        setError((actionError as Error).message),
                                      );
                                    }}
                                    className="rounded-full bg-stone-200 px-3 py-1.5 text-[0.7rem] font-black uppercase tracking-[0.18em] text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <GateMessage message="No pending standing order changes." />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {standingOrders.length > 0 ? (
                        standingOrders.slice(0, 6).map((standingOrder) => (
                          <div key={standingOrder.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="font-semibold text-stone-950">{standingOrder.id}</div>
                                <div className="text-xs text-stone-500">
                                  {customers.find((customer) => customer.id === standingOrder.customerId)?.name ?? standingOrder.customerId}
                                </div>
                              </div>
                              <div className="text-xs uppercase tracking-[0.18em] text-stone-500">{standingOrder.status}</div>
                            </div>
                            <div className="mt-2 text-sm text-stone-600">
                              Days {standingOrder.schedule.deliveryDays.join(', ')} | slot {standingOrder.schedule.slotId}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  updateStandingOrderStatus(
                                    standingOrder.id,
                                    standingOrder.status === 'paused' ? 'active' : 'paused',
                                  ).catch((actionError) => setError((actionError as Error).message));
                                }}
                                className="rounded-full bg-stone-950 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-white"
                                >
                                  {standingOrder.status === 'paused' ? 'Resume' : 'Pause'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  skipStandingOrder(standingOrder.id).catch((actionError) =>
                                    setError((actionError as Error).message),
                                  );
                                }}
                                className="rounded-full bg-orange-700 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-white"
                              >
                                Skip day
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <GateMessage message="No standing orders are configured yet." />
                      )}
                    </div>
                    <div className="rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-600">
                      Runs created: {standingOrderRuns.length} | Pauses: {standingOrderPauses.length}
                    </div>
                  </div>
                </Card>
              </div>
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
                      Standing orders
                    </div>
                    {selectedCustomer.standingOrders.length > 0 ? (
                      selectedCustomer.standingOrders.map((standingOrder) => (
                        <div key={standingOrder.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-semibold text-stone-950">{standingOrder.id}</div>
                              <div className="text-xs text-stone-500">
                                {standingOrder.schedule.slotId} | {standingOrder.schedule.paymentMode}
                              </div>
                            </div>
                            <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
                              {standingOrder.status}
                            </div>
                          </div>
                          <div className="mt-2 text-sm text-stone-600">
                            Days {standingOrder.schedule.deliveryDays.join(', ')} | {standingOrder.schedule.items.length} line(s)
                          </div>
                        </div>
                      ))
                    ) : (
                      <GateMessage message="No standing orders are set up for this account." />
                    )}
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
                              body: JSON.stringify({ decision: 'approve', actor: sessionData.user.role }),
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
                              body: JSON.stringify({ decision: 'reject', actor: sessionData.user.role }),
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

            <Card title="Commercial controls" subtitle="Pricing rules, credit holds, and substitutions live here.">
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Customer" value={pricingRuleCustomerId} onChange={setPricingRuleCustomerId} />
                  <Field label="Branch" value={pricingRuleBranchId} onChange={setPricingRuleBranchId} />
                  <Field label="Product" value={pricingRuleProductId} onChange={setPricingRuleProductId} />
                  <Field label="Price" value={pricingRulePrice} onChange={setPricingRulePrice} />
                </div>
                <Field
                  label="Pricing reason"
                  value={pricingRuleReason}
                  onChange={setPricingRuleReason}
                  placeholder="Contract price for weekday breakfast."
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      createPricingRule().catch((actionError) => setError((actionError as Error).message));
                    }}
                    className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-bold text-white"
                  >
                    Create pricing rule
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Hold customer" value={creditHoldCustomerId} onChange={setCreditHoldCustomerId} />
                  <Field
                    label="Hold reason"
                    value={creditHoldReason}
                    onChange={setCreditHoldReason}
                    placeholder="Credit review pending after month-end exposure."
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      createCreditHold().catch((actionError) => setError((actionError as Error).message));
                    }}
                    className="rounded-2xl bg-amber-700 px-4 py-3 text-sm font-bold text-white"
                  >
                    Apply credit hold
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Sub customer" value={subRuleCustomerId} onChange={setSubRuleCustomerId} />
                  <Field label="Sub branch" value={subRuleBranchId} onChange={setSubRuleBranchId} />
                  <Field label="Product" value={subRuleProductId} onChange={setSubRuleProductId} />
                  <Field label="Replacement" value={subRuleReplacementId} onChange={setSubRuleReplacementId} />
                </div>
                <Field
                  label="Substitution reason"
                  value={subRuleReason}
                  onChange={setSubRuleReason}
                  placeholder="Fallback substitute when the main item is tight."
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      createSubstitutionRule().catch((actionError) => setError((actionError as Error).message));
                    }}
                    className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-bold text-white"
                  >
                    Create substitution rule
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-stone-50 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Pricing rules</div>
                    <div className="mt-3 space-y-2">
                      {customerPricingRules.slice(0, 4).map((rule) => (
                        <div key={rule.id} className="rounded-2xl bg-white px-3 py-2 text-sm">
                          <div className="font-semibold text-stone-950">{rule.productId ?? 'All products'}</div>
                          <div className="text-xs text-stone-500">
                            {rule.status} | {rule.pricingMode} | Rs. {rule.price}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-stone-50 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Credit holds</div>
                    <div className="mt-3 space-y-2">
                      {creditHoldEvents.slice(0, 4).map((hold) => (
                        <div key={hold.id} className="rounded-2xl bg-white px-3 py-2 text-sm">
                          <div className="font-semibold text-stone-950">{hold.customerId}</div>
                          <div className="text-xs text-stone-500">
                            {hold.status} | {hold.reason}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-stone-50 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Substitution events</div>
                  <div className="mt-3 space-y-2">
                    {substitutionEvents.length > 0 ? (
                      substitutionEvents.slice(0, 4).map((event) => (
                        <div key={event.id} className="rounded-2xl bg-white px-3 py-2 text-sm">
                          <div className="font-semibold text-stone-950">
                            {event.productId} → {event.substituteProductId}
                          </div>
                          <div className="text-xs text-stone-500">
                            {event.status} | {event.reason}
                          </div>
                        </div>
                      ))
                    ) : (
                      <GateMessage message="No substitution events yet." />
                    )}
                  </div>
                </div>
                <div className="rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-600">
                  Ledger entries: {creditLedgerEntries.length} | Active holds: {creditHoldEvents.filter((hold) => hold.status === 'active').length}
                </div>
              </div>
            </Card>

            <Card title="Phase 3 commercial layer" subtitle="Notifications, health, alerts, and customer self-service in one place.">
              <div className="grid gap-3 md:grid-cols-2">
                <InfoBlock label="Notifications" value={`${appState.notifications.jobs.length} jobs`} />
                <InfoBlock label="Deliveries" value={`${appState.notifications.deliveries.length} records`} />
                <InfoBlock label="Health snapshots" value={`${appState.accountHealth.snapshots.length}`} />
                <InfoBlock label="Alert events" value={`${appState.alertEvents.length}`} />
                <InfoBlock label="Customer requests" value={`${appState.customerRequests.length}`} />
                <InfoBlock label="Saved addresses" value={`${appState.savedAddresses.length}`} />
                <InfoBlock label="Analytics snapshots" value={`${appState.analytics.snapshots.length}`} />
                <InfoBlock label="Reports" value={`${appState.reportExports.length}`} />
              </div>
            </Card>

            <Card title="Phase 12 analytics" subtitle="Customer segments, branch performance, delivery confidence, returns, credit risk, and pricing health.">
              {analyticsPayload ? (
                <div className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <InfoBlock label="Active customers" value={`${analyticsPayload.totals.activeCustomers}`} />
                    <InfoBlock label="Repeat purchase rate" value={`${analyticsPayload.totals.repeatPurchaseRate}%`} />
                    <InfoBlock label="Delivery success" value={`${analyticsPayload.delivery.deliverySuccessRate}%`} />
                    <InfoBlock label="Return rate" value={`${analyticsPayload.delivery.returnRate}%`} />
                    <InfoBlock label="Average order value" value={`Rs. ${analyticsPayload.totals.averageOrderValue.toLocaleString()}`} />
                    <InfoBlock label="Credit exposure" value={`Rs. ${analyticsPayload.totals.creditExposure.toLocaleString()}`} />
                    <InfoBlock label="Branches active" value={`${analyticsPayload.branches.activeBranches}/${analyticsPayload.branches.totalBranches}`} />
                    <InfoBlock label="Watch customers" value={`${analyticsPayload.credit.buckets.watch + analyticsPayload.credit.buckets.blockSoon + analyticsPayload.credit.buckets.blocked}`} />
                  </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl bg-stone-950 p-5 text-stone-50 shadow-xl shadow-stone-200">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Top customers</div>
                    <div className="mt-4 space-y-3">
                        {analyticsPayload.customers.topCustomers.length > 0 ? (
                          analyticsPayload.customers.topCustomers.map((customer) => (
                            <div key={customer.customerId} className="rounded-2xl bg-white/10 px-4 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-extrabold text-white">{customer.customerName}</div>
                                  <div className="text-xs text-stone-300">
                                    {customer.orderCount} orders | {customer.tier} | {customer.riskState}
                                  </div>
                                </div>
                                <div className="text-right text-sm font-bold text-amber-200">
                                  Rs. {customer.revenue.toLocaleString()}
                                </div>
                              </div>
                              <div className="mt-2 text-xs text-stone-300">
                                Outstanding Rs. {customer.outstandingBalance.toLocaleString()}
                              </div>
                            </div>
                          ))
                        ) : (
                          <GateMessage message="No customer activity yet." />
                        )}
                      </div>
                    </div>

                    <div className="rounded-3xl bg-stone-100 p-5">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Customer segments</div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <InfoBlock label="Repeat" value={`${analyticsPayload.customers.segments.repeatCustomers}`} />
                        <InfoBlock label="High value" value={`${analyticsPayload.customers.segments.highValueCustomers}`} />
                        <InfoBlock label="Dormant" value={`${analyticsPayload.customers.segments.dormantCustomers}`} />
                        <InfoBlock label="Watch" value={`${analyticsPayload.customers.segments.watchCustomers}`} />
                      </div>
                      <div className="mt-4 space-y-2">
                        {analyticsPayload.customers.definitions.map((segment) => (
                          <div key={segment.code} className="rounded-2xl bg-white px-4 py-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-semibold text-stone-950">{segment.name}</div>
                              <div className="text-xs uppercase tracking-[0.18em] text-stone-500">{segment.active ? 'active' : 'paused'}</div>
                            </div>
                            <div className="mt-1 text-xs text-stone-500">{segment.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl bg-stone-100 p-5">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Branch performance</div>
                      <div className="mt-4 space-y-3">
                        {analyticsPayload.branches.performance.length > 0 ? (
                          analyticsPayload.branches.performance.map((branch) => (
                            <div key={branch.branchId} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-extrabold text-stone-950">{branch.branchName}</div>
                                  <div className="text-xs text-stone-500">
                                    {branch.orderCount} orders | {branch.deliverySuccessRate}% success
                                  </div>
                                </div>
                                <div className="text-right text-sm font-bold text-stone-800">
                                  Rs. {branch.revenue.toLocaleString()}
                                </div>
                              </div>
                              <div className="mt-2 text-xs text-stone-500">
                                Returns {branch.returnCount} | Failures {branch.failureCount} | Avg Rs. {branch.averageOrderValue.toLocaleString()}
                              </div>
                            </div>
                          ))
                        ) : (
                          <GateMessage message="No branch analytics yet." />
                        )}
                      </div>
                    </div>

                    <div className="rounded-3xl bg-stone-100 p-5">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Credit risk</div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <InfoBlock label="Healthy" value={`${analyticsPayload.credit.buckets.healthy}`} />
                        <InfoBlock label="Watch" value={`${analyticsPayload.credit.buckets.watch}`} />
                        <InfoBlock label="Block soon" value={`${analyticsPayload.credit.buckets.blockSoon}`} />
                        <InfoBlock label="Blocked" value={`${analyticsPayload.credit.buckets.blocked}`} />
                      </div>
                      <div className="mt-4 space-y-2">
                        {analyticsPayload.credit.watchCustomers.length > 0 ? (
                          analyticsPayload.credit.watchCustomers.slice(0, 4).map((customer) => (
                            <div key={customer.customerId} className="rounded-2xl bg-white px-4 py-3 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <div className="font-semibold text-stone-950">{customer.customerName}</div>
                                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">{customer.riskState}</div>
                              </div>
                              <div className="mt-1 text-xs text-stone-500">
                                Exposure Rs. {customer.outstandingBalance.toLocaleString()} / Limit Rs. {customer.creditLimit.toLocaleString()}
                              </div>
                            </div>
                          ))
                        ) : (
                          <GateMessage message="No watch customers." />
                        )}
                      </div>
                    </div>

                    <div className="rounded-3xl bg-stone-100 p-5">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Pricing mix</div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <InfoBlock label="Prepaid" value={`${analyticsPayload.pricing.orderMix.prepaid}`} />
                        <InfoBlock label="Part pay" value={`${analyticsPayload.pricing.orderMix.partPay}`} />
                        <InfoBlock label="Credit" value={`${analyticsPayload.pricing.orderMix.credit}`} />
                        <InfoBlock label="Active rules" value={`${analyticsPayload.pricing.pricingRules}`} />
                      </div>
                      <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-stone-600">
                        Branch overrides {analyticsPayload.pricing.branchOverrides} | Customer overrides {analyticsPayload.pricing.customerOverrides} | Avg ticket Rs. {analyticsPayload.pricing.averageOrderValue.toLocaleString()}
                      </div>
                    </div>

                    <div className="rounded-3xl bg-stone-950 p-5 text-stone-50 lg:col-span-2">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Margin intelligence</div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <InfoBlock label="Revenue" value={`Rs. ${analyticsPayload.margin.revenue.toLocaleString()}`} />
                        <InfoBlock label="Estimated cost" value={`Rs. ${analyticsPayload.margin.estimatedCost.toLocaleString()}`} />
                        <InfoBlock label="Gross margin" value={`Rs. ${analyticsPayload.margin.grossMargin.toLocaleString()}`} />
                        <InfoBlock label="Margin rate" value={`${analyticsPayload.margin.grossMarginRate}%`} />
                      </div>
                      <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl bg-white/10 p-4">
                          <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-300">Top products by margin</div>
                          <div className="mt-3 space-y-2">
                            {analyticsPayload.margin.productBreakdown.slice(0, 4).map((product) => (
                              <div key={product.productId} className="rounded-2xl bg-white/10 px-4 py-3 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="font-semibold text-white">{product.productName}</div>
                                    <div className="text-xs text-stone-300">{product.category}</div>
                                  </div>
                                  <div className="text-right text-xs text-stone-300">{product.grossMarginRate}%</div>
                                </div>
                                <div className="mt-1 text-xs text-stone-300">
                                  Margin Rs. {product.grossMargin.toLocaleString()} | Revenue Rs. {product.revenue.toLocaleString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/10 p-4">
                          <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-300">Top branches by margin</div>
                          <div className="mt-3 space-y-2">
                            {analyticsPayload.margin.branchBreakdown.slice(0, 4).map((branch) => (
                              <div key={branch.branchId} className="rounded-2xl bg-white/10 px-4 py-3 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="font-semibold text-white">{branch.branchName}</div>
                                  <div className="text-xs text-stone-300">{branch.grossMarginRate}%</div>
                                </div>
                                <div className="mt-1 text-xs text-stone-300">
                                  Margin Rs. {branch.grossMargin.toLocaleString()} | Revenue Rs. {branch.revenue.toLocaleString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl bg-amber-50 p-5 ring-1 ring-amber-200 lg:col-span-2">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Snapshot and report workflow</div>
                          <div className="mt-1 text-sm text-stone-600">
                            Publish the latest analytics snapshot and move an export through queue, generation, and delivery.
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-stone-600">
                          Snapshot {analytics.latest?.status ?? 'none'} | Reports {appState.reportExports.length}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            publishAnalyticsSnapshot().catch((error) => setError((error as Error).message));
                          }}
                          className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-bold text-white"
                        >
                          Publish snapshot
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            queueManagementReport().catch((error) => setError((error as Error).message));
                          }}
                          className="rounded-2xl border border-amber-400 bg-white px-4 py-3 text-sm font-bold text-amber-800"
                        >
                          Queue report
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            generateLatestReport().catch((error) => setError((error as Error).message));
                          }}
                          className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold text-stone-700"
                        >
                          Generate report
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deliverLatestReport().catch((error) => setError((error as Error).message));
                          }}
                          className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold text-stone-700"
                        >
                          Deliver report
                        </button>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {appState.reportExports.slice(0, 2).map((report) => (
                          <div key={report.id} className="rounded-2xl bg-white px-4 py-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-semibold text-stone-950">{report.reportCode}</div>
                              <div className="text-xs uppercase tracking-[0.18em] text-stone-500">{report.status}</div>
                            </div>
                            <div className="mt-1 text-xs text-stone-500">
                              {report.createdBy} | {new Date(report.createdAt).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <GateMessage message="Analytics are building now. Refresh after the snapshot is ready." />
              )}
            </Card>

            <Card title="Phase 9 notification ops" subtitle="Template-based updates with channel priority, retry, and customer preference awareness.">
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoBlock label="Templates" value={`${appState.notifications.templates.length}`} />
                    <InfoBlock label="Preferences" value={`${appState.notifications.preferences.length}`} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-2 text-sm">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Customer</div>
                      <select
                        className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3"
                        value={notificationCustomerId}
                        onChange={(event) => setNotificationCustomerId(event.target.value)}
                      >
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Template</div>
                      <select
                        className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3"
                        value={notificationTemplateCode}
                        onChange={(event) => {
                          const code = event.target.value;
                          setNotificationTemplateCode(code);
                          const template = appState.notifications.templates.find((entry) => entry.code === code);
                          if (template) {
                            setNotificationSubject(template.subject);
                            setNotificationBody(template.body);
                            setNotificationChannel(template.channelPriority[0] ?? 'in_app');
                          }
                        }}
                      >
                        {appState.notifications.templates.map((template) => (
                          <option key={template.code} value={template.code}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Channel</div>
                      <select
                        className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3"
                        value={notificationChannel}
                        onChange={(event) => setNotificationChannel(event.target.value as typeof notificationChannel)}
                      >
                        <option value="whatsapp">WhatsApp</option>
                        <option value="sms">SMS</option>
                        <option value="in_app">In-app</option>
                        <option value="email">Email</option>
                      </select>
                    </label>
                    <label className="space-y-2 text-sm">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Subject</div>
                      <input
                        className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3"
                        value={notificationSubject}
                        onChange={(event) => setNotificationSubject(event.target.value)}
                      />
                    </label>
                  </div>
                  <label className="space-y-2 text-sm">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Message body</div>
                    <textarea
                      className="min-h-24 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3"
                      value={notificationBody}
                      onChange={(event) => setNotificationBody(event.target.value)}
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={queueNotificationFromAdmin}
                      className="rounded-2xl bg-stone-950 px-5 py-3 text-sm font-extrabold text-white"
                    >
                      Queue notification
                    </button>
                    <button
                      type="button"
                      onClick={retryFirstFailedNotification}
                      className="rounded-2xl border border-stone-300 bg-white px-5 py-3 text-sm font-extrabold text-stone-700"
                    >
                      Retry failed
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-3xl bg-stone-50 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Recent jobs</div>
                    <div className="mt-3 space-y-2">
                      {appState.notifications.jobs.slice(0, 5).map((job) => (
                        <div key={job.id} className="rounded-2xl bg-white px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold text-stone-950">{job.subject}</div>
                            <div className="text-xs uppercase tracking-[0.18em] text-stone-500">{job.status}</div>
                          </div>
                          <div className="mt-1 text-xs text-stone-500">
                            {job.channel} | {job.provider} | {job.recipient}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-3xl bg-stone-50 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Channel preferences</div>
                    <div className="mt-3 space-y-2">
                      {appState.notifications.preferences.slice(0, 5).map((preference) => (
                        <div key={preference.customerId} className="rounded-2xl bg-white px-3 py-2 text-sm">
                          <div className="font-semibold text-stone-950">{preference.customerId}</div>
                          <div className="mt-1 text-xs text-stone-500">
                            WA {preference.whatsappEnabled ? 'on' : 'off'} | SMS {preference.smsEnabled ? 'on' : 'off'} | In-app {preference.inAppEnabled ? 'on' : 'off'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-600">
                {appState.notifications.deliveries.length} deliveries tracked. Failed items can be retried after preference changes.
              </div>
            </Card>

            <Card title="Role scope" subtitle="What this role can touch right now.">
              <div className="space-y-2 text-sm text-stone-700">
                {describeAccess(sessionData.user.role, permissions).map((line) => (
                  <div key={line} className="rounded-2xl bg-stone-50 px-4 py-3">
                    {line}
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Phase 10 documents and invoices" subtitle="Document vault, invoice exports, and access-aware support records.">
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoBlock label="Documents" value={`${documents.length}`} />
                    <InfoBlock label="Invoices" value={`${invoiceExports.length}`} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-2 text-sm">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Document customer</div>
                      <select
                        className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3"
                        value={documentCustomerId}
                        onChange={(event) => setDocumentCustomerId(event.target.value)}
                      >
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Document type</div>
                      <select
                        className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3"
                        value={documentType}
                        onChange={(event) => setDocumentType(event.target.value as DocumentRecord['documentType'])}
                      >
                        <option value="gst">GST</option>
                        <option value="credit">Credit</option>
                        <option value="proof">Proof</option>
                        <option value="invoice">Invoice</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <label className="space-y-2 text-sm">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Document title</div>
                      <input
                        className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3"
                        value={documentTitle}
                        onChange={(event) => setDocumentTitle(event.target.value)}
                      />
                    </label>
                    <label className="space-y-2 text-sm">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">File name</div>
                      <input
                        className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3"
                        value={documentFileName}
                        onChange={(event) => setDocumentFileName(event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <button
                      type="button"
                      onClick={createDocumentRecord}
                      className="rounded-2xl bg-stone-950 px-5 py-3 text-sm font-extrabold text-white"
                    >
                      Add document
                    </button>
                    <button
                      type="button"
                      onClick={exportInvoiceRecord}
                      className="rounded-2xl border border-stone-300 bg-white px-5 py-3 text-sm font-extrabold text-stone-700"
                    >
                      Export invoice
                    </button>
                    <label className="space-y-2 text-sm">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Invoice amount</div>
                      <input
                        className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3"
                        value={invoiceAmount}
                        onChange={(event) => setInvoiceAmount(event.target.value)}
                      />
                    </label>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-3xl bg-stone-50 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Recent documents</div>
                    <div className="mt-3 space-y-2">
                      {documents.slice(0, 5).map((document) => (
                        <div key={document.id} className="rounded-2xl bg-white px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold text-stone-950">{document.title}</div>
                            <div className="text-xs uppercase tracking-[0.18em] text-stone-500">{document.status}</div>
                          </div>
                          <div className="mt-1 text-xs text-stone-500">
                            {document.documentType} | {document.fileName}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-3xl bg-stone-50 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Recent invoices</div>
                    <div className="mt-3 space-y-2">
                      {invoiceExports.slice(0, 5).map((invoice) => (
                        <div key={invoice.id} className="rounded-2xl bg-white px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold text-stone-950">{invoice.invoiceNumber}</div>
                            <div className="text-xs uppercase tracking-[0.18em] text-stone-500">{invoice.status}</div>
                          </div>
                          <div className="mt-1 text-xs text-stone-500">
                            Rs. {invoice.amount.toLocaleString()} | {invoice.fileName}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
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
*/

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

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

function BrandMark() {
  return (
    <div className="grid h-12 w-12 place-items-center rounded-[1.15rem] bg-[linear-gradient(135deg,#f59e0b_0%,#d97706_55%,#7c3f12_100%)] shadow-[0_18px_40px_rgba(36,18,7,.35)]">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M4 10.5 12 6l8 4.5v7L12 22l-8-4.5z" />
        <path d="M8 11.2v5.1M12 9.4v7.8M16 11.2v5.1" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function SidebarGlyph({ kind, active }: { kind: 'overview' | 'customers' | 'production' | 'delivery' | 'operations'; active: boolean }) {
  const glyphClass = active ? 'text-white' : 'text-slate-300';

  switch (kind) {
    case 'overview':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-5 w-5 ${glyphClass}`} fill="none" stroke="currentColor" strokeWidth="1.9">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'customers':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-5 w-5 ${glyphClass}`} fill="none" stroke="currentColor" strokeWidth="1.9">
          <circle cx="9" cy="9" r="3" />
          <path d="M3.5 20c.8-3.5 3.1-5.5 5.5-5.5S13.7 16.5 14.5 20" strokeLinecap="round" />
          <path d="M15.5 8.5c1.8.2 3 1.5 3.7 3.5M15.3 13.4c2.1.5 3.2 2 3.7 4.6" strokeLinecap="round" />
        </svg>
      );
    case 'production':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-5 w-5 ${glyphClass}`} fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="M4 8.5 12 4l8 4.5v9L12 22l-8-4.5z" />
          <path d="m12 4 8 4.5M12 13.5V22M4 8.5l8 5 8-5" strokeLinecap="round" />
        </svg>
      );
    case 'delivery':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-5 w-5 ${glyphClass}`} fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="M3 17h12l4-4-4-4H3z" />
          <circle cx="8" cy="17" r="1.8" />
          <circle cx="17" cy="17" r="1.8" />
          <path d="M3 9h5l2-3h4" strokeLinecap="round" />
        </svg>
      );
    case 'operations':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-5 w-5 ${glyphClass}`} fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="M4 7h16M4 12h10M4 17h16" strokeLinecap="round" />
          <circle cx="15.5" cy="12" r="1.5" />
          <circle cx="9.5" cy="17" r="1.5" />
        </svg>
      );
    default:
      return null;
  }
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,.14),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(124,63,18,.10),transparent_28%),linear-gradient(180deg,#fcf7f0_0%,#f6eadc_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-[2.25rem] border border-slate-200/80 bg-white/70 shadow-[0_30px_100px_rgba(36,18,7,.14)] backdrop-blur xl:grid-cols-[1.08fr_.92fr]">
        <section className="relative overflow-hidden bg-[linear-gradient(135deg,#241207_0%,#7c3f12_52%,#d97706_100%)] px-6 py-8 text-white sm:px-8 sm:py-10 lg:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,.06),transparent_45%)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div className="space-y-10">
              <div className="flex items-center gap-4">
                <BrandMark />
                <div>
                  <div className="text-2xl font-black tracking-tight">Aeden Bakes</div>
                  <div className="text-sm text-slate-300">Super-admin portal</div>
                </div>
              </div>

              <div className="max-w-2xl space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.26em] text-amber-100">
                  Operations command center
                </div>
                <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                  Run the bakery like an enterprise network, not a consumer dashboard.
                </h1>
                <p className="max-w-xl text-base leading-7 text-slate-200/90">
                  Watch every account, route, approval, and production line in one high-trust workspace
                  built for super-admins.
                </p>
              </div>
            </div>

            <div className="relative mt-10 grid gap-3 text-sm text-slate-100 sm:grid-cols-2 xl:grid-cols-1">
              {[
                'Live customer drill-down with 360 context',
                'Production, delivery, and receivables in one view',
                'Audit-ready actions with approvals and ERP sync',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-[1.25rem] border border-white/10 bg-white/8 px-4 py-3 backdrop-blur">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center px-6 py-8 sm:px-8 sm:py-10 lg:px-10">
          <div className="w-full max-w-lg">
            <div className="space-y-2">
              <h2 className="text-4xl font-black tracking-tight text-slate-950">Sign in</h2>
              <p className="text-sm leading-6 text-slate-500">Enter a role account to open the operations console.</p>
            </div>
            <div className="mt-8 grid gap-4">
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
                className="h-12 rounded-full bg-slate-950 px-5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(36,18,7,.22)] transition hover:-translate-y-0.5"
              >
                Sign in
              </button>
              {SHOW_DEMO_ACCESS ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Demo accounts: owner / owner123, manager / manager123, production / production123,
                  delivery / delivery123, accounts / accounts123, support / support123
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,.14),transparent_26%),linear-gradient(180deg,#fcf7f0_0%,#f6eadc_100%)] text-slate-700">
      <div className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold shadow-[0_16px_32px_rgba(36,18,7,.08)]">
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
      <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none shadow-[0_10px_24px_rgba(36,18,7,.04)] transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
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
    <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(36,18,7,.08)]">
      <SectionTitle title={title} subtitle={subtitle} />
      <div className="mt-5">{children}</div>
    </div>
  );
}

function GateMessage({ message }: { message: string }) {
  return <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.35rem] border border-white/15 bg-white/10 p-4 shadow-[0_16px_40px_rgba(36,18,7,.14)] backdrop-blur-md">
      <div className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-slate-200">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-2xl font-black tracking-tight text-slate-950">{title}</h2>
      <p className="text-sm leading-6 text-slate-500">{subtitle}</p>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 font-bold text-slate-900">{value}</div>
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
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
      <span className="font-semibold text-slate-700">{label}</span>
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
      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 shadow-[0_10px_24px_rgba(36,18,7,.04)] transition hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {enabled ? label : `${label} (blocked by role)`}
    </button>
  );
}



