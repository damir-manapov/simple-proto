/**
 * Main discount entity and related types
 */

import type { DiscountTarget } from "./target.types.js";
import type { DiscountCondition } from "./condition.types.js";
import type { DiscountValue } from "./value.types.js";

/**
 * Discount status
 */
export type DiscountStatus = "active" | "inactive" | "scheduled" | "expired";

/**
 * Stacking behavior
 */
export type StackingBehavior = "stackable" | "exclusive" | "exclusiveByTarget";

/**
 * Main Discount entity
 */
export interface Discount {
  id: string;
  name: string;
  description?: string;
  code?: string; // Optional - if null, discount auto-applies

  // What and how
  target: DiscountTarget;
  value: DiscountValue;

  // When applicable
  conditions: DiscountCondition[];

  // Stacking and priority
  priority: number; // Higher = applied first
  stacking: StackingBehavior;

  // Usage limits
  usageLimit?: number; // Total uses allowed
  usageLimitPerCustomer?: number;
  currentUsage: number;

  // Validity period
  validFrom?: Date;
  validUntil?: Date;

  // Status
  status: DiscountStatus;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a discount
 */
export interface DiscountInput {
  id?: string;
  name: string;
  description?: string;
  code?: string;
  target: DiscountTarget;
  value: DiscountValue;
  conditions?: DiscountCondition[];
  priority?: number;
  stacking?: StackingBehavior;
  usageLimit?: number;
  usageLimitPerCustomer?: number;
  validFrom?: Date;
  validUntil?: Date;
  status?: DiscountStatus;
}

/**
 * Discount usage record
 */
export interface DiscountUsage {
  id: string;
  discountId: string;
  customerId?: string;
  orderId: string;
  amount: number; // Discount amount applied
  usedAt: Date;
}

/**
 * Input for recording usage
 */
export interface DiscountUsageInput {
  discountId: string;
  customerId?: string;
  orderId: string;
  amount: number;
}
