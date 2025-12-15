import { describe, it, expect } from "vitest";
import {
  getNestedValue,
  setNestedValue,
  resolveValue,
  resolveRecord,
  field,
  constant,
} from "../src/utils.js";

describe("utils", () => {
  describe("getNestedValue", () => {
    it("should get top-level value", () => {
      const obj = { name: "John" };
      expect(getNestedValue(obj, "name")).toBe("John");
    });

    it("should get nested value with dot notation", () => {
      const obj = { user: { address: { city: "NYC" } } };
      expect(getNestedValue(obj, "user.address.city")).toBe("NYC");
    });

    it("should get array element with bracket notation", () => {
      const obj = { items: [{ name: "first" }, { name: "second" }] };
      expect(getNestedValue(obj, "items[0].name")).toBe("first");
      expect(getNestedValue(obj, "items[1].name")).toBe("second");
    });

    it("should return undefined for missing path", () => {
      const obj = { user: { name: "John" } };
      expect(getNestedValue(obj, "user.address.city")).toBeUndefined();
    });

    it("should return undefined for null object", () => {
      expect(getNestedValue(null, "name")).toBeUndefined();
      expect(getNestedValue(undefined, "name")).toBeUndefined();
    });

    it("should handle mixed notation", () => {
      const obj = {
        users: [{ profile: { tags: ["admin", "user"] } }],
      };
      expect(getNestedValue(obj, "users[0].profile.tags[0]")).toBe("admin");
    });
  });

  describe("setNestedValue", () => {
    it("should set top-level value", () => {
      const obj: Record<string, unknown> = {};
      setNestedValue(obj, "name", "John");
      expect(obj["name"]).toBe("John");
    });

    it("should set nested value creating intermediate objects", () => {
      const obj: Record<string, unknown> = {};
      setNestedValue(obj, "user.address.city", "NYC");
      expect(obj["user"] as Record<string, unknown>).toEqual({ address: { city: "NYC" } });
    });

    it("should set array element", () => {
      const obj: Record<string, unknown> = { items: [] };
      setNestedValue(obj, "items[0]", { name: "first" });
      expect((obj["items"] as unknown[])[0]).toEqual({ name: "first" });
    });

    it("should overwrite existing value", () => {
      const obj: Record<string, unknown> = { name: "John" };
      setNestedValue(obj, "name", "Jane");
      expect(obj["name"]).toBe("Jane");
    });
  });

  describe("field and constant helpers", () => {
    it("should create field reference", () => {
      expect(field("user.name")).toEqual({ type: "field", path: "user.name" });
    });

    it("should create constant value", () => {
      expect(constant(42)).toEqual({ type: "constant", value: 42 });
      expect(constant("hello")).toEqual({ type: "constant", value: "hello" });
      expect(constant(null)).toEqual({ type: "constant", value: null });
    });
  });

  describe("resolveValue", () => {
    it("should resolve constant value", () => {
      const context = { user: { name: "John" } };
      expect(resolveValue(constant(42), context)).toBe(42);
      expect(resolveValue(constant("hello"), context)).toBe("hello");
    });

    it("should resolve field reference", () => {
      const context = { user: { name: "John", age: 30 } };
      expect(resolveValue(field("user.name"), context)).toBe("John");
      expect(resolveValue(field("user.age"), context)).toBe(30);
    });

    it("should return undefined for missing field", () => {
      const context = { user: { name: "John" } };
      expect(resolveValue(field("user.email"), context)).toBeUndefined();
    });
  });

  describe("resolveRecord", () => {
    it("should resolve all values in record", () => {
      const context = { user: { name: "John", email: "john@example.com" } };
      const record = {
        userName: field("user.name"),
        userEmail: field("user.email"),
        appName: constant("MyApp"),
      };

      const result = resolveRecord(record, context);
      expect(result).toEqual({
        userName: "John",
        userEmail: "john@example.com",
        appName: "MyApp",
      });
    });
  });
});
