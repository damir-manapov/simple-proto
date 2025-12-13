import { describe, it, expect } from "vitest";
import { isFilterOperator } from "../../src/filter/index.js";

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
