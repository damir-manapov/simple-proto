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

    it("should return true for $before operator", () => {
      expect(isFilterOperator({ $before: new Date() })).toBe(true);
    });

    it("should return true for $after operator", () => {
      expect(isFilterOperator({ $after: new Date() })).toBe(true);
    });

    it("should return true for $between operator", () => {
      expect(isFilterOperator({ $between: [new Date(), new Date()] })).toBe(true);
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

    describe("$before", () => {
      it("should match date before target", () => {
        const date = new Date("2025-01-15");
        const target = new Date("2025-02-01");
        expect(matchesOperator(date, { $before: target })).toBe(true);
      });

      it("should not match date after target", () => {
        const date = new Date("2025-03-01");
        const target = new Date("2025-02-01");
        expect(matchesOperator(date, { $before: target })).toBe(false);
      });

      it("should not match equal date", () => {
        const date = new Date("2025-02-01");
        const target = new Date("2025-02-01");
        expect(matchesOperator(date, { $before: target })).toBe(false);
      });

      it("should return false for non-date", () => {
        expect(matchesOperator("2025-01-15", { $before: new Date("2025-02-01") })).toBe(false);
      });
    });

    describe("$after", () => {
      it("should match date after target", () => {
        const date = new Date("2025-03-01");
        const target = new Date("2025-02-01");
        expect(matchesOperator(date, { $after: target })).toBe(true);
      });

      it("should not match date before target", () => {
        const date = new Date("2025-01-15");
        const target = new Date("2025-02-01");
        expect(matchesOperator(date, { $after: target })).toBe(false);
      });

      it("should not match equal date", () => {
        const date = new Date("2025-02-01");
        const target = new Date("2025-02-01");
        expect(matchesOperator(date, { $after: target })).toBe(false);
      });

      it("should return false for non-date", () => {
        expect(matchesOperator("2025-03-01", { $after: new Date("2025-02-01") })).toBe(false);
      });
    });

    describe("$between", () => {
      it("should match date within range", () => {
        const date = new Date("2025-02-15");
        const start = new Date("2025-02-01");
        const end = new Date("2025-02-28");
        expect(matchesOperator(date, { $between: [start, end] })).toBe(true);
      });

      it("should match date at start of range", () => {
        const date = new Date("2025-02-01");
        const start = new Date("2025-02-01");
        const end = new Date("2025-02-28");
        expect(matchesOperator(date, { $between: [start, end] })).toBe(true);
      });

      it("should match date at end of range", () => {
        const date = new Date("2025-02-28");
        const start = new Date("2025-02-01");
        const end = new Date("2025-02-28");
        expect(matchesOperator(date, { $between: [start, end] })).toBe(true);
      });

      it("should not match date before range", () => {
        const date = new Date("2025-01-15");
        const start = new Date("2025-02-01");
        const end = new Date("2025-02-28");
        expect(matchesOperator(date, { $between: [start, end] })).toBe(false);
      });

      it("should not match date after range", () => {
        const date = new Date("2025-03-15");
        const start = new Date("2025-02-01");
        const end = new Date("2025-02-28");
        expect(matchesOperator(date, { $between: [start, end] })).toBe(false);
      });

      it("should return false for non-date", () => {
        expect(
          matchesOperator("2025-02-15", {
            $between: [new Date("2025-02-01"), new Date("2025-02-28")],
          })
        ).toBe(false);
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

    it("should match exact value with $eq", () => {
      expect(matchesFilter(entry, { name: { $eq: "John" } })).toBe(true);
    });

    it("should not match different value with $eq", () => {
      expect(matchesFilter(entry, { name: { $eq: "Jane" } })).toBe(false);
    });

    it("should match with operator", () => {
      expect(matchesFilter(entry, { age: { $gte: 18 } })).toBe(true);
    });

    it("should match multiple conditions (AND)", () => {
      expect(
        matchesFilter(entry, {
          name: { $eq: "John" },
          age: { $gte: 18 },
        })
      ).toBe(true);
    });

    it("should fail if any condition fails", () => {
      expect(
        matchesFilter(entry, {
          name: { $eq: "John" },
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
            $and: [{ name: { $eq: "John" } }, { age: { $gte: 18 } }],
          })
        ).toBe(true);
      });

      it("should not match when any condition is false", () => {
        expect(
          matchesFilter(entry, {
            $and: [{ name: { $eq: "John" } }, { age: { $lt: 18 } }],
          })
        ).toBe(false);
      });

      it("should match with empty $and array", () => {
        expect(matchesFilter(entry, { $and: [] })).toBe(true);
      });

      it("should support nested $and", () => {
        expect(
          matchesFilter(entry, {
            $and: [
              { $and: [{ name: { $eq: "John" } }, { age: { $eq: 30 } }] },
              { email: { $contains: "@" } },
            ],
          })
        ).toBe(true);
      });
    });

    describe("$or operator", () => {
      it("should match when any condition is true", () => {
        expect(
          matchesFilter(entry, {
            $or: [{ name: { $eq: "Jane" } }, { age: { $gte: 18 } }],
          })
        ).toBe(true);
      });

      it("should not match when all conditions are false", () => {
        expect(
          matchesFilter(entry, {
            $or: [{ name: { $eq: "Jane" } }, { age: { $lt: 18 } }],
          })
        ).toBe(false);
      });

      it("should not match with empty $or array", () => {
        expect(matchesFilter(entry, { $or: [] })).toBe(false);
      });

      it("should support nested $or", () => {
        expect(
          matchesFilter(entry, {
            $or: [
              { $or: [{ name: { $eq: "Jane" } }, { name: { $eq: "Jack" } }] },
              { name: { $eq: "John" } },
            ],
          })
        ).toBe(true);
      });
    });

    describe("combined $and and $or", () => {
      it("should support $or inside $and", () => {
        expect(
          matchesFilter(entry, {
            $and: [
              { $or: [{ name: { $eq: "John" } }, { name: { $eq: "Jane" } }] },
              { age: { $gte: 18 } },
            ],
          })
        ).toBe(true);
      });

      it("should support $and inside $or", () => {
        expect(
          matchesFilter(entry, {
            $or: [
              { $and: [{ name: { $eq: "Jane" } }, { age: { $eq: 25 } }] },
              { $and: [{ name: { $eq: "John" } }, { age: { $eq: 30 } }] },
            ],
          })
        ).toBe(true);
      });

      it("should fail complex nested filter when no match", () => {
        expect(
          matchesFilter(entry, {
            $or: [
              { $and: [{ name: { $eq: "Jane" } }, { age: { $eq: 25 } }] },
              { $and: [{ name: { $eq: "Jack" } }, { age: { $eq: 30 } }] },
            ],
          })
        ).toBe(false);
      });
    });
  });
});
