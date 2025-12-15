/**
 * Condition evaluator - determines if discount conditions are met
 */

import type {
  DiscountCondition,
  CartContext,
  MinAmountCondition,
  MinQuantityCondition,
  DateRangeCondition,
  CustomerGroupCondition,
  FirstPurchaseCondition,
  CustomerTagCondition,
  RequiredProductsCondition,
  AndCondition,
  OrCondition,
  NotCondition,
} from "@simple-proto/discounts-types";

/**
 * Evaluates discount conditions against cart context
 */
export class ConditionEvaluator {
  /**
   * Evaluate a condition against the cart context
   */
  evaluate(condition: DiscountCondition, context: CartContext): boolean {
    switch (condition.type) {
      case "minAmount":
        return this.evaluateMinAmount(condition, context);
      case "minQuantity":
        return this.evaluateMinQuantity(condition, context);
      case "dateRange":
        return this.evaluateDateRange(condition, context);
      case "customerGroup":
        return this.evaluateCustomerGroup(condition, context);
      case "firstPurchase":
        return this.evaluateFirstPurchase(condition, context);
      case "customerTag":
        return this.evaluateCustomerTag(condition, context);
      case "requiredProducts":
        return this.evaluateRequiredProducts(condition, context);
      case "and":
        return this.evaluateAnd(condition, context);
      case "or":
        return this.evaluateOr(condition, context);
      case "not":
        return this.evaluateNot(condition, context);
    }
  }

  /**
   * Evaluate multiple conditions (all must pass)
   */
  evaluateAll(conditions: DiscountCondition[], context: CartContext): boolean {
    return conditions.every((c) => this.evaluate(c, context));
  }

  private evaluateMinAmount(condition: MinAmountCondition, context: CartContext): boolean {
    const cartTotal = this.calculateCartTotal(context);
    return cartTotal >= condition.amount;
  }

  private evaluateMinQuantity(condition: MinQuantityCondition, context: CartContext): boolean {
    let quantity = 0;

    for (const item of context.items) {
      if (condition.productIds && condition.productIds.length > 0) {
        if (condition.productIds.includes(item.productId)) {
          quantity += item.quantity;
        }
      } else {
        quantity += item.quantity;
      }
    }

    return quantity >= condition.quantity;
  }

  private evaluateDateRange(condition: DateRangeCondition, context: CartContext): boolean {
    const now = context.evaluationDate ?? new Date();

    if (condition.from) {
      const from = new Date(condition.from);
      if (now < from) return false;
    }

    if (condition.until) {
      const until = new Date(condition.until);
      if (now > until) return false;
    }

    return true;
  }

  private evaluateCustomerGroup(condition: CustomerGroupCondition, context: CartContext): boolean {
    if (!context.customer?.group) return false;
    return condition.groups.includes(context.customer.group);
  }

  private evaluateFirstPurchase(_condition: FirstPurchaseCondition, context: CartContext): boolean {
    return context.customer?.isFirstPurchase === true;
  }

  private evaluateCustomerTag(condition: CustomerTagCondition, context: CartContext): boolean {
    if (!context.customer?.tags || context.customer.tags.length === 0) return false;
    return condition.tags.some((tag) => context.customer?.tags?.includes(tag));
  }

  private evaluateRequiredProducts(condition: RequiredProductsCondition, context: CartContext): boolean {
    for (const requiredId of condition.productIds) {
      const item = context.items.find((i) => i.productId === requiredId);
      if (!item) return false;
      if (condition.minQuantity && item.quantity < condition.minQuantity) return false;
    }
    return true;
  }

  private evaluateAnd(condition: AndCondition, context: CartContext): boolean {
    return condition.conditions.every((c) => this.evaluate(c, context));
  }

  private evaluateOr(condition: OrCondition, context: CartContext): boolean {
    return condition.conditions.some((c) => this.evaluate(c, context));
  }

  private evaluateNot(condition: NotCondition, context: CartContext): boolean {
    return !this.evaluate(condition.condition, context);
  }

  private calculateCartTotal(context: CartContext): number {
    return context.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }
}
