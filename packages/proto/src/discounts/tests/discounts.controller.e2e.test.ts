import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { DiscountsModule } from "../discounts.module.js";
import { StorageModule } from "../../storage/storage.module.js";
import { StorageService } from "../../storage/storage.service.js";
import type {
  Discount,
  DiscountResult,
  GeneratedCode,
  CodeValidationResult,
} from "@simple-proto/discounts-types";

describe("Discounts Controllers (e2e)", () => {
  let app: INestApplication;
  let storageService: StorageService;

  const getServer = (): Parameters<typeof request>[0] =>
    app.getHttpServer() as Parameters<typeof request>[0];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [StorageModule, DiscountsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    storageService = moduleFixture.get<StorageService>(StorageService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    storageService.clearAll();
  });

  // Helper function for creating a discount in code-related tests
  const createDiscount = async (params: {
    name: string;
    type: "percentage" | "fixed";
    value: number;
    isActive: boolean;
  }): Promise<Discount> => {
    const response = await request(getServer())
      .post("/discounts")
      .send({
        name: params.name,
        target: { type: "cart" },
        value:
          params.type === "percentage"
            ? { type: "percentage", percentage: params.value }
            : { type: "fixedAmount", amount: params.value },
        conditions: [],
        priority: 1,
        stacking: "all",
        status: params.isActive ? "active" : "inactive",
      })
      .expect(201);
    return response.body as Discount;
  };

  describe("DiscountsController", () => {
    describe("POST /discounts", () => {
      it("should create a discount", async () => {
        const response = await request(getServer())
          .post("/discounts")
          .send({
            name: "10% Off",
            code: "SAVE10",
            target: { type: "cart" },
            value: { type: "percentage", percentage: 10 },
            conditions: [],
            priority: 1,
            stacking: "all",
            status: "active",
          })
          .expect(201);

        const discount = response.body as Discount;
        expect(discount.id).toBeDefined();
        expect(discount.name).toBe("10% Off");
        expect(discount.code).toBe("SAVE10");
        expect(discount.status).toBe("active");
      });
    });

    describe("GET /discounts", () => {
      it("should list all discounts", async () => {
        await request(getServer()).post("/discounts").send({
          name: "Discount 1",
          target: { type: "cart" },
          value: { type: "percentage", percentage: 5 },
          conditions: [],
          priority: 1,
          stacking: "all",
          status: "active",
        });
        await request(getServer()).post("/discounts").send({
          name: "Discount 2",
          target: { type: "cart" },
          value: { type: "fixedAmount", amount: 10 },
          conditions: [],
          priority: 2,
          stacking: "all",
          status: "active",
        });

        const response = await request(getServer()).get("/discounts").expect(200);
        const discounts = response.body as Discount[];
        expect(discounts).toHaveLength(2);
      });

      it("should filter by status", async () => {
        await request(getServer()).post("/discounts").send({
          name: "Active Discount",
          target: { type: "cart" },
          value: { type: "percentage", percentage: 5 },
          conditions: [],
          priority: 1,
          stacking: "all",
          status: "active",
        });
        await request(getServer()).post("/discounts").send({
          name: "Inactive Discount",
          target: { type: "cart" },
          value: { type: "percentage", percentage: 10 },
          conditions: [],
          priority: 2,
          stacking: "all",
          status: "inactive",
        });

        const response = await request(getServer()).get("/discounts?status=active").expect(200);
        const discounts = response.body as Discount[];
        expect(discounts).toHaveLength(1);
        expect(discounts[0]?.name).toBe("Active Discount");
      });
    });

    describe("GET /discounts/:id", () => {
      it("should get discount by id", async () => {
        const createResponse = await request(getServer()).post("/discounts").send({
          name: "Test Discount",
          target: { type: "cart" },
          value: { type: "percentage", percentage: 15 },
          conditions: [],
          priority: 1,
          stacking: "all",
          status: "active",
        });
        const created = createResponse.body as Discount;

        const response = await request(getServer()).get(`/discounts/${created.id}`).expect(200);
        const discount = response.body as Discount;
        expect(discount.id).toBe(created.id);
        expect(discount.name).toBe("Test Discount");
      });

      it("should return 404 for non-existent discount", async () => {
        await request(getServer()).get("/discounts/nonexistent").expect(404);
      });
    });

    describe("GET /discounts/by-code/:code", () => {
      it("should get discount by code", async () => {
        await request(getServer()).post("/discounts").send({
          name: "Promo Discount",
          code: "PROMO2024",
          target: { type: "cart" },
          value: { type: "percentage", percentage: 20 },
          conditions: [],
          priority: 1,
          stacking: "all",
          status: "active",
        });

        const response = await request(getServer()).get("/discounts/by-code/PROMO2024").expect(200);
        const discount = response.body as Discount;
        expect(discount.code).toBe("PROMO2024");
        expect(discount.name).toBe("Promo Discount");
      });

      it("should return 404 for non-existent code", async () => {
        await request(getServer()).get("/discounts/by-code/INVALID").expect(404);
      });
    });

    describe("PUT /discounts/:id", () => {
      it("should update a discount", async () => {
        const createResponse = await request(getServer()).post("/discounts").send({
          name: "Original Name",
          target: { type: "cart" },
          value: { type: "percentage", percentage: 10 },
          conditions: [],
          priority: 1,
          stacking: "all",
          status: "active",
        });
        const created = createResponse.body as Discount;

        const response = await request(getServer())
          .put(`/discounts/${created.id}`)
          .send({ name: "Updated Name" })
          .expect(200);

        const updated = response.body as Discount;
        expect(updated.name).toBe("Updated Name");
      });

      it("should return 404 for non-existent discount", async () => {
        await request(getServer())
          .put("/discounts/nonexistent")
          .send({ name: "Updated" })
          .expect(404);
      });
    });

    describe("DELETE /discounts/:id", () => {
      it("should delete a discount", async () => {
        const createResponse = await request(getServer()).post("/discounts").send({
          name: "To Delete",
          target: { type: "cart" },
          value: { type: "percentage", percentage: 5 },
          conditions: [],
          priority: 1,
          stacking: "all",
          status: "active",
        });
        const created = createResponse.body as Discount;

        await request(getServer()).delete(`/discounts/${created.id}`).expect(200);
        await request(getServer()).get(`/discounts/${created.id}`).expect(404);
      });

      it("should return 404 for non-existent discount", async () => {
        await request(getServer()).delete("/discounts/nonexistent").expect(404);
      });
    });

    describe("POST /discounts/calculate", () => {
      it("should calculate discounts for cart", async () => {
        await request(getServer()).post("/discounts").send({
          name: "10% Off",
          code: "SAVE10",
          target: { type: "cart" },
          value: { type: "percentage", percentage: 10 },
          conditions: [],
          priority: 1,
          stacking: "all",
          status: "active",
        });

        const response = await request(getServer())
          .post("/discounts/calculate")
          .send({
            context: {
              items: [
                { productId: "p1", quantity: 2, unitPrice: 50 },
                { productId: "p2", quantity: 1, unitPrice: 100 },
              ],
              appliedCodes: ["SAVE10"],
            },
          })
          .expect(201);

        const result = response.body as DiscountResult;
        expect(result.appliedDiscounts).toHaveLength(1);
        expect(result.totalDiscount).toBe(20); // 10% of 200
        expect(result.subtotal).toBe(200);
        expect(result.finalTotal).toBe(180);
      });

      it("should respect stacking strategy", async () => {
        await request(getServer()).post("/discounts").send({
          name: "10% Off",
          code: "SAVE10",
          target: { type: "cart" },
          value: { type: "percentage", percentage: 10 },
          conditions: [],
          priority: 1,
          stacking: "all",
          status: "active",
        });
        await request(getServer()).post("/discounts").send({
          name: "$5 Off",
          code: "FLAT5",
          target: { type: "cart" },
          value: { type: "fixedAmount", amount: 5 },
          conditions: [],
          priority: 2,
          stacking: "all",
          status: "active",
        });

        const response = await request(getServer())
          .post("/discounts/calculate")
          .send({
            context: {
              items: [{ productId: "p1", quantity: 1, unitPrice: 100 }],
              appliedCodes: ["SAVE10", "FLAT5"],
            },
            stackingStrategy: "all",
          })
          .expect(201);

        const result = response.body as DiscountResult;
        expect(result.appliedDiscounts).toHaveLength(2);
        expect(result.totalDiscount).toBe(15); // 10 + 5
      });

      it("should reject invalid codes", async () => {
        const response = await request(getServer())
          .post("/discounts/calculate")
          .send({
            context: {
              items: [{ productId: "p1", quantity: 1, unitPrice: 100 }],
              appliedCodes: ["INVALID"],
            },
          })
          .expect(201);

        const result = response.body as DiscountResult;
        expect(result.appliedDiscounts).toHaveLength(0);
        expect(result.rejectedCodes).toHaveLength(1);
        expect(result.rejectedCodes[0]?.code).toBe("INVALID");
      });
    });
  });

  describe("UsageController", () => {
    describe("POST /discount-usages", () => {
      it("should record usage", async () => {
        const createResponse = await request(getServer()).post("/discounts").send({
          name: "Limited Use",
          target: { type: "cart" },
          value: { type: "percentage", percentage: 10 },
          conditions: [],
          priority: 1,
          stacking: "all",
          status: "active",
        });
        const discount = createResponse.body as Discount;

        const response = await request(getServer())
          .post("/discount-usages")
          .send({
            discountId: discount.id,
            orderId: "order-123",
            customerId: "customer-456",
            amount: 10,
          })
          .expect(201);

        expect(response.body).toHaveProperty("id");
        expect(response.body).toHaveProperty("discountId", discount.id);
        expect(response.body).toHaveProperty("orderId", "order-123");
      });
    });

    describe("GET /discount-usages/count", () => {
      it("should get usage count for customer", async () => {
        const createResponse = await request(getServer()).post("/discounts").send({
          name: "Limited Use",
          target: { type: "cart" },
          value: { type: "percentage", percentage: 10 },
          conditions: [],
          priority: 1,
          stacking: "all",
          status: "active",
        });
        const discount = createResponse.body as Discount;

        await request(getServer()).post("/discount-usages").send({
          discountId: discount.id,
          orderId: "order-1",
          customerId: "customer-123",
          amount: 10,
        });
        await request(getServer()).post("/discount-usages").send({
          discountId: discount.id,
          orderId: "order-2",
          customerId: "customer-123",
          amount: 15,
        });

        const response = await request(getServer())
          .get(`/discount-usages/count?discountId=${discount.id}&customerId=customer-123`)
          .expect(200);

        expect(response.body).toEqual({ count: 2 });
      });

      it("should return 400 if parameters missing", async () => {
        await request(getServer()).get("/discount-usages/count").expect(400);
      });
    });
  });

  describe("CodesController", () => {
    describe("POST /discount-codes", () => {
      it("should generate codes for a discount", async () => {
        const discount = await createDiscount({
          name: "Promo Code Discount",
          type: "percentage",
          value: 20,
          isActive: true,
        });

        const response = await request(getServer())
          .post("/discount-codes")
          .send({
            discountId: discount.id,
            count: 5,
            options: {
              pattern: "alphanumeric",
              length: 8,
              prefix: "PROMO-",
              uppercase: true,
            },
          })
          .expect(201);

        const body = response.body as { codes: GeneratedCode[] };
        expect(body.codes).toHaveLength(5);
        const firstCode = body.codes[0];
        expect(firstCode).toBeDefined();
        expect(firstCode?.code).toMatch(/^PROMO-[A-Z0-9]{8}$/);
        expect(firstCode?.discountId).toBe(discount.id);
      });

      it("should return 400 if discount not found", async () => {
        await request(getServer())
          .post("/discount-codes")
          .send({
            discountId: "non-existent-id",
            count: 5,
          })
          .expect(400);
      });
    });

    describe("GET /discount-codes/:code", () => {
      it("should get a generated code", async () => {
        const discount = await createDiscount({
          name: "Get Code Test",
          type: "percentage",
          value: 10,
          isActive: true,
        });

        const generateResponse = await request(getServer())
          .post("/discount-codes")
          .send({
            discountId: discount.id,
            count: 1,
            options: { pattern: "alphanumeric", length: 8 },
          })
          .expect(201);

        const generated = generateResponse.body as { codes: GeneratedCode[] };
        const firstGenerated = generated.codes[0];
        expect(firstGenerated).toBeDefined();
        const codeValue = firstGenerated?.code ?? "";

        const response = await request(getServer())
          .get(`/discount-codes/${codeValue}`)
          .expect(200);

        const codeResult = response.body as GeneratedCode;
        expect(codeResult.code).toBe(codeValue);
        expect(codeResult.discountId).toBe(discount.id);
      });

      it("should return 404 if code not found", async () => {
        await request(getServer())
          .get("/discount-codes/INVALID-CODE")
          .expect(404);
      });
    });

    describe("GET /discount-codes", () => {
      it("should list codes for a discount", async () => {
        const discount = await createDiscount({
          name: "List Codes Test",
          type: "percentage",
          value: 15,
          isActive: true,
        });

        await request(getServer())
          .post("/discount-codes")
          .send({
            discountId: discount.id,
            count: 3,
            options: { pattern: "numeric", length: 6 },
          })
          .expect(201);

        const response = await request(getServer())
          .get(`/discount-codes?discountId=${discount.id}`)
          .expect(200);

        const body = response.body as { codes: GeneratedCode[] };
        expect(body.codes).toHaveLength(3);
        const firstCode = body.codes[0];
        expect(firstCode).toBeDefined();
        expect(firstCode?.discountId).toBe(discount.id);
      });

      it("should return 400 if discountId not provided", async () => {
        await request(getServer())
          .get("/discount-codes")
          .expect(400);
      });
    });

    describe("POST /discount-codes/validate", () => {
      it("should validate a valid code", async () => {
        const discount = await createDiscount({
          name: "Validate Code Test",
          type: "percentage",
          value: 25,
          isActive: true,
        });

        const generateResponse = await request(getServer())
          .post("/discount-codes")
          .send({
            discountId: discount.id,
            count: 1,
            options: { pattern: "alphanumeric", length: 10 },
          })
          .expect(201);

        const generated = generateResponse.body as { codes: GeneratedCode[] };
        const firstGenerated = generated.codes[0];
        expect(firstGenerated).toBeDefined();
        const codeValue = firstGenerated?.code ?? "";

        const response = await request(getServer())
          .post("/discount-codes/validate")
          .send({ code: codeValue })
          .expect(200);

        const result = response.body as CodeValidationResult;
        expect(result.valid).toBe(true);
        expect(result.discount).toBeDefined();
        expect(result.discount?.id).toBe(discount.id);
      });

      it("should return invalid for non-existent code", async () => {
        const response = await request(getServer())
          .post("/discount-codes/validate")
          .send({ code: "INVALID-CODE-123" })
          .expect(200);

        const result = response.body as CodeValidationResult;
        expect(result.valid).toBe(false);
        expect(result.reason).toBe("Invalid code");
      });
    });

    describe("POST /discount-codes/:code/redeem", () => {
      it("should redeem a code", async () => {
        const discount = await createDiscount({
          name: "Redeem Code Test",
          type: "fixed",
          value: 10,
          isActive: true,
        });

        const generateResponse = await request(getServer())
          .post("/discount-codes")
          .send({
            discountId: discount.id,
            count: 1,
            options: { pattern: "alphanumeric", length: 8 },
          })
          .expect(201);

        const generated = generateResponse.body as { codes: GeneratedCode[] };
        const firstGenerated = generated.codes[0];
        expect(firstGenerated).toBeDefined();
        const codeValue = firstGenerated?.code ?? "";

        const response = await request(getServer())
          .post(`/discount-codes/${codeValue}/redeem`)
          .send({ customerId: "customer-456" })
          .expect(200);

        const body = response.body as { success: boolean; code: GeneratedCode };
        expect(body.success).toBe(true);
        expect(body.code.usedBy).toBe("customer-456");
        expect(body.code.usedAt).toBeDefined();
      });

      it("should not allow redeeming same code twice", async () => {
        const discount = await createDiscount({
          name: "Double Redeem Test",
          type: "fixed",
          value: 5,
          isActive: true,
        });

        const generateResponse = await request(getServer())
          .post("/discount-codes")
          .send({
            discountId: discount.id,
            count: 1,
            options: { pattern: "alphanumeric", length: 8 },
          })
          .expect(201);

        const generated = generateResponse.body as { codes: GeneratedCode[] };
        const firstGenerated = generated.codes[0];
        expect(firstGenerated).toBeDefined();
        const codeValue = firstGenerated?.code ?? "";

        await request(getServer())
          .post(`/discount-codes/${codeValue}/redeem`)
          .send({ customerId: "customer-789" })
          .expect(200);

        await request(getServer())
          .post(`/discount-codes/${codeValue}/redeem`)
          .send({ customerId: "customer-other" })
          .expect(400);
      });

      it("should return 404 for non-existent code", async () => {
        await request(getServer())
          .post("/discount-codes/FAKE-CODE/redeem")
          .send({ customerId: "customer-123" })
          .expect(404);
      });
    });
  });
});
