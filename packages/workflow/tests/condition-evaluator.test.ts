import { describe, it, expect, beforeEach } from "vitest";
import { ConditionEvaluator } from "../src/condition-evaluator.js";
import { MemoryStorage } from "@simple-proto/storage-memory";
import type { Entry } from "@simple-proto/storage-types";
import type {
  CompareCondition,
  ExistsCondition,
  AndCondition,
  OrCondition,
  NotCondition,
} from "@simple-proto/workflow-types";

// Custom entry types for tests
interface OrderEntry extends Entry {
  customerId?: string;
  status?: string;
  total?: number;
}

describe("ConditionEvaluator", () => {
  let storage: MemoryStorage;
  let evaluator: ConditionEvaluator;

  beforeEach(() => {
    storage = new MemoryStorage();
    evaluator = new ConditionEvaluator(storage);
  });

  describe("compare conditions", () => {
    it("should evaluate equality (==)", async () => {
      const condition: CompareCondition = {
        type: "compare",
        left: { type: "field", path: "value" },
        operator: "==",
        right: { type: "constant", value: 42 },
      };

      expect(await evaluator.evaluate(condition, { value: 42 })).toBe(true);
      expect(await evaluator.evaluate(condition, { value: 43 })).toBe(false);
    });

    it("should evaluate inequality (!=)", async () => {
      const condition: CompareCondition = {
        type: "compare",
        left: { type: "field", path: "value" },
        operator: "!=",
        right: { type: "constant", value: 42 },
      };

      expect(await evaluator.evaluate(condition, { value: 43 })).toBe(true);
      expect(await evaluator.evaluate(condition, { value: 42 })).toBe(false);
    });

    it("should evaluate greater than (>)", async () => {
      const condition: CompareCondition = {
        type: "compare",
        left: { type: "field", path: "value" },
        operator: ">",
        right: { type: "constant", value: 10 },
      };

      expect(await evaluator.evaluate(condition, { value: 15 })).toBe(true);
      expect(await evaluator.evaluate(condition, { value: 10 })).toBe(false);
      expect(await evaluator.evaluate(condition, { value: 5 })).toBe(false);
    });

    it("should evaluate greater than or equal (>=)", async () => {
      const condition: CompareCondition = {
        type: "compare",
        left: { type: "field", path: "value" },
        operator: ">=",
        right: { type: "constant", value: 10 },
      };

      expect(await evaluator.evaluate(condition, { value: 15 })).toBe(true);
      expect(await evaluator.evaluate(condition, { value: 10 })).toBe(true);
      expect(await evaluator.evaluate(condition, { value: 5 })).toBe(false);
    });

    it("should evaluate less than (<)", async () => {
      const condition: CompareCondition = {
        type: "compare",
        left: { type: "field", path: "value" },
        operator: "<",
        right: { type: "constant", value: 10 },
      };

      expect(await evaluator.evaluate(condition, { value: 5 })).toBe(true);
      expect(await evaluator.evaluate(condition, { value: 10 })).toBe(false);
      expect(await evaluator.evaluate(condition, { value: 15 })).toBe(false);
    });

    it("should evaluate less than or equal (<=)", async () => {
      const condition: CompareCondition = {
        type: "compare",
        left: { type: "field", path: "value" },
        operator: "<=",
        right: { type: "constant", value: 10 },
      };

      expect(await evaluator.evaluate(condition, { value: 5 })).toBe(true);
      expect(await evaluator.evaluate(condition, { value: 10 })).toBe(true);
      expect(await evaluator.evaluate(condition, { value: 15 })).toBe(false);
    });

    it("should evaluate contains", async () => {
      const condition: CompareCondition = {
        type: "compare",
        left: { type: "field", path: "text" },
        operator: "contains",
        right: { type: "constant", value: "world" },
      };

      expect(await evaluator.evaluate(condition, { text: "hello world" })).toBe(true);
      expect(await evaluator.evaluate(condition, { text: "hello" })).toBe(false);
    });

    it("should evaluate startsWith", async () => {
      const condition: CompareCondition = {
        type: "compare",
        left: { type: "field", path: "text" },
        operator: "startsWith",
        right: { type: "constant", value: "hello" },
      };

      expect(await evaluator.evaluate(condition, { text: "hello world" })).toBe(true);
      expect(await evaluator.evaluate(condition, { text: "world hello" })).toBe(false);
    });

    it("should evaluate endsWith", async () => {
      const condition: CompareCondition = {
        type: "compare",
        left: { type: "field", path: "text" },
        operator: "endsWith",
        right: { type: "constant", value: "world" },
      };

      expect(await evaluator.evaluate(condition, { text: "hello world" })).toBe(true);
      expect(await evaluator.evaluate(condition, { text: "world hello" })).toBe(false);
    });

    it("should evaluate matches (regex)", async () => {
      const condition: CompareCondition = {
        type: "compare",
        left: { type: "field", path: "email" },
        operator: "matches",
        right: { type: "constant", value: "^[a-z]+@[a-z]+\\.[a-z]+$" },
      };

      expect(await evaluator.evaluate(condition, { email: "test@example.com" })).toBe(true);
      expect(await evaluator.evaluate(condition, { email: "invalid" })).toBe(false);
    });

    it("should compare nested fields", async () => {
      const condition: CompareCondition = {
        type: "compare",
        left: { type: "field", path: "user.profile.age" },
        operator: ">=",
        right: { type: "constant", value: 18 },
      };

      expect(await evaluator.evaluate(condition, { user: { profile: { age: 25 } } })).toBe(true);
      expect(await evaluator.evaluate(condition, { user: { profile: { age: 15 } } })).toBe(false);
    });

    it("should compare field to field", async () => {
      const condition: CompareCondition = {
        type: "compare",
        left: { type: "field", path: "actual" },
        operator: "==",
        right: { type: "field", path: "expected" },
      };

      expect(await evaluator.evaluate(condition, { actual: 42, expected: 42 })).toBe(true);
      expect(await evaluator.evaluate(condition, { actual: 42, expected: 43 })).toBe(false);
    });
  });

  describe("exists conditions", () => {
    it("should return true when entity exists with matching filter", async () => {
      storage.registerCollection({ name: "orders", schema: { type: "object" } });
      const repo = storage.getRepository<OrderEntry>("orders");
      repo.create({ customerId: "c1", status: "active" } as OrderEntry);

      const condition: ExistsCondition = {
        type: "exists",
        collection: "orders",
        filter: {
          field: "customerId",
          operator: "==",
          value: { type: "field", path: "targetCustomerId" },
        },
      };

      expect(await evaluator.evaluate(condition, { targetCustomerId: "c1" })).toBe(true);
      expect(await evaluator.evaluate(condition, { targetCustomerId: "c2" })).toBe(false);
    });

    it("should return false when collection does not exist", async () => {
      const condition: ExistsCondition = {
        type: "exists",
        collection: "nonexistent",
        filter: {
          field: "id",
          operator: "==",
          value: { type: "constant", value: "1" },
        },
      };

      expect(await evaluator.evaluate(condition, {})).toBe(false);
    });
  });

  describe("and conditions", () => {
    it("should return true when all conditions are true", async () => {
      const condition: AndCondition = {
        type: "and",
        conditions: [
          {
            type: "compare",
            left: { type: "field", path: "age" },
            operator: ">=",
            right: { type: "constant", value: 18 },
          },
          {
            type: "compare",
            left: { type: "field", path: "verified" },
            operator: "==",
            right: { type: "constant", value: true },
          },
        ],
      };

      expect(await evaluator.evaluate(condition, { age: 25, verified: true })).toBe(true);
      expect(await evaluator.evaluate(condition, { age: 25, verified: false })).toBe(false);
      expect(await evaluator.evaluate(condition, { age: 15, verified: true })).toBe(false);
    });
  });

  describe("or conditions", () => {
    it("should return true when any condition is true", async () => {
      const condition: OrCondition = {
        type: "or",
        conditions: [
          {
            type: "compare",
            left: { type: "field", path: "role" },
            operator: "==",
            right: { type: "constant", value: "admin" },
          },
          {
            type: "compare",
            left: { type: "field", path: "role" },
            operator: "==",
            right: { type: "constant", value: "moderator" },
          },
        ],
      };

      expect(await evaluator.evaluate(condition, { role: "admin" })).toBe(true);
      expect(await evaluator.evaluate(condition, { role: "moderator" })).toBe(true);
      expect(await evaluator.evaluate(condition, { role: "user" })).toBe(false);
    });
  });

  describe("not conditions", () => {
    it("should negate the inner condition", async () => {
      const condition: NotCondition = {
        type: "not",
        condition: {
          type: "compare",
          left: { type: "field", path: "status" },
          operator: "==",
          right: { type: "constant", value: "deleted" },
        },
      };

      expect(await evaluator.evaluate(condition, { status: "active" })).toBe(true);
      expect(await evaluator.evaluate(condition, { status: "deleted" })).toBe(false);
    });
  });
});
