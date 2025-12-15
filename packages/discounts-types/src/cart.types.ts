/**
 * Cart and calculation types for discount evaluation
 */

import type { Discount } from "./discount.types.js";

/**
 * Item in the cart
 */
export interface CartItem {
  productId: string;
  categoryId?: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  originalPrice?: number; // Before any discounts
}

/**
 * Customer context for discount evaluation
 */
export interface CustomerContext {
  id?: string;
  group?: string;
  tags?: string[];
  isFirstPurchase?: boolean;
  totalPurchases?: number;
}

/**
 * Cart context for discount evaluation
 */
export interface CartContext {
  items: CartItem[];
  customer?: CustomerContext;
  appliedCodes: string[]; // Promo codes entered by customer
  shippingAmount?: number;
  evaluationDate?: Date; // For testing with specific dates
}

/**
 * A discount that has been evaluated and applied
 */
export interface AppliedDiscount {
  discount: Discount;
  amount: number; // Calculated discount amount
  appliedToItems?: AppliedToItem[]; // Which items got the discount
}

/**
 * Tracks how discount was applied to specific item
 */
export interface AppliedToItem {
  productId: string;
  quantity: number;
  discountAmount: number;
}

/**
 * Result of discount calculation
 */
export interface DiscountResult {
  appliedDiscounts: AppliedDiscount[];
  totalDiscount: number;
  subtotal: number; // Before discounts
  shippingDiscount: number;
  finalTotal: number; // After discounts
  rejectedCodes: RejectedCode[]; // Codes that couldn't be applied
}

/**
 * Rejected promo code with reason
 */
export interface RejectedCode {
  code: string;
  reason: string;
}

/**
 * Stacking strategy for combining discounts
 */
export type StackingStrategy =
  | "none" // Only best discount applies
  | "all" // All applicable discounts stack
  | "byPriority" // Apply in priority order, respect stacking rules
  | "bestCombination"; // Find optimal combination (expensive)

/**
 * Options for discount calculation
 */
export interface CalculationOptions {
  stackingStrategy: StackingStrategy;
  maxDiscountsToApply?: number;
  includeInactive?: boolean; // For preview purposes
}
