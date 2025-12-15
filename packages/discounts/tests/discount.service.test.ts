import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStorage } from "@simple-proto/storage-memory";
import type { CartContext } from "@simple-proto/discounts-types";
import { DiscountService } from "../src/discount.service.js";

describe("DiscountService", () => {
  let storage: MemoryStorage;
  let service: DiscountService;

  beforeEach(() => {
    storage = new MemoryStorage();
    service = new DiscountService(storage);
  });

  describe("CRUD operations", () => {
    it("should create a discount", () => {
      const discount = service.createDiscount({
        name: "10% Off",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 10 },
      });

      expect(discount.id).toBeDefined();
      expect(discount.name).toBe("10% Off");
      expect(discount.status).toBe("active");
      expect(discount.currentUsage).toBe(0);
    });

    it("should get a discount by id", () => {
      const created = service.createDiscount({
        name: "Test",
        target: { type: "cart" },
        value: { type: "fixedAmount", amount: 10 },
      });

      const found = service.getDiscount(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it("should get a discount by code", () => {
      service.createDiscount({
        name: "Promo",
        code: "SAVE10",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 10 },
      });

      const found = service.getDiscountByCode("SAVE10");

      expect(found).not.toBeNull();
      expect(found?.code).toBe("SAVE10");
    });

    it("should list discounts", () => {
      service.createDiscount({
        name: "D1",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 5 },
      });
      service.createDiscount({
        name: "D2",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 10 },
        status: "inactive",
      });

      const all = service.listDiscounts();
      expect(all).toHaveLength(2);

      const active = service.listDiscounts({ status: "active" });
      expect(active).toHaveLength(1);
      expect(active[0]?.name).toBe("D1");
    });

    it("should update a discount", () => {
      const created = service.createDiscount({
        name: "Original",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 10 },
      });

      const updated = service.updateDiscount(created.id, {
        name: "Updated",
        status: "inactive",
      });

      expect(updated?.name).toBe("Updated");
      expect(updated?.status).toBe("inactive");
    });

    it("should delete a discount", () => {
      const created = service.createDiscount({
        name: "ToDelete",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 10 },
      });

      const deleted = service.deleteDiscount(created.id);
      expect(deleted).toBe(true);

      const found = service.getDiscount(created.id);
      expect(found).toBeNull();
    });
  });

  describe("discount calculation", () => {
    it("should calculate discounts for a cart", () => {
      service.createDiscount({
        name: "10% Off",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 10 },
      });

      const context: CartContext = {
        items: [{ productId: "p1", quantity: 2, unitPrice: 50 }],
        appliedCodes: [],
      };

      const result = service.calculateDiscounts(context);

      expect(result.subtotal).toBe(100);
      expect(result.totalDiscount).toBe(10);
      expect(result.finalTotal).toBe(90);
      expect(result.appliedDiscounts).toHaveLength(1);
    });

    it("should apply promo codes", () => {
      service.createDiscount({
        name: "Promo Discount",
        code: "SAVE20",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 20 },
      });

      const context: CartContext = {
        items: [{ productId: "p1", quantity: 1, unitPrice: 100 }],
        appliedCodes: ["SAVE20"],
      };

      const result = service.calculateDiscounts(context);

      expect(result.totalDiscount).toBe(20);
      expect(result.appliedDiscounts).toHaveLength(1);
    });

    it("should reject invalid promo codes", () => {
      const context: CartContext = {
        items: [{ productId: "p1", quantity: 1, unitPrice: 100 }],
        appliedCodes: ["INVALID"],
      };

      const result = service.calculateDiscounts(context);

      expect(result.rejectedCodes).toHaveLength(1);
      expect(result.rejectedCodes[0]?.code).toBe("INVALID");
      expect(result.rejectedCodes[0]?.reason).toBe("Invalid code");
    });

    it("should combine auto-apply and code discounts", () => {
      service.createDiscount({
        name: "Auto 5%",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 5 },
      });
      service.createDiscount({
        name: "Code 10%",
        code: "EXTRA10",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 10 },
      });

      const context: CartContext = {
        items: [{ productId: "p1", quantity: 1, unitPrice: 100 }],
        appliedCodes: ["EXTRA10"],
      };

      const result = service.calculateDiscounts(context);

      expect(result.appliedDiscounts).toHaveLength(2);
      expect(result.totalDiscount).toBe(15); // 5 + 10
    });

    it("should respect stacking strategy", () => {
      service.createDiscount({
        name: "Best Deal",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 20 },
        priority: 10,
      });
      service.createDiscount({
        name: "Regular Deal",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 5 },
        priority: 5,
      });

      const context: CartContext = {
        items: [{ productId: "p1", quantity: 1, unitPrice: 100 }],
        appliedCodes: [],
      };

      const resultNone = service.calculateDiscounts(context, { stackingStrategy: "none" });
      expect(resultNone.appliedDiscounts).toHaveLength(1);
      expect(resultNone.totalDiscount).toBe(20); // Best only

      const resultAll = service.calculateDiscounts(context, { stackingStrategy: "all" });
      expect(resultAll.totalDiscount).toBe(25); // Both
    });
  });

  describe("code validation", () => {
    it("should validate a valid code", () => {
      service.createDiscount({
        name: "Valid",
        code: "VALID",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 10 },
      });

      const result = service.validateCode({ code: "VALID" });

      expect(result.valid).toBe(true);
      expect(result.discount).toBeDefined();
    });

    it("should reject expired code", () => {
      service.createDiscount({
        name: "Expired",
        code: "EXPIRED",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 10 },
        validUntil: new Date("2020-01-01"),
      });

      const result = service.validateCode({ code: "EXPIRED" });

      expect(result.valid).toBe(false);
      expect(result.isExpired).toBe(true);
    });

    it("should reject code at usage limit", () => {
      const discount = service.createDiscount({
        name: "Limited",
        code: "LIMITED",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 10 },
        usageLimit: 1,
      });

      // Record one usage
      service.recordUsage({ discountId: discount.id, orderId: "order1", amount: 10 });

      const result = service.validateCode({ code: "LIMITED" });

      expect(result.valid).toBe(false);
      expect(result.usageLimitReached).toBe(true);
    });
  });

  describe("usage tracking", () => {
    it("should record usage", () => {
      const discount = service.createDiscount({
        name: "Tracked",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 10 },
      });

      const usage = service.recordUsage({
        discountId: discount.id,
        orderId: "order123",
        customerId: "cust1",
        amount: 15,
      });

      expect(usage.discountId).toBe(discount.id);
      expect(usage.orderId).toBe("order123");
      expect(usage.amount).toBe(15);

      // Check usage count incremented
      const updated = service.getDiscount(discount.id);
      expect(updated?.currentUsage).toBe(1);
    });

    it("should track customer usage", () => {
      const discount = service.createDiscount({
        name: "Customer Tracked",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 10 },
      });

      service.recordUsage({ discountId: discount.id, orderId: "o1", customerId: "c1", amount: 10 });
      service.recordUsage({ discountId: discount.id, orderId: "o2", customerId: "c1", amount: 10 });
      service.recordUsage({ discountId: discount.id, orderId: "o3", customerId: "c2", amount: 10 });

      expect(service.getCustomerUsage(discount.id, "c1")).toBe(2);
      expect(service.getCustomerUsage(discount.id, "c2")).toBe(1);
    });

    it("should get discount usage history", () => {
      const discount = service.createDiscount({
        name: "History",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 10 },
      });

      service.recordUsage({ discountId: discount.id, orderId: "o1", amount: 10 });
      service.recordUsage({ discountId: discount.id, orderId: "o2", amount: 20 });

      const history = service.getDiscountUsage(discount.id);

      expect(history).toHaveLength(2);
    });
  });

  describe("complex scenarios", () => {
    it("should handle exclusive discounts", () => {
      service.createDiscount({
        name: "Exclusive Big",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 30 },
        stacking: "exclusive",
        priority: 10,
      });
      service.createDiscount({
        name: "Regular Small",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 5 },
        priority: 5,
      });

      const context: CartContext = {
        items: [{ productId: "p1", quantity: 1, unitPrice: 100 }],
        appliedCodes: [],
      };

      const result = service.calculateDiscounts(context, { stackingStrategy: "byPriority" });

      // Only exclusive should apply
      expect(result.appliedDiscounts).toHaveLength(1);
      expect(result.totalDiscount).toBe(30);
    });

    it("should handle tiered discount with conditions", () => {
      service.createDiscount({
        name: "VIP Tier",
        target: { type: "cart" },
        value: {
          type: "tiered",
          tierBy: "amount",
          tiers: [
            { threshold: 100, percentage: 10 },
            { threshold: 200, percentage: 15 },
          ],
        },
        conditions: [{ type: "customerGroup", groups: ["vip"] }],
      });

      const regularContext: CartContext = {
        items: [{ productId: "p1", quantity: 3, unitPrice: 100 }],
        appliedCodes: [],
        customer: { group: "regular" },
      };

      const vipContext: CartContext = {
        items: [{ productId: "p1", quantity: 3, unitPrice: 100 }],
        appliedCodes: [],
        customer: { group: "vip" },
      };

      const regularResult = service.calculateDiscounts(regularContext);
      expect(regularResult.appliedDiscounts).toHaveLength(0);

      const vipResult = service.calculateDiscounts(vipContext);
      expect(vipResult.appliedDiscounts).toHaveLength(1);
      expect(vipResult.totalDiscount).toBe(45); // 15% of 300
    });

    it("should handle shipping discount", () => {
      service.createDiscount({
        name: "Free Shipping",
        target: { type: "shipping" },
        value: { type: "freeShipping", target: { type: "shipping" } },
        conditions: [{ type: "minAmount", amount: 100 }],
      });

      const context: CartContext = {
        items: [{ productId: "p1", quantity: 2, unitPrice: 60 }],
        appliedCodes: [],
        shippingAmount: 15,
      };

      const result = service.calculateDiscounts(context);

      expect(result.shippingDiscount).toBe(15);
      expect(result.finalTotal).toBe(120); // 120 subtotal + 0 shipping
    });
  });

  describe("Code Generation", () => {
    it("should generate a single code", () => {
      const discount = service.createDiscount({
        name: "Promo Discount",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 10 },
      });

      const code = service.generateCode(discount.id, {
        pattern: "alphanumeric",
        length: 8,
      });

      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[A-Z0-9]+$/);
    });

    it("should generate code with prefix and suffix", () => {
      const discount = service.createDiscount({
        name: "Summer Sale",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 20 },
      });

      const code = service.generateCode(discount.id, {
        pattern: "alphanumeric",
        length: 4,
        prefix: "SUMMER-",
        suffix: "-25",
      });

      expect(code).toMatch(/^SUMMER-[A-Z0-9]{4}-25$/);
    });

    it("should generate batch of unique codes", () => {
      const discount = service.createDiscount({
        name: "Batch Discount",
        target: { type: "cart" },
        value: { type: "fixedAmount", amount: 5 },
      });

      const codes = service.generateCodeBatch(discount.id, 10, {
        pattern: "alphanumeric",
        length: 8,
      });

      expect(codes).toHaveLength(10);
      const uniqueCodes = new Set(codes.map((c) => c.code));
      expect(uniqueCodes.size).toBe(10);
    });

    it("should throw when generating code for non-existent discount", () => {
      expect(() => {
        service.generateCode("non-existent", {
          pattern: "alphanumeric",
          length: 8,
        });
      }).toThrow("not found");
    });

    it("should retrieve generated codes for a discount", () => {
      const discount = service.createDiscount({
        name: "Test",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 10 },
      });

      service.generateCodeBatch(discount.id, 5, {
        pattern: "numeric",
        length: 6,
      });

      const codes = service.getGeneratedCodesForDiscount(discount.id);
      expect(codes).toHaveLength(5);
    });

    it("should redeem a generated code", () => {
      const discount = service.createDiscount({
        name: "Single Use",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 15 },
      });

      const code = service.generateCode(discount.id, {
        pattern: "alphanumeric",
        length: 8,
      });

      const redeemed = service.redeemGeneratedCode(code, "customer-123", "order-456");

      expect(redeemed).not.toBeNull();
      expect(redeemed?.usedBy).toBe("customer-123");
      expect(redeemed?.orderId).toBe("order-456");
      expect(redeemed?.usedAt).toBeDefined();
    });

    it("should not allow double redemption", () => {
      const discount = service.createDiscount({
        name: "Single Use",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 15 },
      });

      const code = service.generateCode(discount.id, {
        pattern: "alphanumeric",
        length: 8,
      });

      service.redeemGeneratedCode(code, "customer-1", "order-1");

      expect(() => {
        service.redeemGeneratedCode(code, "customer-2", "order-2");
      }).toThrow("already been redeemed");
    });
  });

  describe("Code Validation", () => {
    it("should validate a valid discount code", () => {
      service.createDiscount({
        name: "Active Discount",
        code: "VALID10",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 10 },
        status: "active",
      });

      const result = service.validateCode({ code: "VALID10" });

      expect(result.valid).toBe(true);
      expect(result.discount).toBeDefined();
      expect(result.discount?.code).toBe("VALID10");
    });

    it("should reject invalid code", () => {
      const result = service.validateCode({ code: "INVALID" });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Invalid code");
    });

    it("should reject inactive discount", () => {
      service.createDiscount({
        name: "Inactive",
        code: "INACTIVE",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 10 },
        status: "inactive",
      });

      const result = service.validateCode({ code: "INACTIVE" });

      expect(result.valid).toBe(false);
      expect(result.isInactive).toBe(true);
    });

    it("should reject expired discount", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      service.createDiscount({
        name: "Expired",
        code: "EXPIRED",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 10 },
        validUntil: yesterday,
      });

      const result = service.validateCode({ code: "EXPIRED" });

      expect(result.valid).toBe(false);
      expect(result.isExpired).toBe(true);
    });

    it("should reject when usage limit reached", () => {
      const discount = service.createDiscount({
        name: "Limited",
        code: "LIMITED",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 10 },
        usageLimit: 1,
      });

      // Record one usage
      service.recordUsage({
        discountId: discount.id,
        orderId: "order-1",
        amount: 10,
      });

      const result = service.validateCode({ code: "LIMITED" });

      expect(result.valid).toBe(false);
      expect(result.usageLimitReached).toBe(true);
    });

    it("should reject when customer usage limit reached", () => {
      const discount = service.createDiscount({
        name: "Per Customer",
        code: "ONCEPER",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 10 },
        usageLimitPerCustomer: 1,
      });

      service.recordUsage({
        discountId: discount.id,
        customerId: "customer-123",
        orderId: "order-1",
        amount: 10,
      });

      const result = service.validateCode({
        code: "ONCEPER",
        customerId: "customer-123",
      });

      expect(result.valid).toBe(false);
      expect(result.customerUsageLimitReached).toBe(true);
    });

    it("should validate generated code", () => {
      const discount = service.createDiscount({
        name: "Generated",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 20 },
      });

      const code = service.generateCode(discount.id, {
        pattern: "alphanumeric",
        length: 8,
      });

      const result = service.validateCode({ code });

      expect(result.valid).toBe(true);
      expect(result.discount?.id).toBe(discount.id);
    });

    it("should reject already redeemed generated code", () => {
      const discount = service.createDiscount({
        name: "Single Use Generated",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 25 },
      });

      const code = service.generateCode(discount.id, {
        pattern: "alphanumeric",
        length: 8,
      });

      service.redeemGeneratedCode(code, "customer-1", "order-1");

      const result = service.validateCode({ code });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Code has already been redeemed");
    });

    it("should check conditions when context provided", () => {
      service.createDiscount({
        name: "Min Amount",
        code: "MIN100",
        target: { type: "cart" },
        value: { type: "percentage", percentage: 10 },
        conditions: [{ type: "minAmount", amount: 100 }],
      });

      const resultLow = service.validateCode({
        code: "MIN100",
        context: {
          items: [{ productId: "p1", quantity: 1 }],
        },
      });

      expect(resultLow.valid).toBe(false);
      expect(resultLow.conditionsNotMet).toContain("minAmount");

      // Note: minAmount condition needs items with prices in the actual cart
      // For validation, we just check that a code exists and is valid
      const resultOk = service.validateCode({
        code: "MIN100",
      });

      expect(resultOk.valid).toBe(true);
    });
  });
});
