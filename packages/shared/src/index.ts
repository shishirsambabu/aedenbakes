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

export interface Product {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
  defaultCutoffTime: string;
  active: boolean;
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
  orders: Order[];
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

export interface Customer360Response {
  customer: CustomerAccount;
  auth: CustomerPortalAuthRecord | null;
  notes: CustomerNote[];
  timeline: CustomerTimelineEvent[];
  supportCases: SupportCase[];
  orders: Order[];
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
}

export interface CustomerOrderLineInput {
  productId: string;
  quantity: number;
}

export interface CustomerOrderCreateRequest {
  serviceDate?: string;
  slotId: string;
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
