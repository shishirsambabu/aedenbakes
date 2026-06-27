export type Role =
  | 'owner'
  | 'manager'
  | 'production'
  | 'delivery'
  | 'accounts'
  | 'support'
  | 'customer';

export type PaymentMode = 'prepaid' | 'part-pay' | 'credit';

export type OrderStatus =
  | 'draft'
  | 'confirmed'
  | 'locked'
  | 'in_production'
  | 'out_for_delivery'
  | 'delivered'
  | 'partial_delivery'
  | 'failed_delivery'
  | 'cancelled';

export type RiskState = 'healthy' | 'watch' | 'block_soon' | 'blocked';

export interface CustomerAccount {
  id: string;
  name: string;
  tier: string;
  creditLimit: number;
  outstandingBalance: number;
  riskState: RiskState;
  deliveryZone: string;
}

export interface CustomerBranch {
  id: string;
  customerId: string;
  name: string;
  code: string;
  status: 'active' | 'paused' | 'service_hold' | 'closed';
  serviceZone: string;
  deliveryNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerPricingRule {
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
}

export interface CreditLedgerEntry {
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
}

export interface CreditHoldEvent {
  id: string;
  customerId: string;
  branchId: string | null;
  status: 'active' | 'released';
  reason: string;
  createdAt: string;
  releasedAt: string | null;
}

export interface SubstitutionRule {
  id: string;
  customerId: string | null;
  branchId: string | null;
  productId: string;
  substituteProductId: string;
  status: 'active' | 'paused';
  reason: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubstitutionEvent {
  id: string;
  customerId: string;
  branchId: string | null;
  orderId: string | null;
  productId: string;
  substituteProductId: string;
  status: 'proposed' | 'approved' | 'applied' | 'rejected';
  reason: string;
  createdAt: string;
}

export interface CustomerUserMembership {
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
}

export interface Product {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
  defaultCutoffTime: string;
  active: boolean;
  available?: boolean;
  published?: boolean;
  price?: number;
  capacityToday?: number;
  capacityTomorrow?: number;
  cutoff?: string;
  badge?: string;
  note?: string;
}

export interface ProductDayCapacity {
  id: string;
  productId: string;
  serviceDate: string;
  capacity: number;
  bookedQuantity: number;
  status: 'open' | 'throttled' | 'closed';
  version: number;
}

export interface DeliverySlot {
  id: string;
  serviceDate: string;
  zone: string;
  label: string;
  maxOrders: number;
  bookedOrders: number;
  status: 'open' | 'nearly_full' | 'full' | 'locked';
}

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  customerId: string;
  branchId?: string | null;
  serviceDate: string;
  slotId: string;
  paymentMode: PaymentMode;
  status: OrderStatus;
  source: 'customer_app' | 'admin' | 'standing_order';
  amountTotal: number;
  createdAt: string;
  items: OrderItem[];
}

export interface ProductionBatchLine {
  productId: string;
  slotId: string;
  quantity: number;
  plannedQuantity?: number;
  actualQuantity?: number;
  shortQuantity?: number;
  note?: string;
}

export interface ProductionBatch {
  id: string;
  serviceDate: string;
  status: 'draft' | 'locked' | 'in_progress' | 'completed';
  lines: ProductionBatchLine[];
  generatedAt?: string;
  lockedAt?: string;
  completedAt?: string;
}

export interface AuditEvent {
  id: string;
  kind:
    | 'order_adjusted'
    | 'return_captured'
    | 'customer_onboarded'
    | 'customer_order_placed'
    | 'customer_order_rejected'
    | 'customer_note_added'
    | 'support_case_opened'
    | 'support_case_updated'
    | 'standing_order_created'
    | 'standing_order_updated'
    | 'standing_order_paused'
    | 'standing_order_resumed'
    | 'standing_order_run_generated'
    | 'erp_sync_triggered'
    | 'erp_sync_completed'
    | 'approval_queued'
    | 'approval_approved'
    | 'approval_rejected'
    | 'batch_locked'
    | 'batch_started'
    | 'batch_completed'
    | 'batch_unlocked'
    | 'delivery_pod_completed'
    | 'delivery_failed'
    | 'delivery_returned'
    | 'customer_onboarded'
    | 'customer_order_placed'
    | 'customer_order_rejected';
  actor: string;
  summary: string;
  referenceId: string;
  createdAt: string;
}

export interface CustomerPortalAuthRecord {
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
}

export interface CustomerServiceabilitySlot {
  slotId: string;
  label: string;
  zone: string;
  serviceDate: string;
  maxOrders: number;
  bookedOrders: number;
  status: DeliverySlot['status'];
  available: boolean;
}

export interface CustomerServiceabilityCapacity {
  productId: string;
  productName: string;
  serviceDate: string;
  capacity: number;
  bookedQuantity: number;
  remainingQuantity: number;
  status: ProductDayCapacity['status'];
  active: boolean;
  cutoffTime: string;
}

export interface CustomerServiceabilitySummary {
  customerId: string;
  customerZone: string;
  defaultServiceDate: string;
  canOrder: boolean;
  reasons: string[];
  slots: CustomerServiceabilitySlot[];
  capacities: CustomerServiceabilityCapacity[];
}

export interface CustomerDashboardResponse {
  customer: CustomerAccount;
  auth: CustomerPortalAuthRecord;
  branches: CustomerBranch[];
  users: CustomerUserMembership[];
  orders: Order[];
  pricingRules: CustomerPricingRule[];
  creditHolds: CreditHoldEvent[];
  creditLedgerEntries: CreditLedgerEntry[];
  substitutionRules: SubstitutionRule[];
  substitutionEvents: SubstitutionEvent[];
  documents?: CustomerDocument[];
  invoiceExports?: InvoiceExport[];
  catalog: {
    products: Product[];
    capacities: ProductDayCapacity[];
    slots: DeliverySlot[];
  };
  serviceability: CustomerServiceabilitySummary;
  defaultServiceDate: string;
}

export interface CustomerNote {
  id: string;
  customerId: string;
  noteType: 'support' | 'accounts' | 'delivery' | 'production' | 'general';
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface CustomerTimelineEvent {
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
}

export interface SupportCase {
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
}

export interface SupportCaseMessage {
  id: string;
  caseId: string;
  messageType: 'customer' | 'internal' | 'system';
  message: string;
  authorRole: Role | 'system';
  authorId: string;
  createdAt: string;
}

export interface StandingOrderItem {
  productId: string;
  quantity: number;
}

export interface StandingOrderSchedule {
  deliveryDays: number[];
  slotId: string;
  paymentMode: PaymentMode;
  items: StandingOrderItem[];
  notes?: string;
}

export interface StandingOrder {
  id: string;
  customerId: string;
  branchId?: string | null;
  status: 'draft' | 'active' | 'paused' | 'cancelled';
  schedule: StandingOrderSchedule;
  createdAt: string;
  updatedAt: string;
}

export interface StandingOrderRun {
  id: string;
  standingOrderId: string;
  serviceDate: string;
  status: 'generated' | 'skipped' | 'failed';
  generatedOrderId: string | null;
  reason?: string;
  createdAt: string;
}

export interface StandingOrderPause {
  id: string;
  standingOrderId: string;
  startDate: string;
  endDate: string | null;
  reason: string;
  createdAt: string;
}

export interface RecurrenceRule {
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
}

export interface StandingOrderChange {
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
  patchJson: {
    branchId?: string | null;
    status?: StandingOrder['status'];
    schedule?: Partial<StandingOrderSchedule>;
  };
}

export interface CustomerDocument {
  id: string;
  customerId: string;
  documentType: 'gst' | 'fssai' | 'cheque' | 'credit' | 'proof' | 'invoice' | 'other';
  status: 'draft' | 'uploaded' | 'verified' | 'archived';
  title: string;
  fileName: string;
  mimeType: string;
  downloadUrl: string;
  tags: string[];
  createdAt: string;
  verifiedAt: string | null;
}

export interface InvoiceExport {
  id: string;
  customerId: string;
  invoiceNumber: string;
  fileName: string;
  status: 'ready' | 'downloaded' | 'emailed' | 'archived';
  amount: number;
  createdAt: string;
  downloadUrl: string;
}

export interface Customer360Response {
  customer: CustomerAccount;
  auth: CustomerPortalAuthRecord | null;
  branches: CustomerBranch[];
  users: CustomerUserMembership[];
  notes: CustomerNote[];
  timeline: CustomerTimelineEvent[];
  supportCases: SupportCase[];
  standingOrders: StandingOrder[];
  recurrenceRules: RecurrenceRule[];
  standingOrderChanges: StandingOrderChange[];
  documents?: CustomerDocument[];
  invoiceExports?: InvoiceExport[];
  orders: Order[];
  analytics?: {
    orderCount: number;
    repeatOrderCount: number;
    revenue: number;
    averageOrderValue: number;
    activeSupportCases: number;
    activeStandingOrders: number;
    riskState: RiskState;
    riskScore: number;
    estimatedMargin: number;
    lastOrderAt: string | null;
    segments: string[];
  };
}

export interface CustomerOnboardingRequest {
  customerId?: string;
  name: string;
  deliveryZone: string;
  loginId: string;
  password: string;
  defaultAddress: string;
  tier?: string;
  creditLimit?: number;
  gstVerified?: boolean;
  documents?: CustomerOnboardingDocument[];
}

export interface CustomerOnboardingDocument {
  documentType: 'gst' | 'fssai' | 'cheque';
  title: string;
  fileName: string;
  verified: boolean;
}

export interface CustomerOrderLineInput {
  productId: string;
  quantity: number;
}

export interface CustomerOrderCreateRequest {
  serviceDate?: string;
  slotId: string;
  branchId?: string | null;
  paymentMode?: PaymentMode;
  notes?: string;
  items: CustomerOrderLineInput[];
}

export interface ErpSyncStatus {
  provider: 'vasy';
  state: 'healthy' | 'degraded' | 'down';
  lastAttemptAt: string;
  lastSuccessAt: string | null;
  pendingCount: number;
  failedCount: number;
}

export interface VasyErpOrderLine {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface VasyErpOrderPayload {
  orderId: string;
  customerCode: string;
  serviceDate: string;
  deliverySlotCode: string;
  paymentMode: PaymentMode;
  status: OrderStatus;
  totalAmount: number;
  lines: VasyErpOrderLine[];
}

export interface VasyErpBatchPayload {
  batchId: string;
  serviceDate: string;
  status: ProductionBatch['status'];
  lines: Array<{
    sku: string;
    deliverySlotCode: string;
    quantity: number;
  }>;
}

export interface VasyErpContractPreview {
  provider: 'vasy';
  exportedAt: string;
  orderCount: number;
  batchCount: number;
  orders: VasyErpOrderPayload[];
  batches: VasyErpBatchPayload[];
}

export interface VasyErpPushResult {
  provider: 'vasy';
  accepted: number;
  rejected: number;
  message: string;
  receivedAt: string;
}
