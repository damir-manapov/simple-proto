import { describe, it, expect } from "vitest";
import type { CartContext, DiscountCondition } from "@simple-proto/discounts-types";
import { ConditionEvaluator } from "../src/condition-evaluator.js";

describe("ConditionEvaluator", () => {
  const evaluator = new ConditionEvaluator();

  const baseContext: CartContext = {
    items: [
      { productId: "p1", categoryId: "c1", quantity: 2, unitPrice: 50 },
      { productId: "p2", categoryId: "c2", quantity: 1, unitPrice: 100 },
    ],
    appliedCodes: [],
  };

  describe("minAmount condition", () => {
    it("should pass when cart total meets minimum", () => {
      const condition: DiscountCondition = { type: "minAmount", amount: 100 };
      // Cart total = 2*50 + 1*100 = 200
      expect(evaluator.evaluate(condition, baseContext)).toBe(true);
    });

    it("should fail when cart total is below minimum", () => {
      const condition: DiscountCondition = { type: "minAmount", amount: 300 };
      expect(evaluator.evaluate(condition, baseContext)).toBe(false);
    });
  });

  describe("minQuantity condition", () => {
    it("should pass when total quantity meets minimum", () => {
      const condition: DiscountCondition = { type: "minQuantity", quantity: 3 };
      expect(evaluator.evaluate(condition, baseContext)).toBe(true);
    });

    it("should fail when total quantity is below minimum", () => {
      const condition: DiscountCondition = { type: "minQuantity", quantity: 5 };
      expect(evaluator.evaluate(condition, baseContext)).toBe(false);
    });

    it("should count only specified products", () => {
      const condition: DiscountCondition = { type: "minQuantity", quantity: 2, productIds: ["p1"] };
      expect(evaluator.evaluate(condition, baseContext)).toBe(true);

      const condition2: DiscountCondition = {
        type: "minQuantity",
        quantity: 3,
        productIds: ["p1"],
      };
      expect(evaluator.evaluate(condition2, baseContext)).toBe(false);
    });
  });

  describe("dateRange condition", () => {
    it("should pass when within date range", () => {
      const condition: DiscountCondition = {
        type: "dateRange",
        from: "2020-01-01",
        until: "2030-12-31",
      };
      expect(evaluator.evaluate(condition, baseContext)).toBe(true);
    });

    it("should fail when before start date", () => {
      const condition: DiscountCondition = {
        type: "dateRange",
        from: "2030-01-01",
      };
      expect(evaluator.evaluate(condition, baseContext)).toBe(false);
    });

    it("should fail when after end date", () => {
      const condition: DiscountCondition = {
        type: "dateRange",
        until: "2020-01-01",
      };
      expect(evaluator.evaluate(condition, baseContext)).toBe(false);
    });

    it("should use evaluationDate from context", () => {
      const condition: DiscountCondition = {
        type: "dateRange",
        from: "2024-01-01",
        until: "2024-12-31",
      };
      const context: CartContext = {
        ...baseContext,
        evaluationDate: new Date("2024-06-15"),
      };
      expect(evaluator.evaluate(condition, context)).toBe(true);
    });
  });

  describe("customerGroup condition", () => {
    it("should pass when customer is in allowed group", () => {
      const condition: DiscountCondition = { type: "customerGroup", groups: ["vip", "premium"] };
      const context: CartContext = {
        ...baseContext,
        customer: { group: "vip" },
      };
      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    it("should fail when customer is not in allowed group", () => {
      const condition: DiscountCondition = { type: "customerGroup", groups: ["vip"] };
      const context: CartContext = {
        ...baseContext,
        customer: { group: "regular" },
      };
      expect(evaluator.evaluate(condition, context)).toBe(false);
    });

    it("should fail when no customer context", () => {
      const condition: DiscountCondition = { type: "customerGroup", groups: ["vip"] };
      expect(evaluator.evaluate(condition, baseContext)).toBe(false);
    });
  });

  describe("firstPurchase condition", () => {
    it("should pass for first purchase", () => {
      const condition: DiscountCondition = { type: "firstPurchase" };
      const context: CartContext = {
        ...baseContext,
        customer: { isFirstPurchase: true },
      };
      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    it("should fail for returning customer", () => {
      const condition: DiscountCondition = { type: "firstPurchase" };
      const context: CartContext = {
        ...baseContext,
        customer: { isFirstPurchase: false },
      };
      expect(evaluator.evaluate(condition, context)).toBe(false);
    });
  });

  describe("customerTag condition", () => {
    it("should pass when customer has matching tag", () => {
      const condition: DiscountCondition = { type: "customerTag", tags: ["newsletter", "loyalty"] };
      const context: CartContext = {
        ...baseContext,
        customer: { tags: ["newsletter"] },
      };
      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    it("should fail when customer lacks matching tags", () => {
      const condition: DiscountCondition = { type: "customerTag", tags: ["vip"] };
      const context: CartContext = {
        ...baseContext,
        customer: { tags: ["newsletter"] },
      };
      expect(evaluator.evaluate(condition, context)).toBe(false);
    });
  });

  describe("requiredProducts condition", () => {
    it("should pass when all required products are in cart", () => {
      const condition: DiscountCondition = { type: "requiredProducts", productIds: ["p1", "p2"] };
      expect(evaluator.evaluate(condition, baseContext)).toBe(true);
    });

    it("should fail when missing required product", () => {
      const condition: DiscountCondition = { type: "requiredProducts", productIds: ["p1", "p3"] };
      expect(evaluator.evaluate(condition, baseContext)).toBe(false);
    });

    it("should check minimum quantity", () => {
      const condition: DiscountCondition = {
        type: "requiredProducts",
        productIds: ["p1"],
        minQuantity: 3,
      };
      expect(evaluator.evaluate(condition, baseContext)).toBe(false);

      const condition2: DiscountCondition = {
        type: "requiredProducts",
        productIds: ["p1"],
        minQuantity: 2,
      };
      expect(evaluator.evaluate(condition2, baseContext)).toBe(true);
    });
  });

  describe("logical conditions", () => {
    it("should evaluate AND condition", () => {
      const condition: DiscountCondition = {
        type: "and",
        conditions: [
          { type: "minAmount", amount: 100 },
          { type: "minQuantity", quantity: 2 },
        ],
      };
      expect(evaluator.evaluate(condition, baseContext)).toBe(true);

      const failCondition: DiscountCondition = {
        type: "and",
        conditions: [
          { type: "minAmount", amount: 100 },
          { type: "minQuantity", quantity: 10 },
        ],
      };
      expect(evaluator.evaluate(failCondition, baseContext)).toBe(false);
    });

    it("should evaluate OR condition", () => {
      const condition: DiscountCondition = {
        type: "or",
        conditions: [
          { type: "minAmount", amount: 500 },
          { type: "minQuantity", quantity: 2 },
        ],
      };
      expect(evaluator.evaluate(condition, baseContext)).toBe(true);
    });

    it("should evaluate NOT condition", () => {
      const condition: DiscountCondition = {
        type: "not",
        condition: { type: "minAmount", amount: 500 },
      };
      expect(evaluator.evaluate(condition, baseContext)).toBe(true);
    });
  });

  describe("evaluateAll", () => {
    it("should pass when all conditions are met", () => {
      const conditions: DiscountCondition[] = [
        { type: "minAmount", amount: 100 },
        { type: "minQuantity", quantity: 2 },
      ];
      expect(evaluator.evaluateAll(conditions, baseContext)).toBe(true);
    });

    it("should fail when any condition fails", () => {
      const conditions: DiscountCondition[] = [
        { type: "minAmount", amount: 100 },
        { type: "minQuantity", quantity: 10 },
      ];
      expect(evaluator.evaluateAll(conditions, baseContext)).toBe(false);
    });
  });
});
