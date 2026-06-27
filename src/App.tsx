import { useMemo, useState } from 'react';

type ViewMode = 'customer' | 'admin';
type DateView = 'today' | 'tomorrow';
type PaymentMode = 'prepaid' | 'part-pay' | 'credit';
type OrderStatus = 'Confirmed' | 'In production' | 'Out for delivery' | 'Delivered' | 'Cancelled';
type ReviewState = 'pending' | 'approved' | 'rejected';
type ApplicationState = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'needs_more_info';

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  capacityToday: number;
  capacityTomorrow: number;
  cutoff: string;
  badge: string;
  note: string;
  available: boolean;
  published: boolean;
};

type CartEntry = {
  productId: string;
  quantity: number;
};

type Order = {
  id: string;
  customer: string;
  dateView: DateView;
  slot: string;
  paymentMode: PaymentMode;
  status: OrderStatus;
  reviewState?: ReviewState;
  items: CartEntry[];
  amount: number;
};

type Slot = {
  id: string;
  label: string;
  window: string;
  maxOrders: number;
  booked: number;
};

type CustomerApplication = {
  id: string;
  businessName: string;
  city: string;
  zone: string;
  contactPerson: string;
  gstin: string;
  requestedCredit: string;
  documents: string[];
  submittedAt: string;
  status: ApplicationState;
  note: string;
};

type CollectionAccount = {
  name: string;
  tier: string;
  outstanding: number;
  due: string;
  risk: string;
  action: string;
};

type ProductDraft = {
  name: string;
  category: string;
  price: string;
  capacityToday: string;
  capacityTomorrow: string;
  cutoff: string;
  badge: string;
  note: string;
};

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const initialProducts: Product[] = [
  {
    id: 'croissant',
    name: 'Butter Croissant',
    category: 'Laminated',
    price: 58,
    capacityToday: 120,
    capacityTomorrow: 200,
    cutoff: '6:00 PM',
    badge: 'High demand',
    note: "Booked against tomorrow's bake plan, not shelf inventory.",
    available: true,
    published: true,
  },
  {
    id: 'multigrain',
    name: 'Multigrain Loaf',
    category: 'Bread',
    price: 92,
    capacityToday: 180,
    capacityTomorrow: 260,
    cutoff: '8:30 PM',
    badge: 'Weekly staple',
    note: 'Best for standing orders and recurring slots.',
    available: true,
    published: true,
  },
  {
    id: 'baguette',
    name: 'French Baguette',
    category: 'Bread',
    price: 74,
    capacityToday: 140,
    capacityTomorrow: 180,
    cutoff: '9:30 PM',
    badge: 'Early bake',
    note: 'Longer lead time but strong repeat demand.',
    available: true,
    published: true,
  },
  {
    id: 'danish',
    name: 'Fruit Danish',
    category: 'Pastry',
    price: 66,
    capacityToday: 90,
    capacityTomorrow: 130,
    cutoff: '5:15 PM',
    badge: 'Limited batch',
    note: 'Priority item for hotels and cafe counters.',
    available: false,
    published: true,
  },
];

const initialSlots: Slot[] = [
  { id: 'slot-1', label: '6:00 - 8:00 AM', window: 'Morning drop', maxOrders: 18, booked: 12 },
  { id: 'slot-2', label: '10:00 - 12:00 PM', window: 'Midday route', maxOrders: 14, booked: 7 },
  { id: 'slot-3', label: '4:00 - 6:00 PM', window: 'Evening refill', maxOrders: 10, booked: 4 },
];

const initialOrders: Order[] = [
  {
    id: 'AB-1041',
    customer: 'Cafe Nook',
    dateView: 'tomorrow',
    slot: 'slot-1',
    paymentMode: 'credit',
    status: 'Confirmed',
    reviewState: 'approved',
    items: [
      { productId: 'multigrain', quantity: 18 },
      { productId: 'croissant', quantity: 24 },
    ],
    amount: 2640,
  },
  {
    id: 'AB-1042',
    customer: 'Hotel Lotus',
    dateView: 'tomorrow',
    slot: 'slot-2',
    paymentMode: 'part-pay',
    status: 'In production',
    reviewState: 'approved',
    items: [
      { productId: 'baguette', quantity: 20 },
      { productId: 'danish', quantity: 12 },
    ],
    amount: 2044,
  },
  {
    id: 'AB-1038',
    customer: 'Mira Retail',
    dateView: 'today',
    slot: 'slot-3',
    paymentMode: 'prepaid',
    status: 'Delivered',
    reviewState: 'approved',
    items: [{ productId: 'multigrain', quantity: 10 }],
    amount: 920,
  },
  {
    id: 'AB-1043',
    customer: 'Seaside Cafe',
    dateView: 'tomorrow',
    slot: 'slot-3',
    paymentMode: 'credit',
    status: 'Confirmed',
    reviewState: 'pending',
    items: [
      { productId: 'croissant', quantity: 16 },
      { productId: 'multigrain', quantity: 8 },
    ],
    amount: 1804,
  },
];

const initialApplications: CustomerApplication[] = [
  {
    id: 'APP-2001',
    businessName: 'Seaside Cafe',
    city: 'Kochi',
    zone: 'Central',
    contactPerson: 'Anjali K.',
    gstin: '32AAJCS1132Q1Z5',
    requestedCredit: '₹50,000 / 15 days',
    documents: ['GST certificate', 'FSSAI license', 'Cancelled cheque'],
    submittedAt: 'Today, 9:15 AM',
    status: 'submitted',
    note: 'New cafe opening with breakfast focus.',
  },
  {
    id: 'APP-2002',
    businessName: 'Palm Residency',
    city: 'Ernakulam',
    zone: 'North',
    contactPerson: 'Rahul V.',
    gstin: '32AAACP7741R1Z4',
    requestedCredit: '₹1,00,000 / 30 days',
    documents: ['GST certificate', 'FSSAI license'],
    submittedAt: 'Today, 10:05 AM',
    status: 'needs_more_info',
    note: 'Missing cancelled cheque for credit review.',
  },
];

const initialAccounts: CollectionAccount[] = [
  { name: 'Cafe Nook', tier: 'Tier A', outstanding: 18400, due: '2 days', risk: 'Watch', action: 'Call and confirm payment' },
  { name: 'Hotel Lotus', tier: 'Tier B', outstanding: 9310, due: '7 days', risk: 'Healthy', action: 'Monitor standing order' },
  { name: 'Mira Retail', tier: 'Tier C', outstanding: 2800, due: 'Overdue', risk: 'Block soon', action: 'Hold next order' },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sumItems(items: CartEntry[]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

function App() {
  const [mode, setMode] = useState<ViewMode>('admin');
  const [dateView, setDateView] = useState<DateView>('tomorrow');
  const [products, setProducts] = useState(initialProducts);
  const [slots, setSlots] = useState(initialSlots);
  const [orders, setOrders] = useState(initialOrders);
  const [applications, setApplications] = useState(initialApplications);
  const [accounts] = useState(initialAccounts);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [customerName, setCustomerName] = useState('Aanya Cafe');
  const [selectedSlot, setSelectedSlot] = useState(initialSlots[0]?.id ?? '');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('prepaid');
  const [activity, setActivity] = useState<string[]>([
    'Admin board ready',
    'Product catalog loaded',
    'Application queue seeded',
  ]);
  const [draft, setDraft] = useState<ProductDraft>({
    name: '',
    category: 'Bread',
    price: '',
    capacityToday: '',
    capacityTomorrow: '',
    cutoff: '6:00 PM',
    badge: 'New',
    note: '',
  });

  const selectedProducts = dateView === 'today'
    ? products.map((product) => ({ ...product, capacity: product.capacityToday }))
    : products.map((product) => ({ ...product, capacity: product.capacityTomorrow }));

  const bookedCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of orders.filter((entry) => entry.dateView === dateView && entry.reviewState !== 'rejected')) {
      for (const item of order.items) {
        map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
      }
    }
    return map;
  }, [dateView, orders]);

  const totalCapacity = useMemo(
    () => selectedProducts.reduce((total, product) => total + product.capacity, 0),
    [selectedProducts],
  );

  const totalBooked = useMemo(
    () => selectedProducts.reduce((total, product) => total + (bookedCounts.get(product.id) ?? 0), 0),
    [bookedCounts, selectedProducts],
  );

  const remainingCapacity = totalCapacity - totalBooked;
  const cartTotal = cart.reduce((total, item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return total + (product?.price ?? 0) * item.quantity;
  }, 0);
  const selectedSlotInfo = slots.find((slot) => slot.id === selectedSlot) ?? slots[0];

  const productionSheet = useMemo(() => {
    const sheet = new Map<string, { name: string; total: number; slotBreakdown: Map<string, number> }>();
    for (const order of orders.filter((entry) => entry.dateView === 'tomorrow' && entry.reviewState !== 'rejected')) {
      for (const item of order.items) {
        const product = products.find((entry) => entry.id === item.productId);
        if (!product) continue;
        const bucket = sheet.get(product.id) ?? {
          name: product.name,
          total: 0,
          slotBreakdown: new Map<string, number>(),
        };
        bucket.total += item.quantity;
        bucket.slotBreakdown.set(order.slot, (bucket.slotBreakdown.get(order.slot) ?? 0) + item.quantity);
        sheet.set(product.id, bucket);
      }
    }
    return [...sheet.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .sort((left, right) => right.total - left.total);
  }, [orders, products]);

  function pushActivity(message: string) {
    setActivity((current) => [message, ...current].slice(0, 8));
  }

  function addToCart(productId: string) {
    const product = products.find((entry) => entry.id === productId);
    if (!product || !product.available || !product.published) return;
    const capacity = dateView === 'today' ? product.capacityToday : product.capacityTomorrow;
    const booked = bookedCounts.get(productId) ?? 0;
    const current = cart.find((item) => item.productId === productId)?.quantity ?? 0;
    if (booked + current >= capacity) return;

    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.productId === productId);
      if (existing) {
        return currentCart.map((item) =>
          item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...currentCart, { productId, quantity: 1 }];
    });
  }

  function removeFromCart(productId: string) {
    setCart((currentCart) =>
      currentCart
        .map((item) => (item.productId === productId ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0),
    );
  }

  function placeOrder() {
    if (!selectedSlotInfo || cart.length === 0) return;
    const newOrder: Order = {
      id: `AB-${1100 + orders.length}`,
      customer: customerName,
      dateView,
      slot: selectedSlotInfo.id,
      paymentMode,
      status: 'Confirmed',
      reviewState: 'pending',
      items: cart,
      amount: cartTotal,
    };
    setOrders((current) => [newOrder, ...current]);
    setSlots((current) =>
      current.map((slot) =>
        slot.id === selectedSlotInfo.id ? { ...slot, booked: slot.booked + 1 } : slot,
      ),
    );
    setProducts((current) =>
      current.map((product) => {
        const ordered = cart.find((item) => item.productId === product.id)?.quantity ?? 0;
        if (!ordered) return product;
        return dateView === 'today'
          ? { ...product, capacityToday: clamp(product.capacityToday - ordered, 0, 9999) }
          : { ...product, capacityTomorrow: clamp(product.capacityTomorrow - ordered, 0, 9999) };
      }),
    );
    setCart([]);
    pushActivity(`Order ${newOrder.id} placed from the customer app.`);
  }

  function cycleOrderStatus(orderId: string) {
    const flow: OrderStatus[] = ['Confirmed', 'In production', 'Out for delivery', 'Delivered'];
    setOrders((current) =>
      current.map((order) => {
        if (order.id !== orderId) return order;
        if (order.reviewState === 'rejected') return order;
        const currentIndex = Math.max(0, flow.indexOf(order.status));
        const nextIndex = currentIndex === flow.length - 1 ? currentIndex : currentIndex + 1;
        return { ...order, status: flow[nextIndex]! };
      }),
    );
  }

  function approveOrder(orderId: string) {
    setOrders((current) =>
      current.map((order) => (order.id === orderId ? { ...order, reviewState: 'approved', status: 'Confirmed' } : order)),
    );
    pushActivity(`Order ${orderId} approved for production.`);
  }

  function rejectOrder(orderId: string) {
    setOrders((current) =>
      current.map((order) => (order.id === orderId ? { ...order, reviewState: 'rejected', status: 'Cancelled' } : order)),
    );
    pushActivity(`Order ${orderId} rejected and removed from the sheet.`);
  }

  function toggleProductAvailability(productId: string) {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId ? { ...product, available: !product.available } : product,
      ),
    );
    const product = products.find((entry) => entry.id === productId);
    pushActivity(`${product?.name ?? productId} availability toggled.`);
  }

  function toggleProductPublished(productId: string) {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId ? { ...product, published: !product.published } : product,
      ),
    );
    const product = products.find((entry) => entry.id === productId);
    pushActivity(`${product?.name ?? productId} publish state changed.`);
  }

  function adjustTomorrowCapacity(productId: string, delta: number) {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId
          ? { ...product, capacityTomorrow: clamp(product.capacityTomorrow + delta, 0, 9999) }
          : product,
      ),
    );
    const product = products.find((entry) => entry.id === productId);
    pushActivity(`${product?.name ?? productId} tomorrow capacity adjusted by ${delta}.`);
  }

  function createProduct() {
    if (!draft.name.trim() || !draft.price.trim()) return;
    const id = draft.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const next: Product = {
      id: id || `prod-${products.length + 1}`,
      name: draft.name.trim(),
      category: draft.category.trim() || 'Bread',
      price: Math.max(0, Number(draft.price) || 0),
      capacityToday: Math.max(0, Number(draft.capacityToday) || 0),
      capacityTomorrow: Math.max(0, Number(draft.capacityTomorrow) || 0),
      cutoff: draft.cutoff.trim() || '6:00 PM',
      badge: draft.badge.trim() || 'New',
      note: draft.note.trim() || 'New product added from the admin product master.',
      available: true,
      published: false,
    };
    setProducts((current) => [next, ...current]);
    setDraft({
      name: '',
      category: 'Bread',
      price: '',
      capacityToday: '',
      capacityTomorrow: '',
      cutoff: '6:00 PM',
      badge: 'New',
      note: '',
    });
    pushActivity(`Product ${next.name} created in the master catalog.`);
  }

  function reviewApplication(applicationId: string, nextStatus: ApplicationState) {
    setApplications((current) =>
      current.map((application) =>
        application.id === applicationId
          ? { ...application, status: nextStatus }
          : application,
      ),
    );
    const application = applications.find((entry) => entry.id === applicationId);
    pushActivity(`${application?.businessName ?? applicationId} moved to ${nextStatus}.`);
  }

  const revenue = orders.reduce((total, order) => total + order.amount, 0);
  const overdue = accounts.filter((account) => account.risk !== 'Healthy').length;
  const approvalQueue = orders.filter((order) => order.reviewState === 'pending').length;
  const activeApplications = applications.filter((application) => application.status !== 'approved' && application.status !== 'rejected').length;
  const activeProducts = products.filter((product) => product.available && product.published).length;
  const upcomingSlotFill = `${selectedSlotInfo?.booked ?? 0}/${selectedSlotInfo?.maxOrders ?? 0}`;
  const tomorrowOrders = orders.filter((order) => order.dateView === 'tomorrow' && order.reviewState !== 'rejected');

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero__copy">
          <div className="eyebrow">Aeden Bakes operations OS</div>
          <h1>One system for products, approvals, production, and collections.</h1>
          <p>
            This admin build is the bakery command center. Product master, order approval, account review,
            and production planning all live in one warm, auditable workspace.
          </p>

          <div className="hero__switcher" role="tablist" aria-label="App mode">
            <button
              type="button"
              className={mode === 'customer' ? 'switcher switcher--active' : 'switcher'}
              onClick={() => setMode('customer')}
            >
              Customer app
            </button>
            <button
              type="button"
              className={mode === 'admin' ? 'switcher switcher--active' : 'switcher'}
              onClick={() => setMode('admin')}
            >
              Admin app
            </button>
          </div>
        </div>

        <aside className="hero__stats">
          <div className="stat-card">
            <span>Booked vs capacity</span>
            <strong>
              {totalBooked} / {totalCapacity}
            </strong>
            <p>{remainingCapacity} units still open for {dateView}.</p>
          </div>
          <div className="stat-grid">
            <div className="mini-card">
              <span>Orders</span>
              <strong>{orders.length}</strong>
            </div>
            <div className="mini-card">
              <span>Revenue</span>
              <strong>{money.format(revenue)}</strong>
            </div>
            <div className="mini-card">
              <span>Applications</span>
              <strong>{activeApplications}</strong>
            </div>
            <div className="mini-card">
              <span>Accounts at risk</span>
              <strong>{overdue}</strong>
            </div>
          </div>
        </aside>
      </header>

      <main className="layout">
        {mode === 'customer' ? (
          <>
            <section className="panel panel--wide">
              <div className="panel__header">
                <div>
                  <h2>Customer ordering</h2>
                  <p>Customers see tomorrow's real capacity, not a fake available toggle.</p>
                </div>
                <div className="date-toggle" role="tablist" aria-label="Order date">
                  <button
                    type="button"
                    className={dateView === 'today' ? 'date-toggle__btn active' : 'date-toggle__btn'}
                    onClick={() => setDateView('today')}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className={dateView === 'tomorrow' ? 'date-toggle__btn active' : 'date-toggle__btn'}
                    onClick={() => setDateView('tomorrow')}
                  >
                    Tomorrow
                  </button>
                </div>
              </div>

              <div className="capacity-banner">
                <div>
                  <span>Production cutoff</span>
                  <strong>
                    Order by {selectedProducts[0]?.cutoff ?? '6:00 PM'} for next-day delivery
                  </strong>
                </div>
                <div>
                  <span>Selected slot</span>
                  <strong>{selectedSlotInfo?.label ?? 'Choose a slot'}</strong>
                </div>
                <div>
                  <span>Payment mode</span>
                  <strong>{paymentMode}</strong>
                </div>
              </div>
            </section>

            <section className="panel panel--wide">
              <div className="panel__header">
                <div>
                  <h3>Book from the bake plan</h3>
                  <p>Only published products can be booked. Availability follows the admin switches.</p>
                </div>
                <label className="inline-field">
                  Customer
                  <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
                </label>
              </div>

              <div className="grid grid--products">
                {selectedProducts.map((product) => {
                  const booked = bookedCounts.get(product.id) ?? 0;
                  const remaining = Math.max(product.capacity - booked, 0);
                  const percent = product.capacity === 0 ? 0 : (booked / product.capacity) * 100;
                  const inCart = cart.find((item) => item.productId === product.id)?.quantity ?? 0;
                  const disabled = !product.available || !product.published;

                  return (
                    <article className="product-card" key={product.id}>
                      <div className="product-card__top">
                        <div>
                          <span className="pill">{product.badge}</span>
                          <h4>{product.name}</h4>
                        </div>
                        <strong>{money.format(product.price)}</strong>
                      </div>

                      <p>{disabled ? 'Currently hidden from sale.' : product.note}</p>

                      <div className="meter">
                        <div className="meter__bar" style={{ width: `${Math.min(percent, 100)}%` }} />
                      </div>

                      <div className="product-card__meta">
                        <span>{booked} booked</span>
                        <span>{remaining} left for {dateView}</span>
                      </div>

                      <button type="button" className="action-btn" onClick={() => addToCart(product.id)} disabled={disabled}>
                        {disabled ? 'Not available' : `Add to cart${inCart > 0 ? ` (${inCart})` : ''}`}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="two-up">
              <section className="panel">
                <div className="panel__header">
                  <div>
                    <h3>Delivery slots</h3>
                    <p>Slots are capped per route, which keeps the delivery team honest.</p>
                  </div>
                </div>

                <div className="stack">
                  {slots.map((slot) => (
                    <button
                      type="button"
                      className={slot.id === selectedSlot ? 'slot-card slot-card--active' : 'slot-card'}
                      key={slot.id}
                      onClick={() => setSelectedSlot(slot.id)}
                    >
                      <div>
                        <strong>{slot.label}</strong>
                        <p>{slot.window}</p>
                      </div>
                      <span>
                        {slot.booked}/{slot.maxOrders}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="panel__header">
                  <div>
                    <h3>Cart and checkout</h3>
                    <p>Prepaid, part-pay, or credit. Same order flow, different payment policy.</p>
                  </div>
                </div>

                <div className="cart">
                  {cart.length === 0 ? (
                    <div className="empty-state">Your cart is empty. Add a product to reserve capacity.</div>
                  ) : (
                    cart.map((item) => {
                      const product = products.find((entry) => entry.id === item.productId);
                      if (!product) return null;

                      return (
                        <div key={item.productId} className="cart-row">
                          <div>
                            <strong>{product.name}</strong>
                            <p>
                              {item.quantity} x {money.format(product.price)}
                            </p>
                          </div>
                          <div className="cart-row__actions">
                            <span>{money.format(item.quantity * product.price)}</span>
                            <button type="button" onClick={() => removeFromCart(item.productId)}>
                              -
                            </button>
                            <button type="button" onClick={() => addToCart(item.productId)}>
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="payment-mode">
                  {(['prepaid', 'part-pay', 'credit'] as PaymentMode[]).map((modeOption) => (
                    <button
                      type="button"
                      key={modeOption}
                      className={paymentMode === modeOption ? 'pill-button pill-button--active' : 'pill-button'}
                      onClick={() => setPaymentMode(modeOption)}
                    >
                      {modeOption}
                    </button>
                  ))}
                </div>

                <div className="checkout">
                  <div>
                    <span>Total</span>
                    <strong>{money.format(cartTotal)}</strong>
                  </div>
                  <button type="button" className="action-btn" onClick={placeOrder} disabled={cart.length === 0}>
                    Confirm order
                  </button>
                </div>
              </section>
            </section>
          </>
        ) : (
          <>
            <section className="panel panel--wide">
              <div className="panel__header">
                <div>
                  <h2>Admin command center</h2>
                  <p>Product master, approvals, order desk, production, and receivables in one place.</p>
                </div>
                <span className="pill">Roles: owner · manager · accounts · production · support</span>
              </div>

              <div className="capacity-banner">
                <div>
                  <span>Active products</span>
                  <strong>{activeProducts}</strong>
                </div>
                <div>
                  <span>Approval queue</span>
                  <strong>{approvalQueue}</strong>
                </div>
                <div>
                  <span>Receivables</span>
                  <strong>{money.format(accounts.reduce((sum, account) => sum + account.outstanding, 0))}</strong>
                </div>
              </div>
            </section>

            <section className="two-up">
              <section className="panel">
                <div className="panel__header">
                  <div>
                    <h3>Product master</h3>
                    <p>Add new items, toggle sale availability, and control publish state.</p>
                  </div>
                </div>

                <div className="stack">
                  <div className="admin-form">
                    <div className="admin-form__grid">
                      <label>
                        Product name
                        <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Sourdough Loaf" />
                      </label>
                      <label>
                        Category
                        <input value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} placeholder="Bread" />
                      </label>
                      <label>
                        Price
                        <input value={draft.price} onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))} placeholder="125" />
                      </label>
                      <label>
                        Cutoff
                        <input value={draft.cutoff} onChange={(event) => setDraft((current) => ({ ...current, cutoff: event.target.value }))} placeholder="6:00 PM" />
                      </label>
                      <label>
                        Today cap
                        <input value={draft.capacityToday} onChange={(event) => setDraft((current) => ({ ...current, capacityToday: event.target.value }))} placeholder="120" />
                      </label>
                      <label>
                        Tomorrow cap
                        <input value={draft.capacityTomorrow} onChange={(event) => setDraft((current) => ({ ...current, capacityTomorrow: event.target.value }))} placeholder="180" />
                      </label>
                    </div>
                    <label>
                      Badge
                      <input value={draft.badge} onChange={(event) => setDraft((current) => ({ ...current, badge: event.target.value }))} placeholder="New" />
                    </label>
                    <label>
                      Description
                      <textarea
                        value={draft.note}
                        onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                        placeholder="Short product note for the customer app."
                        rows={3}
                      />
                    </label>
                    <button type="button" className="action-btn" onClick={createProduct}>
                      Add product
                    </button>
                  </div>

                  <div className="stack">
                    {products.map((product) => (
                      <article key={product.id} className="product-card">
                        <div className="product-card__top">
                          <div>
                            <span className="pill">{product.category}</span>
                            <h4>{product.name}</h4>
                          </div>
                          <strong>{money.format(product.price)}</strong>
                        </div>
                        <p>{product.note}</p>
                        <div className="product-card__meta">
                          <span>Cutoff {product.cutoff}</span>
                          <span>{product.available ? 'Available' : 'Hidden'} · {product.published ? 'Published' : 'Draft'}</span>
                        </div>
                        <div className="admin-controls">
                          <button type="button" onClick={() => toggleProductAvailability(product.id)}>
                            {product.available ? 'Turn off' : 'Turn on'}
                          </button>
                          <button type="button" onClick={() => toggleProductPublished(product.id)}>
                            {product.published ? 'Unpublish' : 'Publish'}
                          </button>
                          <button type="button" onClick={() => adjustTomorrowCapacity(product.id, -10)}>
                            -10
                          </button>
                          <button type="button" onClick={() => adjustTomorrowCapacity(product.id, 10)}>
                            +10
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel__header">
                  <div>
                    <h3>Customer applications</h3>
                    <p>Approve, reject, or request more information before the account is opened.</p>
                  </div>
                </div>

                <div className="stack">
                  {applications.map((application) => (
                    <article key={application.id} className="ledger-row">
                      <div>
                        <strong>{application.businessName}</strong>
                        <p>
                          {application.city} · {application.zone}
                        </p>
                        <p>
                          GST {application.gstin} · {application.requestedCredit}
                        </p>
                      </div>
                      <div className="ledger-row__meta">
                        <span>{application.status}</span>
                        <span>{application.submittedAt}</span>
                      </div>
                      <div className="admin-controls">
                        <button type="button" onClick={() => reviewApplication(application.id, 'approved')}>
                          Approve
                        </button>
                        <button type="button" onClick={() => reviewApplication(application.id, 'needs_more_info')}>
                          Query
                        </button>
                        <button type="button" onClick={() => reviewApplication(application.id, 'rejected')}>
                          Reject
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </section>

            <section className="two-up">
              <section className="panel">
                <div className="panel__header">
                  <div>
                    <h3>Incoming orders</h3>
                    <p>Approve or reject tomorrow's orders before they enter production.</p>
                  </div>
                </div>

                <div className="stack">
                  {tomorrowOrders.map((order) => (
                    <article key={order.id} className="order-card">
                      <div className="order-card__top">
                        <div>
                          <strong>{order.id}</strong>
                          <p>
                            {order.customer} · {order.slot}
                          </p>
                        </div>
                        <span className="pill">{order.reviewState ?? 'pending'}</span>
                      </div>
                      <div className="order-card__meta">
                        <span>{money.format(order.amount)}</span>
                        <span>{sumItems(order.items)} items</span>
                        <span>{order.paymentMode}</span>
                      </div>
                      <div className="admin-controls">
                        <button type="button" onClick={() => approveOrder(order.id)}>
                          Approve
                        </button>
                        <button type="button" onClick={() => rejectOrder(order.id)}>
                          Reject
                        </button>
                        <button type="button" onClick={() => cycleOrderStatus(order.id)}>
                          Advance
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="panel__header">
                  <div>
                    <h3>Production sheet</h3>
                    <p>Grouped by product and split by delivery slot.</p>
                  </div>
                </div>

                <div className="stack">
                  {productionSheet.map((item) => (
                    <article key={item.id} className="sheet-row">
                      <div>
                        <strong>{item.name}</strong>
                        <p>Total: {item.total}</p>
                      </div>
                      <div className="sheet-row__slots">
                        {[...item.slotBreakdown.entries()].map(([slotId, quantity]) => {
                          const slot = slots.find((entry) => entry.id === slotId);
                          return (
                            <span key={slotId} className="mini-pill">
                              {slot?.label ?? slotId}: {quantity}
                            </span>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </section>

            <section className="two-up">
              <section className="panel">
                <div className="panel__header">
                  <div>
                    <h3>Receivables</h3>
                    <p>The ledger is the moat: limits, aging, and overdue risk live here.</p>
                  </div>
                </div>

                <div className="stack">
                  {accounts.map((account) => (
                    <article key={account.name} className="ledger-row">
                      <div>
                        <strong>{account.name}</strong>
                        <p>{account.tier}</p>
                      </div>
                      <div className="ledger-row__meta">
                        <span>{money.format(account.outstanding)}</span>
                        <span>{account.due}</span>
                        <span>{account.risk}</span>
                      </div>
                      <button type="button" className="action-btn action-btn--secondary" onClick={() => pushActivity(account.action)}>
                        Follow up
                      </button>
                    </article>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="panel__header">
                  <div>
                    <h3>Activity log</h3>
                    <p>Every action taken in the admin app leaves a visible trace.</p>
                  </div>
                </div>

                <div className="stack">
                  {activity.map((entry, index) => (
                    <div key={`${entry}-${index}`} className="empty-state">
                      {entry}
                    </div>
                  ))}
                </div>
              </section>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
