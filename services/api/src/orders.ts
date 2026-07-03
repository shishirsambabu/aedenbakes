// Order-integrity helpers (R4.1). Pure so they can be unit-tested without
// booting the server or crafting a fully valid order fixture.

export type CapacitySlice = {
  productId: string;
  serviceDate: string;
  capacity: number;
  bookedQuantity: number;
};

// Returns a rejection reason if the aggregate quantity for any product on the
// service date would exceed its remaining capacity, or null if every line
// fits. Products without a capacity record are unconstrained.
export function findCapacityViolation(
  lines: Array<{ productId?: string; quantity?: number }>,
  capacities: CapacitySlice[],
  serviceDate: string,
): string | null {
  const required = new Map<string, number>();
  for (const line of lines) {
    if (!line.productId) {
      continue;
    }
    required.set(line.productId, (required.get(line.productId) ?? 0) + (line.quantity ?? 0));
  }
  for (const [productId, quantity] of required) {
    const capacity = capacities.find(
      (entry) => entry.productId === productId && entry.serviceDate === serviceDate,
    );
    if (capacity && capacity.bookedQuantity + quantity > capacity.capacity) {
      const remaining = Math.max(0, capacity.capacity - capacity.bookedQuantity);
      return `Insufficient capacity for ${productId} on ${serviceDate}: only ${remaining} remaining.`;
    }
  }
  return null;
}

export type IdempotencyRecord = {
  customerId: string;
  key: string;
  orderId: string;
  createdAt: string;
};

// Looks up a previously processed order for the same customer + idempotency key
// so a retried/double-tapped request returns the original order instead of
// creating a duplicate.
export function findIdempotentOrderId(
  keys: IdempotencyRecord[],
  customerId: string,
  key: string,
): string | null {
  const match = keys.find((entry) => entry.customerId === customerId && entry.key === key);
  return match ? match.orderId : null;
}
