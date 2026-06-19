import { useMemo, useState } from 'react';

type ViewMode = 'customer' | 'admin';
type DateView = 'today' | 'tomorrow';
type PaymentMode = 'prepaid' | 'part-pay' | 'credit';
type OrderStatus = 'Confirmed' | 'In production' | 'Out for delivery' | 'Delivered';

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
    note: 'Booked against tomorrow’s bake plan, not shelf inventory.',
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
    items: [{ productId: 'multigrain', quantity: 10 }],
    amount: 920,
  },
];

const accounts = [
  { name: 'Cafe Nook', tier: 'Tier A', outstanding: 18400, due: '2 days', risk: 'Watch' },
  { name: 'Hotel Lotus', tier: 'Tier B', outstanding: 9310, due: '7 days', risk: 'Healthy' },
  { name: 'Mira Retail', tier: 'Tier C', outstanding: 2800, due: 'Overdue', risk: 'Block soon' },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sumItems(items: CartEntry[]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

function App() {
  const [mode, setMode] = useState<ViewMode>('customer');
  const [dateView, setDateView] = useState<DateView>('tomorrow');
  const [products, setProducts] = useState(initialProducts);
  const [slots, setSlots] = useState(initialSlots);
  const [orders, setOrders] = useState(initialOrders);
  const [selectedSlot, setSelectedSlot] = useState(initialSlots[0]?.id ?? '');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('prepaid');
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [customerName, setCustomerName] = useState('Aanya Cafe');

  const selectedProducts = dateView === 'today'
    ? products.map((product) => ({ ...product, capacity: product.capacityToday }))
    : products.map((product) => ({ ...product, capacity: product.capacityTomorrow }));

  const bookedCounts = useMemo(() => {
    const map = new Map<string, number>();

    for (const order of orders.filter((entry) => entry.dateView === dateView)) {
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
    () =>
      selectedProducts.reduce(
        (total, product) => total + (bookedCounts.get(product.id) ?? 0),
        0,
      ),
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

    for (const order of orders.filter((order) => order.dateView === 'tomorrow')) {
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

  function addToCart(productId: string) {
    const product = products.find((entry) => entry.id === productId);
    if (!product) return;

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
  }

  function cycleOrderStatus(orderId: string) {
    const next: OrderStatus[] = ['Confirmed', 'In production', 'Out for delivery', 'Delivered'];

    setOrders((current) =>
      current.map((order) => {
        if (order.id !== orderId) return order;

        const currentIndex = Math.max(0, next.indexOf(order.status));
        const nextIndex = currentIndex === next.length - 1 ? currentIndex : currentIndex + 1;

        return { ...order, status: next[nextIndex]! };
      }),
    );
  }

  function adjustTomorrowCapacity(productId: string, delta: number) {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId
          ? { ...product, capacityTomorrow: clamp(product.capacityTomorrow + delta, 0, 9999) }
          : product,
      ),
    );
  }

  const revenue = orders.reduce((total, order) => total + order.amount, 0);
  const overdue = accounts.filter((account) => account.risk !== 'Healthy').length;
  const upcomingSlotFill = `${selectedSlotInfo?.booked ?? 0}/${selectedSlotInfo?.maxOrders ?? 0}`;

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero__copy">
          <div className="eyebrow">Aeden Bakes • production capacity OS</div>
          <h1>Build tomorrow’s bake plan, not just a shopping cart.</h1>
          <p>
            This prototype follows the plan: capacity-based ordering, cutoffs, delivery slots,
            and an admin board that turns confirmed orders into a production sheet.
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
              Admin board
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
              <span>Slots</span>
              <strong>{upcomingSlotFill}</strong>
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
                  <p>Customers see tomorrow’s real capacity, not a fake “available” toggle.</p>
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
                  <h3>Book from tomorrow’s bake plan</h3>
                  <p>Each card shows how much capacity remains after confirmed orders.</p>
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

                  return (
                    <article className="product-card" key={product.id}>
                      <div className="product-card__top">
                        <div>
                          <span className="pill">{product.badge}</span>
                          <h4>{product.name}</h4>
                        </div>
                        <strong>{money.format(product.price)}</strong>
                      </div>

                      <p>{product.note}</p>

                      <div className="meter">
                        <div className="meter__bar" style={{ width: `${Math.min(percent, 100)}%` }} />
                      </div>

                      <div className="product-card__meta">
                        <span>{booked} booked</span>
                        <span>{remaining} left for {dateView}</span>
                      </div>

                      <button type="button" className="action-btn" onClick={() => addToCart(product.id)}>
                        Add to cart {inCart > 0 ? `(${inCart})` : ''}
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
                              {item.quantity} × {money.format(product.price)}
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
                  <h2>Admin production board</h2>
                  <p>Tomorrow’s orders auto-shape the production sheet by item and delivery slot.</p>
                </div>
                <span className="pill">Roles: owner · manager · production · delivery · accounts</span>
              </div>

              <div className="grid grid--products">
                {products.map((product) => {
                  const remaining = product.capacityTomorrow - (bookedCounts.get(product.id) ?? 0);
                  return (
                    <article className="product-card" key={product.id}>
                      <div className="product-card__top">
                        <div>
                          <span className="pill">{product.category}</span>
                          <h4>{product.name}</h4>
                        </div>
                        <strong>{remaining} left</strong>
                      </div>

                      <p>Tomorrow capacity: {product.capacityTomorrow}</p>

                      <div className="admin-controls">
                        <button type="button" onClick={() => adjustTomorrowCapacity(product.id, -10)}>
                          -10
                        </button>
                        <button type="button" onClick={() => adjustTomorrowCapacity(product.id, 10)}>
                          +10
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="two-up">
              <section className="panel">
                <div className="panel__header">
                  <div>
                    <h3>Production sheet</h3>
                    <p>Grouped the way the bakers actually need it: item, total, slot split.</p>
                  </div>
                </div>

                <div className="stack">
                  {productionSheet.map((item) => (
                    <article className="sheet-row" key={item.id}>
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

              <section className="panel">
                <div className="panel__header">
                  <div>
                    <h3>Orders and status flow</h3>
                    <p>Confirm, move into production, dispatch, and close with proof of delivery later.</p>
                  </div>
                </div>

                <div className="stack">
                  {orders.slice(0, 5).map((order) => (
                    <article key={order.id} className="order-card">
                      <div className="order-card__top">
                        <div>
                          <strong>{order.id}</strong>
                          <p>
                            {order.customer} · {order.slot}
                          </p>
                        </div>
                        <span className="pill">{order.status}</span>
                      </div>
                      <div className="order-card__meta">
                        <span>{money.format(order.amount)}</span>
                        <span>{sumItems(order.items)} items</span>
                        <span>{order.paymentMode}</span>
                      </div>
                      <button type="button" className="action-btn action-btn--secondary" onClick={() => cycleOrderStatus(order.id)}>
                        Advance status
                      </button>
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
                    </article>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="panel__header">
                  <div>
                    <h3>What this prototype already proves</h3>
                    <p>The app is structured around tomorrow’s production, not storefront browsing.</p>
                  </div>
                </div>

                <ul className="feature-list">
                  <li>Capacity is tracked per product and per day.</li>
                  <li>Cutoffs and slot caps shape what a customer can book.</li>
                  <li>Admin controls can raise or reduce tomorrow’s production plan.</li>
                  <li>Orders flow into a production sheet, not a generic cart list.</li>
                  <li>The UI leaves room for credit, subscriptions, and ledger automation next.</li>
                </ul>
              </section>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
