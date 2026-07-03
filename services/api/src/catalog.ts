import type { Product } from '@aeden-bakes/shared';

// Returns a rejection reason if any order item is below its product's minimum
// order quantity, or null when every line satisfies its MOQ. Pure so it can be
// unit-tested without booting the server.
export function findMinimumOrderQuantityViolation(
  items: Array<{ productId?: string; quantity?: number }>,
  products: Product[],
): string | null {
  for (const item of items) {
    const product = products.find((entry) => entry.id === item.productId);
    if (product?.minimumOrderQuantity && (item.quantity ?? 0) < product.minimumOrderQuantity) {
      return `${product.name} has a minimum order quantity of ${product.minimumOrderQuantity}.`;
    }
  }
  return null;
}
