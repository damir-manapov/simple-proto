/**
 * Discount calculator - calculates discount amounts
 */

import type {
  Discount,
  CartContext,
  CartItem,
  AppliedDiscount,
  AppliedToItem,
  DiscountValue,
  PercentageDiscount,
  FixedAmountDiscount,
  BuyXGetYDiscount,
  TieredDiscount,
  BundleDiscount,
} from "@simple-proto/discounts-types";

/**
 * Calculates discount amounts based on cart context
 */
export class DiscountCalculator {
  /**
   * Calculate the discount amount for a given discount and cart
   */
  calculate(discount: Discount, context: CartContext): AppliedDiscount | null {
    const eligibleItems = this.getEligibleItems(discount, context);

    if (eligibleItems.length === 0 && discount.target.type !== "cart" && discount.target.type !== "shipping") {
      return null;
    }

    const result = this.calculateValue(discount.value, eligibleItems, context);

    if (result.amount <= 0) {
      return null;
    }

    const applied: AppliedDiscount = {
      discount,
      amount: result.amount,
    };
    if (result.appliedToItems) {
      applied.appliedToItems = result.appliedToItems;
    }
    return applied;
  }

  /**
   * Get items eligible for this discount based on target
   */
  private getEligibleItems(discount: Discount, context: CartContext): CartItem[] {
    switch (discount.target.type) {
      case "cart":
        return [...context.items];
      case "product":
        return context.items.filter((item) =>
          (discount.target as { type: "product"; productIds: string[] }).productIds.includes(item.productId)
        );
      case "category":
        return context.items.filter(
          (item) =>
            item.categoryId &&
            (discount.target as { type: "category"; categoryIds: string[] }).categoryIds.includes(item.categoryId)
        );
      case "shipping":
        return []; // Shipping discounts don't apply to items
    }
  }

  /**
   * Calculate discount value based on type
   */
  private calculateValue(
    value: DiscountValue,
    items: CartItem[],
    context: CartContext
  ): { amount: number; appliedToItems?: AppliedToItem[] } {
    switch (value.type) {
      case "percentage":
        return this.calculatePercentage(value, items);
      case "fixedAmount":
        return this.calculateFixedAmount(value, items);
      case "buyXGetY":
        return this.calculateBuyXGetY(value, items, context);
      case "tiered":
        return this.calculateTiered(value, items);
      case "bundle":
        return this.calculateBundle(value, context);
      case "freeShipping":
        return { amount: context.shippingAmount ?? 0 };
    }
  }

  private calculatePercentage(
    value: PercentageDiscount,
    items: CartItem[]
  ): { amount: number; appliedToItems: AppliedToItem[] } {
    const appliedToItems: AppliedToItem[] = [];
    let totalDiscount = 0;

    for (const item of items) {
      const itemTotal = item.unitPrice * item.quantity;
      let discount = (itemTotal * value.percentage) / 100;

      if (value.maxAmount !== undefined) {
        const remainingMax = value.maxAmount - totalDiscount;
        discount = Math.min(discount, remainingMax);
      }

      if (discount > 0) {
        appliedToItems.push({
          productId: item.productId,
          quantity: item.quantity,
          discountAmount: discount,
        });
        totalDiscount += discount;
      }
    }

    return { amount: totalDiscount, appliedToItems };
  }

  private calculateFixedAmount(
    value: FixedAmountDiscount,
    items: CartItem[]
  ): { amount: number; appliedToItems: AppliedToItem[] } {
    const itemsTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const amount = Math.min(value.amount, itemsTotal); // Don't exceed items total

    // Distribute proportionally
    const appliedToItems: AppliedToItem[] = items.map((item) => {
      const itemTotal = item.unitPrice * item.quantity;
      const proportion = itemTotal / itemsTotal;
      return {
        productId: item.productId,
        quantity: item.quantity,
        discountAmount: amount * proportion,
      };
    });

    return { amount, appliedToItems };
  }

  private calculateBuyXGetY(
    value: BuyXGetYDiscount,
    items: CartItem[],
    context: CartContext
  ): { amount: number; appliedToItems: AppliedToItem[] } {
    // Find qualifying items
    const buyItems = items;
    const totalBuyQuantity = buyItems.reduce((sum, item) => sum + item.quantity, 0);

    // Calculate how many complete "sets" qualify
    // A set = buyQuantity + getQuantity items (e.g., buy 2 get 1 = 3 items per set)
    const setSize = value.buyQuantity + value.getQuantity;
    const sets = Math.floor(totalBuyQuantity / setSize);
    if (sets === 0) return { amount: 0, appliedToItems: [] };

    const freeQuantity = sets * value.getQuantity;

    // Find items to make free (cheapest first for customer benefit)
    const getItems = value.getProductIds
      ? context.items.filter((i) => value.getProductIds?.includes(i.productId))
      : buyItems;

    const sortedGetItems = [...getItems].sort((a, b) => a.unitPrice - b.unitPrice);

    let remainingFree = freeQuantity;
    const appliedToItems: AppliedToItem[] = [];
    let totalDiscount = 0;

    for (const item of sortedGetItems) {
      if (remainingFree <= 0) break;

      const qtyToDiscount = Math.min(item.quantity, remainingFree);
      const discountAmount = (item.unitPrice * qtyToDiscount * value.discountPercentage) / 100;

      appliedToItems.push({
        productId: item.productId,
        quantity: qtyToDiscount,
        discountAmount,
      });

      totalDiscount += discountAmount;
      remainingFree -= qtyToDiscount;
    }

    return { amount: totalDiscount, appliedToItems };
  }

  private calculateTiered(
    value: TieredDiscount,
    items: CartItem[]
  ): { amount: number; appliedToItems: AppliedToItem[] } {
    // Calculate threshold value
    let thresholdValue: number;
    if (value.tierBy === "amount") {
      thresholdValue = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    } else {
      thresholdValue = items.reduce((sum, item) => sum + item.quantity, 0);
    }

    // Find applicable tier (highest threshold that's met)
    const sortedTiers = [...value.tiers].sort((a, b) => b.threshold - a.threshold);
    const applicableTier = sortedTiers.find((tier) => thresholdValue >= tier.threshold);

    if (!applicableTier) {
      return { amount: 0, appliedToItems: [] };
    }

    const itemsTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    let discount: number;
    if (applicableTier.percentage !== undefined) {
      discount = (itemsTotal * applicableTier.percentage) / 100;
    } else if (applicableTier.fixedAmount !== undefined) {
      discount = Math.min(applicableTier.fixedAmount, itemsTotal);
    } else {
      return { amount: 0, appliedToItems: [] };
    }

    // Distribute proportionally
    const appliedToItems: AppliedToItem[] = items.map((item) => {
      const itemTotal = item.unitPrice * item.quantity;
      const proportion = itemTotal / itemsTotal;
      return {
        productId: item.productId,
        quantity: item.quantity,
        discountAmount: discount * proportion,
      };
    });

    return { amount: discount, appliedToItems };
  }

  private calculateBundle(
    value: BundleDiscount,
    context: CartContext
  ): { amount: number; appliedToItems: AppliedToItem[] } {
    // Check if all bundle items are present in required quantities
    const bundleItems: { item: CartItem; requiredQty: number }[] = [];

    for (const bundleItem of value.items) {
      const cartItem = context.items.find((i) => i.productId === bundleItem.productId);
      if (!cartItem || cartItem.quantity < bundleItem.quantity) {
        return { amount: 0, appliedToItems: [] }; // Bundle not complete
      }
      bundleItems.push({ item: cartItem, requiredQty: bundleItem.quantity });
    }

    // Calculate original price of bundle items
    const originalBundlePrice = bundleItems.reduce(
      (sum, bi) => sum + bi.item.unitPrice * bi.requiredQty,
      0
    );

    let discount: number;
    if (value.bundlePrice !== undefined) {
      discount = originalBundlePrice - value.bundlePrice;
    } else if (value.bundlePercentage !== undefined) {
      discount = (originalBundlePrice * value.bundlePercentage) / 100;
    } else {
      return { amount: 0, appliedToItems: [] };
    }

    discount = Math.max(0, discount); // Ensure non-negative

    // Distribute proportionally among bundle items
    const appliedToItems: AppliedToItem[] = bundleItems.map((bi) => {
      const itemTotal = bi.item.unitPrice * bi.requiredQty;
      const proportion = itemTotal / originalBundlePrice;
      return {
        productId: bi.item.productId,
        quantity: bi.requiredQty,
        discountAmount: discount * proportion,
      };
    });

    return { amount: discount, appliedToItems };
  }
}
