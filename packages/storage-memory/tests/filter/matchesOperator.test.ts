import { describe, it, expect } from "vitest";
import { matchesOperator } from "../../src/filter/index.js";

describe("matchesOperator", () => {
  describe("any type operators", () => {
    describe("eq", () => {
      it("should match equal values", () => {
        expect(matchesOperator("John", { eq: "John" })).toBe(true);
      });

      it("should not match different values", () => {
        expect(matchesOperator("John", { eq: "Jane" })).toBe(false);
      });
    });

    describe("ne", () => {
      it("should match different values", () => {
        expect(matchesOperator("John", { ne: "Jane" })).toBe(true);
      });

      it("should not match equal values", () => {
        expect(matchesOperator("John", { ne: "John" })).toBe(false);
      });
    });

    describe("in", () => {
      it("should match value in array", () => {
        expect(matchesOperator("a", { in: ["a", "b", "c"] })).toBe(true);
      });

      it("should not match value not in array", () => {
        expect(matchesOperator("d", { in: ["a", "b", "c"] })).toBe(false);
      });
    });

    describe("nin", () => {
      it("should match value not in array", () => {
        expect(matchesOperator("d", { nin: ["a", "b", "c"] })).toBe(true);
      });

      it("should not match value in array", () => {
        expect(matchesOperator("a", { nin: ["a", "b", "c"] })).toBe(false);
      });
    });
  });

  describe("number operators", () => {
    describe("gt", () => {
      it("should match greater values", () => {
        expect(matchesOperator(10, { gt: 5 })).toBe(true);
      });

      it("should not match equal values", () => {
        expect(matchesOperator(5, { gt: 5 })).toBe(false);
      });

      it("should not match lesser values", () => {
        expect(matchesOperator(3, { gt: 5 })).toBe(false);
      });

      it("should return false for non-number", () => {
        expect(matchesOperator("10", { gt: 5 })).toBe(false);
      });
    });

    describe("gte", () => {
      it("should match greater values", () => {
        expect(matchesOperator(10, { gte: 5 })).toBe(true);
      });

      it("should match equal values", () => {
        expect(matchesOperator(5, { gte: 5 })).toBe(true);
      });

      it("should not match lesser values", () => {
        expect(matchesOperator(3, { gte: 5 })).toBe(false);
      });
    });

    describe("lt", () => {
      it("should match lesser values", () => {
        expect(matchesOperator(3, { lt: 5 })).toBe(true);
      });

      it("should not match equal values", () => {
        expect(matchesOperator(5, { lt: 5 })).toBe(false);
      });

      it("should not match greater values", () => {
        expect(matchesOperator(10, { lt: 5 })).toBe(false);
      });
    });

    describe("lte", () => {
      it("should match lesser values", () => {
        expect(matchesOperator(3, { lte: 5 })).toBe(true);
      });

      it("should match equal values", () => {
        expect(matchesOperator(5, { lte: 5 })).toBe(true);
      });

      it("should not match greater values", () => {
        expect(matchesOperator(10, { lte: 5 })).toBe(false);
      });
    });
  });

  describe("string operators", () => {
    describe("contains", () => {
      it("should match substring", () => {
        expect(matchesOperator("hello world", { contains: "world" })).toBe(true);
      });

      it("should not match missing substring", () => {
        expect(matchesOperator("hello world", { contains: "foo" })).toBe(false);
      });

      it("should return false for non-string", () => {
        expect(matchesOperator(123, { contains: "12" })).toBe(false);
      });
    });

    describe("startsWith", () => {
      it("should match prefix", () => {
        expect(matchesOperator("hello world", { startsWith: "hello" })).toBe(true);
      });

      it("should not match non-prefix", () => {
        expect(matchesOperator("hello world", { startsWith: "world" })).toBe(false);
      });
    });

    describe("endsWith", () => {
      it("should match suffix", () => {
        expect(matchesOperator("hello world", { endsWith: "world" })).toBe(true);
      });

      it("should not match non-suffix", () => {
        expect(matchesOperator("hello world", { endsWith: "hello" })).toBe(false);
      });
    });
  });

  describe("date operators", () => {
    describe("before", () => {
      it("should match date before target", () => {
        const date = new Date("2025-01-15");
        const target = new Date("2025-02-01");
        expect(matchesOperator(date, { before: target })).toBe(true);
      });

      it("should not match date after target", () => {
        const date = new Date("2025-03-01");
        const target = new Date("2025-02-01");
        expect(matchesOperator(date, { before: target })).toBe(false);
      });

      it("should not match equal date", () => {
        const date = new Date("2025-02-01");
        const target = new Date("2025-02-01");
        expect(matchesOperator(date, { before: target })).toBe(false);
      });

      it("should return false for non-date", () => {
        expect(matchesOperator("2025-01-15", { before: new Date("2025-02-01") })).toBe(false);
      });
    });

    describe("after", () => {
      it("should match date after target", () => {
        const date = new Date("2025-03-01");
        const target = new Date("2025-02-01");
        expect(matchesOperator(date, { after: target })).toBe(true);
      });

      it("should not match date before target", () => {
        const date = new Date("2025-01-15");
        const target = new Date("2025-02-01");
        expect(matchesOperator(date, { after: target })).toBe(false);
      });

      it("should not match equal date", () => {
        const date = new Date("2025-02-01");
        const target = new Date("2025-02-01");
        expect(matchesOperator(date, { after: target })).toBe(false);
      });

      it("should return false for non-date", () => {
        expect(matchesOperator("2025-03-01", { after: new Date("2025-02-01") })).toBe(false);
      });
    });

    describe("between", () => {
      it("should match date within range", () => {
        const date = new Date("2025-02-15");
        const start = new Date("2025-02-01");
        const end = new Date("2025-02-28");
        expect(matchesOperator(date, { between: [start, end] })).toBe(true);
      });

      it("should match date at start of range", () => {
        const date = new Date("2025-02-01");
        const start = new Date("2025-02-01");
        const end = new Date("2025-02-28");
        expect(matchesOperator(date, { between: [start, end] })).toBe(true);
      });

      it("should match date at end of range", () => {
        const date = new Date("2025-02-28");
        const start = new Date("2025-02-01");
        const end = new Date("2025-02-28");
        expect(matchesOperator(date, { between: [start, end] })).toBe(true);
      });

      it("should not match date before range", () => {
        const date = new Date("2025-01-15");
        const start = new Date("2025-02-01");
        const end = new Date("2025-02-28");
        expect(matchesOperator(date, { between: [start, end] })).toBe(false);
      });

      it("should not match date after range", () => {
        const date = new Date("2025-03-15");
        const start = new Date("2025-02-01");
        const end = new Date("2025-02-28");
        expect(matchesOperator(date, { between: [start, end] })).toBe(false);
      });

      it("should return false for non-date", () => {
        expect(
          matchesOperator("2025-02-15", {
            between: [new Date("2025-02-01"), new Date("2025-02-28")],
          })
        ).toBe(false);
      });
    });
  });
});
