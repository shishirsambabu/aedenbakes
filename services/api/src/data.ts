import type {
  CustomerBranch,
  CustomerAccount,
  CustomerUserMembership,
  DeliverySlot,
  Order,
  Product,
  ProductDayCapacity,
  ProductionBatch,
} from '@aeden-bakes/shared';

export const customers: CustomerAccount[] = [
  {
    id: 'cust_cafe_nook',
    name: 'Cafe Nook',
    tier: 'Tier A',
    creditLimit: 25000,
    outstandingBalance: 18400,
    riskState: 'watch',
    deliveryZone: 'North',
  },
  {
    id: 'cust_hotel_lotus',
    name: 'Hotel Lotus',
    tier: 'Tier B',
    creditLimit: 15000,
    outstandingBalance: 9310,
    riskState: 'healthy',
    deliveryZone: 'Central',
  },
];

export const customerBranches: CustomerBranch[] = [
  {
    id: 'branch_cafe_nook_main',
    customerId: 'cust_cafe_nook',
    name: 'Cafe Nook - Main Kitchen',
    code: 'CN-MAIN',
    status: 'active',
    serviceZone: 'North',
    deliveryNotes: 'Use the side loading bay before 8:00 AM.',
    createdAt: '2026-06-19T08:00:00+05:30',
    updatedAt: '2026-06-19T08:00:00+05:30',
  },
  {
    id: 'branch_cafe_nook_outlet',
    customerId: 'cust_cafe_nook',
    name: 'Cafe Nook - Outlet',
    code: 'CN-OUTLET',
    status: 'paused',
    serviceZone: 'North',
    deliveryNotes: 'Currently paused for renovation.',
    createdAt: '2026-06-19T08:02:00+05:30',
    updatedAt: '2026-06-19T08:02:00+05:30',
  },
  {
    id: 'branch_hotel_lotus_main',
    customerId: 'cust_hotel_lotus',
    name: 'Hotel Lotus - Receiving Dock',
    code: 'HL-MAIN',
    status: 'active',
    serviceZone: 'Central',
    deliveryNotes: 'Receive at the service lift after 9:30 AM.',
    createdAt: '2026-06-19T08:04:00+05:30',
    updatedAt: '2026-06-19T08:04:00+05:30',
  },
];

export const customerUsers: CustomerUserMembership[] = [
  {
    id: 'cuserm_cafe_owner',
    customerId: 'cust_cafe_nook',
    branchId: 'branch_cafe_nook_main',
    displayName: 'Anand Menon',
    role: 'admin',
    status: 'active',
    phone: '9000000001',
    email: 'anand@example.com',
    createdAt: '2026-06-19T08:05:00+05:30',
    updatedAt: '2026-06-19T08:05:00+05:30',
  },
  {
    id: 'cuserm_hotel_buyer',
    customerId: 'cust_hotel_lotus',
    branchId: 'branch_hotel_lotus_main',
    displayName: 'Lotus Procurement',
    role: 'buyer',
    status: 'active',
    phone: '9000000002',
    email: 'buyer@lotus.example',
    createdAt: '2026-06-19T08:06:00+05:30',
    updatedAt: '2026-06-19T08:06:00+05:30',
  },
];

export const products: Product[] = [
  {
    id: 'prod_croissant',
    name: 'Butter Croissant',
    category: 'Laminated',
    unitPrice: 58,
    defaultCutoffTime: '18:00',
    active: true,
  },
  {
    id: 'prod_loaf',
    name: 'Multigrain Loaf',
    category: 'Bread',
    unitPrice: 92,
    defaultCutoffTime: '20:30',
    active: true,
  },
  {
    id: 'prod_danish',
    name: 'Fruit Danish',
    category: 'Pastry',
    unitPrice: 66,
    defaultCutoffTime: '17:15',
    active: true,
  },
];

export const capacities: ProductDayCapacity[] = [
  {
    id: 'cap_1',
    productId: 'prod_croissant',
    serviceDate: '2026-06-20',
    capacity: 200,
    bookedQuantity: 178,
    status: 'throttled',
    version: 4,
  },
  {
    id: 'cap_2',
    productId: 'prod_loaf',
    serviceDate: '2026-06-20',
    capacity: 260,
    bookedQuantity: 210,
    status: 'open',
    version: 2,
  },
];

export const slots: DeliverySlot[] = [
  {
    id: 'slot_morning',
    serviceDate: '2026-06-20',
    zone: 'North',
    label: '6:00 - 8:00 AM',
    maxOrders: 18,
    bookedOrders: 12,
    status: 'open',
  },
  {
    id: 'slot_midday',
    serviceDate: '2026-06-20',
    zone: 'Central',
    label: '10:00 - 12:00 PM',
    maxOrders: 14,
    bookedOrders: 14,
    status: 'full',
  },
];

export const orders: Order[] = [
  {
    id: 'AB-1041',
    customerId: 'cust_cafe_nook',
    branchId: 'branch_cafe_nook_main',
    serviceDate: '2026-06-20',
    slotId: 'slot_morning',
    paymentMode: 'credit',
    status: 'confirmed',
    source: 'customer_app',
    amountTotal: 2640,
    createdAt: '2026-06-19T06:42:00+05:30',
    items: [
      { productId: 'prod_loaf', quantity: 18, unitPrice: 92 },
      { productId: 'prod_croissant', quantity: 24, unitPrice: 58 },
    ],
  },
];

export const productionBatches: ProductionBatch[] = [
  {
    id: 'batch_20260620',
    serviceDate: '2026-06-20',
    status: 'draft',
    lines: [
      { productId: 'prod_loaf', slotId: 'slot_morning', quantity: 18, plannedQuantity: 18, actualQuantity: 18, shortQuantity: 0 },
      { productId: 'prod_croissant', slotId: 'slot_morning', quantity: 24, plannedQuantity: 24, actualQuantity: 24, shortQuantity: 0 },
    ],
  },
];
