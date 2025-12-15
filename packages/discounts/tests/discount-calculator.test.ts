import { describe, it, expect } from "vitest";
import type { Discount, CartContext, DiscountTarget, DiscountValue } from "@simple-proto/discounts-types";
import { DiscountCalculator } from "../src/discount-calculator.js";

describe("DiscountCalculator", () => {
  const calculator = new DiscountCalculator();

  const createDiscount = (
    target: DiscountTarget,
    value: DiscountValue,
    overrides: Partial<Discount> = {}
  ): Discount => ({
    id: "d1",
    name: "Test Discount",
    target,
    value,
    conditions: [],
    priority: 0,
    stacking: "stackable",
    currentUsage: 0,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const baseContext: CartContext = {
    items: [
      { productId: "p1", categoryId: "c1", quantity: 2, unitPrice: 50 },
      { productId: "p2", categoryId: "c2", quantity: 1, unitPrice: 100 },
    ],
    appliedCodes: [],
  };

  describe("percentage discount", () => {
    it("should calculate percentage off cart", () => {
      const discount = createDiscount(
        { type: "cart" },
        { type: "percentage", percentage: 10 }
      );

      const result = calculator.calculate(discount, baseContext);

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(20); // 10% of 200
    });

    it("should respect max amount cap", () => {
      const discount = createDiscount(
        { type: "cart" },
        { type: "percentage", percentage: 50, maxAmount: 25 }
      );

      const result = calculator.calculate(discount, baseContext);

      expect(result?.amount).toBe(25); // Capped at 25
    });

    it("should calculate for specific products", () => {
      const discount = createDiscount(
        { type: "product", productIds: ["p1"] },
        { type: "percentage", percentage: 20 }
      );

      const result = calculator.calculate(discount, baseContext);

      // p1 = 2 * 50 = 100, 20% = 20
      expect(result?.amount).toBe(20);
      expect(result?.appliedToItems).toHaveLength(1);
      expect(result?.appliedToItems?.[0]?.productId).toBe("p1");
    });

    it("should calculate for category", () => {
      const discount = createDiscount(
        { type: "category", categoryIds: ["c2"] },
        { type: "percentage", percentage: 10 }
      );

      const result = calculator.calculate(discount, baseContext);

      // c2 items: p2 = 100, 10% = 10
      expect(result?.amount).toBe(10);
    });
  });

  describe("fixed amount discount", () => {
    it("should apply fixed amount to cart", () => {
      const discount = createDiscount(
        { type: "cart" },
        { type: "fixedAmount", amount: 30 }
      );

      const result = calculator.calculate(discount, baseContext);

      expect(result?.amount).toBe(30);
    });

    it("should not exceed item total", () => {
      const discount = createDiscount(
        { type: "product", productIds: ["p1"] },
        { type: "fixedAmount", amount: 150 }
      );

      const result = calculator.calculate(discount, baseContext);

      // p1 total is 100, can't exceed that
      expect(result?.amount).toBe(100);
    });

    it("should distribute proportionally among items", () => {
      const discount = createDiscount(
        { type: "cart" },
        { type: "fixedAmount", amount: 40 }
      );

      const result = calculator.calculate(discount, baseContext);

      expect(result?.amount).toBe(40);
      // p1 = 100 (50%), p2 = 100 (50%)
      expect(result?.appliedToItems).toHaveLength(2);
    });
  });

  describe("buy X get Y discount", () => {
    it("should apply buy 2 get 1 free", () => {
      const context: CartContext = {
        items: [{ productId: "p1", quantity: 3, unitPrice: 30 }],
        appliedCodes: [],
      };

      const discount = createDiscount(
        { type: "product", productIds: ["p1"] },
        { type: "buyXGetY", buyQuantity: 2, getQuantity: 1, discountPercentage: 100 }
      );

      const result = calculator.calculate(discount, context);

      // Buy 2, get 1 free = 30 discount
      expect(result?.amount).toBe(30);
    });

    it("should handle multiple sets", () => {
      const context: CartContext = {
        items: [{ productId: "p1", quantity: 6, unitPrice: 20 }],
        appliedCodes: [],
      };

      const discount = createDiscount(
        { type: "product", productIds: ["p1"] },
        { type: "buyXGetY", buyQuantity: 2, getQuantity: 1, discountPercentage: 100 }
      );

      const result = calculator.calculate(discount, context);

      // 6 items = 2 sets, each set gives 1 free = 2 free items = 40 discount
      expect(result?.amount).toBe(40);
    });

    it("should handle partial discount", () => {
      const context: CartContext = {
        items: [{ productId: "p1", quantity: 3, unitPrice: 30 }],
        appliedCodes: [],
      };

      const discount = createDiscount(
        { type: "product", productIds: ["p1"] },
        { type: "buyXGetY", buyQuantity: 2, getQuantity: 1, discountPercentage: 50 }
      );

      const result = calculator.calculate(discount, context);

      // Buy 2, get 1 at 50% off = 15 discount
      expect(result?.amount).toBe(15);
    });
  });

  describe("tiered discount", () => {
    it("should apply tier based on amount", () => {
      const discount = createDiscount(
        { type: "cart" },
        {
          type: "tiered",
          tierBy: "amount",
          tiers: [
            { threshold: 100, percentage: 5 },
            { threshold: 200, percentage: 10 },
            { threshold: 500, percentage: 20 },
          ],
        }
      );

      // Cart = 200, should get 10%
      const result = calculator.calculate(discount, baseContext);

      expect(result?.amount).toBe(20); // 10% of 200
    });

    it("should apply tier based on quantity", () => {
      const discount = createDiscount(
        { type: "cart" },
        {
          type: "tiered",
          tierBy: "quantity",
          tiers: [
            { threshold: 2, percentage: 5 },
            { threshold: 5, percentage: 10 },
          ],
        }
      );

      // Total quantity = 3, should get 5%
      const result = calculator.calculate(discount, baseContext);

      expect(result?.amount).toBe(10); // 5% of 200
    });

    it("should return nothing if no tier met", () => {
      const discount = createDiscount(
        { type: "cart" },
        {
          type: "tiered",
          tierBy: "amount",
          tiers: [{ threshold: 500, percentage: 10 }],
        }
      );

      const result = calculator.calculate(discount, baseContext);

      expect(result).toBeNull();
    });

    it("should apply fixed amount tier", () => {
      const discount = createDiscount(
        { type: "cart" },
        {
          type: "tiered",
          tierBy: "amount",
          tiers: [{ threshold: 100, fixedAmount: 25 }],
        }
      );

      const result = calculator.calculate(discount, baseContext);

      expect(result?.amount).toBe(25);
    });
  });

  describe("bundle discount", () => {
    it("should apply bundle price", () => {
      const context: CartContext = {
        items: [
          { productId: "p1", quantity: 1, unitPrice: 50 },
          { productId: "p2", quantity: 1, unitPrice: 40 },
        ],
        appliedCodes: [],
      };

      const discount = createDiscount(
        { type: "cart" },
        {
          type: "bundle",
          items: [
            { productId: "p1", quantity: 1 },
            { productId: "p2", quantity: 1 },
          ],
          bundlePrice: 70,
        }
      );

      const result = calculator.calculate(discount, context);

      // Original: 50 + 40 = 90, Bundle: 70, Discount: 20
      expect(result?.amount).toBe(20);
    });

    it("should return null if bundle incomplete", () => {
      const context: CartContext = {
        items: [{ productId: "p1", quantity: 1, unitPrice: 50 }],
        appliedCodes: [],
      };

      const discount = createDiscount(
        { type: "cart" },
        {
          type: "bundle",
          items: [
            { productId: "p1", quantity: 1 },
            { productId: "p2", quantity: 1 },
          ],
          bundlePrice: 70,
        }
      );

      const result = calculator.calculate(discount, context);

      expect(result).toBeNull();
    });

    it("should apply bundle percentage", () => {
      const context: CartContext = {
        items: [
          { productId: "p1", quantity: 1, unitPrice: 50 },
          { productId: "p2", quantity: 1, unitPrice: 50 },
        ],
        appliedCodes: [],
      };

      const discount = createDiscount(
        { type: "cart" },
        {
          type: "bundle",
          items: [
            { productId: "p1", quantity: 1 },
            { productId: "p2", quantity: 1 },
          ],
          bundlePercentage: 20,
        }
      );

      const result = calculator.calculate(discount, context);

      // 20% of 100 = 20
      expect(result?.amount).toBe(20);
    });
  });

  describe("free shipping discount", () => {
    it("should return shipping amount as discount", () => {
      const context: CartContext = {
        ...baseContext,
        shippingAmount: 15,
      };

      const discount = createDiscount(
        { type: "shipping" },
        { type: "freeShipping", target: { type: "shipping" } }
      );

      const result = calculator.calculate(discount, context);

      expect(result?.amount).toBe(15);
    });
  });
});
