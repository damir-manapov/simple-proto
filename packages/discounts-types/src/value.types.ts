/**
 * Discount value types - how the discount is calculated
 */

import type { DiscountTarget } from "./target.types.js";

/**
 * Percentage discount (e.g., 10% off)
 */
export interface PercentageDiscount {
  type: "percentage";
  percentage: number; // 0-100
  maxAmount?: number; // Optional cap
}

/**
 * Fixed amount discount (e.g., $5 off)
 */
export interface FixedAmountDiscount {
  type: "fixedAmount";
  amount: number;
}

/**
 * Buy X Get Y free
 */
export interface BuyXGetYDiscount {
  type: "buyXGetY";
  buyQuantity: number;
  getQuantity: number;
  getProductIds?: string[]; // If different from buy products
  discountPercentage: number; // Usually 100 for free, but can be partial
}

/**
 * Tiered discount based on amount or quantity
 */
export interface TieredDiscountTier {
  threshold: number;
  percentage?: number;
  fixedAmount?: number;
}

export interface TieredDiscount {
  type: "tiered";
  tiers: TieredDiscountTier[];
  tierBy: "amount" | "quantity";
}

/**
 * Bundle discount - buy specific items together for a price
 */
export interface BundleDiscountItem {
  productId: string;
  quantity: number;
}

export interface BundleDiscount {
  type: "bundle";
  items: BundleDiscountItem[];
  bundlePrice?: number; // Fixed price for the bundle
  bundlePercentage?: number; // Or percentage off bundle
}

/**
 * Free shipping discount
 */
export interface FreeShippingDiscount {
  type: "freeShipping";
  target: DiscountTarget; // Which shipping to make free
}

/**
 * Union of all discount value types
 */
export type DiscountValue =
  | PercentageDiscount
  | FixedAmountDiscount
  | BuyXGetYDiscount
  | TieredDiscount
  | BundleDiscount
  | FreeShippingDiscount;
