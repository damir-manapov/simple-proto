import { describe, it, expect } from "vitest";
import {
  levenshteinDistance,
  levenshteinSimilarity,
  soundex,
  soundexMatch,
  soundexSimilarity,
  normalizeString,
  getValueByPath,
  setValueByPath,
} from "../src/utils.js";

describe("levenshteinDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshteinDistance("hello", "hello")).toBe(0);
  });

  it("returns the length of the non-empty string when one is empty", () => {
    expect(levenshteinDistance("", "hello")).toBe(5);
    expect(levenshteinDistance("hello", "")).toBe(5);
  });

  it("returns 0 for two empty strings", () => {
    expect(levenshteinDistance("", "")).toBe(0);
  });

  it("calculates correct distance for insertions", () => {
    expect(levenshteinDistance("cat", "cats")).toBe(1);
  });

  it("calculates correct distance for deletions", () => {
    expect(levenshteinDistance("cats", "cat")).toBe(1);
  });

  it("calculates correct distance for substitutions", () => {
    expect(levenshteinDistance("cat", "bat")).toBe(1);
  });

  it("calculates correct distance for complex changes", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
    expect(levenshteinDistance("saturday", "sunday")).toBe(3);
  });

  it("is case-sensitive", () => {
    expect(levenshteinDistance("Hello", "hello")).toBe(1);
  });
});

describe("levenshteinSimilarity", () => {
  it("returns 1 for identical strings", () => {
    expect(levenshteinSimilarity("hello", "hello")).toBe(1);
  });

  it("returns 0 for completely different strings of same length", () => {
    // "abc" vs "xyz" = 3 substitutions, max length 3, similarity = 1 - 3/3 = 0
    expect(levenshteinSimilarity("abc", "xyz")).toBe(0);
  });

  it("returns 1 for two empty strings", () => {
    expect(levenshteinSimilarity("", "")).toBe(1);
  });

  it("returns correct similarity for similar strings", () => {
    // "hello" vs "hallo" = 1 substitution, max length 5, similarity = 1 - 1/5 = 0.8
    expect(levenshteinSimilarity("hello", "hallo")).toBe(0.8);
  });

  it("handles one empty string", () => {
    expect(levenshteinSimilarity("hello", "")).toBe(0);
  });
});

describe("soundex", () => {
  it("returns default code for empty string", () => {
    expect(soundex("")).toBe("0000");
  });

  it("pads with zeros to length 4", () => {
    expect(soundex("a")).toBe("A000");
  });

  it("generates correct soundex for common names", () => {
    // Robert and Rupert should have same soundex
    expect(soundex("Robert")).toBe("R163");
    expect(soundex("Rupert")).toBe("R163");

    // Smith variations
    expect(soundex("Smith")).toBe("S530");
    expect(soundex("Smyth")).toBe("S530");
  });

  it("ignores non-letter characters", () => {
    expect(soundex("O'Brien")).toBe("O165");
  });

  it("is case-insensitive", () => {
    expect(soundex("JOHN")).toBe(soundex("john"));
  });
});

describe("soundexMatch", () => {
  it("returns true for phonetically similar names", () => {
    expect(soundexMatch("Robert", "Rupert")).toBe(true);
    expect(soundexMatch("Smith", "Smyth")).toBe(true);
  });

  it("returns false for phonetically different names", () => {
    expect(soundexMatch("John", "Mary")).toBe(false);
  });

  it("returns true for identical strings", () => {
    expect(soundexMatch("Hello", "Hello")).toBe(true);
  });

  it("returns true for empty strings", () => {
    expect(soundexMatch("", "")).toBe(true);
  });
});

describe("soundexSimilarity", () => {
  it("returns 1 for identical soundex codes", () => {
    expect(soundexSimilarity("Robert", "Rupert")).toBe(1);
  });

  it("returns a value between 0 and 1", () => {
    const similarity = soundexSimilarity("John", "Joan");
    expect(similarity).toBeGreaterThanOrEqual(0);
    expect(similarity).toBeLessThanOrEqual(1);
  });

  it("returns 0 for completely different soundex codes", () => {
    // Testing very different names
    const similarity = soundexSimilarity("Aaa", "Zzz");
    expect(similarity).toBeLessThan(1);
  });
});

describe("normalizeString", () => {
  it("trims whitespace", () => {
    expect(normalizeString("  hello  ")).toBe("hello");
  });

  it("converts to lowercase", () => {
    expect(normalizeString("HELLO")).toBe("hello");
  });

  it("handles empty string", () => {
    expect(normalizeString("")).toBe("");
  });

  it("handles string with only whitespace", () => {
    expect(normalizeString("   ")).toBe("");
  });
});

describe("getValueByPath", () => {
  const testObj = {
    name: "John",
    address: {
      city: "New York",
      zip: "10001",
    },
    tags: ["a", "b", "c"],
  };

  it("gets top-level property", () => {
    expect(getValueByPath(testObj, "name")).toBe("John");
  });

  it("gets nested property", () => {
    expect(getValueByPath(testObj, "address.city")).toBe("New York");
  });

  it("returns undefined for non-existent property", () => {
    expect(getValueByPath(testObj, "nonexistent")).toBeUndefined();
  });

  it("returns undefined for non-existent nested property", () => {
    expect(getValueByPath(testObj, "address.nonexistent")).toBeUndefined();
  });

  it("handles empty object", () => {
    expect(getValueByPath({}, "name")).toBeUndefined();
  });
});

describe("setValueByPath", () => {
  it("sets top-level property", () => {
    const obj: Record<string, unknown> = {};
    setValueByPath(obj, "name", "John");
    expect(obj["name"]).toBe("John");
  });

  it("sets nested property", () => {
    const obj: Record<string, unknown> = {};
    setValueByPath(obj, "address.city", "New York");
    const address = obj["address"] as Record<string, unknown>;
    expect(address["city"]).toBe("New York");
  });

  it("overwrites existing value", () => {
    const obj: Record<string, unknown> = { name: "John" };
    setValueByPath(obj, "name", "Jane");
    expect(obj["name"]).toBe("Jane");
  });

  it("creates intermediate objects", () => {
    const obj: Record<string, unknown> = {};
    setValueByPath(obj, "a.b.c", "value");
    const a = obj["a"] as Record<string, unknown>;
    const b = a["b"] as Record<string, unknown>;
    expect(b["c"]).toBe("value");
  });
});
