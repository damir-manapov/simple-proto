import { describe, it, expect } from "vitest";
import { CalcService } from "../../src/calc/calc.service.js";

describe("CalcService", () => {
  const service = new CalcService();

  describe("add", () => {
    it("should add two positive numbers", () => {
      expect(service.add(2, 3)).toBe(5);
    });

    it("should handle negative numbers", () => {
      expect(service.add(-1, 1)).toBe(0);
    });
  });

  describe("subtract", () => {
    it("should subtract two numbers", () => {
      expect(service.subtract(5, 3)).toBe(2);
    });

    it("should handle negative results", () => {
      expect(service.subtract(3, 5)).toBe(-2);
    });
  });
});
