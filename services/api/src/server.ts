import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  capacities,
  customers,
  customerBranches as seedCustomerBranches,
  customerUsers as seedCustomerUsers,
  orders,
  productionBatches,
  products,
  slots,
} from './data.js';
import type {
  AuditEvent,
  CustomerAccount,
  CustomerBranch,
  Customer360Response,
  CustomerDashboardResponse,
  CustomerNote,
  CreditHoldEvent,
  CreditLedgerEntry,
  CustomerTimelineEvent,
  CustomerOnboardingRequest,
  CustomerOrderCreateRequest,
  CustomerPortalAuthRecord,
  CustomerUserMembership,
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
  RecurrenceRule,
  CustomerPricingRule,
  StandingOrder,
  StandingOrderChange,
  StandingOrderPause,
  StandingOrderRun,
  SubstitutionEvent,
  SubstitutionRule,
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
const allowDemoAccounts = process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEMO_ACCOUNTS === 'true';
const exposeOtpDebugCode = process.env.NODE_ENV !== 'production' || process.env.EXPOSE_OTP_DEBUG_CODE === 'true';

app.get('/', (_req, res) => {
  res.json({
    name: 'Aeden Bakes API',
    status: 'ok',
    endpoints: ['/health', '/catalog', '/customers', '/orders', '/production/batches', '/delivery/manifest'],
  });
});

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

type OtpChallenge = {
  id: string;
  phone: string;
  code: string;
  createdAt: string;
  expiresAt: string;
};

type OtpVerification = {
  token: string;
  phone: string;
  verifiedAt: string;
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

type DeliveryManifest = {
  id: string;
  serviceDate: string;
  status: 'draft' | 'locked' | 'dispatched' | 'completed';
  routeCount: number;
  note: string | null;
  createdAt: string;
  lockedAt: string | null;
  dispatchedAt: string | null;
  completedAt: string | null;
};

type DeliveryManifestStop = {
  id: string;
  manifestId: string;
  slotId: string;
  orderId: string;
  stopNumber: number;
  customerId: string;
  customerName: string;
  address: string;
  status: 'pending' | 'reached' | 'completed' | 'failed' | 'returned';
  proofStatus: 'pending' | 'captured' | 'verified';
  note: string;
  updatedAt: string;
};

type ProofOfDelivery = {
  id: string;
  manifestId: string;
  stopId: string;
  orderId: string;
  signatureName: string | null;
  photoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  capturedAt: string;
};

type DeliveryPhoto = {
  id: string;
  proofId: string;
  orderId: string;
  caption: string;
  url: string;
  createdAt: string;
};

type FailureReason = {
  id: string;
  orderId: string;
  stopId: string;
  code: 'customer_unavailable' | 'damaged' | 'wrong_address' | 'rescheduled' | 'other';
  note: string;
  createdAt: string;
};

type ReturnRecord = {
  id: string;
  orderId: string;
  stopId: string;
  quantity: number;
  note: string;
  createdAt: string;
};

type ReturnItem = {
  id: string;
  returnId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
};

type EventOutbox = {
  id: string;
  eventId: string;
  orderId: string;
  action: DeliveryWritebackAction;
  payloadJson: Record<string, unknown>;
  status: 'queued' | 'accepted' | 'applied' | 'duplicate' | 'rejected';
  createdAt: string;
  processedAt: string | null;
};

type DeliveryWritebackEvent = {
  eventId: string;
  orderId: string;
  slotId: string;
  action: DeliveryWritebackAction;
  note: string;
  capturedAt: string;
  signatureName?: string;
  photoUrl?: string;
  latitude?: number;
  longitude?: number;
  reasonCode?: FailureReason['code'];
  returnQuantity?: number;
};

type SupportCaseMessageRecord = {
  id: string;
  caseId: string;
  messageType: 'customer' | 'internal' | 'system';
  message: string;
  authorRole: AuthRole | 'system';
  authorId: string;
  createdAt: string;
};

type NotificationJob = {
  id: string;
  channel: 'sms' | 'whatsapp' | 'email' | 'in_app';
  templateCode: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'retrying';
  correlationKey: string;
  recipient: string;
  subject: string;
  body: string;
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
  payloadJson: Record<string, unknown>;
  status: 'building' | 'ready' | 'published';
  createdAt: string;
};

type SegmentDefinition = {
  code: string;
  name: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type SegmentMembership = {
  id: string;
  segmentCode: string;
  customerId: string;
  createdAt: string;
};

type MarginProductBreakdown = {
  productId: string;
  productName: string;
  category: string;
  revenue: number;
  estimatedCost: number;
  grossMargin: number;
  grossMarginRate: number;
};

type MarginBranchBreakdown = {
  branchId: string;
  branchName: string;
  revenue: number;
  estimatedCost: number;
  grossMargin: number;
  grossMarginRate: number;
};

type MarginSnapshot = {
  id: string;
  serviceDate: string;
  status: 'draft' | 'ready' | 'published';
  revenue: number;
  estimatedCost: number;
  grossMargin: number;
  grossMarginRate: number;
  productBreakdown: MarginProductBreakdown[];
  branchBreakdown: MarginBranchBreakdown[];
  createdAt: string;
  updatedAt: string;
};

type RiskSnapshot = {
  id: string;
  serviceDate: string;
  status: 'draft' | 'ready' | 'published';
  totalCustomers: number;
  healthyCustomers: number;
  watchCustomers: number;
  blockSoonCustomers: number;
  blockedCustomers: number;
  topRiskCustomers: Array<{
    customerId: string;
    customerName: string;
    riskState: string;
    riskScore: number;
    outstandingBalance: number;
  }>;
  createdAt: string;
  updatedAt: string;
};

type KpiRollup = {
  id: string;
  metricCode: string;
  serviceDate: string;
  value: number;
  createdAt: string;
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
  branchId?: string | null;
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

type DocumentAccessLog = {
  id: string;
  documentId: string;
  customerId: string;
  actorRole: AuthRole | 'system';
  action: 'view' | 'download' | 'verify' | 'archive';
  createdAt: string;
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

type ApiStateSnapshot = {
  customers: typeof customers;
  customerBranches: CustomerBranch[];
  customerUsers: CustomerUserMembership[];
  customerAuthRecords: AuthRecord[];
  customerNotes: CustomerNote[];
  supportCaseMessages: SupportCaseMessageRecord[];
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
  deliveryManifests: DeliveryManifest[];
  deliveryManifestStops: DeliveryManifestStop[];
  proofOfDelivery: ProofOfDelivery[];
  deliveryPhotos: DeliveryPhoto[];
  failureReasons: FailureReason[];
  returnRecords: ReturnRecord[];
  returnItems: ReturnItem[];
  eventOutbox: EventOutbox[];
  notificationJobs: NotificationJob[];
  notificationDeliveries: NotificationDelivery[];
  notificationTemplates: NotificationTemplate[];
  notificationPreferences: NotificationPreference[];
  accountHealthSnapshots: AccountHealthSnapshot[];
  accountActions: AccountAction[];
  alertRules: AlertRule[];
  alertEvents: AlertEvent[];
  analyticsSnapshots: AnalyticsSnapshot[];
  kpiRollups: KpiRollup[];
  segmentDefinitions: SegmentDefinition[];
  segmentMemberships: SegmentMembership[];
  marginSnapshots: MarginSnapshot[];
  riskSnapshots: RiskSnapshot[];
  customerRequests: CustomerRequest[];
  savedAddresses: SavedAddress[];
  reportExports: ReportExport[];
  documents: DocumentRecord[];
  documentAccessLogs: DocumentAccessLog[];
  invoiceExports: InvoiceExport[];
};

const authUsers: AuthRecord[] = allowDemoAccounts
  ? [
      { id: 'user_owner', username: 'owner', displayName: 'Owner', role: 'owner', password: 'owner123' },
      { id: 'user_manager', username: 'manager', displayName: 'Manager', role: 'manager', password: 'manager123' },
      {
        id: 'user_production',
        username: 'production',
        displayName: 'Production Lead',
        role: 'production',
        password: 'production123',
      },
      { id: 'user_delivery', username: 'delivery', displayName: 'Delivery Lead', role: 'delivery', password: 'delivery123' },
      { id: 'user_accounts', username: 'accounts', displayName: 'Accounts Lead', role: 'accounts', password: 'accounts123' },
      { id: 'user_support', username: 'support', displayName: 'Support Lead', role: 'support', password: 'support123' },
    ]
  : [];

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
const databasePath = resolveDatabasePath(process.env.DATABASE_URL ?? '');
const database = new DatabaseSync(databasePath);
database.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    snapshot TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS migration_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    migration_name TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS auth_sessions (
    token TEXT PRIMARY KEY,
    user_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notification_templates (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notification_preferences (
    customer_id TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invoice_exports (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS document_access_logs (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS delivery_manifests (
    id TEXT PRIMARY KEY,
    service_date TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS delivery_manifest_stops (
    id TEXT PRIMARY KEY,
    manifest_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS proof_of_delivery (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS delivery_photos (
    id TEXT PRIMARY KEY,
    proof_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS failure_reasons (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS returns (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS return_items (
    id TEXT PRIMARY KEY,
    return_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS event_outbox (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);
recordMigration('database-initialized');
const sessions = new Map<string, Session>();
const otpChallenges = new Map<string, OtpChallenge>();
const otpVerifications = new Map<string, OtpVerification>();
let auditEvents: AuditEvent[] = [];
let approvals: ApprovalRequest[] = [];
let branchApprovalRules = [
  {
    id: 'rule_customer_branch_create',
    ruleCode: 'customer_branch_create',
    targetType: 'branch',
    thresholdJson: { requiresApproval: true },
    active: true,
    createdAt: '2026-06-19T08:07:00+05:30',
  },
  {
    id: 'rule_customer_branch_edit',
    ruleCode: 'customer_branch_edit',
    targetType: 'branch',
    thresholdJson: { requiresApproval: false },
    active: true,
    createdAt: '2026-06-19T08:07:00+05:30',
  },
];
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
let customerBranches = [...seedCustomerBranches];
let customerUsers = [...seedCustomerUsers];
let supportCaseMessages: SupportCaseMessageRecord[] = [
  {
    id: 'msg_case_cafe_nook_1',
    caseId: 'case_cafe_nook_1',
    messageType: 'internal',
    message: 'Follow up with the bakery team before the cutoff closes.',
    authorRole: 'support',
    authorId: 'support',
    createdAt: '2026-06-19T08:11:00+05:30',
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
let standingOrders: StandingOrder[] = [
  {
    id: 'so_cafe_nook_weekday',
    customerId: 'cust_cafe_nook',
    branchId: 'branch_cafe_nook_main',
    status: 'active',
    schedule: {
      deliveryDays: [1, 2, 3, 4, 5],
      slotId: 'slot_morning',
      paymentMode: 'credit',
      items: [
        { productId: 'prod_loaf', quantity: 12 },
        { productId: 'prod_croissant', quantity: 12 },
      ],
      notes: 'Weekday breakfast repeat for Cafe Nook.',
    },
    createdAt: '2026-06-19T08:15:00+05:30',
    updatedAt: '2026-06-19T08:15:00+05:30',
  },
  {
    id: 'so_hotel_lotus_weekend',
    customerId: 'cust_hotel_lotus',
    branchId: 'branch_hotel_lotus_main',
    status: 'paused',
    schedule: {
      deliveryDays: [0, 6],
      slotId: 'slot_evening',
      paymentMode: 'part-pay',
      items: [{ productId: 'prod_loaf', quantity: 8 }],
      notes: 'Weekend banquet bread pack for Hotel Lotus.',
    },
    createdAt: '2026-06-19T08:16:00+05:30',
    updatedAt: '2026-06-19T08:20:00+05:30',
  },
];
let standingOrderRuns: StandingOrderRun[] = [];
let standingOrderPauses: StandingOrderPause[] = [
  {
    id: 'pause_hotel_lotus_1',
    standingOrderId: 'so_hotel_lotus_weekend',
    startDate: '2026-06-19',
    endDate: null,
    reason: 'Paused for temporary renovation closure.',
    createdAt: '2026-06-19T08:20:00+05:30',
  },
];
let recurrenceRules: RecurrenceRule[] = [
  {
    id: 'rule_cafe_nook_weekday',
    customerId: 'cust_cafe_nook',
    branchId: 'branch_cafe_nook_main',
    ruleCode: 'weekday_breakfast_repeat',
    cadence: 'weekly',
    status: 'active',
    payload: {
      deliveryDays: [1, 2, 3, 4, 5],
      slotId: 'slot_morning',
      notes: 'Auto-generate weekday breakfast runs for the main kitchen.',
      branchScoped: true,
    },
    createdAt: '2026-06-19T08:18:00+05:30',
    updatedAt: '2026-06-19T08:18:00+05:30',
  },
  {
    id: 'rule_hotel_lotus_weekend',
    customerId: 'cust_hotel_lotus',
    branchId: 'branch_hotel_lotus_main',
    ruleCode: 'weekend_banquet_pack',
    cadence: 'weekly',
    status: 'paused',
    payload: {
      deliveryDays: [0, 6],
      slotId: 'slot_evening',
      notes: 'Weekend standing pack for banquet support.',
      branchScoped: true,
    },
    createdAt: '2026-06-19T08:19:00+05:30',
    updatedAt: '2026-06-19T08:19:00+05:30',
  },
];
let standingOrderChanges: StandingOrderChange[] = [
  {
    id: 'soc_hotel_lotus_pause_note',
    standingOrderId: 'so_hotel_lotus_weekend',
    customerId: 'cust_hotel_lotus',
    branchId: 'branch_hotel_lotus_main',
    changeType: 'pause',
    status: 'submitted',
    requestedBy: 'customer_admin',
    requestedAt: '2026-06-19T08:22:00+05:30',
    decidedBy: null,
    decidedAt: null,
    reason: 'Pause until renovation work is complete.',
    patchJson: {
      status: 'paused',
    },
  },
];
let customerPricingRules: CustomerPricingRule[] = [
  {
    id: 'price_cafe_nook_loaf',
    customerId: 'cust_cafe_nook',
    branchId: 'branch_cafe_nook_main',
    productId: 'prod_loaf',
    price: 88,
    pricingMode: 'fixed',
    status: 'active',
    reason: 'Contract price for daily breakfast loaves.',
    createdAt: '2026-06-19T08:25:00+05:30',
    updatedAt: '2026-06-19T08:25:00+05:30',
  },
  {
    id: 'price_hotel_lotus_croissant',
    customerId: 'cust_hotel_lotus',
    branchId: 'branch_hotel_lotus_main',
    productId: 'prod_croissant',
    price: 55,
    pricingMode: 'fixed',
    status: 'active',
    reason: 'Tier B breakfast agreement.',
    createdAt: '2026-06-19T08:26:00+05:30',
    updatedAt: '2026-06-19T08:26:00+05:30',
  },
];
let creditLedgerEntries: CreditLedgerEntry[] = [
  {
    id: 'ledger_cafe_nook_opening',
    customerId: 'cust_cafe_nook',
    branchId: 'branch_cafe_nook_main',
    entryType: 'invoice',
    amount: 18400,
    balanceAfter: 18400,
    referenceType: 'opening_balance',
    referenceId: 'seed',
    note: 'Opening receivables balance.',
    createdAt: '2026-06-19T08:27:00+05:30',
  },
];
let creditHoldEvents: CreditHoldEvent[] = [
  {
    id: 'hold_hotel_lotus_watch',
    customerId: 'cust_hotel_lotus',
    branchId: 'branch_hotel_lotus_main',
    status: 'active',
    reason: 'Credit review pending after month-end exposure.',
    createdAt: '2026-06-19T08:28:00+05:30',
    releasedAt: null,
  },
];
let substitutionRules: SubstitutionRule[] = [
  {
    id: 'sub_loaf_to_brioche',
    customerId: null,
    branchId: null,
    productId: 'prod_loaf',
    substituteProductId: 'prod_danish',
    status: 'active',
    reason: 'Fallback substitute when loaf capacity is tight.',
    createdAt: '2026-06-19T08:29:00+05:30',
    updatedAt: '2026-06-19T08:29:00+05:30',
  },
];
let substitutionEvents: SubstitutionEvent[] = [];
let notificationJobs: NotificationJob[] = [];
let notificationDeliveries: NotificationDelivery[] = [];
let notificationTemplates: NotificationTemplate[] = [
  {
    code: 'order_confirmed',
    name: 'Order confirmed',
    channelPriority: ['whatsapp', 'sms', 'in_app'],
    subject: 'Your order is confirmed',
    body: 'We have locked your order and the bakery team is preparing your batch.',
    retryable: true,
  },
  {
    code: 'dispatch_update',
    name: 'Dispatch update',
    channelPriority: ['whatsapp', 'sms', 'in_app'],
    subject: 'Your order is out for delivery',
    body: 'The route has started and the delivery partner is on the way.',
    retryable: true,
  },
  {
    code: 'delay_alert',
    name: 'Delay alert',
    channelPriority: ['whatsapp', 'sms', 'in_app'],
    subject: 'Delivery delay update',
    body: 'A delay has been detected and the bakery is adjusting the route immediately.',
    retryable: true,
  },
  {
    code: 'invoice_reminder',
    name: 'Invoice reminder',
    channelPriority: ['whatsapp', 'sms', 'in_app'],
    subject: 'Invoice reminder',
    body: 'Your latest invoice is ready and the accounts team has a reminder queued.',
    retryable: true,
  },
];
let notificationPreferences: NotificationPreference[] = [
  {
    customerId: 'cust_cafe_nook',
    pushEnabled: true,
    whatsappEnabled: true,
    smsEnabled: true,
    inAppEnabled: true,
    phone: '9000000001',
    whatsappNumber: '9000000001',
    updatedAt: '2026-06-19T08:30:00+05:30',
  },
  {
    customerId: 'cust_hotel_lotus',
    pushEnabled: true,
    whatsappEnabled: true,
    smsEnabled: true,
    inAppEnabled: true,
    phone: '9000000002',
    whatsappNumber: '9000000002',
    updatedAt: '2026-06-19T08:30:00+05:30',
  },
];
let accountHealthSnapshots: AccountHealthSnapshot[] = [];
let accountActions: AccountAction[] = [];
let alertRules: AlertRule[] = [
  {
    id: 'rule_watch_balance',
    ruleCode: 'balance_watch',
    thresholdJson: { riskState: ['watch', 'block_soon', 'blocked'] },
    active: true,
    createdAt: '2026-06-19T08:05:00+05:30',
  },
  {
    id: 'rule_failed_delivery',
    ruleCode: 'failed_delivery',
    thresholdJson: { status: ['failed_delivery', 'partial_delivery'] },
    active: true,
    createdAt: '2026-06-19T08:05:00+05:30',
  },
];
let alertEvents: AlertEvent[] = [];
let analyticsSnapshots: AnalyticsSnapshot[] = [];
let kpiRollups: KpiRollup[] = [];
let segmentDefinitions: SegmentDefinition[] = [
  {
    code: 'repeat_customers',
    name: 'Repeat customers',
    description: 'Accounts with more than one non-cancelled order.',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    code: 'high_value_customers',
    name: 'High value customers',
    description: 'Accounts with revenue at or above the high-value threshold.',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    code: 'watch_customers',
    name: 'Watch customers',
    description: 'Accounts currently on watch, block soon, or blocked.',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    code: 'dormant_customers',
    name: 'Dormant customers',
    description: 'Accounts with no recent order activity.',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
let segmentMemberships: SegmentMembership[] = [];
let marginSnapshots: MarginSnapshot[] = [];
let riskSnapshots: RiskSnapshot[] = [];
let customerRequests: CustomerRequest[] = [];
let savedAddresses: SavedAddress[] = [
  {
    id: 'addr_cafe_nook_main',
    customerId: 'cust_cafe_nook',
    label: 'Main kitchen',
    addressLine: 'Cafe Nook, North Industrial Estate',
    deliveryZone: 'North',
    active: true,
  },
  {
    id: 'addr_hotel_lotus_main',
    customerId: 'cust_hotel_lotus',
    label: 'Receiving dock',
    addressLine: 'Hotel Lotus, Central Market Road',
    deliveryZone: 'Central',
    active: true,
  },
];
let reportExports: ReportExport[] = [];
let documents: DocumentRecord[] = [
  {
    id: 'doc_gst_cafe_nook',
    customerId: 'cust_cafe_nook',
    documentType: 'gst',
    status: 'verified',
    title: 'GST certificate',
    fileName: 'cafe-nook-gst.pdf',
    mimeType: 'application/pdf',
    downloadUrl: '/documents/doc_gst_cafe_nook/download',
    tags: ['gst', 'kyc'],
    createdAt: '2026-06-19T08:35:00+05:30',
    verifiedAt: '2026-06-19T09:00:00+05:30',
  },
  {
    id: 'doc_invoice_cafe_nook_2401',
    customerId: 'cust_cafe_nook',
    documentType: 'invoice',
    status: 'uploaded',
    title: 'Invoice 2401',
    fileName: 'invoice-2401.pdf',
    mimeType: 'application/pdf',
    downloadUrl: '/documents/doc_invoice_cafe_nook_2401/download',
    tags: ['invoice', 'accounts'],
    createdAt: '2026-06-19T10:15:00+05:30',
    verifiedAt: null,
  },
];
let documentAccessLogs: DocumentAccessLog[] = [];
let invoiceExports: InvoiceExport[] = [
  {
    id: 'invexp_cafe_nook_2401',
    customerId: 'cust_cafe_nook',
    invoiceNumber: 'INV-2401',
    fileName: 'INV-2401.pdf',
    status: 'ready',
    amount: 12640,
    createdAt: '2026-06-19T10:15:00+05:30',
    downloadUrl: '/invoices/invexp_cafe_nook_2401/download',
  },
];
let deliveryManifests: DeliveryManifest[] = [];
let deliveryManifestStops: DeliveryManifestStop[] = [];
let proofOfDelivery: ProofOfDelivery[] = [];
let deliveryPhotos: DeliveryPhoto[] = [];
let failureReasons: FailureReason[] = [];
let returnRecords: ReturnRecord[] = [];
let returnItems: ReturnItem[] = [];
let eventOutbox: EventOutbox[] = [];
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
  database
    .prepare(
      `
      INSERT INTO auth_sessions (token, user_json, created_at, expires_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(token) DO UPDATE SET
        user_json = excluded.user_json,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at
      `,
    )
    .run(token, JSON.stringify(session.user), session.createdAt, session.expiresAt);
  return session;
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'aeden-bakes-api',
    persistence: 'sqlite',
    databasePath,
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
    database.prepare('DELETE FROM auth_sessions WHERE token = ?').run(token);
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

app.post('/auth/otp/request', (req, res) => {
  const { phone } = req.body as { phone?: string };
  const normalizedPhone = phone?.replace(/\D/g, '').trim();

  if (!normalizedPhone || normalizedPhone.length < 10) {
    res.status(400).json({ error: 'phone is required' });
    return;
  }

  const challengeId = crypto.randomUUID();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const now = new Date();

  otpChallenges.set(challengeId, {
    id: challengeId,
    phone: normalizedPhone,
    code,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 1000 * 60 * 5).toISOString(),
  });

  res.json({
    challengeId,
    expiresInSeconds: 300,
    ...(exposeOtpDebugCode ? { debugCode: code } : {}),
  });
});

app.post('/auth/otp/verify', (req, res) => {
  const { challengeId, phone, code } = req.body as {
    challengeId?: string;
    phone?: string;
    code?: string;
  };
  const normalizedPhone = phone?.replace(/\D/g, '').trim();
  const normalizedCode = code?.trim();

  if (!challengeId || !normalizedPhone || !normalizedCode) {
    res.status(400).json({ error: 'challengeId, phone, and code are required' });
    return;
  }

  const challenge = otpChallenges.get(challengeId);
  if (!challenge) {
    res.status(404).json({ error: 'OTP challenge not found' });
    return;
  }

  if (challenge.phone !== normalizedPhone) {
    res.status(400).json({ error: 'phone does not match the OTP challenge' });
    return;
  }

  if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
    otpChallenges.delete(challengeId);
    res.status(410).json({ error: 'OTP challenge expired' });
    return;
  }

  if (challenge.code !== normalizedCode) {
    res.status(401).json({ error: 'Invalid OTP code' });
    return;
  }

  otpChallenges.delete(challengeId);

  const token = `otp_${crypto.randomUUID()}`;
  otpVerifications.set(token, {
    token,
    phone: normalizedPhone,
    verifiedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
  });

  res.json({
    verified: true,
    otpToken: token,
    phone: normalizedPhone,
    expiresInSeconds: 600,
  });
});

app.post('/customer/onboard', (req, res) => {
  const input = req.body as Partial<CustomerOnboardingRequest> & { otpToken?: string };
  const name = input.name?.trim();
  const deliveryZone = input.deliveryZone?.trim();
  const loginId = input.loginId?.trim();
  const password = input.password?.trim();
  const defaultAddress = input.defaultAddress?.trim();
  const otpToken = input.otpToken?.trim();
  const otpVerification = otpToken ? otpVerifications.get(otpToken) : undefined;
  const otpActive =
    otpVerification &&
    otpVerification.phone === loginId?.replace(/\D/g, '') &&
    new Date(otpVerification.expiresAt).getTime() > Date.now();

  if (!name || !deliveryZone || !loginId || !defaultAddress) {
    res.status(400).json({ error: 'name, deliveryZone, loginId, and defaultAddress are required' });
    return;
  }

  if (!password && !otpActive) {
    res.status(400).json({ error: 'password or a valid otpToken is required' });
    return;
  }

  if (password && password.length < 6) {
    res.status(400).json({ error: 'password must be at least 6 characters long' });
    return;
  }

  const effectivePassword = password || crypto.randomUUID().slice(0, 12);

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
    password: effectivePassword,
    customerId: customer.id,
    active: true,
    createdAt: now,
    updatedAt: now,
    phone: loginId,
    defaultAddress,
    deliveryZone,
  };
  customerAuthRecords.unshift(authRecord);

  const branchNow = new Date().toISOString();
  const primaryBranch: CustomerBranch = {
    id: `branch_${customer.id}_main`,
    customerId: customer.id,
    name: `${name} - Main`,
    code: `${customer.id.slice(-4).toUpperCase()}-MAIN`,
    status: 'active',
    serviceZone: deliveryZone,
    deliveryNotes: defaultAddress,
    createdAt: branchNow,
    updatedAt: branchNow,
  };
  customerBranches.unshift(primaryBranch);

  const accountUser: CustomerUserMembership = {
    id: `cust_user_${crypto.randomUUID().slice(0, 8)}`,
    customerId: customer.id,
    branchId: primaryBranch.id,
    displayName: name,
    role: 'admin',
    status: 'active',
    phone: loginId,
    createdAt: branchNow,
    updatedAt: branchNow,
  };
  customerUsers.unshift(accountUser);

  const session = issueSession(toSessionUser(authRecord));
  recordAudit({
    kind: 'customer_onboarded',
    actor: loginId,
    summary: `Created customer portal profile for ${customer.id}.`,
    referenceId: customer.id,
  });
  enqueueNotification({
    customerId: customer.id,
    channel: 'in_app',
    templateCode: 'customer_onboarded',
    subject: `Welcome ${customer.name}`,
    correlationKey: `onboard:${customer.id}`,
    recipient: customer.id,
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
    otpVerified: Boolean(otpActive),
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

app.get('/customer/branches', authenticate, requireAnyRole(['customer']), (req, res) => {
  const customerId = req.session?.user.customerId;
  if (!customerId) {
    res.status(400).json({ error: 'Customer session is missing a customer link' });
    return;
  }

  res.json({
    branches: customerBranches.filter((entry) => entry.customerId === customerId),
  });
});

app.get('/customer/users', authenticate, requireAnyRole(['customer']), (req, res) => {
  const customerId = req.session?.user.customerId;
  if (!customerId) {
    res.status(400).json({ error: 'Customer session is missing a customer link' });
    return;
  }

  res.json({
    users: customerUsers.filter((entry) => entry.customerId === customerId),
  });
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
  const branchId = body.branchId?.trim() || null;
  const paymentMode = body.paymentMode ?? 'prepaid';
  const items = Array.isArray(body.items) ? body.items : [];
  const branchesForCustomer = customerBranches.filter((entry) => entry.customerId === customer.id);
  const selectedBranch = branchId
    ? branchesForCustomer.find((entry) => entry.id === branchId) ?? null
    : branchesForCustomer.find((entry) => entry.status === 'active') ?? branchesForCustomer[0] ?? null;

  if (branchId && !selectedBranch) {
    const reason = 'Selected branch was not found for this customer.';
    recordCustomerOrderRejection(customer, attemptId, reason);
    persistStateSoon();
    res.status(400).json({ error: reason });
    return;
  }

  if (selectedBranch && selectedBranch.status !== 'active') {
    const reason = `Selected branch is ${selectedBranch.status}.`;
    recordCustomerOrderRejection(customer, attemptId, reason);
    persistStateSoon();
    res.status(400).json({ error: reason });
    return;
  }

  const validationError = validateCustomerOrderDraft(customer, {
    serviceDate,
    slotId,
    branchZone: selectedBranch?.serviceZone,
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
  if (hasActiveCreditHold(customer.id)) {
    const reason = 'Credit hold is active for this account.';
    recordCustomerOrderRejection(customer, attemptId, reason);
    persistStateSoon();
    res.status(400).json({ error: reason });
    return;
  }
  const orderItems = items.map((item) => {
    const product = products.find((entry) => entry.id === item.productId)!;
    const unitPrice = resolveUnitPrice(customer.id, selectedBranch?.id ?? null, item.productId) ?? product.unitPrice;
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice,
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
    branchId: selectedBranch?.id ?? null,
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
  enqueueNotification({
    customerId: customer.id,
    channel: 'in_app',
    templateCode: 'order_confirmation',
    subject: `Order ${order.id} confirmed`,
    correlationKey: `order-confirm:${order.id}`,
    recipient: customer.id,
  });
  rebuildOperationalState();
  persistStateSoon();

  res.status(201).json({
    order,
    dashboard: buildCustomerDashboard(customer.id),
  });
});

app.get('/catalog', authenticate, (_req, res) => {
  res.json({ products, capacities, slots });
});

app.get('/customers', authenticate, requireAnyRole(['owner', 'manager', 'support', 'accounts']), (_req, res) => {
  res.json({ customers });
});

app.get('/customers/:id', authenticate, requireAnyRole(['owner', 'manager', 'support', 'accounts']), (req, res) => {
  const customerId = readRouteParam(req.params.id);
  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  res.json({
    customer,
    branches: customerBranches.filter((entry) => entry.customerId === customer.id),
    users: customerUsers.filter((entry) => entry.customerId === customer.id),
    orders: orders.filter((entry) => entry.customerId === customer.id),
    productionBatches,
  });
});

app.get('/customers/:id/360', authenticate, requireAnyRole(['owner', 'manager', 'support', 'accounts']), (req, res) => {
  const customerId = readRouteParam(req.params.id);
  const snapshot = buildCustomer360(customerId);
  res.json(snapshot);
});

app.get('/customers/:id/branches', authenticate, requireAnyRole(['owner', 'manager', 'support', 'accounts']), (req, res) => {
  const customerId = readRouteParam(req.params.id);
  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  res.json({
    branches: customerBranches.filter((entry) => entry.customerId === customer.id),
  });
});

app.post('/customers/:id/branches', authenticate, requireAnyRole(['owner', 'manager']), (req, res) => {
  const customerId = readRouteParam(req.params.id);
  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  const body = req.body as {
    name?: string;
    code?: string;
    serviceZone?: string;
    deliveryNotes?: string;
    status?: CustomerBranch['status'];
  };
  const name = body.name?.trim();
  const code = body.code?.trim().toUpperCase();
  const serviceZone = body.serviceZone?.trim();
  if (!name || !code || !serviceZone) {
    res.status(400).json({ error: 'name, code, and serviceZone are required' });
    return;
  }

  const existing = customerBranches.find((entry) => entry.customerId === customer.id && entry.code === code);
  if (existing) {
    res.status(409).json({ error: 'A branch with this code already exists for the customer' });
    return;
  }

  const now = new Date().toISOString();
  const branch: CustomerBranch = {
    id: `branch_${crypto.randomUUID().slice(0, 8)}`,
    customerId: customer.id,
    name,
    code,
    status: body.status ?? 'active',
    serviceZone,
    deliveryNotes: body.deliveryNotes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  customerBranches.unshift(branch);
  recordAudit({
    kind: 'customer_onboarded',
    actor: req.session?.user.username ?? 'system',
    summary: `Created branch ${branch.code} for ${customer.id}.`,
    referenceId: branch.id,
  });
  persistStateSoon();

  res.status(201).json({ branch, branches: customerBranches.filter((entry) => entry.customerId === customer.id) });
});

app.get('/customers/:id/users', authenticate, requireAnyRole(['owner', 'manager', 'support', 'accounts']), (req, res) => {
  const customerId = readRouteParam(req.params.id);
  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  res.json({
    users: customerUsers.filter((entry) => entry.customerId === customer.id),
  });
});

app.post('/customers/:id/users/invite', authenticate, requireAnyRole(['owner', 'manager']), (req, res) => {
  const customerId = readRouteParam(req.params.id);
  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  const body = req.body as {
    displayName?: string;
    branchId?: string | null;
    role?: CustomerUserMembership['role'];
    phone?: string;
    email?: string;
  };
  const displayName = body.displayName?.trim();
  const role = body.role ?? 'viewer';
  const branchId = body.branchId?.trim() || null;
  const branch = branchId ? customerBranches.find((entry) => entry.id === branchId && entry.customerId === customer.id) : null;
  if (branchId && !branch) {
    res.status(400).json({ error: 'branchId does not belong to this customer' });
    return;
  }

  if (!displayName) {
    res.status(400).json({ error: 'displayName is required' });
    return;
  }

  const now = new Date().toISOString();
  const user: CustomerUserMembership = {
    id: `cust_user_${crypto.randomUUID().slice(0, 8)}`,
    customerId: customer.id,
    branchId,
    displayName,
    role,
    status: 'invited',
    phone: body.phone?.trim() || undefined,
    email: body.email?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  customerUsers.unshift(user);
  recordAudit({
    kind: 'customer_onboarded',
    actor: req.session?.user.username ?? 'system',
    summary: `Invited customer user ${displayName} for ${customer.id}.`,
    referenceId: user.id,
  });
  persistStateSoon();

  res.status(201).json({ user, users: customerUsers.filter((entry) => entry.customerId === customer.id) });
});

app.get('/branch-roles', authenticate, requireAnyRole(['owner', 'manager', 'support', 'accounts']), (_req, res) => {
  res.json({
    roles: [
      { code: 'admin', name: 'Admin', description: 'Can manage branches, users, and approvals.' },
      { code: 'buyer', name: 'Buyer', description: 'Can place and manage orders for a branch.' },
      { code: 'manager', name: 'Manager', description: 'Can review orders and requests.' },
      { code: 'viewer', name: 'Viewer', description: 'Read-only access for visibility.' },
    ],
  });
});

app.get('/approval-rules', authenticate, requireAnyRole(['owner', 'manager', 'support', 'accounts']), (_req, res) => {
  res.json({
    rules: branchApprovalRules,
  });
});

app.post('/branches/:branchId/serviceability/check', authenticate, requireAnyRole(['owner', 'manager', 'support', 'accounts', 'customer']), (req, res) => {
  const branchId = readRouteParam(req.params.branchId);
  const branch = customerBranches.find((entry) => entry.id === branchId);
  if (!branch) {
    res.status(404).json({ error: 'Branch not found' });
    return;
  }

  const customer = customers.find((entry) => entry.id === branch.customerId);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  res.json({
    branch,
    serviceability: buildCustomerServiceability({ ...customer, deliveryZone: branch.serviceZone }, getDefaultServiceDate(customer)),
  });
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
  enqueueNotification({
    customerId,
    channel: 'in_app',
    templateCode: 'support_case_opened',
    subject: `Support case opened for ${customer.name}`,
    correlationKey: `support-open:${supportCase.id}`,
    recipient: customer.id,
  });
  rebuildOperationalState();
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
  enqueueNotification({
    customerId: supportCase.customerId,
    channel: 'in_app',
    templateCode: 'support_case_transition',
    subject: `Support case ${supportCase.subject} moved to ${status}`,
    correlationKey: `support-transition:${supportCase.id}:${status}`,
    recipient: supportCase.customerId,
  });
  rebuildOperationalState();
  persistStateSoon();

  res.json({ supportCase, supportCases, customer: buildCustomer360(supportCase.customerId) });
});

app.get('/support/cases/:id/messages', authenticate, requireAnyRole(['owner', 'manager', 'support', 'accounts']), (req, res) => {
  const id = readRouteParam(req.params.id);
  const messages = supportCaseMessages.filter((entry) => entry.caseId === id).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  res.json({ messages });
});

app.post('/support/cases/:id/messages', authenticate, requireAnyRole(['owner', 'manager', 'support']), (req, res) => {
  const id = readRouteParam(req.params.id);
  const supportCase = supportCases.find((entry) => entry.id === id);
  if (!supportCase) {
    res.status(404).json({ error: 'Support case not found' });
    return;
  }

  const { message, messageType = 'internal' } = req.body as {
    message?: string;
    messageType?: SupportCaseMessageRecord['messageType'];
  };
  if (!message?.trim()) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  const supportMessage: SupportCaseMessageRecord = {
    id: `msg_${crypto.randomUUID()}`,
    caseId: supportCase.id,
    messageType,
    message: message.trim(),
    authorRole: req.session?.user.role ?? 'system',
    authorId: req.session?.user.username ?? 'system',
    createdAt: new Date().toISOString(),
  };
  supportCaseMessages.unshift(supportMessage);
  supportCase.lastUpdatedAt = supportMessage.createdAt;
  recordAudit({
    kind: 'support_case_updated',
    actor: req.session?.user.role ?? 'support',
    summary: `Added message to support case ${supportCase.id}.`,
    referenceId: supportCase.id,
  });
  enqueueNotification({
    customerId: supportCase.customerId,
    channel: 'in_app',
    templateCode: 'support_case_update',
    subject: `Support case ${supportCase.subject} updated`,
    correlationKey: `support:${supportCase.id}:${supportMessage.id}`,
    recipient: supportCase.customerId,
  });
  rebuildOperationalState();
  persistStateSoon();
  res.status(201).json({ message: supportMessage, messages: supportCaseMessages.filter((entry) => entry.caseId === id) });
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
  rebuildOperationalState();
  persistStateSoon();

  res.status(201).json({ note: customerNote, customer: buildCustomer360(id) });
});

app.get(
  '/standing-orders',
  authenticate,
  requireAnyRole(['owner', 'manager', 'accounts', 'production', 'support']),
  (_req, res) => {
    res.json({
      standingOrders,
      standingOrderRuns,
      standingOrderPauses,
      recurrenceRules,
      standingOrderChanges,
    });
  },
);

app.get('/customer/standing-orders', authenticate, requireAnyRole(['customer']), (req, res) => {
  const customerId = req.session?.user.customerId;
  if (!customerId) {
    res.status(400).json({ error: 'Customer session is missing a customer link' });
    return;
  }

  res.json({
    standingOrders: standingOrders.filter((entry) => entry.customerId === customerId),
    standingOrderRuns: standingOrderRuns.filter((entry) =>
      standingOrders.some((order) => order.id === entry.standingOrderId && order.customerId === customerId),
    ),
    standingOrderPauses: standingOrderPauses.filter((entry) =>
      standingOrders.some((order) => order.id === entry.standingOrderId && order.customerId === customerId),
    ),
    recurrenceRules: recurrenceRules.filter((entry) => entry.customerId === null || entry.customerId === customerId),
    standingOrderChanges: standingOrderChanges.filter((entry) => entry.customerId === customerId),
  });
});

app.post('/standing-orders', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (req, res) => {
  const body = req.body as Partial<{
    customerId: string;
    branchId: string | null;
    status: StandingOrder['status'];
    deliveryDays: number[];
    slotId: string;
    paymentMode: StandingOrder['schedule']['paymentMode'];
    items: StandingOrder['schedule']['items'];
    notes: string;
  }>;

  const customerId = body.customerId?.trim();
  if (!customerId) {
    res.status(400).json({ error: 'customerId is required' });
    return;
  }

  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  const branchId = body.branchId?.trim() || null;
  const branch = branchId
    ? customerBranches.find((entry) => entry.id === branchId && entry.customerId === customer.id)
    : customerBranches.find((entry) => entry.customerId === customer.id && entry.status === 'active') ?? null;
  if (branchId && !branch) {
    res.status(400).json({ error: 'branchId does not belong to this customer' });
    return;
  }

  if (!body.slotId?.trim() || !Array.isArray(body.deliveryDays) || !Array.isArray(body.items) || body.items.length === 0) {
    res.status(400).json({ error: 'deliveryDays, slotId, and items are required' });
    return;
  }

  const now = new Date().toISOString();
  const standingOrder: StandingOrder = {
    id: `so_${crypto.randomUUID()}`,
    customerId,
    branchId: branch?.id ?? branchId,
    status: body.status ?? 'draft',
    schedule: {
      deliveryDays: normalizeDeliveryDays(body.deliveryDays),
      slotId: body.slotId.trim(),
      paymentMode: body.paymentMode ?? 'prepaid',
      items: sanitizeStandingOrderItems(body.items),
      notes: body.notes?.trim() || undefined,
    },
    createdAt: now,
    updatedAt: now,
  };

  standingOrders.unshift(standingOrder);
  recordAudit({
    kind: 'standing_order_created',
    actor: req.session?.user.role ?? 'system',
    summary: `Created standing order ${standingOrder.id} for ${customer.name}.`,
    referenceId: standingOrder.id,
  });
  enqueueNotification({
    customerId,
    channel: 'in_app',
    templateCode: 'standing_order_created',
    subject: `Standing order created for ${customer.name}`,
    correlationKey: `standing-create:${standingOrder.id}`,
    recipient: customer.id,
  });
  rebuildOperationalState();
  persistStateSoon();

  res.status(201).json({ standingOrder, standingOrders });
});

app.post('/customer/standing-orders', authenticate, requireAnyRole(['customer']), (req, res) => {
  const customerId = req.session?.user.customerId;
  if (!customerId) {
    res.status(400).json({ error: 'Customer session is missing a customer link' });
    return;
  }

  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  const body = req.body as Partial<{
    branchId: string | null;
    status: StandingOrder['status'];
    deliveryDays: number[];
    slotId: string;
    paymentMode: StandingOrder['schedule']['paymentMode'];
    items: StandingOrder['schedule']['items'];
    notes: string;
  }>;
  const branchId = body.branchId?.trim() || null;
  const branch = branchId
    ? customerBranches.find((entry) => entry.id === branchId && entry.customerId === customer.id)
    : customerBranches.find((entry) => entry.customerId === customer.id && entry.status === 'active') ?? null;
  if (branchId && !branch) {
    res.status(400).json({ error: 'branchId does not belong to this customer' });
    return;
  }

  if (!body.slotId?.trim() || !Array.isArray(body.deliveryDays) || !Array.isArray(body.items) || body.items.length === 0) {
    res.status(400).json({ error: 'deliveryDays, slotId, and items are required' });
    return;
  }

  const now = new Date().toISOString();
  const standingOrder: StandingOrder = {
    id: `so_${crypto.randomUUID()}`,
    customerId,
    branchId: branch?.id ?? branchId,
    status: body.status ?? 'draft',
    schedule: {
      deliveryDays: normalizeDeliveryDays(body.deliveryDays),
      slotId: body.slotId.trim(),
      paymentMode: body.paymentMode ?? 'prepaid',
      items: sanitizeStandingOrderItems(body.items),
      notes: body.notes?.trim() || undefined,
    },
    createdAt: now,
    updatedAt: now,
  };

  standingOrders.unshift(standingOrder);
  recordAudit({
    kind: 'standing_order_created',
    actor: req.session?.user.username ?? 'system',
    summary: `Customer created standing order ${standingOrder.id} for ${customer.name}.`,
    referenceId: standingOrder.id,
  });
  enqueueNotification({
    customerId,
    channel: 'in_app',
    templateCode: 'standing_order_created',
    subject: `Standing order created for ${customer.name}`,
    correlationKey: `standing-create:${standingOrder.id}`,
    recipient: customer.id,
  });
  rebuildOperationalState();
  persistStateSoon();

  res.status(201).json({ standingOrder, standingOrders: standingOrders.filter((entry) => entry.customerId === customerId) });
});

app.patch('/standing-orders/:id', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (req, res) => {
  const id = readRouteParam(req.params.id);
  const standingOrder = standingOrders.find((entry) => entry.id === id);
  if (!standingOrder) {
    res.status(404).json({ error: 'Standing order not found' });
    return;
  }

  const body = req.body as Partial<{
    status: StandingOrder['status'];
    branchId: string | null;
    deliveryDays: number[];
    slotId: string;
    paymentMode: StandingOrder['schedule']['paymentMode'];
    items: StandingOrder['schedule']['items'];
    notes: string;
  }>;

  if (body.status) {
    standingOrder.status = body.status;
  }
  if (body.branchId !== undefined) {
    const branchId = body.branchId?.trim() || null;
    if (branchId) {
      const branch = customerBranches.find((entry) => entry.id === branchId && entry.customerId === standingOrder.customerId);
      if (!branch) {
        res.status(400).json({ error: 'branchId does not belong to this customer' });
        return;
      }
      standingOrder.branchId = branch.id;
    } else {
      standingOrder.branchId = null;
    }
  }
  if (Array.isArray(body.deliveryDays)) {
    standingOrder.schedule.deliveryDays = normalizeDeliveryDays(body.deliveryDays);
  }
  if (typeof body.slotId === 'string' && body.slotId.trim()) {
    standingOrder.schedule.slotId = body.slotId.trim();
  }
  if (body.paymentMode) {
    standingOrder.schedule.paymentMode = body.paymentMode;
  }
  if (Array.isArray(body.items) && body.items.length > 0) {
    standingOrder.schedule.items = sanitizeStandingOrderItems(body.items);
  }
  if (typeof body.notes === 'string') {
    standingOrder.schedule.notes = body.notes.trim() || undefined;
  }
  standingOrder.updatedAt = new Date().toISOString();

  recordAudit({
    kind: 'standing_order_updated',
    actor: req.session?.user.role ?? 'system',
    summary: `Updated standing order ${standingOrder.id}.`,
    referenceId: standingOrder.id,
  });
  rebuildOperationalState();
  persistStateSoon();

  res.json({ standingOrder, standingOrders });
});

app.post('/standing-orders/:id/pause', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (req, res) => {
  const id = readRouteParam(req.params.id);
  const standingOrder = standingOrders.find((entry) => entry.id === id);
  if (!standingOrder) {
    res.status(404).json({ error: 'Standing order not found' });
    return;
  }

  if (standingOrder.status === 'cancelled') {
    res.status(400).json({ error: 'Cannot pause a cancelled standing order' });
    return;
  }

  const body = req.body as { reason?: string; startDate?: string; endDate?: string };
  const reason = body.reason?.trim();
  if (!reason) {
    res.status(400).json({ error: 'reason is required' });
    return;
  }

  standingOrder.status = 'paused';
  standingOrder.updatedAt = new Date().toISOString();
  const pause: StandingOrderPause = {
    id: `pause_${crypto.randomUUID()}`,
    standingOrderId: standingOrder.id,
    startDate: body.startDate?.trim() || todayIsoDate(),
    endDate: body.endDate?.trim() || null,
    reason,
    createdAt: new Date().toISOString(),
  };
  standingOrderPauses.unshift(pause);
  recordAudit({
    kind: 'standing_order_paused',
    actor: req.session?.user.role ?? 'system',
    summary: `Paused standing order ${standingOrder.id}. ${reason}`,
    referenceId: standingOrder.id,
  });
  enqueueNotification({
    customerId: standingOrder.customerId,
    channel: 'in_app',
    templateCode: 'standing_order_paused',
    subject: `Standing order paused: ${standingOrder.id}`,
    correlationKey: `standing-pause:${standingOrder.id}:${pause.id}`,
    recipient: standingOrder.customerId,
  });
  rebuildOperationalState();
  persistStateSoon();

  res.json({ standingOrder, pause, standingOrders, standingOrderPauses });
});

app.post('/standing-orders/:id/resume', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (req, res) => {
  const id = readRouteParam(req.params.id);
  const standingOrder = standingOrders.find((entry) => entry.id === id);
  if (!standingOrder) {
    res.status(404).json({ error: 'Standing order not found' });
    return;
  }

  if (standingOrder.status === 'cancelled') {
    res.status(400).json({ error: 'Cannot resume a cancelled standing order' });
    return;
  }

  const openPause = standingOrderPauses.find((pause) => pause.standingOrderId === standingOrder.id && pause.endDate === null);
  if (openPause) {
    openPause.endDate = todayIsoDate();
  }

  standingOrder.status = 'active';
  standingOrder.updatedAt = new Date().toISOString();
  recordAudit({
    kind: 'standing_order_resumed',
    actor: req.session?.user.role ?? 'system',
    summary: `Resumed standing order ${standingOrder.id}.`,
    referenceId: standingOrder.id,
  });
  enqueueNotification({
    customerId: standingOrder.customerId,
    channel: 'in_app',
    templateCode: 'standing_order_resumed',
    subject: `Standing order resumed: ${standingOrder.id}`,
    correlationKey: `standing-resume:${standingOrder.id}`,
    recipient: standingOrder.customerId,
  });
  rebuildOperationalState();
  persistStateSoon();

  res.json({ standingOrder, standingOrders, standingOrderPauses });
});

app.post('/standing-orders/generate-runs', authenticate, requireAnyRole(['owner', 'manager', 'accounts', 'production', 'support']), (req, res) => {
  const body = req.body as { serviceDate?: string };
  const serviceDate = body.serviceDate?.trim() || todayIsoDate();
  const result = generateStandingOrderRuns(serviceDate, req.session?.user.role ?? 'system');
  persistStateSoon();
  res.json(result);
});

app.get('/recurrence-rules', authenticate, requireAnyRole(['owner', 'manager', 'accounts', 'support']), (_req, res) => {
  res.json({ recurrenceRules });
});

app.post('/recurrence-rules', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (req, res) => {
  const body = req.body as Partial<{
    customerId: string | null;
    branchId: string | null;
    ruleCode: string;
    cadence: RecurrenceRule['cadence'];
    status: RecurrenceRule['status'];
    deliveryDays: number[];
    slotId: string;
    notes: string;
    branchScoped: boolean;
  }>;
  const ruleCode = body.ruleCode?.trim();
  const slotId = body.slotId?.trim();
  const deliveryDays = Array.isArray(body.deliveryDays) ? normalizeDeliveryDays(body.deliveryDays) : [];
  if (!ruleCode || !slotId || deliveryDays.length === 0) {
    res.status(400).json({ error: 'ruleCode, slotId, and deliveryDays are required' });
    return;
  }

  const customerId = body.customerId?.trim() || null;
  const branchId = body.branchId?.trim() || null;
  if (branchId) {
    const branch = customerBranches.find((entry) => entry.id === branchId);
    if (!branch) {
      res.status(400).json({ error: 'branchId does not exist' });
      return;
    }
    if (customerId && branch.customerId !== customerId) {
      res.status(400).json({ error: 'branchId does not belong to the selected customer' });
      return;
    }
  }

  const rule: RecurrenceRule = {
    id: `rr_${crypto.randomUUID().slice(0, 8)}`,
    customerId,
    branchId,
    ruleCode,
    cadence: body.cadence ?? 'weekly',
    status: body.status ?? 'active',
    payload: {
      deliveryDays,
      slotId,
      notes: body.notes?.trim() || undefined,
      branchScoped: body.branchScoped ?? Boolean(branchId),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  recurrenceRules.unshift(rule);
  recordAudit({
    kind: 'customer_onboarded',
    actor: req.session?.user.role ?? 'system',
    summary: `Created recurrence rule ${rule.ruleCode}.`,
    referenceId: rule.id,
  });
  persistStateSoon();
  res.status(201).json({ recurrenceRule: rule, recurrenceRules });
});

app.patch('/recurrence-rules/:id', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (req, res) => {
  const id = readRouteParam(req.params.id);
  const rule = recurrenceRules.find((entry) => entry.id === id);
  if (!rule) {
    res.status(404).json({ error: 'Recurrence rule not found' });
    return;
  }

  const body = req.body as Partial<{
    branchId: string | null;
    status: RecurrenceRule['status'];
    deliveryDays: number[];
    slotId: string;
    notes: string;
    branchScoped: boolean;
  }>;
  if (body.branchId !== undefined) {
    const branchId = body.branchId?.trim() || null;
    if (branchId) {
      const branch = customerBranches.find((entry) => entry.id === branchId);
      if (!branch) {
        res.status(400).json({ error: 'branchId does not exist' });
        return;
      }
      rule.branchId = branch.id;
      rule.customerId = branch.customerId;
    } else {
      rule.branchId = null;
    }
  }
  if (body.status) {
    rule.status = body.status;
  }
  if (Array.isArray(body.deliveryDays)) {
    rule.payload.deliveryDays = normalizeDeliveryDays(body.deliveryDays);
  }
  if (typeof body.slotId === 'string' && body.slotId.trim()) {
    rule.payload.slotId = body.slotId.trim();
  }
  if (typeof body.notes === 'string') {
    rule.payload.notes = body.notes.trim() || undefined;
  }
  if (typeof body.branchScoped === 'boolean') {
    rule.payload.branchScoped = body.branchScoped;
  }
  rule.updatedAt = new Date().toISOString();
  recordAudit({
    kind: 'customer_onboarded',
    actor: req.session?.user.role ?? 'system',
    summary: `Updated recurrence rule ${rule.ruleCode}.`,
    referenceId: rule.id,
  });
  persistStateSoon();
  res.json({ recurrenceRule: rule, recurrenceRules });
});

app.get('/standing-order-changes', authenticate, requireAnyRole(['owner', 'manager', 'accounts', 'support']), (_req, res) => {
  res.json({ standingOrderChanges });
});

app.post(
  '/standing-orders/:id/change-request',
  authenticate,
  requireAnyRole(['owner', 'manager', 'accounts', 'customer']),
  (req, res) => {
    const standingOrderId = readRouteParam(req.params.id);
    const standingOrder = standingOrders.find((entry) => entry.id === standingOrderId);
    if (!standingOrder) {
      res.status(404).json({ error: 'Standing order not found' });
      return;
    }

    const customerId = req.session?.user.customerId;
    if (req.session?.user.role === 'customer' && standingOrder.customerId !== customerId) {
      res.status(403).json({ error: 'Standing order does not belong to this customer session' });
      return;
    }

    const body = req.body as Partial<{
      changeType: StandingOrderChange['changeType'];
      reason: string;
      branchId: string | null;
      status: StandingOrder['status'];
      schedule: Partial<StandingOrder['schedule']>;
    }>;
    const changeType = body.changeType ?? 'schedule_update';
    const reason = body.reason?.trim();
    if (!reason) {
      res.status(400).json({ error: 'reason is required' });
      return;
    }

    const change: StandingOrderChange = {
      id: `soc_${crypto.randomUUID().slice(0, 8)}`,
      standingOrderId: standingOrder.id,
      customerId: standingOrder.customerId,
      branchId: standingOrder.branchId ?? null,
      changeType,
      status: 'submitted',
      requestedBy: req.session?.user.username ?? 'system',
      requestedAt: new Date().toISOString(),
      decidedBy: null,
      decidedAt: null,
      reason,
      patchJson: {
        branchId: body.branchId ?? standingOrder.branchId ?? null,
        status: body.status,
        schedule: body.schedule,
      },
    };
    standingOrderChanges.unshift(change);
    recordAudit({
      kind: 'approval_queued',
      actor: req.session?.user.role ?? 'system',
      summary: `Queued standing order change ${change.id} for ${standingOrder.id}.`,
      referenceId: change.id,
    });
    persistStateSoon();
    res.status(201).json({ change, standingOrderChanges });
  },
);

app.post('/standing-order-changes/:id/approve', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (req, res) => {
  const id = readRouteParam(req.params.id);
  const change = standingOrderChanges.find((entry) => entry.id === id);
  if (!change) {
    res.status(404).json({ error: 'Standing order change not found' });
    return;
  }
  if (change.status === 'rejected' || change.status === 'applied') {
    res.status(400).json({ error: 'Standing order change is no longer pending' });
    return;
  }

  change.status = 'approved';
  const applied = applyStandingOrderChange(change);
  if (!applied) {
    res.status(400).json({ error: 'Change could not be applied' });
    return;
  }

  change.status = 'applied';
  change.decidedBy = req.session?.user.username ?? 'system';
  change.decidedAt = new Date().toISOString();
  recordAudit({
    kind: 'approval_approved',
    actor: req.session?.user.role ?? 'system',
    summary: `Approved standing order change ${change.id}.`,
    referenceId: change.id,
  });
  persistStateSoon();
  res.json({ change, standingOrders, standingOrderChanges });
});

app.post('/standing-order-changes/:id/reject', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (req, res) => {
  const id = readRouteParam(req.params.id);
  const change = standingOrderChanges.find((entry) => entry.id === id);
  if (!change) {
    res.status(404).json({ error: 'Standing order change not found' });
    return;
  }
  if (change.status === 'applied') {
    res.status(400).json({ error: 'Applied changes cannot be rejected' });
    return;
  }

  change.status = 'rejected';
  change.decidedBy = req.session?.user.username ?? 'system';
  change.decidedAt = new Date().toISOString();
  recordAudit({
    kind: 'approval_rejected',
    actor: req.session?.user.role ?? 'system',
    summary: `Rejected standing order change ${change.id}.`,
    referenceId: change.id,
  });
  persistStateSoon();
  res.json({ change, standingOrderChanges });
});

app.post('/standing-orders/:id/skip', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (req, res) => {
  const id = readRouteParam(req.params.id);
  const standingOrder = standingOrders.find((entry) => entry.id === id);
  if (!standingOrder) {
    res.status(404).json({ error: 'Standing order not found' });
    return;
  }

  const body = req.body as { serviceDate?: string; reason?: string };
  const serviceDate = body.serviceDate?.trim() || todayIsoDate();
  const reason = body.reason?.trim() || 'Skipped from admin control.';
  const existingPause = standingOrderPauses.find(
    (pause) => pause.standingOrderId === standingOrder.id && pause.startDate === serviceDate && pause.endDate === serviceDate,
  );
  if (!existingPause) {
    standingOrderPauses.unshift({
      id: `pause_${crypto.randomUUID().slice(0, 8)}`,
      standingOrderId: standingOrder.id,
      startDate: serviceDate,
      endDate: serviceDate,
      reason,
      createdAt: new Date().toISOString(),
    });
  }
  recordAudit({
    kind: 'standing_order_paused',
    actor: req.session?.user.role ?? 'system',
    summary: `Skipped standing order ${standingOrder.id} for ${serviceDate}. ${reason}`,
    referenceId: standingOrder.id,
  });
  persistStateSoon();
  res.json({ standingOrder, standingOrderPauses });
});

app.get('/notifications', authenticate, requireAnyRole(['owner', 'manager', 'accounts', 'support']), (_req, res) => {
  res.json({
    jobs: notificationJobs,
    deliveries: notificationDeliveries,
    templates: notificationTemplates,
    preferences: notificationPreferences,
  });
});

app.get('/customer/notifications', authenticate, requireAnyRole(['customer']), (req, res) => {
  const customerId = req.session?.user.customerId;
  if (!customerId) {
    res.status(400).json({ error: 'Customer session missing customer id' });
    return;
  }

  res.json({
    jobs: notificationJobs.filter((job) => job.recipient === customerId),
    deliveries: notificationDeliveries.filter((delivery) => {
      const job = notificationJobs.find((entry) => entry.id === delivery.jobId);
      return job?.recipient === customerId;
    }),
    templates: notificationTemplates,
    preference: notificationPreferences.find((entry) => entry.customerId === customerId) ?? null,
  });
});

app.get('/notifications/templates', authenticate, requireAnyRole(['owner', 'manager', 'accounts', 'support']), (_req, res) => {
  res.json({ templates: notificationTemplates });
});

app.get('/notifications/preferences', authenticate, requireAnyRole(['owner', 'manager', 'accounts', 'support']), (_req, res) => {
  res.json({ preferences: notificationPreferences });
});

app.post('/notifications/preferences', authenticate, requireAnyRole(['owner', 'manager', 'accounts', 'support']), (req, res) => {
  const { customerId, pushEnabled, whatsappEnabled, smsEnabled, inAppEnabled, phone, whatsappNumber } = req.body as {
    customerId?: string;
    pushEnabled?: boolean;
    whatsappEnabled?: boolean;
    smsEnabled?: boolean;
    inAppEnabled?: boolean;
    phone?: string;
    whatsappNumber?: string;
  };
  if (!customerId) {
    res.status(400).json({ error: 'customerId is required' });
    return;
  }

  const updatedAt = new Date().toISOString();
  const existingIndex = notificationPreferences.findIndex((entry) => entry.customerId === customerId);
  const preference: NotificationPreference = {
    customerId,
    pushEnabled: pushEnabled ?? notificationPreferences[existingIndex]?.pushEnabled ?? true,
    whatsappEnabled: whatsappEnabled ?? notificationPreferences[existingIndex]?.whatsappEnabled ?? true,
    smsEnabled: smsEnabled ?? notificationPreferences[existingIndex]?.smsEnabled ?? true,
    inAppEnabled: inAppEnabled ?? notificationPreferences[existingIndex]?.inAppEnabled ?? true,
    phone: phone ?? notificationPreferences[existingIndex]?.phone,
    whatsappNumber: whatsappNumber ?? notificationPreferences[existingIndex]?.whatsappNumber,
    updatedAt,
  };

  if (existingIndex >= 0) {
    notificationPreferences.splice(existingIndex, 1, preference);
  } else {
    notificationPreferences.unshift(preference);
  }
  persistStateSoon();
  res.status(201).json({ preference });
});

app.post('/notifications/queue', authenticate, requireAnyRole(['owner', 'manager', 'accounts', 'support']), (req, res) => {
  const { customerId, channel, templateCode = 'manual', subject, body, correlationKey } = req.body as {
    customerId?: string;
    channel?: NotificationJob['channel'];
    templateCode?: string;
    subject?: string;
    body?: string;
    correlationKey?: string;
  };
  if (!customerId) {
    res.status(400).json({ error: 'customerId is required' });
    return;
  }
  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }
  const template = notificationTemplates.find((entry) => entry.code === templateCode) ?? {
    code: templateCode,
    name: templateCode,
    channelPriority: ['in_app'],
    subject: subject?.trim() || 'Manual notification',
    body: subject?.trim() || 'Manual notification',
    retryable: true,
  };
  const result = enqueueNotification({
    customerId,
    channel: channel ?? template.channelPriority[0],
    templateCode,
    subject: subject?.trim() || template.subject,
    body: body?.trim() || template.body,
    correlationKey: correlationKey?.trim() || `manual:${customerId}:${crypto.randomUUID()}`,
    recipient: customer.id,
  });
  persistStateSoon();
  res.status(201).json(result);
});

app.post('/notifications/:jobId/retry', authenticate, requireAnyRole(['owner', 'manager', 'accounts', 'support']), (req, res) => {
  const job = notificationJobs.find((entry) => entry.id === req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'Notification job not found' });
    return;
  }
  if (job.status !== 'failed' && job.status !== 'retrying') {
    res.status(400).json({ error: 'Only failed notifications can be retried' });
    return;
  }
  const customer = customers.find((entry) => entry.id === job.recipient);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }
  const retried = enqueueNotification({
    customerId: customer.id,
    channel: job.channel,
    templateCode: job.templateCode,
    subject: job.subject,
    body: job.body,
    correlationKey: `${job.correlationKey}:retry:${job.status}-${job.id}`,
    recipient: customer.id,
  });
  persistStateSoon();
  res.status(201).json(retried);
});

app.get('/account-health', authenticate, requireAnyRole(['owner', 'manager', 'accounts', 'support']), (_req, res) => {
  res.json({
    snapshots: accountHealthSnapshots,
    actions: accountActions,
  });
});

app.get('/commercial/overview', authenticate, requireAnyRole(['owner', 'manager', 'accounts', 'support']), (_req, res) => {
  res.json({
    pricingRules: customerPricingRules,
    creditLedgerEntries,
    creditHoldEvents,
    substitutionRules,
    substitutionEvents,
  });
});

app.post('/pricing-rules', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (req, res) => {
  const body = req.body as Partial<{
    customerId: string | null;
    branchId: string | null;
    productId: string | null;
    price: number;
    pricingMode: CustomerPricingRule['pricingMode'];
    status: CustomerPricingRule['status'];
    reason: string;
  }>;
  if (!body.productId?.trim() || !Number.isFinite(body.price)) {
    res.status(400).json({ error: 'productId and price are required' });
    return;
  }
  const rule: CustomerPricingRule = {
    id: `price_${crypto.randomUUID().slice(0, 8)}`,
    customerId: body.customerId?.trim() || null,
    branchId: body.branchId?.trim() || null,
    productId: body.productId.trim(),
    price: Math.max(0, Number(body.price)),
    pricingMode: body.pricingMode ?? 'fixed',
    status: body.status ?? 'active',
    reason: body.reason?.trim() || undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  customerPricingRules.unshift(rule);
  persistStateSoon();
  res.status(201).json({ pricingRule: rule, pricingRules: customerPricingRules });
});

app.post('/credit-holds', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (req, res) => {
  const body = req.body as Partial<{ customerId: string; branchId: string | null; reason: string }>;
  const customerId = body.customerId?.trim();
  const reason = body.reason?.trim();
  if (!customerId || !reason) {
    res.status(400).json({ error: 'customerId and reason are required' });
    return;
  }
  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }
  if (hasActiveCreditHold(customerId)) {
    res.status(409).json({ error: 'Credit hold already active' });
    return;
  }
  const hold: CreditHoldEvent = {
    id: `hold_${crypto.randomUUID().slice(0, 8)}`,
    customerId,
    branchId: body.branchId?.trim() || null,
    status: 'active',
    reason,
    createdAt: new Date().toISOString(),
    releasedAt: null,
  };
  creditHoldEvents.unshift(hold);
  customer.riskState = 'blocked';
  addCreditLedgerEntry({
    customerId,
    branchId: hold.branchId,
    entryType: 'hold',
    amount: 0,
    balanceAfter: customer.outstandingBalance,
    referenceType: 'credit_hold',
    referenceId: hold.id,
    note: reason,
  });
  recordAudit({
    kind: 'approval_queued',
    actor: req.session?.user.role ?? 'system',
    summary: `Credit hold applied to ${customer.id}. ${reason}`,
    referenceId: hold.id,
  });
  rebuildOperationalState();
  persistStateSoon();
  res.status(201).json({ hold, creditHoldEvents, creditLedgerEntries });
});

app.post('/credit-holds/:id/release', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (req, res) => {
  const id = readRouteParam(req.params.id);
  const hold = creditHoldEvents.find((entry) => entry.id === id);
  if (!hold) {
    res.status(404).json({ error: 'Credit hold not found' });
    return;
  }
  if (hold.status === 'released') {
    res.status(400).json({ error: 'Credit hold already released' });
    return;
  }
  const customer = customers.find((entry) => entry.id === hold.customerId);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }
  hold.status = 'released';
  hold.releasedAt = new Date().toISOString();
  addCreditLedgerEntry({
    customerId: hold.customerId,
    branchId: hold.branchId,
    entryType: 'release',
    amount: 0,
    balanceAfter: customer.outstandingBalance,
    referenceType: 'credit_hold',
    referenceId: hold.id,
    note: `Hold released: ${hold.reason}`,
  });
  refreshCustomerRisk(customer);
  recordAudit({
    kind: 'approval_approved',
    actor: req.session?.user.role ?? 'system',
    summary: `Credit hold released for ${hold.customerId}.`,
    referenceId: hold.id,
  });
  persistStateSoon();
  res.json({ hold, creditHoldEvents, creditLedgerEntries });
});

app.post('/substitution-rules', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (req, res) => {
  const body = req.body as Partial<{
    customerId: string | null;
    branchId: string | null;
    productId: string;
    substituteProductId: string;
    reason: string;
  }>;
  if (!body.productId?.trim() || !body.substituteProductId?.trim() || !body.reason?.trim()) {
    res.status(400).json({ error: 'productId, substituteProductId, and reason are required' });
    return;
  }
  const rule: SubstitutionRule = {
    id: `sub_${crypto.randomUUID().slice(0, 8)}`,
    customerId: body.customerId?.trim() || null,
    branchId: body.branchId?.trim() || null,
    productId: body.productId.trim(),
    substituteProductId: body.substituteProductId.trim(),
    status: 'active',
    reason: body.reason.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  substitutionRules.unshift(rule);
  persistStateSoon();
  res.status(201).json({ substitutionRule: rule, substitutionRules });
});

app.post('/substitution-events', authenticate, requireAnyRole(['owner', 'manager', 'accounts', 'support']), (req, res) => {
  const body = req.body as Partial<{
    customerId: string;
    branchId: string | null;
    orderId: string | null;
    productId: string;
    substituteProductId: string;
    status: SubstitutionEvent['status'];
    reason: string;
  }>;
  if (!body.customerId?.trim() || !body.productId?.trim() || !body.substituteProductId?.trim() || !body.reason?.trim()) {
    res.status(400).json({ error: 'customerId, productId, substituteProductId, and reason are required' });
    return;
  }
  const event: SubstitutionEvent = {
    id: `subevt_${crypto.randomUUID().slice(0, 8)}`,
    customerId: body.customerId.trim(),
    branchId: body.branchId?.trim() || null,
    orderId: body.orderId?.trim() || null,
    productId: body.productId.trim(),
    substituteProductId: body.substituteProductId.trim(),
    status: body.status ?? 'proposed',
    reason: body.reason.trim(),
    createdAt: new Date().toISOString(),
  };
  substitutionEvents.unshift(event);
  persistStateSoon();
  res.status(201).json({ substitutionEvent: event, substitutionEvents });
});

app.post('/account-health/:customerId/actions', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (req, res) => {
  const customerId = readRouteParam(req.params.customerId);
  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  const { actionType, reason, approvedBy = null } = req.body as {
    actionType?: string;
    reason?: string;
    approvedBy?: string | null;
  };

  if (!actionType?.trim() || !reason?.trim()) {
    res.status(400).json({ error: 'actionType and reason are required' });
    return;
  }

  const action: AccountAction = {
    id: `acct_action_${crypto.randomUUID()}`,
    customerId,
    actionType: actionType.trim(),
    reason: reason.trim(),
    createdBy: req.session?.user.username ?? 'system',
    approvedBy,
    createdAt: new Date().toISOString(),
  };
  accountActions.unshift(action);
  rebuildOperationalState();
  persistStateSoon();
  res.status(201).json({ action, snapshots: accountHealthSnapshots });
});

app.get('/analytics/overview', authenticate, requireAnyRole(['owner', 'manager', 'accounts', 'support']), (_req, res) => {
  res.json({
    latest: analyticsSnapshots[0] ?? null,
    snapshots: analyticsSnapshots,
    rollups: kpiRollups,
    insights: analyticsSnapshots[0]?.payloadJson ?? null,
  });
});

app.post('/analytics/rebuild', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (_req, res) => {
  refreshPhase3DerivedState();
  persistStateSoon();
  res.json({
    latest: analyticsSnapshots[0] ?? null,
    snapshots: analyticsSnapshots,
    rollups: kpiRollups,
    insights: analyticsSnapshots[0]?.payloadJson ?? null,
  });
});

app.post('/analytics/publish', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (_req, res) => {
  if (analyticsSnapshots.length === 0) {
    res.status(404).json({ error: 'No analytics snapshot available' });
    return;
  }
  analyticsSnapshots[0].status = 'published';
  persistStateSoon();
  res.json({
    latest: analyticsSnapshots[0],
    snapshots: analyticsSnapshots,
    rollups: kpiRollups,
    insights: analyticsSnapshots[0]?.payloadJson ?? null,
  });
});

app.get('/alert-rules', authenticate, requireAnyRole(['owner', 'manager', 'accounts', 'support']), (_req, res) => {
  res.json({ alertRules, alertEvents });
});

app.get('/customer/requests', authenticate, requireAnyRole(['customer', 'owner', 'manager', 'support', 'accounts']), (req, res) => {
  const customerId = req.session?.user.customerId;
  const visibleRequests = req.session?.user.role === 'customer' && customerId
    ? customerRequests.filter((entry) => entry.customerId === customerId)
    : customerRequests;
  res.json({ requests: visibleRequests });
});

app.post('/customer/requests', authenticate, requireAnyRole(['customer']), (req, res) => {
  const customerId = req.session?.user.customerId;
  if (!customerId) {
    res.status(400).json({ error: 'Customer session is missing a customer link' });
    return;
  }

  const { requestType = 'support_follow_up', reason } = req.body as {
    requestType?: CustomerRequest['requestType'];
    reason?: string;
  };
  if (!reason?.trim()) {
    res.status(400).json({ error: 'reason is required' });
    return;
  }

  const request: CustomerRequest = {
    id: `req_${crypto.randomUUID()}`,
    customerId,
    requestType,
    status: 'submitted',
    reason: reason.trim(),
    createdAt: new Date().toISOString(),
    decidedAt: null,
  };
  customerRequests.unshift(request);
  enqueueNotification({
    customerId,
    channel: 'in_app',
    templateCode: 'customer_request_submitted',
    subject: 'Your request was submitted',
    correlationKey: `request:${request.id}`,
    recipient: customerId,
  });
  rebuildOperationalState();
  persistStateSoon();
  res.status(201).json({ request, requests: customerRequests.filter((entry) => entry.customerId === customerId) });
});

app.get('/customer/addresses', authenticate, requireAnyRole(['customer', 'owner', 'manager', 'support', 'accounts']), (req, res) => {
  const customerId = req.session?.user.customerId;
  const visibleAddresses = req.session?.user.role === 'customer' && customerId
    ? savedAddresses.filter((entry) => entry.customerId === customerId)
    : savedAddresses;
  res.json({ addresses: visibleAddresses });
});

app.post('/customer/addresses', authenticate, requireAnyRole(['customer', 'owner', 'manager', 'support']), (req, res) => {
  const customerId = req.session?.user.customerId ?? (req.body as { customerId?: string }).customerId;
  if (!customerId) {
    res.status(400).json({ error: 'customerId is required' });
    return;
  }

  const { label, addressLine, deliveryZone } = req.body as {
    label?: string;
    addressLine?: string;
    deliveryZone?: string;
  };
  if (!label?.trim() || !addressLine?.trim() || !deliveryZone?.trim()) {
    res.status(400).json({ error: 'label, addressLine, and deliveryZone are required' });
    return;
  }

  const address: SavedAddress = {
    id: `addr_${crypto.randomUUID()}`,
    customerId,
    label: label.trim(),
    addressLine: addressLine.trim(),
    deliveryZone: deliveryZone.trim(),
    active: true,
  };
  savedAddresses.unshift(address);
  persistStateSoon();
  res.status(201).json({ address, addresses: savedAddresses.filter((entry) => entry.customerId === customerId) });
});

app.get('/reports', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (_req, res) => {
  res.json({ reportExports });
});

app.post('/reports/export', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (req, res) => {
  const { reportCode = 'operations_overview' } = req.body as { reportCode?: string };
  const payload = {
    customers: customers.length,
    orders: orders.length,
    supportCases: supportCases.length,
    standingOrders: standingOrders.length,
    analytics: analyticsSnapshots[0] ?? null,
    health: accountHealthSnapshots.slice(0, 5),
  };
  const report: ReportExport = {
    id: `report_${crypto.randomUUID()}`,
    reportCode,
    createdBy: req.session?.user.username ?? 'system',
    createdAt: new Date().toISOString(),
    status: 'queued',
    generatedAt: null,
    deliveredAt: null,
    payloadJson: payload,
  };
  reportExports.unshift(report);
  persistStateSoon();
  res.status(201).json({ report, reportExports });
});

app.post('/reports/:id/generate', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (req, res) => {
  const report = reportExports.find((entry) => entry.id === readRouteParam(req.params.id));
  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }
  if (report.status === 'delivered') {
    res.status(400).json({ error: 'Report already delivered' });
    return;
  }
  report.status = 'generated';
  report.generatedAt = new Date().toISOString();
  persistStateSoon();
  res.json({ report, reportExports });
});

app.post('/reports/:id/deliver', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (req, res) => {
  const report = reportExports.find((entry) => entry.id === readRouteParam(req.params.id));
  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }
  if (report.status === 'queued') {
    res.status(400).json({ error: 'Report must be generated before delivery' });
    return;
  }
  report.status = 'delivered';
  report.deliveredAt = new Date().toISOString();
  persistStateSoon();
  res.json({ report, reportExports });
});

app.get('/documents', authenticate, requireAnyRole(['owner', 'manager', 'support', 'accounts']), (_req, res) => {
  res.json({ documents });
});

app.get('/customer/documents', authenticate, requireAnyRole(['customer']), (req, res) => {
  const customerId = req.session?.user.customerId;
  if (!customerId) {
    res.status(400).json({ error: 'Customer session missing customer id' });
    return;
  }

  res.json({
    documents: documents.filter((document) => document.customerId === customerId),
    invoiceExports: invoiceExports.filter((invoice) => invoice.customerId === customerId),
  });
});

app.post('/documents', authenticate, requireAnyRole(['owner', 'manager', 'support', 'accounts']), (req, res) => {
  const { customerId, documentType = 'other', title, fileName, mimeType = 'application/pdf', tags = [] } = req.body as {
    customerId?: string;
    documentType?: DocumentRecord['documentType'];
    title?: string;
    fileName?: string;
    mimeType?: string;
    tags?: string[];
  };
  if (!customerId || !title?.trim() || !fileName?.trim()) {
    res.status(400).json({ error: 'customerId, title, and fileName are required' });
    return;
  }

  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  const id = `doc_${crypto.randomUUID()}`;
  const document: DocumentRecord = {
    id,
    customerId,
    documentType,
    status: 'uploaded',
    title: title.trim(),
    fileName: fileName.trim(),
    mimeType,
    downloadUrl: `/documents/${id}/download`,
    tags,
    createdAt: new Date().toISOString(),
    verifiedAt: null,
  };
  documents.unshift(document);
  persistStateSoon();
  res.status(201).json({ document, documents });
});

app.post('/documents/:id/verify', authenticate, requireAnyRole(['owner', 'manager', 'support', 'accounts']), (req, res) => {
  const id = readRouteParam(req.params.id);
  const document = documents.find((entry) => entry.id === id);
  if (!document) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  document.status = 'verified';
  document.verifiedAt = new Date().toISOString();
  documentAccessLogs.unshift({
    id: `doclog_${crypto.randomUUID()}`,
    documentId: document.id,
    customerId: document.customerId,
    actorRole: req.session?.user.role ?? 'system',
    action: 'verify',
    createdAt: document.verifiedAt,
  });
  persistStateSoon();
  res.json({ document, documents });
});

app.get('/documents/:id/download', authenticate, requireAnyRole(['owner', 'manager', 'support', 'accounts', 'customer']), (req, res) => {
  const id = readRouteParam(req.params.id);
  const document = documents.find((entry) => entry.id === id);
  const invoice = invoiceExports.find((entry) => entry.id === id);
  if (!document && !invoice) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const customerId = document?.customerId ?? invoice?.customerId ?? req.session?.user.customerId ?? '';
  documentAccessLogs.unshift({
    id: `doclog_${crypto.randomUUID()}`,
    documentId: id,
    customerId,
    actorRole: req.session?.user.role ?? 'system',
    action: 'download',
    createdAt: new Date().toISOString(),
  });
  if (invoice) {
    invoice.status = 'downloaded';
  }
  persistStateSoon();
  res.json({ document, invoice });
});

app.get('/invoices', authenticate, requireAnyRole(['owner', 'manager', 'support', 'accounts']), (_req, res) => {
  res.json({ invoiceExports });
});

app.post('/invoices/export', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (req, res) => {
  const { customerId, amount = 0, invoiceNumber, fileName } = req.body as {
    customerId?: string;
    amount?: number;
    invoiceNumber?: string;
    fileName?: string;
  };
  if (!customerId || !invoiceNumber?.trim()) {
    res.status(400).json({ error: 'customerId and invoiceNumber are required' });
    return;
  }

  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  const invoiceId = `invexp_${crypto.randomUUID()}`;
  const invoiceExport: InvoiceExport = {
    id: invoiceId,
    customerId,
    invoiceNumber: invoiceNumber.trim(),
    fileName: fileName?.trim() || `${invoiceNumber.trim()}.pdf`,
    status: 'ready',
    amount,
    createdAt: new Date().toISOString(),
    downloadUrl: `/documents/${invoiceId}/download`,
  };
  invoiceExports.unshift(invoiceExport);
  persistStateSoon();
  res.status(201).json({ invoiceExport, invoiceExports });
});

app.post('/invoices/:id/archive', authenticate, requireAnyRole(['owner', 'manager', 'accounts']), (req, res) => {
  const id = readRouteParam(req.params.id);
  const invoice = invoiceExports.find((entry) => entry.id === id);
  if (!invoice) {
    res.status(404).json({ error: 'Invoice export not found' });
    return;
  }

  invoice.status = 'archived';
  persistStateSoon();
  res.json({ invoice, invoiceExports });
});

app.get('/storage/status', (_req, res) => {
  const r2Configured = Boolean(
    process.env.R2_ACCOUNT_ID?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim() &&
      process.env.R2_BUCKET_NAME?.trim(),
  );

  res.json({
    mode: r2Configured ? 'cloud' : 'demo',
    r2Configured,
    uploadStorageEnabled: r2Configured,
    note: r2Configured
      ? 'Cloud object storage is ready.'
      : 'Cloud object storage is not configured yet, so uploads remain in demo mode.',
  });
});

app.get('/orders', authenticate, requireAnyRole(['owner', 'manager', 'production', 'delivery', 'support', 'accounts']), (_req, res) => {
  res.json({ orders });
});

app.get('/production/batches', authenticate, requireAnyRole(['owner', 'manager', 'production', 'support']), (_req, res) => {
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

app.get('/delivery/manifest', authenticate, requireAnyRole(['owner', 'manager', 'delivery']), (_req, res) => {
  const manifest = getCurrentDeliveryManifest();
  const snapshot = syncDeliveryManifestStops();
  res.json({
    manifest,
    routes: slots.map((slot) => {
      const routeStops = snapshot.stops.filter((stop) => stop.slotId === slot.id);
      return {
        slotId: slot.id,
        label: slot.label,
        zone: slot.zone,
        orderCount: routeStops.length,
        completedOrders: routeStops.filter((stop) => stop.status === 'completed').length,
        failedOrders: routeStops.filter((stop) => stop.status === 'failed').length,
        stops: routeStops.map((stop) => ({
          stopNumber: stop.stopNumber,
          orderId: stop.orderId,
          customerName: stop.customerName,
          address: stop.address,
          slot: slot.label,
          status: orders.find((order) => order.id === stop.orderId)?.status ?? 'confirmed',
          proofStatus: stop.proofStatus,
          note: stop.note,
        })),
      };
    }),
    stops: snapshot.stops,
    proofOfDelivery,
    deliveryPhotos,
    failureReasons,
    returnRecords,
    returnItems,
    eventOutbox,
    outboxCount: eventOutbox.filter((entry) => entry.status === 'queued').length,
  });
});

app.post('/delivery/manifest/lock', authenticate, requireAnyRole(['owner', 'manager', 'delivery']), (_req, res) => {
  const manifest = getCurrentDeliveryManifest();
  const now = new Date().toISOString();
  manifest.status = 'locked';
  manifest.lockedAt = manifest.lockedAt ?? now;
  syncDeliveryManifestStops();
  persistStateSoon();
  res.json({ manifest, routes: slots.length });
});

app.post('/delivery/manifest/dispatch', authenticate, requireAnyRole(['owner', 'manager', 'delivery']), (_req, res) => {
  const manifest = getCurrentDeliveryManifest();
  const now = new Date().toISOString();
  manifest.status = 'dispatched';
  manifest.dispatchedAt = manifest.dispatchedAt ?? now;
  syncDeliveryManifestStops();
  persistStateSoon();
  res.json({ manifest, routes: slots.length });
});

app.post('/delivery/manifest/complete', authenticate, requireAnyRole(['owner', 'manager', 'delivery']), (_req, res) => {
  const manifest = getCurrentDeliveryManifest();
  const now = new Date().toISOString();
  manifest.status = 'completed';
  manifest.completedAt = now;
  syncDeliveryManifestStops();
  persistStateSoon();
  res.json({ manifest, routes: slots.length });
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
  const manifest = getCurrentDeliveryManifest();

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
      recordDeliveryOutbox({
        eventId: event?.eventId ?? `invalid_${result.rejected}`,
        orderId: event?.orderId ?? 'unknown',
        action: event?.action ?? 'pod_completed',
        status: 'rejected',
        payloadJson: { reason: 'Invalid event payload', event: event ?? null },
      });
      continue;
    }

    if (processedDeliveryEventIds.has(event.eventId)) {
      result.duplicates += 1;
      duplicateEventIds.push(event.eventId);
      recordDeliveryOutbox({
        eventId: event.eventId,
        orderId: event.orderId,
        action: event.action,
        status: 'duplicate',
        payloadJson: event,
      });
      continue;
    }

    const order = orders.find((entry) => entry.id === event.orderId);
    if (!order || order.slotId !== event.slotId) {
      result.rejected += 1;
      rejectedEventIds.push(event.eventId);
      recordDeliveryOutbox({
        eventId: event.eventId,
        orderId: event.orderId,
        action: event.action,
        status: 'rejected',
        payloadJson: { reason: 'Order missing or slot mismatch', event },
      });
      continue;
    }

    processedDeliveryEventIds.add(event.eventId);
    acceptedEventIds.push(event.eventId);
    const now = event.capturedAt || new Date().toISOString();
    const stop = deliveryManifestStops.find((entry) => entry.manifestId === manifest.id && entry.orderId === order.id);

    if (event.action === 'pod_completed') {
      order.status = 'delivered';
      if (stop) {
        stop.status = 'completed';
        stop.proofStatus = 'captured';
        stop.updatedAt = now;
      }
      const proofId = `pod_${crypto.randomUUID()}`;
      proofOfDelivery.unshift({
        id: proofId,
        manifestId: manifest.id,
        stopId: stop?.id ?? `stop_${order.id}`,
        orderId: order.id,
        signatureName: event.signatureName ?? null,
        photoUrl: event.photoUrl ?? null,
        latitude: event.latitude ?? null,
        longitude: event.longitude ?? null,
        capturedAt: now,
      });
      if (event.photoUrl) {
        deliveryPhotos.unshift({
          id: `photo_${crypto.randomUUID()}`,
          proofId,
          orderId: order.id,
          caption: event.note,
          url: event.photoUrl,
          createdAt: now,
        });
      }
      recordAudit({
        kind: 'delivery_pod_completed',
        actor: 'delivery',
        summary: `POD completed for ${order.id}. ${event.note}`.trim(),
        referenceId: order.id,
      });
      enqueueNotification({
        customerId: order.customerId,
        channel: 'in_app',
        templateCode: 'delivery_completed',
        subject: `Order ${order.id} delivered`,
        correlationKey: `delivery-ok:${event.eventId}`,
        recipient: order.customerId,
      });
      recordDeliveryOutbox({
        eventId: event.eventId,
        orderId: order.id,
        action: event.action,
        status: 'applied',
        payloadJson: event,
      });
    } else if (event.action === 'delivery_failed') {
      order.status = 'failed_delivery';
      if (stop) {
        stop.status = 'failed';
        stop.updatedAt = now;
      }
      failureReasons.unshift({
        id: `fail_${crypto.randomUUID()}`,
        orderId: order.id,
        stopId: stop?.id ?? `stop_${order.id}`,
        code: event.reasonCode ?? 'other',
        note: event.note,
        createdAt: now,
      });
      recordAudit({
        kind: 'delivery_failed',
        actor: 'delivery',
        summary: `Delivery failed for ${order.id}. ${event.note}`.trim(),
        referenceId: order.id,
      });
      enqueueNotification({
        customerId: order.customerId,
        channel: 'in_app',
        templateCode: 'delivery_failed',
        subject: `Order ${order.id} delivery failed`,
        correlationKey: `delivery-failed:${event.eventId}`,
        recipient: order.customerId,
      });
      recordDeliveryOutbox({
        eventId: event.eventId,
        orderId: order.id,
        action: event.action,
        status: 'applied',
        payloadJson: event,
      });
    } else {
      const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
      const returnQuantity = Math.max(1, Math.min(event.returnQuantity ?? 1, totalUnits));
      order.status = returnQuantity >= totalUnits ? 'failed_delivery' : 'partial_delivery';
      if (stop) {
        stop.status = 'returned';
        stop.proofStatus = 'captured';
        stop.updatedAt = now;
      }
      const returnId = `ret_${crypto.randomUUID()}`;
      returnRecords.unshift({
        id: returnId,
        orderId: order.id,
        stopId: stop?.id ?? `stop_${order.id}`,
        quantity: returnQuantity,
        note: event.note,
        createdAt: now,
      });
      const firstItem = order.items[0];
      if (firstItem) {
        returnItems.unshift({
          id: `ret_item_${crypto.randomUUID()}`,
          returnId,
          productId: firstItem.productId,
          quantity: returnQuantity,
          unitPrice: firstItem.unitPrice,
        });
      }
      recordAudit({
        kind: 'delivery_returned',
        actor: 'delivery',
        summary: `Return captured for ${order.id}. ${event.note}`.trim(),
        referenceId: order.id,
      });
      enqueueNotification({
        customerId: order.customerId,
        channel: 'in_app',
        templateCode: 'delivery_return_captured',
        subject: `Order ${order.id} returned`,
        correlationKey: `delivery-return:${event.eventId}`,
        recipient: order.customerId,
      });
      recordDeliveryOutbox({
        eventId: event.eventId,
        orderId: order.id,
        action: event.action,
        status: 'applied',
        payloadJson: { ...event, returnQuantity: event.returnQuantity ?? 1 },
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

function getNotificationTemplate(templateCode: string) {
  return notificationTemplates.find((template) => template.code === templateCode) ?? {
    code: templateCode,
    name: templateCode,
    channelPriority: ['in_app'],
    subject: 'Manual notification',
    body: 'Manual notification',
    retryable: true,
  };
}

function getNotificationPreference(customerId: string) {
  return notificationPreferences.find((preference) => preference.customerId === customerId) ?? {
    customerId,
    pushEnabled: true,
    whatsappEnabled: true,
    smsEnabled: true,
    inAppEnabled: true,
    updatedAt: new Date().toISOString(),
  };
}

function channelAvailable(channel: NotificationJob['channel'], preference: NotificationPreference) {
  switch (channel) {
    case 'sms':
      return preference.smsEnabled;
    case 'whatsapp':
      return preference.whatsappEnabled;
    case 'email':
      return true;
    case 'in_app':
      return preference.inAppEnabled;
  }
}

function gatewayForChannel(channel: NotificationJob['channel']) {
  switch (channel) {
    case 'sms':
      return 'sms';
    case 'whatsapp':
      return 'whatsapp';
    case 'email':
      return 'internal';
    case 'in_app':
      return 'internal';
  }
}

function enqueueNotification(_input: {
  customerId: string;
  channel?: NotificationJob['channel'];
  templateCode: string;
  subject: string;
  body?: string;
  correlationKey: string;
  recipient: string;
}) {
  const input = _input;
  const existing = notificationJobs.find((job) => job.correlationKey === input.correlationKey);
  if (existing) {
    return {
      job: existing,
      deliveries: notificationDeliveries.filter((delivery) => delivery.jobId === existing.id),
    };
  }

  const template = getNotificationTemplate(input.templateCode);
  const preference = getNotificationPreference(input.customerId);
  const selectedChannel = input.channel ?? template.channelPriority.find((candidate) => channelAvailable(candidate, preference)) ?? 'in_app';
  const resolvedStatus: NotificationJob['status'] = channelAvailable(selectedChannel, preference) ? 'delivered' : 'failed';
  const now = new Date().toISOString();
  const job: NotificationJob = {
    id: `ntf_${crypto.randomUUID()}`,
    channel: selectedChannel,
    templateCode: input.templateCode,
    status: resolvedStatus,
    correlationKey: input.correlationKey,
    recipient: input.recipient,
    subject: input.subject,
    body: input.body ?? template.body,
    createdAt: now,
    sentAt: resolvedStatus === 'failed' ? null : now,
    provider: gatewayForChannel(selectedChannel),
  };
  const delivery: NotificationDelivery = {
    id: `ntfd_${crypto.randomUUID()}`,
    jobId: job.id,
    recipient: input.recipient,
    providerMessageId: resolvedStatus === 'failed' ? null : `msg_${crypto.randomUUID().slice(0, 8)}`,
    status: resolvedStatus,
    attemptNo: 1,
    createdAt: now,
    gateway: gatewayForChannel(selectedChannel),
    errorMessage: resolvedStatus === 'failed' ? `Channel ${selectedChannel} is disabled for this customer` : null,
  };
  notificationJobs.unshift(job);
  notificationDeliveries.unshift(delivery);
  return {
    job,
    deliveries: [delivery],
  };
}

function getCurrentDeliveryManifest() {
  const serviceDate = getZoneDate('Asia/Kolkata').date;
  const now = new Date().toISOString();
  let manifest = deliveryManifests.find((entry) => entry.serviceDate === serviceDate);
  if (!manifest) {
    manifest = {
      id: `manifest_${serviceDate}`,
      serviceDate,
      status: 'draft',
      routeCount: 0,
      note: 'Generated from live route load.',
      createdAt: now,
      lockedAt: null,
      dispatchedAt: null,
      completedAt: null,
    };
    deliveryManifests.unshift(manifest);
  }
  return manifest;
}

function mapOrderStatusToStopStatus(status: OrderStatus): DeliveryManifestStop['status'] {
  switch (status) {
    case 'delivered':
      return 'completed';
    case 'partial_delivery':
      return 'returned';
    case 'failed_delivery':
      return 'failed';
    default:
      return 'pending';
  }
}

function syncDeliveryManifestStops() {
  const manifest = getCurrentDeliveryManifest();
  const now = new Date().toISOString();
  const nextStops: DeliveryManifestStop[] = [];

  for (const slot of slots) {
    const routeOrders = orders.filter((order) => order.slotId === slot.id);
    routeOrders.forEach((order, index) => {
      const customer = customers.find((entry) => entry.id === order.customerId);
      const address =
        savedAddresses.find((entry) => entry.customerId === order.customerId)?.addressLine ??
        customerAuthRecords.find((entry) => entry.customerId === order.customerId)?.defaultAddress ??
        'Address unavailable';
      const existingStop = deliveryManifestStops.find((stop) => stop.manifestId === manifest.id && stop.orderId === order.id);
      const proof = proofOfDelivery.find((entry) => entry.orderId === order.id);
      nextStops.push({
        id: existingStop?.id ?? `stop_${order.id}`,
        manifestId: manifest.id,
        slotId: slot.id,
        orderId: order.id,
        stopNumber: index + 1,
        customerId: order.customerId,
        customerName: customer?.name ?? order.customerId,
        address,
        status: existingStop?.status ?? mapOrderStatusToStopStatus(order.status),
        proofStatus: proof ? 'captured' : existingStop?.proofStatus ?? 'pending',
        note:
          order.status === 'delivered'
            ? 'Delivered and signed off.'
            : order.status === 'failed_delivery'
              ? 'Delivery failed and needs follow-up.'
              : order.status === 'partial_delivery'
                ? 'Partial delivery with return.'
                : 'Ready for handoff.',
        updatedAt: existingStop?.updatedAt ?? now,
      });
    });
  }

  deliveryManifestStops.splice(0, deliveryManifestStops.length, ...nextStops);
  manifest.routeCount = nextStops.length;
  if (manifest.status === 'dispatched' && nextStops.length > 0 && nextStops.every((stop) => ['completed', 'failed', 'returned'].includes(stop.status))) {
    manifest.status = 'completed';
    manifest.completedAt = now;
  }
  return { manifest, stops: nextStops };
}

function recordDeliveryOutbox(input: {
  eventId: string;
  orderId: string;
  action: DeliveryWritebackAction;
  status: EventOutbox['status'];
  payloadJson: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  eventOutbox.unshift({
    id: `outbox_${crypto.randomUUID()}`,
    eventId: input.eventId,
    orderId: input.orderId,
    action: input.action,
    payloadJson: input.payloadJson,
    status: input.status,
    createdAt: now,
    processedAt: input.status === 'applied' ? now : null,
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
  const branches = customerBranches.filter((entry) => entry.customerId === customer.id);
  const users = customerUsers.filter((entry) => entry.customerId === customer.id);
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
    pricingRules: customerPricingRules.filter(
      (rule) => rule.status === 'active' && (rule.customerId === null || rule.customerId === customer.id),
    ),
    creditHolds: creditHoldEvents.filter((hold) => hold.customerId === customer.id),
    creditLedgerEntries: creditLedgerEntries.filter((entry) => entry.customerId === customer.id),
    substitutionRules: substitutionRules.filter(
      (rule) => rule.status === 'active' && (rule.customerId === null || rule.customerId === customer.id),
    ),
    substitutionEvents: substitutionEvents.filter((event) => event.customerId === customer.id),
    documents: documents.filter((document) => document.customerId === customer.id),
    invoiceExports: invoiceExports.filter((invoice) => invoice.customerId === customer.id),
    catalog: {
      products,
      capacities,
      slots,
    },
    serviceability: buildCustomerServiceability(customer, defaultServiceDate),
    defaultServiceDate,
    branches,
    users,
  };
}

function buildCustomer360(customerId: string): Customer360Response {
  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer) {
    throw new Error(`Customer ${customerId} not found`);
  }

  const auth = customerAuthRecords.find((entry) => entry.customerId === customer.id && entry.active !== false);
  const branches = customerBranches.filter((entry) => entry.customerId === customer.id);
  const users = customerUsers.filter((entry) => entry.customerId === customer.id);
  const notes = customerNotes.filter((entry) => entry.customerId === customer.id).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const supportCasesForCustomer = supportCases.filter((entry) => entry.customerId === customer.id).sort((left, right) => right.lastUpdatedAt.localeCompare(left.lastUpdatedAt));
  const standingOrdersForCustomer = standingOrders.filter((entry) => entry.customerId === customer.id).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const recurrenceRulesForCustomer = recurrenceRules.filter((entry) => entry.customerId === null || entry.customerId === customer.id);
  const standingOrderChangesForCustomer = standingOrderChanges.filter((entry) => entry.customerId === customer.id);
  const documentsForCustomer = documents.filter((document) => document.customerId === customer.id);
  const invoiceExportsForCustomer = invoiceExports.filter((invoice) => invoice.customerId === customer.id);
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
    standingOrders: standingOrdersForCustomer,
    recurrenceRules: recurrenceRulesForCustomer,
    standingOrderChanges: standingOrderChangesForCustomer,
    documents: documentsForCustomer,
    invoiceExports: invoiceExportsForCustomer,
    branches,
    users,
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

  for (const standingOrder of standingOrders.filter((entry) => entry.customerId === customerId)) {
    events.push({
      id: `timeline_standing_order_${standingOrder.id}`,
      customerId,
      eventType: 'standing_order_updated',
      referenceId: standingOrder.id,
      summary: `Standing order ${standingOrder.id} is ${standingOrder.status}.`,
      createdAt: standingOrder.updatedAt,
    });
  }

  for (const pause of standingOrderPauses) {
    const standingOrder = standingOrders.find((entry) => entry.id === pause.standingOrderId);
    if (standingOrder?.customerId !== customerId) {
      continue;
    }

    events.push({
      id: `timeline_pause_${pause.id}`,
      customerId,
      eventType: 'standing_order_paused',
      referenceId: pause.id,
      summary: `Standing order paused: ${pause.reason}`,
      createdAt: pause.createdAt,
    });
  }

  for (const change of standingOrderChanges.filter((entry) => entry.customerId === customerId)) {
    events.push({
      id: `timeline_change_${change.id}`,
      customerId,
      eventType: 'standing_order_updated',
      referenceId: change.id,
      summary: `Standing order change ${change.changeType} is ${change.status}.`,
      createdAt: change.requestedAt,
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
    branchZone?: string;
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

  const expectedZone = draft.branchZone ?? customer.deliveryZone;
  if (slot.zone !== expectedZone) {
    return `Selected slot is in ${slot.zone} zone, but branch is assigned to ${expectedZone}.`;
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
  if (hasActiveCreditHold(customer.id)) {
    customer.riskState = 'blocked';
    return;
  }
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

function hasActiveCreditHold(customerId: string) {
  return creditHoldEvents.some((entry) => entry.customerId === customerId && entry.status === 'active');
}

function resolveUnitPrice(customerId: string, branchId: string | null, productId: string) {
  const product = products.find((entry) => entry.id === productId);
  if (!product) {
    return null;
  }

  const rule = customerPricingRules.find(
    (entry) =>
      entry.status === 'active' &&
      entry.productId === productId &&
      (entry.customerId === null || entry.customerId === customerId) &&
      (entry.branchId === null || entry.branchId === branchId),
  );

  if (!rule) {
    return product.unitPrice;
  }

  if (rule.pricingMode === 'discount_percent') {
    const discount = Math.max(0, Math.min(100, rule.price));
    return Math.max(0, Math.round(product.unitPrice * (1 - discount / 100)));
  }

  return Math.max(0, rule.price);
}

function addCreditLedgerEntry(entry: Omit<CreditLedgerEntry, 'id' | 'createdAt'>) {
  const record: CreditLedgerEntry = {
    ...entry,
    id: `ledger_${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
  };
  creditLedgerEntries.unshift(record);
  return record;
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

function todayIsoDate() {
  return getZoneDate('Asia/Kolkata').date;
}

function normalizeDeliveryDays(days: number[]) {
  return [...new Set(days.map((day) => Math.trunc(day)).filter((day) => day >= 0 && day <= 6))].sort((left, right) => left - right);
}

function sanitizeStandingOrderItems(items: Array<{ productId: string; quantity: number }>) {
  return items
    .map((item) => ({
      productId: item.productId.trim(),
      quantity: Math.max(1, Math.trunc(item.quantity)),
    }))
    .filter((item) => Boolean(item.productId) && item.quantity > 0);
}

function getIsoWeekday(serviceDate: string) {
  const date = new Date(`${serviceDate}T12:00:00Z`);
  return date.getUTCDay();
}

function isStandingOrderPausedOnDate(standingOrderId: string, serviceDate: string) {
  return standingOrderPauses.some(
    (pause) =>
      pause.standingOrderId === standingOrderId &&
      pause.startDate <= serviceDate &&
      (pause.endDate === null || pause.endDate >= serviceDate),
  );
}

function generateStandingOrderRuns(serviceDate: string, actor: string) {
  const generatedRuns: StandingOrderRun[] = [];
  const skippedRuns: StandingOrderRun[] = [];
  const generatedOrders: Order[] = [];
  const weekday = getIsoWeekday(serviceDate);

  for (const standingOrder of standingOrders) {
    const existingRun = standingOrderRuns.find(
      (run) => run.standingOrderId === standingOrder.id && run.serviceDate === serviceDate,
    );
    if (existingRun) {
      continue;
    }

    const customer = customers.find((entry) => entry.id === standingOrder.customerId);
    const branch = standingOrder.branchId
      ? customerBranches.find((entry) => entry.id === standingOrder.branchId && entry.customerId === standingOrder.customerId)
      : null;
    const slotZone = branch?.serviceZone ?? customer?.deliveryZone;
    const slot = slots.find(
      (entry) => entry.id === standingOrder.schedule.slotId && entry.serviceDate === serviceDate && entry.zone === slotZone,
    );
    const pausedOnDate = isStandingOrderPausedOnDate(standingOrder.id, serviceDate);
    let reason = '';
    let status: StandingOrderRun['status'] = 'generated';
    let generatedOrderId: string | null = null;

    if (!customer) {
      status = 'failed';
      reason = 'Customer record not found.';
    } else if (standingOrder.status !== 'active') {
      status = 'skipped';
      reason = `Standing order is ${standingOrder.status}.`;
    } else if (pausedOnDate) {
      status = 'skipped';
      reason = 'Standing order is paused for this date.';
    } else if (!standingOrder.schedule.deliveryDays.includes(weekday)) {
      status = 'skipped';
      reason = 'Standing order does not run on this weekday.';
    } else if (!slot) {
      status = 'failed';
      reason = `No delivery slot found for ${standingOrder.schedule.slotId} on ${serviceDate}.`;
    } else {
      const orderItems = standingOrder.schedule.items
        .map((item) => {
          const product = products.find((entry) => entry.id === item.productId);
          if (!product) {
            return null;
          }
          const unitPrice = resolveUnitPrice(customer.id, branch?.id ?? null, item.productId) ?? product.unitPrice;
          return {
            productId: item.productId,
            quantity: item.quantity,
            unitPrice,
          };
        })
        .filter((item): item is { productId: string; quantity: number; unitPrice: number } => Boolean(item));

      if (orderItems.length !== standingOrder.schedule.items.length) {
        status = 'failed';
        reason = 'One or more standing order items are invalid.';
      } else {
        const amountTotal = recalculateItemsTotal(orderItems);
        const exposureAmount = standingOrder.schedule.paymentMode === 'credit' ? amountTotal : standingOrder.schedule.paymentMode === 'part-pay' ? Math.ceil(amountTotal / 2) : 0;

        if (hasActiveCreditHold(customer.id)) {
          status = 'failed';
          reason = 'Credit hold is active for this account.';
        } else if (standingOrder.schedule.paymentMode !== 'prepaid' && customer.outstandingBalance + exposureAmount > customer.creditLimit) {
          status = 'failed';
          reason = `Credit limit blocked standing order generation.`;
        } else {
          const order: Order = {
            id: `ord_${crypto.randomUUID()}`,
            customerId: customer.id,
            serviceDate,
            slotId: slot.id,
            paymentMode: standingOrder.schedule.paymentMode,
            status: 'confirmed',
            source: 'standing_order',
            amountTotal,
            createdAt: new Date().toISOString(),
            items: orderItems,
          };

          orders.unshift(order);
          generatedOrders.push(order);
          generatedOrderId = order.id;
          enqueueNotification({
            customerId: customer.id,
            channel: 'in_app',
            templateCode: 'standing_order_run_generated',
            subject: `Standing order run generated for ${serviceDate}`,
            correlationKey: `standing-run:${standingOrder.id}:${serviceDate}`,
            recipient: customer.id,
          });
          if (exposureAmount > 0) {
            customer.outstandingBalance += exposureAmount;
            refreshCustomerRisk(customer);
          }
          recordAudit({
            kind: 'standing_order_run_generated',
            actor,
            summary: `Generated standing order run ${standingOrder.id} into order ${order.id} for ${serviceDate}.`,
            referenceId: order.id,
          });
        }
      }
    }

    const run: StandingOrderRun = {
      id: `sor_${crypto.randomUUID()}`,
      standingOrderId: standingOrder.id,
      serviceDate,
      status,
      generatedOrderId,
      reason: reason || undefined,
      createdAt: new Date().toISOString(),
    };
    standingOrderRuns.unshift(run);
    if (status === 'generated') {
      generatedRuns.push(run);
    } else {
      skippedRuns.push(run);
    }
  }

  rebuildOperationalState();

  return {
    serviceDate,
    generatedRuns,
    skippedRuns,
    generatedOrders,
    standingOrderRuns,
  };
}

function applyStandingOrderChange(change: StandingOrderChange) {
  const standingOrder = standingOrders.find((entry) => entry.id === change.standingOrderId);
  if (!standingOrder) {
    return false;
  }

  const patch = change.patchJson;
  if (patch.branchId !== undefined) {
    const branchId = patch.branchId?.trim() || null;
    if (branchId) {
      const branch = customerBranches.find((entry) => entry.id === branchId && entry.customerId === standingOrder.customerId);
      if (!branch) {
        return false;
      }
      standingOrder.branchId = branch.id;
    } else {
      standingOrder.branchId = null;
    }
  }
  if (patch.status) {
    standingOrder.status = patch.status;
  }
  if (patch.schedule) {
    if (Array.isArray(patch.schedule.deliveryDays)) {
      standingOrder.schedule.deliveryDays = normalizeDeliveryDays(patch.schedule.deliveryDays);
    }
    if (typeof patch.schedule.slotId === 'string' && patch.schedule.slotId.trim()) {
      standingOrder.schedule.slotId = patch.schedule.slotId.trim();
    }
    if (patch.schedule.paymentMode) {
      standingOrder.schedule.paymentMode = patch.schedule.paymentMode;
    }
    if (Array.isArray(patch.schedule.items) && patch.schedule.items.length > 0) {
      standingOrder.schedule.items = sanitizeStandingOrderItems(patch.schedule.items);
    }
    if (typeof patch.schedule.notes === 'string') {
      standingOrder.schedule.notes = patch.schedule.notes.trim() || undefined;
    }
  }

  standingOrder.updatedAt = new Date().toISOString();
  return true;
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

function normalizeSnapshot(parsed: Partial<ApiStateSnapshot>): ApiStateSnapshot {
  return {
    customers: parsed.customers ?? customers,
    customerBranches: parsed.customerBranches ?? customerBranches,
    customerUsers: parsed.customerUsers ?? customerUsers,
    customerAuthRecords: parsed.customerAuthRecords ?? customerAuthRecords,
    customerNotes: parsed.customerNotes ?? customerNotes,
    supportCaseMessages: parsed.supportCaseMessages ?? supportCaseMessages,
    supportCases: parsed.supportCases ?? supportCases,
    standingOrders: parsed.standingOrders ?? standingOrders,
    standingOrderRuns: parsed.standingOrderRuns ?? standingOrderRuns,
    standingOrderPauses: parsed.standingOrderPauses ?? standingOrderPauses,
    recurrenceRules: parsed.recurrenceRules ?? recurrenceRules,
    standingOrderChanges: parsed.standingOrderChanges ?? standingOrderChanges,
    customerPricingRules: parsed.customerPricingRules ?? customerPricingRules,
    creditLedgerEntries: parsed.creditLedgerEntries ?? creditLedgerEntries,
    creditHoldEvents: parsed.creditHoldEvents ?? creditHoldEvents,
    substitutionRules: parsed.substitutionRules ?? substitutionRules,
    substitutionEvents: parsed.substitutionEvents ?? substitutionEvents,
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
    deliveryManifests: parsed.deliveryManifests ?? deliveryManifests,
    deliveryManifestStops: parsed.deliveryManifestStops ?? deliveryManifestStops,
    proofOfDelivery: parsed.proofOfDelivery ?? proofOfDelivery,
    deliveryPhotos: parsed.deliveryPhotos ?? deliveryPhotos,
    failureReasons: parsed.failureReasons ?? failureReasons,
    returnRecords: parsed.returnRecords ?? returnRecords,
    returnItems: parsed.returnItems ?? returnItems,
    eventOutbox: parsed.eventOutbox ?? eventOutbox,
    notificationJobs: parsed.notificationJobs ?? notificationJobs,
    notificationDeliveries: parsed.notificationDeliveries ?? notificationDeliveries,
    notificationTemplates: parsed.notificationTemplates ?? notificationTemplates,
    notificationPreferences: parsed.notificationPreferences ?? notificationPreferences,
    accountHealthSnapshots: parsed.accountHealthSnapshots ?? accountHealthSnapshots,
    accountActions: parsed.accountActions ?? accountActions,
    alertRules: parsed.alertRules ?? alertRules,
    alertEvents: parsed.alertEvents ?? alertEvents,
    analyticsSnapshots: (parsed.analyticsSnapshots ?? analyticsSnapshots).map((snapshot) => ({
      ...snapshot,
      status: snapshot.status ?? 'ready',
    })),
    kpiRollups: parsed.kpiRollups ?? kpiRollups,
    segmentDefinitions: parsed.segmentDefinitions ?? segmentDefinitions,
    segmentMemberships: parsed.segmentMemberships ?? segmentMemberships,
    marginSnapshots: (parsed.marginSnapshots ?? marginSnapshots).map((snapshot) => ({
      ...snapshot,
      status: snapshot.status ?? 'ready',
      grossMarginRate: snapshot.grossMarginRate ?? 0,
      updatedAt: snapshot.updatedAt ?? snapshot.createdAt,
    })),
    riskSnapshots: (parsed.riskSnapshots ?? riskSnapshots).map((snapshot) => ({
      ...snapshot,
      status: snapshot.status ?? 'ready',
      updatedAt: snapshot.updatedAt ?? snapshot.createdAt,
    })),
    customerRequests: parsed.customerRequests ?? customerRequests,
    savedAddresses: parsed.savedAddresses ?? savedAddresses,
    reportExports: (parsed.reportExports ?? reportExports).map((report) => ({
      ...report,
      status: report.status ?? 'queued',
      generatedAt: report.generatedAt ?? null,
      deliveredAt: report.deliveredAt ?? null,
    })),
    documents: parsed.documents ?? documents,
    documentAccessLogs: parsed.documentAccessLogs ?? documentAccessLogs,
    invoiceExports: parsed.invoiceExports ?? invoiceExports,
  };
}

function resolveDatabasePath(databaseUrl: string) {
  const trimmed = databaseUrl.trim();
  if (!trimmed) {
    return join(process.cwd(), 'data', 'aeden-bakes.sqlite');
  }

  if (trimmed.startsWith('file:')) {
    return trimmed.slice('file:'.length);
  }

  return trimmed;
}

function recordMigration(migrationName: string, source = 'sqlite') {
  database
    .prepare(
      `
      INSERT INTO migration_runs (migration_name, source, created_at)
      VALUES (?, ?, ?)
      `,
    )
    .run(migrationName, source, new Date().toISOString());
}

async function persistState() {
  const snapshot: ApiStateSnapshot = {
    customers,
    customerBranches,
    customerUsers,
    customerAuthRecords,
    customerNotes,
    supportCaseMessages,
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
    deliveryManifests,
    deliveryManifestStops,
    proofOfDelivery,
    deliveryPhotos,
    failureReasons,
    returnRecords,
    returnItems,
    eventOutbox,
    notificationJobs,
    notificationDeliveries,
    notificationTemplates,
    notificationPreferences,
    accountHealthSnapshots,
    accountActions,
    alertRules,
    alertEvents,
    analyticsSnapshots,
    kpiRollups,
    segmentDefinitions,
    segmentMemberships,
    marginSnapshots,
    riskSnapshots,
    customerRequests,
    savedAddresses,
    reportExports,
    documents,
    documentAccessLogs,
    invoiceExports,
  };

  database
    .prepare(
      `
      INSERT INTO app_state (id, snapshot, updated_at)
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        snapshot = excluded.snapshot,
        updated_at = excluded.updated_at
      `,
    )
    .run(JSON.stringify(snapshot), new Date().toISOString());

  const deleteSessions = database.prepare('DELETE FROM auth_sessions');
  deleteSessions.run();
  const insertSession = database.prepare(
    `
    INSERT INTO auth_sessions (token, user_json, created_at, expires_at)
    VALUES (?, ?, ?, ?)
    `,
  );
  for (const session of sessions.values()) {
    insertSession.run(session.token, JSON.stringify(session.user), session.createdAt, session.expiresAt);
  }
}

async function loadState(): Promise<ApiStateSnapshot> {
  const row = database.prepare('SELECT snapshot FROM app_state WHERE id = 1').get() as
    | { snapshot: string }
    | undefined;

  if (row) {
    const parsed = JSON.parse(row.snapshot) as Partial<ApiStateSnapshot>;
    const snapshot: ApiStateSnapshot = normalizeSnapshot(parsed);
    rehydrateState(snapshot);
    return snapshot;
  }

  try {
    const raw = await readFile(stateFilePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ApiStateSnapshot>;
    const snapshot = normalizeSnapshot(parsed);
    rehydrateState(snapshot);
    await persistState();
    recordMigration('json-to-sqlite');
    return snapshot;
  } catch {
    const snapshot = normalizeSnapshot({});
    rehydrateState(snapshot);
    await persistState();
    recordMigration('seed-to-sqlite');
    return snapshot;
  }
}

function rehydrateState(snapshot: ApiStateSnapshot) {
  customers.splice(0, customers.length, ...snapshot.customers);
  customerBranches.splice(0, customerBranches.length, ...snapshot.customerBranches);
  customerUsers.splice(0, customerUsers.length, ...snapshot.customerUsers);
  customerAuthRecords.splice(0, customerAuthRecords.length, ...snapshot.customerAuthRecords);
  customerNotes.splice(0, customerNotes.length, ...snapshot.customerNotes);
  supportCaseMessages.splice(0, supportCaseMessages.length, ...snapshot.supportCaseMessages);
  supportCases.splice(0, supportCases.length, ...snapshot.supportCases);
  standingOrders.splice(0, standingOrders.length, ...snapshot.standingOrders);
  standingOrderRuns.splice(0, standingOrderRuns.length, ...snapshot.standingOrderRuns);
  standingOrderPauses.splice(0, standingOrderPauses.length, ...snapshot.standingOrderPauses);
  recurrenceRules.splice(0, recurrenceRules.length, ...snapshot.recurrenceRules);
  standingOrderChanges.splice(0, standingOrderChanges.length, ...snapshot.standingOrderChanges);
  customerPricingRules.splice(0, customerPricingRules.length, ...snapshot.customerPricingRules);
  creditLedgerEntries.splice(0, creditLedgerEntries.length, ...snapshot.creditLedgerEntries);
  creditHoldEvents.splice(0, creditHoldEvents.length, ...snapshot.creditHoldEvents);
  substitutionRules.splice(0, substitutionRules.length, ...snapshot.substitutionRules);
  substitutionEvents.splice(0, substitutionEvents.length, ...snapshot.substitutionEvents);
  products.splice(0, products.length, ...snapshot.products);
  capacities.splice(0, capacities.length, ...snapshot.capacities);
  slots.splice(0, slots.length, ...snapshot.slots);
  orders.splice(0, orders.length, ...snapshot.orders);
  productionBatches.splice(0, productionBatches.length, ...snapshot.productionBatches);
  auditEvents.splice(0, auditEvents.length, ...snapshot.auditEvents);
  approvals.splice(0, approvals.length, ...snapshot.approvals);
  notificationJobs.splice(0, notificationJobs.length, ...snapshot.notificationJobs);
  notificationDeliveries.splice(0, notificationDeliveries.length, ...snapshot.notificationDeliveries);
  notificationTemplates.splice(0, notificationTemplates.length, ...snapshot.notificationTemplates);
  notificationPreferences.splice(0, notificationPreferences.length, ...snapshot.notificationPreferences);
  deliveryManifests.splice(0, deliveryManifests.length, ...snapshot.deliveryManifests);
  deliveryManifestStops.splice(0, deliveryManifestStops.length, ...snapshot.deliveryManifestStops);
  proofOfDelivery.splice(0, proofOfDelivery.length, ...snapshot.proofOfDelivery);
  deliveryPhotos.splice(0, deliveryPhotos.length, ...snapshot.deliveryPhotos);
  failureReasons.splice(0, failureReasons.length, ...snapshot.failureReasons);
  returnRecords.splice(0, returnRecords.length, ...snapshot.returnRecords);
  returnItems.splice(0, returnItems.length, ...snapshot.returnItems);
  eventOutbox.splice(0, eventOutbox.length, ...snapshot.eventOutbox);
  accountHealthSnapshots.splice(0, accountHealthSnapshots.length, ...snapshot.accountHealthSnapshots);
  accountActions.splice(0, accountActions.length, ...snapshot.accountActions);
  alertRules.splice(0, alertRules.length, ...snapshot.alertRules);
  alertEvents.splice(0, alertEvents.length, ...snapshot.alertEvents);
  analyticsSnapshots.splice(0, analyticsSnapshots.length, ...snapshot.analyticsSnapshots);
  kpiRollups.splice(0, kpiRollups.length, ...snapshot.kpiRollups);
  segmentDefinitions.splice(0, segmentDefinitions.length, ...snapshot.segmentDefinitions);
  segmentMemberships.splice(0, segmentMemberships.length, ...snapshot.segmentMemberships);
  marginSnapshots.splice(0, marginSnapshots.length, ...snapshot.marginSnapshots);
  riskSnapshots.splice(0, riskSnapshots.length, ...snapshot.riskSnapshots);
  customerRequests.splice(0, customerRequests.length, ...snapshot.customerRequests);
  savedAddresses.splice(0, savedAddresses.length, ...snapshot.savedAddresses);
  reportExports.splice(0, reportExports.length, ...snapshot.reportExports);
  documents.splice(0, documents.length, ...snapshot.documents);
  documentAccessLogs.splice(0, documentAccessLogs.length, ...snapshot.documentAccessLogs);
  invoiceExports.splice(0, invoiceExports.length, ...snapshot.invoiceExports);
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
  const storedSessions = database.prepare('SELECT token, user_json, created_at, expires_at FROM auth_sessions').all() as Array<{
    token: string;
    user_json: string;
    created_at: string;
    expires_at: string;
  }>;

  for (const sessionRow of storedSessions) {
    if (new Date(sessionRow.expires_at).getTime() <= Date.now()) {
      database.prepare('DELETE FROM auth_sessions WHERE token = ?').run(sessionRow.token);
      continue;
    }

    sessions.set(sessionRow.token, {
      token: sessionRow.token,
      user: JSON.parse(sessionRow.user_json) as SessionUser,
      createdAt: sessionRow.created_at,
      expiresAt: sessionRow.expires_at,
    });
  }

  if (sessions.size === 0) {
    for (const session of snapshot.sessions) {
      if (new Date(session.expiresAt).getTime() > Date.now()) {
        sessions.set(session.token, session);
      }
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

  refreshPhase3DerivedState();
}

function refreshPhase3DerivedState() {
  const now = new Date().toISOString();
  const today = todayIsoDate();
  const activeOrders = orders.filter((order) => order.status !== 'cancelled');
  const estimatedCostRateByCategory = new Map<string, number>([
    ['Laminated', 0.58],
    ['Bread', 0.52],
    ['Pastry', 0.54],
  ]);
  const customerOrderCounts = new Map<string, number>();
  const customerRevenue = new Map<string, number>();
  const branchOrderCounts = new Map<string, number>();
  const branchRevenue = new Map<string, number>();
  const branchFailureCounts = new Map<string, number>();
  const branchReturnCounts = new Map<string, number>();
  const paymentModeCounts = new Map<PaymentMode, number>();
  const returnedOrderIds = new Set(returnRecords.map((record) => record.orderId));
  const returnedQuantity = returnRecords.reduce((sum, record) => sum + record.quantity, 0);

  for (const order of activeOrders) {
    customerOrderCounts.set(order.customerId, (customerOrderCounts.get(order.customerId) ?? 0) + 1);
    customerRevenue.set(order.customerId, (customerRevenue.get(order.customerId) ?? 0) + order.amountTotal);

    const branchKey = order.branchId?.trim() || 'unassigned';
    branchOrderCounts.set(branchKey, (branchOrderCounts.get(branchKey) ?? 0) + 1);
    branchRevenue.set(branchKey, (branchRevenue.get(branchKey) ?? 0) + order.amountTotal);
    paymentModeCounts.set(order.paymentMode, (paymentModeCounts.get(order.paymentMode) ?? 0) + 1);

    if (order.status === 'failed_delivery' || order.status === 'partial_delivery') {
      branchFailureCounts.set(branchKey, (branchFailureCounts.get(branchKey) ?? 0) + 1);
    }
    if (returnedOrderIds.has(order.id)) {
      branchReturnCounts.set(branchKey, (branchReturnCounts.get(branchKey) ?? 0) + 1);
    }
  }

  const nextHealthSnapshots: AccountHealthSnapshot[] = customers
    .map((customer) => {
      const customerOrders = activeOrders.filter((entry) => entry.customerId === customer.id);
      const failedDeliveries = customerOrders.filter((entry) => entry.status === 'failed_delivery').length;
      const partialDeliveries = customerOrders.filter((entry) => entry.status === 'partial_delivery').length;
      const openCases = supportCases.filter(
        (entry) => entry.customerId === customer.id && !['closed'].includes(entry.status),
      ).length;
      const activeStandingOrders = standingOrders.filter(
        (entry) => entry.customerId === customer.id && entry.status === 'active',
      ).length;
      const exposure = customer.outstandingBalance;
      const exposureRatio = customer.creditLimit > 0 ? exposure / customer.creditLimit : exposure > 0 ? 1 : 0;
      const riskPenalty = customer.riskState === 'blocked' ? 30 : customer.riskState === 'block_soon' ? 20 : customer.riskState === 'watch' ? 10 : 0;
      const riskScore = Math.min(
        100,
        Math.max(
          0,
          Math.round(exposureRatio * 65 + failedDeliveries * 12 + partialDeliveries * 7 + openCases * 8 + activeStandingOrders * 3 + riskPenalty),
        ),
      );

      const reasonJson = [
        `risk=${customer.riskState}`,
        `exposure=${exposure}`,
        `open_cases=${openCases}`,
        `failed_deliveries=${failedDeliveries}`,
        `partial_deliveries=${partialDeliveries}`,
      ];

      return {
        id: `health_${customer.id}`,
        customerId: customer.id,
        healthState: customer.riskState,
        riskScore,
        exposure,
        reasonJson,
        createdAt: now,
      } satisfies AccountHealthSnapshot;
    })
    .sort((left, right) => right.riskScore - left.riskScore);

  accountHealthSnapshots.splice(0, accountHealthSnapshots.length, ...nextHealthSnapshots);

  const totalRevenue = orders.reduce((sum, order) => sum + order.amountTotal, 0);
  const deliveredCount = orders.filter((order) => order.status === 'delivered').length;
  const fulfilledCount = orders.filter((order) => ['delivered', 'partial_delivery', 'failed_delivery'].includes(order.status)).length;
  const deliverySuccessRate = fulfilledCount === 0 ? 0 : Math.round((deliveredCount / fulfilledCount) * 100);
  const repeatCustomers = customers.filter((customer) => (customerOrderCounts.get(customer.id) ?? 0) > 1).length;
  const activeCustomers = customers.filter((customer) => (customerOrderCounts.get(customer.id) ?? 0) > 0).length;
  const supportOpenCount = supportCases.filter((entry) => !['closed'].includes(entry.status)).length;
  const activeStandingOrderCount = standingOrders.filter((entry) => entry.status === 'active').length;
  const watchCustomers = customers.filter((customer) => ['watch', 'block_soon', 'blocked'].includes(customer.riskState)).length;
  const openRouteCount = slots.filter((slot) => slot.status !== 'locked').length;
  const failedDeliveryCount = orders.filter((order) => order.status === 'failed_delivery').length;
  const partialDeliveryCount = orders.filter((order) => order.status === 'partial_delivery').length;
  const repeatPurchaseRate = customers.length === 0 ? 0 : Math.round((repeatCustomers / customers.length) * 100);
  const returnOrderRate = fulfilledCount === 0 ? 0 : Math.round((returnRecords.length / fulfilledCount) * 100);
  const creditExposure = customers.reduce((sum, customer) => sum + customer.outstandingBalance, 0);
  const averageOrderValue = activeOrders.length === 0 ? 0 : Math.round(totalRevenue / activeOrders.length);
  const creditUtilization = customers.length === 0
    ? 0
    : Math.round(
        (customers.reduce((sum, customer) => {
          if (customer.creditLimit <= 0) {
            return sum;
          }
          return sum + Math.min(1, customer.outstandingBalance / customer.creditLimit);
        }, 0) / customers.length) * 100,
      );

  const topCustomers = customers
    .map((customer) => {
      const orderCount = customerOrderCounts.get(customer.id) ?? 0;
      const revenue = customerRevenue.get(customer.id) ?? 0;
      return {
        customerId: customer.id,
        customerName: customer.name,
        orderCount,
        revenue,
        outstandingBalance: customer.outstandingBalance,
        riskState: customer.riskState,
        tier: customer.tier,
      };
    })
    .filter((entry) => entry.orderCount > 0 || entry.revenue > 0)
    .sort((left, right) => right.revenue - left.revenue || right.orderCount - left.orderCount)
    .slice(0, 5);

  const customerSegments = {
    newCustomers: customers.filter((customer) => (customerOrderCounts.get(customer.id) ?? 0) === 1).length,
    repeatCustomers,
    dormantCustomers: customers.filter((customer) => (customerOrderCounts.get(customer.id) ?? 0) === 0).length,
    highValueCustomers: customers.filter((customer) => (customerRevenue.get(customer.id) ?? 0) >= 10000).length,
    watchCustomers,
  };

  const segmentMembershipEntries: SegmentMembership[] = [];
  for (const customer of customers) {
    const orderCount = customerOrderCounts.get(customer.id) ?? 0;
    const revenue = customerRevenue.get(customer.id) ?? 0;
    const segmentCodes = [
      orderCount > 1 ? 'repeat_customers' : null,
      revenue >= 10000 ? 'high_value_customers' : null,
      orderCount === 0 ? 'dormant_customers' : null,
      ['watch', 'block_soon', 'blocked'].includes(customer.riskState) ? 'watch_customers' : null,
    ].filter((entry): entry is string => Boolean(entry));

    for (const segmentCode of segmentCodes) {
      segmentMembershipEntries.push({
        id: `segment_${segmentCode}_${customer.id}`,
        segmentCode,
        customerId: customer.id,
        createdAt: now,
      });
    }
  }

  segmentDefinitions.splice(
    0,
    segmentDefinitions.length,
    ...[
      {
        code: 'repeat_customers',
        name: 'Repeat customers',
        description: 'Accounts with more than one non-cancelled order.',
        active: true,
        createdAt: segmentDefinitions[0]?.createdAt ?? now,
        updatedAt: now,
      },
      {
        code: 'high_value_customers',
        name: 'High value customers',
        description: 'Accounts with revenue at or above the high-value threshold.',
        active: true,
        createdAt: segmentDefinitions[1]?.createdAt ?? now,
        updatedAt: now,
      },
      {
        code: 'watch_customers',
        name: 'Watch customers',
        description: 'Accounts currently on watch, block soon, or blocked.',
        active: true,
        createdAt: segmentDefinitions[2]?.createdAt ?? now,
        updatedAt: now,
      },
      {
        code: 'dormant_customers',
        name: 'Dormant customers',
        description: 'Accounts with no recent order activity.',
        active: true,
        createdAt: segmentDefinitions[3]?.createdAt ?? now,
        updatedAt: now,
      },
    ],
  );
  segmentMemberships.splice(0, segmentMemberships.length, ...segmentMembershipEntries);

  const branchPerformance = customerBranches
    .map((branch) => {
      const orderCount = branchOrderCounts.get(branch.id) ?? 0;
      const revenue = branchRevenue.get(branch.id) ?? 0;
      const returnCount = branchReturnCounts.get(branch.id) ?? 0;
      const failureCount = branchFailureCounts.get(branch.id) ?? 0;
      const successBase = orderCount === 0 ? 0 : Math.max(0, orderCount - failureCount);
      return {
        branchId: branch.id,
        branchName: branch.name,
        customerId: branch.customerId,
        status: branch.status,
        orderCount,
        revenue,
        returnCount,
        failureCount,
        deliverySuccessRate: orderCount === 0 ? 0 : Math.round((successBase / orderCount) * 100),
        averageOrderValue: orderCount === 0 ? 0 : Math.round(revenue / orderCount),
      };
    })
    .sort((left, right) => right.revenue - left.revenue || right.orderCount - left.orderCount);

  const paymentMix = {
    prepaid: paymentModeCounts.get('prepaid') ?? 0,
    partPay: paymentModeCounts.get('part-pay') ?? 0,
    credit: paymentModeCounts.get('credit') ?? 0,
  };

  const deliveryQuality = {
    delivered: deliveredCount,
    partialDeliveries: partialDeliveryCount,
    failedDeliveries: failedDeliveryCount,
    returnedOrders: returnRecords.length,
    returnedQuantity,
    deliverySuccessRate,
    returnRate: returnOrderRate,
  };

  const riskBuckets = {
    healthy: customers.filter((customer) => customer.riskState === 'healthy').length,
    watch: customers.filter((customer) => customer.riskState === 'watch').length,
    blockSoon: customers.filter((customer) => customer.riskState === 'block_soon').length,
    blocked: customers.filter((customer) => customer.riskState === 'blocked').length,
  };

  const topRiskCustomers = [...nextHealthSnapshots]
    .sort((left, right) => right.riskScore - left.riskScore)
    .slice(0, 5)
    .map((snapshot) => ({
      customerId: snapshot.customerId,
      customerName: customers.find((customer) => customer.id === snapshot.customerId)?.name ?? snapshot.customerId,
      riskState: snapshot.healthState,
      riskScore: snapshot.riskScore,
      outstandingBalance: snapshot.exposure,
    }));

  riskSnapshots.splice(0, riskSnapshots.length, {
    id: `risk_${today}`,
    serviceDate: today,
    status: 'ready',
    totalCustomers: customers.length,
    healthyCustomers: riskBuckets.healthy,
    watchCustomers: riskBuckets.watch,
    blockSoonCustomers: riskBuckets.blockSoon,
    blockedCustomers: riskBuckets.blocked,
    topRiskCustomers,
    createdAt: now,
    updatedAt: now,
  });

  const pricingCoverage = customerPricingRules.filter((rule) => rule.status === 'active');
  const marginByProduct = new Map<string, { revenue: number; estimatedCost: number; category: string; productName: string }>();
  const marginByBranch = new Map<string, { revenue: number; estimatedCost: number; branchName: string }>();
  let estimatedCostTotal = 0;

  for (const order of activeOrders) {
    const branch = customerBranches.find((entry) => entry.id === order.branchId);
    const branchKey = branch?.id ?? 'unassigned';
    const branchName = branch?.name ?? 'Unassigned';
    for (const item of order.items) {
      const product = products.find((entry) => entry.id === item.productId);
      const categoryRate = estimatedCostRateByCategory.get(product?.category ?? '') ?? 0.55;
      const revenue = item.quantity * item.unitPrice;
      const estimatedCost = Math.round(revenue * categoryRate);
      estimatedCostTotal += estimatedCost;

      const productEntry = marginByProduct.get(item.productId) ?? {
        revenue: 0,
        estimatedCost: 0,
        category: product?.category ?? 'Unknown',
        productName: product?.name ?? item.productId,
      };
      productEntry.revenue += revenue;
      productEntry.estimatedCost += estimatedCost;
      marginByProduct.set(item.productId, productEntry);

      const branchEntry = marginByBranch.get(branchKey) ?? {
        revenue: 0,
        estimatedCost: 0,
        branchName,
      };
      branchEntry.revenue += revenue;
      branchEntry.estimatedCost += estimatedCost;
      marginByBranch.set(branchKey, branchEntry);
    }
  }

  const marginProductBreakdown: MarginProductBreakdown[] = [...marginByProduct.entries()]
    .map(([productId, entry]) => ({
      productId,
      productName: entry.productName,
      category: entry.category,
      revenue: entry.revenue,
      estimatedCost: entry.estimatedCost,
      grossMargin: entry.revenue - entry.estimatedCost,
      grossMarginRate: entry.revenue === 0 ? 0 : Math.round(((entry.revenue - entry.estimatedCost) / entry.revenue) * 100),
    }))
    .sort((left, right) => right.grossMargin - left.grossMargin);

  const marginBranchBreakdown: MarginBranchBreakdown[] = [...marginByBranch.entries()]
    .map(([branchId, entry]) => ({
      branchId,
      branchName: entry.branchName,
      revenue: entry.revenue,
      estimatedCost: entry.estimatedCost,
      grossMargin: entry.revenue - entry.estimatedCost,
      grossMarginRate: entry.revenue === 0 ? 0 : Math.round(((entry.revenue - entry.estimatedCost) / entry.revenue) * 100),
    }))
    .sort((left, right) => right.grossMargin - left.grossMargin);

  const totalMargin = totalRevenue - estimatedCostTotal;
  const marginRate = totalRevenue === 0 ? 0 : Math.round((totalMargin / totalRevenue) * 100);

  marginSnapshots.splice(0, marginSnapshots.length, {
    id: `margin_${today}`,
    serviceDate: today,
    status: 'ready',
    revenue: totalRevenue,
    estimatedCost: estimatedCostTotal,
    grossMargin: totalMargin,
    grossMarginRate: marginRate,
    productBreakdown: marginProductBreakdown,
    branchBreakdown: marginBranchBreakdown,
    createdAt: now,
    updatedAt: now,
  });

  const analyticsPayload = {
    snapshotTime: now,
    totals: {
      customers: customers.length,
      activeCustomers,
      repeatCustomers,
      repeatPurchaseRate,
      orders: orders.length,
      revenue: totalRevenue,
      averageOrderValue,
      supportOpen: supportOpenCount,
      activeStandingOrders: activeStandingOrderCount,
      watchCustomers,
      deliverySuccessRate,
      returnOrders: returnRecords.length,
      returnQuantity: returnedQuantity,
      failedDeliveries: failedDeliveryCount,
      partialDeliveries: partialDeliveryCount,
      creditExposure,
    },
    customers: {
      segments: customerSegments,
      definitions: segmentDefinitions,
      memberships: segmentMemberships,
      topCustomers,
    },
    branches: {
      totalBranches: customerBranches.length,
      activeBranches: customerBranches.filter((branch) => branch.status === 'active').length,
      performance: branchPerformance,
    },
    capacity: {
      booked: capacities.reduce((sum, capacity) => sum + capacity.bookedQuantity, 0),
      total: capacities.reduce((sum, capacity) => sum + capacity.capacity, 0),
      fillRate:
        capacities.reduce((sum, capacity) => sum + capacity.capacity, 0) === 0
          ? 0
          : Math.round(
              (capacities.reduce((sum, capacity) => sum + capacity.bookedQuantity, 0) /
                capacities.reduce((sum, capacity) => sum + capacity.capacity, 0)) *
                100,
            ),
    },
    delivery: deliveryQuality,
    credit: {
      exposure: creditExposure,
      utilizationRate: creditUtilization,
      buckets: riskBuckets,
      watchCustomers: customers
        .filter((customer) => ['watch', 'block_soon', 'blocked'].includes(customer.riskState))
        .map((customer) => ({
          customerId: customer.id,
          customerName: customer.name,
          riskState: customer.riskState,
          outstandingBalance: customer.outstandingBalance,
          creditLimit: customer.creditLimit,
        })),
    },
    risk: {
      totalCustomers: customers.length,
      healthyCustomers: riskBuckets.healthy,
      watchCustomers: riskBuckets.watch,
      blockSoonCustomers: riskBuckets.blockSoon,
      blockedCustomers: riskBuckets.blocked,
      topRiskCustomers,
    },
    pricing: {
      orderMix: paymentMix,
      pricingRules: pricingCoverage.length,
      branchOverrides: pricingCoverage.filter((rule) => rule.branchId !== null).length,
      customerOverrides: pricingCoverage.filter((rule) => rule.customerId !== null).length,
      averageOrderValue,
    },
    margin: {
      revenue: totalRevenue,
      estimatedCost: estimatedCostTotal,
      grossMargin: totalMargin,
      grossMarginRate: marginRate,
      productBreakdown: marginProductBreakdown,
      branchBreakdown: marginBranchBreakdown,
    },
  };

  kpiRollups.splice(
    0,
    kpiRollups.length,
    {
      id: `kpi_orders_${today}`,
      metricCode: 'order_count',
      serviceDate: today,
      value: orders.length,
      createdAt: now,
    },
    {
      id: `kpi_revenue_${today}`,
      metricCode: 'revenue_total',
      serviceDate: today,
      value: totalRevenue,
      createdAt: now,
    },
    {
      id: `kpi_delivery_success_${today}`,
      metricCode: 'delivery_success_rate',
      serviceDate: today,
      value: deliverySuccessRate,
      createdAt: now,
    },
    {
      id: `kpi_support_open_${today}`,
      metricCode: 'open_support_cases',
      serviceDate: today,
      value: supportOpenCount,
      createdAt: now,
    },
    {
      id: `kpi_standing_active_${today}`,
      metricCode: 'active_standing_orders',
      serviceDate: today,
      value: activeStandingOrderCount,
      createdAt: now,
    },
    {
      id: `kpi_watch_${today}`,
      metricCode: 'watch_customers',
      serviceDate: today,
      value: watchCustomers,
      createdAt: now,
    },
    {
      id: `kpi_routes_${today}`,
      metricCode: 'open_routes',
      serviceDate: today,
      value: openRouteCount,
      createdAt: now,
    },
    {
      id: `kpi_repeat_${today}`,
      metricCode: 'repeat_customers',
      serviceDate: today,
      value: repeatCustomers,
      createdAt: now,
    },
    {
      id: `kpi_returns_${today}`,
      metricCode: 'returned_orders',
      serviceDate: today,
      value: returnRecords.length,
      createdAt: now,
    },
    {
      id: `kpi_credit_${today}`,
      metricCode: 'credit_exposure',
      serviceDate: today,
      value: creditExposure,
      createdAt: now,
    },
  );

  analyticsSnapshots.splice(0, analyticsSnapshots.length, {
    id: `analytics_${today}_${analyticsSnapshots.length + 1}`,
    snapshotTime: now,
    status: 'ready',
    payloadJson: analyticsPayload,
    createdAt: now,
  });

  const alertEventsNow: AlertEvent[] = [];
  for (const rule of alertRules.filter((entry) => entry.active)) {
    if (rule.ruleCode === 'balance_watch') {
      const offenders = customers.filter((customer) => ['watch', 'block_soon', 'blocked'].includes(customer.riskState));
      if (offenders.length > 0) {
        alertEventsNow.push({
          id: `alert_${rule.id}_${today}`,
          ruleId: rule.id,
          severity: offenders.some((customer) => customer.riskState === 'blocked') ? 'critical' : 'warn',
          payloadJson: { customerIds: offenders.map((customer) => customer.id), count: offenders.length },
          createdAt: now,
          acknowledgedAt: null,
        });
      }
    }
    if (rule.ruleCode === 'failed_delivery') {
      const failedOrders = orders.filter((order) => ['failed_delivery', 'partial_delivery'].includes(order.status));
      if (failedOrders.length > 0) {
        alertEventsNow.push({
          id: `alert_${rule.id}_${today}_deliveries`,
          ruleId: rule.id,
          severity: failedOrders.some((order) => order.status === 'failed_delivery') ? 'critical' : 'warn',
          payloadJson: { orderIds: failedOrders.map((order) => order.id), count: failedOrders.length },
          createdAt: now,
          acknowledgedAt: null,
        });
      }
    }
  }

  alertEvents.splice(0, alertEvents.length, ...alertEventsNow);

  syncDeliveryManifestStops();

  const activeNotifications = notificationJobs.filter((job) => job.status !== 'failed');
  if (activeNotifications.length === 0 && customers.length > 0) {
    const fallbackCustomer = customers[0];
    const seed = enqueueNotification({
      customerId: fallbackCustomer.id,
      channel: 'in_app',
      templateCode: 'daily_digest',
      subject: 'Daily operations digest ready',
      correlationKey: `digest:${today}`,
      recipient: fallbackCustomer.id,
    });
    if (!activeNotifications.some((job) => job.id === seed.job.id)) {
      notificationJobs.unshift(seed.job);
      notificationDeliveries.unshift(...seed.deliveries);
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
