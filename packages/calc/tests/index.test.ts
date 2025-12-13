import { describe, it, expect } from "vitest";
import { add, subtract } from "../src/index.js";

describe("math functions", () => {
  describe("add", () => {
    it("should add two positive numbers", () => {
      expect(add(2, 3)).toBe(5);
    });

    it("should handle negative numbers", () => {
      expect(add(-1, 1)).toBe(0);
    });

    it("should handle zero", () => {
      expect(add(0, 5)).toBe(5);
    });
  });

  describe("subtract", () => {
    it("should subtract two numbers", () => {
      expect(subtract(5, 3)).toBe(2);
    });

    it("should handle negative results", () => {
      expect(subtract(3, 5)).toBe(-2);
    });

    it("should handle zero", () => {
      expect(subtract(5, 0)).toBe(5);
    });
  });
});
