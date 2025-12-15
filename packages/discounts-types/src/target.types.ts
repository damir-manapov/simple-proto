/**
 * Discount target types - what the discount applies to
 */

/**
 * Applies to entire cart/order
 */
export interface CartTarget {
  type: "cart";
}

/**
 * Applies to specific products
 */
export interface ProductTarget {
  type: "product";
  productIds: string[];
}

/**
 * Applies to products in specific categories
 */
export interface CategoryTarget {
  type: "category";
  categoryIds: string[];
}

/**
 * Applies to shipping cost
 */
export interface ShippingTarget {
  type: "shipping";
}

/**
 * Union of all discount targets
 */
export type DiscountTarget = CartTarget | ProductTarget | CategoryTarget | ShippingTarget;
