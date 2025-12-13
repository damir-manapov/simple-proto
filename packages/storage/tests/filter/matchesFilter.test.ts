import { describe, it, expect } from "vitest";
import { matchesFilter } from "../../src/filter/index.js";
import type { Entry } from "../../src/index.js";

interface TestEntry extends Entry {
  name: string;
  age: number;
  email: string;
}

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

  it("should match exact value with eq", () => {
    expect(matchesFilter(entry, { name: { eq: "John" } })).toBe(true);
  });

  it("should not match different value with eq", () => {
    expect(matchesFilter(entry, { name: { eq: "Jane" } })).toBe(false);
  });

  it("should match with operator", () => {
    expect(matchesFilter(entry, { age: { gte: 18 } })).toBe(true);
  });

  it("should match multiple conditions (AND)", () => {
    expect(
      matchesFilter(entry, {
        name: { eq: "John" },
        age: { gte: 18 },
      })
    ).toBe(true);
  });

  it("should fail if any condition fails", () => {
    expect(
      matchesFilter(entry, {
        name: { eq: "John" },
        age: { lt: 18 },
      })
    ).toBe(false);
  });

  it("should match with string operator", () => {
    expect(matchesFilter(entry, { email: { endsWith: "@example.com" } })).toBe(true);
  });

  describe("and operator", () => {
    it("should match when all conditions are true", () => {
      expect(
        matchesFilter(entry, {
          and: [{ name: { eq: "John" } }, { age: { gte: 18 } }],
        })
      ).toBe(true);
    });

    it("should not match when any condition is false", () => {
      expect(
        matchesFilter(entry, {
          and: [{ name: { eq: "John" } }, { age: { lt: 18 } }],
        })
      ).toBe(false);
    });

    it("should match with empty and array", () => {
      expect(matchesFilter(entry, { and: [] })).toBe(true);
    });

    it("should support nested and", () => {
      expect(
        matchesFilter(entry, {
          and: [
            { and: [{ name: { eq: "John" } }, { age: { eq: 30 } }] },
            { email: { contains: "@" } },
          ],
        })
      ).toBe(true);
    });
  });

  describe("or operator", () => {
    it("should match when any condition is true", () => {
      expect(
        matchesFilter(entry, {
          or: [{ name: { eq: "Jane" } }, { age: { gte: 18 } }],
        })
      ).toBe(true);
    });

    it("should not match when all conditions are false", () => {
      expect(
        matchesFilter(entry, {
          or: [{ name: { eq: "Jane" } }, { age: { lt: 18 } }],
        })
      ).toBe(false);
    });

    it("should not match with empty or array", () => {
      expect(matchesFilter(entry, { or: [] })).toBe(false);
    });

    it("should support nested or", () => {
      expect(
        matchesFilter(entry, {
          or: [
            { or: [{ name: { eq: "Jane" } }, { name: { eq: "Jack" } }] },
            { name: { eq: "John" } },
          ],
        })
      ).toBe(true);
    });
  });

  describe("combined and and or", () => {
    it("should support or inside and", () => {
      expect(
        matchesFilter(entry, {
          and: [{ or: [{ name: { eq: "John" } }, { name: { eq: "Jane" } }] }, { age: { gte: 18 } }],
        })
      ).toBe(true);
    });

    it("should support and inside or", () => {
      expect(
        matchesFilter(entry, {
          or: [
            { and: [{ name: { eq: "Jane" } }, { age: { eq: 25 } }] },
            { and: [{ name: { eq: "John" } }, { age: { eq: 30 } }] },
          ],
        })
      ).toBe(true);
    });

    it("should fail complex nested filter when no match", () => {
      expect(
        matchesFilter(entry, {
          or: [
            { and: [{ name: { eq: "Jane" } }, { age: { eq: 25 } }] },
            { and: [{ name: { eq: "Jack" } }, { age: { eq: 30 } }] },
          ],
        })
      ).toBe(false);
    });
  });
});
