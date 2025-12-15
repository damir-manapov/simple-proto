import { describe, it, expect } from "vitest";
import { CodeGenerator } from "../src/code-generator.js";

describe("CodeGenerator", () => {
  const generator = new CodeGenerator();

  describe("generate", () => {
    it("should generate alphanumeric code of specified length", () => {
      const code = generator.generate({
        pattern: "alphanumeric",
        length: 8,
      });

      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[A-Z0-9]+$/);
    });

    it("should generate alphabetic code", () => {
      const code = generator.generate({
        pattern: "alphabetic",
        length: 6,
      });

      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[A-Z]+$/);
    });

    it("should generate numeric code", () => {
      const code = generator.generate({
        pattern: "numeric",
        length: 6,
      });

      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[0-9]+$/);
    });

    it("should add prefix and suffix", () => {
      const code = generator.generate({
        pattern: "alphanumeric",
        length: 4,
        prefix: "SUMMER-",
        suffix: "-2025",
      });

      expect(code).toMatch(/^SUMMER-[A-Z0-9]{4}-2025$/);
    });

    it("should generate lowercase when specified", () => {
      const code = generator.generate({
        pattern: "alphabetic",
        length: 6,
        uppercase: false,
      });

      expect(code).toMatch(/^[a-z]+$/);
    });

    it("should use custom charset", () => {
      const code = generator.generate({
        pattern: "custom",
        length: 4,
        customCharset: "ABC123",
      });

      expect(code).toHaveLength(4);
      expect(code).toMatch(/^[ABC123]+$/);
    });

    it("should exclude specified characters", () => {
      // Generate multiple codes to test exclusion
      for (let i = 0; i < 10; i++) {
        const code = generator.generate({
          pattern: "alphanumeric",
          length: 20,
          excludeChars: "0O1I",
        });

        expect(code).not.toMatch(/[0O1I]/);
      }
    });
  });

  describe("generateBatch", () => {
    it("should generate multiple unique codes", () => {
      const codes = generator.generateBatch(10, {
        pattern: "alphanumeric",
        length: 8,
      });

      expect(codes).toHaveLength(10);
      expect(new Set(codes).size).toBe(10); // All unique
    });

    it("should not include existing codes", () => {
      const existingCodes = new Set(["AAAA1111", "BBBB2222"]);
      const codes = generator.generateBatch(5, {
        pattern: "alphanumeric",
        length: 8,
      }, existingCodes);

      expect(codes).toHaveLength(5);
      for (const code of codes) {
        expect(existingCodes.has(code)).toBe(false);
      }
    });

    it("should throw when cannot generate enough unique codes", () => {
      expect(() => {
        generator.generateBatch(1000, {
          pattern: "numeric",
          length: 1, // Only 10 possible codes
        });
      }).toThrow();
    });
  });

  describe("validateFormat", () => {
    it("should validate correct format", () => {
      const valid = generator.validateFormat("ABCD2345", {
        pattern: "alphanumeric",
        length: 8,
      });

      expect(valid).toBe(true);
    });

    it("should validate with prefix and suffix", () => {
      const valid = generator.validateFormat("PRE-ABCD-SUF", {
        pattern: "alphabetic",
        length: 4,
        prefix: "PRE-",
        suffix: "-SUF",
      });

      expect(valid).toBe(true);
    });

    it("should reject wrong length", () => {
      const valid = generator.validateFormat("ABC", {
        pattern: "alphabetic",
        length: 4,
      });

      expect(valid).toBe(false);
    });

    it("should reject wrong prefix", () => {
      const valid = generator.validateFormat("WRONG-ABCD", {
        pattern: "alphabetic",
        length: 4,
        prefix: "PRE-",
      });

      expect(valid).toBe(false);
    });

    it("should reject invalid characters", () => {
      const valid = generator.validateFormat("ABCD1234", {
        pattern: "alphabetic",
        length: 8,
      });

      expect(valid).toBe(false); // Contains numbers
    });
  });

  describe("calculatePossibleCombinations", () => {
    it("should calculate for alphanumeric", () => {
      const combinations = generator.calculatePossibleCombinations({
        pattern: "alphanumeric",
        length: 4,
      });

      // Default alphanumeric charset has 32 chars (excludes 0,O,1,I)
      expect(combinations).toBe(Math.pow(32, 4));
    });

    it("should calculate for numeric", () => {
      const combinations = generator.calculatePossibleCombinations({
        pattern: "numeric",
        length: 6,
      });

      expect(combinations).toBe(1_000_000);
    });
  });
});
