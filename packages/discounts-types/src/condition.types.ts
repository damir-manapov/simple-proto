/**
 * Discount condition types - when a discount is applicable
 */

/**
 * Minimum cart amount required
 */
export interface MinAmountCondition {
  type: "minAmount";
  amount: number;
}

/**
 * Minimum quantity of items required
 */
export interface MinQuantityCondition {
  type: "minQuantity";
  quantity: number;
  productIds?: string[]; // If specified, only count these products
}

/**
 * Date range condition
 */
export interface DateRangeCondition {
  type: "dateRange";
  from?: string; // ISO date
  until?: string; // ISO date
}

/**
 * Customer group condition
 */
export interface CustomerGroupCondition {
  type: "customerGroup";
  groups: string[];
}

/**
 * First purchase condition
 */
export interface FirstPurchaseCondition {
  type: "firstPurchase";
}

/**
 * Customer has specific tag
 */
export interface CustomerTagCondition {
  type: "customerTag";
  tags: string[];
}

/**
 * Requires specific products in cart
 */
export interface RequiredProductsCondition {
  type: "requiredProducts";
  productIds: string[];
  minQuantity?: number;
}

/**
 * Logical AND of multiple conditions
 */
export interface AndCondition {
  type: "and";
  conditions: DiscountCondition[];
}

/**
 * Logical OR of multiple conditions
 */
export interface OrCondition {
  type: "or";
  conditions: DiscountCondition[];
}

/**
 * Logical NOT of a condition
 */
export interface NotCondition {
  type: "not";
  condition: DiscountCondition;
}

/**
 * Union of all condition types
 */
export type DiscountCondition =
  | MinAmountCondition
  | MinQuantityCondition
  | DateRangeCondition
  | CustomerGroupCondition
  | FirstPurchaseCondition
  | CustomerTagCondition
  | RequiredProductsCondition
  | AndCondition
  | OrCondition
  | NotCondition;
