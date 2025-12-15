/**
 * Discount evaluator - determines which discounts apply to a cart
 */

import type {
  Discount,
  CartContext,
  AppliedDiscount,
  DiscountResult,
  RejectedCode,
  CalculationOptions,
  StackingStrategy,
} from "@simple-proto/discounts-types";
import { ConditionEvaluator } from "./condition-evaluator.js";
import { DiscountCalculator } from "./discount-calculator.js";

const DEFAULT_OPTIONS: CalculationOptions = {
  stackingStrategy: "byPriority",
};

/**
 * Evaluates and applies discounts to a cart
 */
export class DiscountEvaluator {
  private readonly conditionEvaluator: ConditionEvaluator;
  private readonly calculator: DiscountCalculator;

  constructor() {
    this.conditionEvaluator = new ConditionEvaluator();
    this.calculator = new DiscountCalculator();
  }

  /**
   * Evaluate all discounts and calculate the result
   */
  evaluate(
    discounts: Discount[],
    context: CartContext,
    options: Partial<CalculationOptions> = {}
  ): DiscountResult {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Calculate subtotal
    const subtotal = context.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    // Separate auto-apply and code-based discounts
    const autoApplyDiscounts = discounts.filter((d) => !d.code);
    const codeBasedDiscounts = discounts.filter((d) => d.code);

    // Find applicable discounts
    const applicableAuto = this.filterApplicable(autoApplyDiscounts, context, opts);
    const { applicable: applicableCode, rejected: rejectedCodes } = this.matchCodes(
      codeBasedDiscounts,
      context,
      opts
    );

    const allApplicable = [...applicableAuto, ...applicableCode];

    // Apply stacking strategy
    const appliedDiscounts = this.applyStackingStrategy(allApplicable, context, opts.stackingStrategy);

    // Calculate totals
    let totalDiscount = 0;
    let shippingDiscount = 0;

    for (const applied of appliedDiscounts) {
      if (applied.discount.target.type === "shipping") {
        shippingDiscount += applied.amount;
      } else {
        totalDiscount += applied.amount;
      }
    }

    // Cap discount at subtotal
    totalDiscount = Math.min(totalDiscount, subtotal);

    const finalTotal = Math.max(0, subtotal - totalDiscount + (context.shippingAmount ?? 0) - shippingDiscount);

    return {
      appliedDiscounts,
      totalDiscount,
      subtotal,
      shippingDiscount,
      finalTotal,
      rejectedCodes,
    };
  }

  /**
   * Filter discounts to only applicable ones
   */
  private filterApplicable(
    discounts: Discount[],
    context: CartContext,
    options: CalculationOptions
  ): Discount[] {
    const now = context.evaluationDate ?? new Date();

    return discounts.filter((discount) => {
      // Check status
      if (!options.includeInactive && discount.status !== "active") {
        return false;
      }

      // Check validity period
      if (discount.validFrom && now < discount.validFrom) {
        return false;
      }
      if (discount.validUntil && now > discount.validUntil) {
        return false;
      }

      // Check usage limits
      if (discount.usageLimit !== undefined && discount.currentUsage >= discount.usageLimit) {
        return false;
      }

      // Check conditions
      if (discount.conditions.length > 0) {
        if (!this.conditionEvaluator.evaluateAll(discount.conditions, context)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Match promo codes to discounts
   */
  private matchCodes(
    discounts: Discount[],
    context: CartContext,
    options: CalculationOptions
  ): { applicable: Discount[]; rejected: RejectedCode[] } {
    const applicable: Discount[] = [];
    const rejected: RejectedCode[] = [];

    for (const code of context.appliedCodes) {
      const discount = discounts.find((d) => d.code?.toLowerCase() === code.toLowerCase());

      if (!discount) {
        rejected.push({ code, reason: "Invalid code" });
        continue;
      }

      const now = context.evaluationDate ?? new Date();

      if (!options.includeInactive && discount.status !== "active") {
        rejected.push({ code, reason: "Discount is not active" });
        continue;
      }

      if (discount.validFrom && now < discount.validFrom) {
        rejected.push({ code, reason: "Discount is not yet valid" });
        continue;
      }

      if (discount.validUntil && now > discount.validUntil) {
        rejected.push({ code, reason: "Discount has expired" });
        continue;
      }

      if (discount.usageLimit !== undefined && discount.currentUsage >= discount.usageLimit) {
        rejected.push({ code, reason: "Discount usage limit reached" });
        continue;
      }

      if (discount.conditions.length > 0) {
        if (!this.conditionEvaluator.evaluateAll(discount.conditions, context)) {
          rejected.push({ code, reason: "Conditions not met" });
          continue;
        }
      }

      applicable.push(discount);
    }

    return { applicable, rejected };
  }

  /**
   * Apply stacking strategy to determine final set of discounts
   */
  private applyStackingStrategy(
    discounts: Discount[],
    context: CartContext,
    strategy: StackingStrategy
  ): AppliedDiscount[] {
    if (discounts.length === 0) {
      return [];
    }

    // Sort by priority (higher first)
    const sorted = [...discounts].sort((a, b) => b.priority - a.priority);

    switch (strategy) {
      case "none":
        return this.applyBestOnly(sorted, context);
      case "all":
        return this.applyAll(sorted, context);
      case "byPriority":
        return this.applyByPriority(sorted, context);
      case "bestCombination":
        return this.applyBestCombination(sorted, context);
    }
  }

  /**
   * Apply only the best discount
   */
  private applyBestOnly(discounts: Discount[], context: CartContext): AppliedDiscount[] {
    let bestApplied: AppliedDiscount | null = null;

    for (const discount of discounts) {
      const applied = this.calculator.calculate(discount, context);
      if (applied && (!bestApplied || applied.amount > bestApplied.amount)) {
        bestApplied = applied;
      }
    }

    return bestApplied ? [bestApplied] : [];
  }

  /**
   * Apply all applicable discounts
   */
  private applyAll(discounts: Discount[], context: CartContext): AppliedDiscount[] {
    const results: AppliedDiscount[] = [];

    for (const discount of discounts) {
      const applied = this.calculator.calculate(discount, context);
      if (applied) {
        results.push(applied);
      }
    }

    return results;
  }

  /**
   * Apply discounts by priority, respecting stacking rules
   */
  private applyByPriority(discounts: Discount[], context: CartContext): AppliedDiscount[] {
    const results: AppliedDiscount[] = [];
    const usedTargets = new Set<string>();

    for (const discount of discounts) {
      const targetKey = this.getTargetKey(discount);

      // Check stacking behavior
      if (discount.stacking === "exclusive" && results.length > 0) {
        continue; // Exclusive discount can't be combined
      }

      if (discount.stacking === "exclusiveByTarget" && usedTargets.has(targetKey)) {
        continue; // Only one discount per target
      }

      const applied = this.calculator.calculate(discount, context);
      if (applied) {
        results.push(applied);
        usedTargets.add(targetKey);

        // If this discount is exclusive, stop processing
        if (discount.stacking === "exclusive") {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Find the best combination of discounts (brute force for small sets)
   */
  private applyBestCombination(discounts: Discount[], context: CartContext): AppliedDiscount[] {
    // For performance, fall back to byPriority if too many discounts
    if (discounts.length > 10) {
      return this.applyByPriority(discounts, context);
    }

    // Generate all valid combinations
    const combinations = this.generateValidCombinations(discounts);

    let bestCombination: AppliedDiscount[] = [];
    let bestTotal = 0;

    for (const combo of combinations) {
      const applied: AppliedDiscount[] = [];
      let total = 0;

      for (const discount of combo) {
        const result = this.calculator.calculate(discount, context);
        if (result) {
          applied.push(result);
          total += result.amount;
        }
      }

      if (total > bestTotal) {
        bestTotal = total;
        bestCombination = applied;
      }
    }

    return bestCombination;
  }

  /**
   * Generate all valid discount combinations respecting stacking rules
   */
  private generateValidCombinations(discounts: Discount[]): Discount[][] {
    const combinations: Discount[][] = [[]];

    for (const discount of discounts) {
      const newCombinations: Discount[][] = [];

      for (const combo of combinations) {
        // Keep existing combo
        newCombinations.push(combo);

        // Try adding this discount
        if (this.isValidAddition(combo, discount)) {
          newCombinations.push([...combo, discount]);
        }
      }

      combinations.length = 0;
      combinations.push(...newCombinations);
    }

    return combinations.filter((c) => c.length > 0);
  }

  /**
   * Check if a discount can be added to a combination
   */
  private isValidAddition(combo: Discount[], discount: Discount): boolean {
    // Check exclusive discounts
    if (discount.stacking === "exclusive" && combo.length > 0) {
      return false;
    }

    for (const existing of combo) {
      if (existing.stacking === "exclusive") {
        return false;
      }

      // Check exclusiveByTarget
      if (
        discount.stacking === "exclusiveByTarget" &&
        this.getTargetKey(existing) === this.getTargetKey(discount)
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get a unique key for a discount target
   */
  private getTargetKey(discount: Discount): string {
    const target = discount.target;
    switch (target.type) {
      case "cart":
        return "cart";
      case "shipping":
        return "shipping";
      case "product":
        return `product:${target.productIds.sort().join(",")}`;
      case "category":
        return `category:${target.categoryIds.sort().join(",")}`;
    }
  }
}
