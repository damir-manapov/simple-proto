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

// ==================== Promo Code Types ====================

/**
 * Code generation pattern
 */
export type CodePattern =
  | "alphanumeric" // ABC123
  | "alphabetic" // ABCDEF
  | "numeric" // 123456
  | "custom"; // User-defined pattern

/**
 * Options for generating promo codes
 */
export interface CodeGenerationOptions {
  pattern: CodePattern;
  length: number;
  prefix?: string; // e.g., "SUMMER-"
  suffix?: string; // e.g., "-2025"
  customCharset?: string; // For custom pattern
  excludeChars?: string; // e.g., "0O1I" to avoid confusion
  uppercase?: boolean; // Default true
}

/**
 * Batch code generation request
 */
export interface BatchCodeGenerationInput {
  discountId: string;
  count: number;
  options: CodeGenerationOptions;
}

/**
 * Generated code entity (for batch-generated codes)
 */
export interface GeneratedCode {
  id: string;
  code: string;
  discountId: string;
  usedBy?: string; // customerId if redeemed
  usedAt?: Date;
  orderId?: string;
  createdAt: Date;
}

/**
 * Code validation result
 */
export interface CodeValidationResult {
  valid: boolean;
  discount?: Discount;
  reason?: string;
  // Validation details
  isExpired?: boolean;
  isInactive?: boolean;
  usageLimitReached?: boolean;
  customerUsageLimitReached?: boolean;
  conditionsNotMet?: string[];
}

/**
 * Input for validating a code
 */
export interface CodeValidationInput {
  code: string;
  customerId?: string;
  context?: {
    subtotal?: number;
    items?: { productId: string; categoryId?: string; quantity: number }[];
  };
}
