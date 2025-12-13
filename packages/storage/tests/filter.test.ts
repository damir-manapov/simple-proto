import { describe, it, expect } from "vitest";
import { isFilterOperator, matchesOperator, matchesFilter } from "../src/filter/index.js";
import type { Entry } from "../src/index.js";

interface TestEntry extends Entry {
  name: string;
  age: number;
  email: string;
}

describe("Filter", () => {
  describe("isFilterOperator", () => {
    it("should return true for $eq operator", () => {
      expect(isFilterOperator({ $eq: "value" })).toBe(true);
    });

    it("should return true for $ne operator", () => {
      expect(isFilterOperator({ $ne: "value" })).toBe(true);
    });

    it("should return true for $gt operator", () => {
      expect(isFilterOperator({ $gt: 10 })).toBe(true);
    });

    it("should return true for $gte operator", () => {
      expect(isFilterOperator({ $gte: 10 })).toBe(true);
    });

    it("should return true for $lt operator", () => {
      expect(isFilterOperator({ $lt: 10 })).toBe(true);
    });

    it("should return true for $lte operator", () => {
      expect(isFilterOperator({ $lte: 10 })).toBe(true);
    });

    it("should return true for $in operator", () => {
      expect(isFilterOperator({ $in: [1, 2, 3] })).toBe(true);
    });

    it("should return true for $nin operator", () => {
      expect(isFilterOperator({ $nin: [1, 2, 3] })).toBe(true);
    });

    it("should return true for $contains operator", () => {
      expect(isFilterOperator({ $contains: "test" })).toBe(true);
    });

    it("should return true for $startsWith operator", () => {
      expect(isFilterOperator({ $startsWith: "test" })).toBe(true);
    });

    it("should return true for $endsWith operator", () => {
      expect(isFilterOperator({ $endsWith: "test" })).toBe(true);
    });

    it("should return false for plain value", () => {
      expect(isFilterOperator("value")).toBe(false);
    });

    it("should return false for null", () => {
      expect(isFilterOperator(null)).toBe(false);
    });

    it("should return false for regular object", () => {
      expect(isFilterOperator({ name: "John" })).toBe(false);
    });

    it("should return false for object with multiple keys", () => {
      expect(isFilterOperator({ $eq: "a", $ne: "b" })).toBe(false);
    });
  });

  describe("matchesOperator", () => {
    describe("$eq", () => {
      it("should match equal values", () => {
        expect(matchesOperator("John", { $eq: "John" })).toBe(true);
      });

      it("should not match different values", () => {
        expect(matchesOperator("John", { $eq: "Jane" })).toBe(false);
      });
    });

    describe("$ne", () => {
      it("should match different values", () => {
        expect(matchesOperator("John", { $ne: "Jane" })).toBe(true);
      });

      it("should not match equal values", () => {
        expect(matchesOperator("John", { $ne: "John" })).toBe(false);
      });
    });

    describe("$gt", () => {
      it("should match greater values", () => {
        expect(matchesOperator(10, { $gt: 5 })).toBe(true);
      });

      it("should not match equal values", () => {
        expect(matchesOperator(5, { $gt: 5 })).toBe(false);
      });

      it("should not match lesser values", () => {
        expect(matchesOperator(3, { $gt: 5 })).toBe(false);
      });

      it("should return false for non-number", () => {
        expect(matchesOperator("10", { $gt: 5 })).toBe(false);
      });
    });

    describe("$gte", () => {
      it("should match greater values", () => {
        expect(matchesOperator(10, { $gte: 5 })).toBe(true);
      });

      it("should match equal values", () => {
        expect(matchesOperator(5, { $gte: 5 })).toBe(true);
      });

      it("should not match lesser values", () => {
        expect(matchesOperator(3, { $gte: 5 })).toBe(false);
      });
    });

    describe("$lt", () => {
      it("should match lesser values", () => {
        expect(matchesOperator(3, { $lt: 5 })).toBe(true);
      });

      it("should not match equal values", () => {
        expect(matchesOperator(5, { $lt: 5 })).toBe(false);
      });

      it("should not match greater values", () => {
        expect(matchesOperator(10, { $lt: 5 })).toBe(false);
      });
    });

    describe("$lte", () => {
      it("should match lesser values", () => {
        expect(matchesOperator(3, { $lte: 5 })).toBe(true);
      });

      it("should match equal values", () => {
        expect(matchesOperator(5, { $lte: 5 })).toBe(true);
      });

      it("should not match greater values", () => {
        expect(matchesOperator(10, { $lte: 5 })).toBe(false);
      });
    });

    describe("$in", () => {
      it("should match value in array", () => {
        expect(matchesOperator("a", { $in: ["a", "b", "c"] })).toBe(true);
      });

      it("should not match value not in array", () => {
        expect(matchesOperator("d", { $in: ["a", "b", "c"] })).toBe(false);
      });
    });

    describe("$nin", () => {
      it("should match value not in array", () => {
        expect(matchesOperator("d", { $nin: ["a", "b", "c"] })).toBe(true);
      });

      it("should not match value in array", () => {
        expect(matchesOperator("a", { $nin: ["a", "b", "c"] })).toBe(false);
      });
    });

    describe("$contains", () => {
      it("should match substring", () => {
        expect(matchesOperator("hello world", { $contains: "world" })).toBe(true);
      });

      it("should not match missing substring", () => {
        expect(matchesOperator("hello world", { $contains: "foo" })).toBe(false);
      });

      it("should return false for non-string", () => {
        expect(matchesOperator(123, { $contains: "12" })).toBe(false);
      });
    });

    describe("$startsWith", () => {
      it("should match prefix", () => {
        expect(matchesOperator("hello world", { $startsWith: "hello" })).toBe(true);
      });

      it("should not match non-prefix", () => {
        expect(matchesOperator("hello world", { $startsWith: "world" })).toBe(false);
      });
    });

    describe("$endsWith", () => {
      it("should match suffix", () => {
        expect(matchesOperator("hello world", { $endsWith: "world" })).toBe(true);
      });

      it("should not match non-suffix", () => {
        expect(matchesOperator("hello world", { $endsWith: "hello" })).toBe(false);
      });
    });
  });

  describe("matchesFilter", () => {
    const entry: TestEntry = {
      id: "1",
      name: "John",
      age: 30,
      email: "john@example.com",
    };

    it("should match with empty filter", () => {
      expect(matchesFilter(entry, {})).toBe(true);
    });

    it("should match exact value", () => {
      expect(matchesFilter(entry, { name: "John" })).toBe(true);
    });

    it("should not match different value", () => {
      expect(matchesFilter(entry, { name: "Jane" })).toBe(false);
    });

    it("should match with operator", () => {
      expect(matchesFilter(entry, { age: { $gte: 18 } })).toBe(true);
    });

    it("should match multiple conditions (AND)", () => {
      expect(
        matchesFilter(entry, {
          name: "John",
          age: { $gte: 18 },
        })
      ).toBe(true);
    });

    it("should fail if any condition fails", () => {
      expect(
        matchesFilter(entry, {
          name: "John",
          age: { $lt: 18 },
        })
      ).toBe(false);
    });

    it("should match with string operator", () => {
      expect(matchesFilter(entry, { email: { $endsWith: "@example.com" } })).toBe(true);
    });

    describe("$and operator", () => {
      it("should match when all conditions are true", () => {
        expect(
          matchesFilter(entry, {
            $and: [{ name: "John" }, { age: { $gte: 18 } }],
          })
        ).toBe(true);
      });

      it("should not match when any condition is false", () => {
        expect(
          matchesFilter(entry, {
            $and: [{ name: "John" }, { age: { $lt: 18 } }],
          })
        ).toBe(false);
      });

      it("should match with empty $and array", () => {
        expect(matchesFilter(entry, { $and: [] })).toBe(true);
      });

      it("should support nested $and", () => {
        expect(
          matchesFilter(entry, {
            $and: [{ $and: [{ name: "John" }, { age: 30 }] }, { email: { $contains: "@" } }],
          })
        ).toBe(true);
      });
    });

    describe("$or operator", () => {
      it("should match when any condition is true", () => {
        expect(
          matchesFilter(entry, {
            $or: [{ name: "Jane" }, { age: { $gte: 18 } }],
          })
        ).toBe(true);
      });

      it("should not match when all conditions are false", () => {
        expect(
          matchesFilter(entry, {
            $or: [{ name: "Jane" }, { age: { $lt: 18 } }],
          })
        ).toBe(false);
      });

      it("should not match with empty $or array", () => {
        expect(matchesFilter(entry, { $or: [] })).toBe(false);
      });

      it("should support nested $or", () => {
        expect(
          matchesFilter(entry, {
            $or: [{ $or: [{ name: "Jane" }, { name: "Jack" }] }, { name: "John" }],
          })
        ).toBe(true);
      });
    });

    describe("combined $and and $or", () => {
      it("should support $or inside $and", () => {
        expect(
          matchesFilter(entry, {
            $and: [{ $or: [{ name: "John" }, { name: "Jane" }] }, { age: { $gte: 18 } }],
          })
        ).toBe(true);
      });

      it("should support $and inside $or", () => {
        expect(
          matchesFilter(entry, {
            $or: [
              { $and: [{ name: "Jane" }, { age: 25 }] },
              { $and: [{ name: "John" }, { age: 30 }] },
            ],
          })
        ).toBe(true);
      });

      it("should fail complex nested filter when no match", () => {
        expect(
          matchesFilter(entry, {
            $or: [
              { $and: [{ name: "Jane" }, { age: 25 }] },
              { $and: [{ name: "Jack" }, { age: 30 }] },
            ],
          })
        ).toBe(false);
      });
    });
  });
});
