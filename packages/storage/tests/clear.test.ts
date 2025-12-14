import { describe, it, expect, beforeEach } from "vitest";
import { Storage } from "../src/index.js";
import type { Schema } from "@simple-proto/storage-types";

const anySchema: Schema = { type: "object", additionalProperties: true };

describe("Storage - Clear Operations", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = new Storage();
  });

  describe("clear", () => {
    it("should clear a collection", () => {
      storage.registerCollection({ name: "test", schema: anySchema });
      storage.create("test", { id: "1", name: "test", value: 1 });
      storage.create("test", { id: "2", name: "test2", value: 2 });
      storage.clear("test");
      expect(storage.findAll("test")).toEqual([]);
    });

    it("should not affect other collections", () => {
      storage.registerCollection({ name: "test1", schema: anySchema });
      storage.registerCollection({ name: "test2", schema: anySchema });
      storage.create("test1", { id: "1" });
      storage.create("test2", { id: "1" });
      storage.clear("test1");
      expect(storage.findAll("test1")).toEqual([]);
      expect(storage.findAll("test2")).toHaveLength(1);
    });
  });

  describe("clearAll", () => {
    it("should clear all collections", () => {
      storage.registerCollection({ name: "test1", schema: anySchema });
      storage.registerCollection({ name: "test2", schema: anySchema });
      storage.create("test1", { id: "1", name: "test", value: 1 });
      storage.create("test2", { id: "1", name: "test", value: 1 });
      storage.clearAll();
      expect(storage.findAll("test1")).toEqual([]);
      expect(storage.findAll("test2")).toEqual([]);
    });

    it("should keep collection registrations after clearAll", () => {
      storage.registerCollection({ name: "test", schema: anySchema });
      storage.create("test", { id: "1", name: "test", value: 1 });
      storage.clearAll();
      expect(storage.hasCollection("test")).toBe(true);
      expect(storage.findAll("test")).toEqual([]);
    });

    it("should allow creating entities after clearAll", () => {
      storage.registerCollection({ name: "test", schema: anySchema });
      storage.create("test", { id: "1" });
      storage.clearAll();
      const entity = storage.create("test", { id: "2" });
      expect(entity.id).toBe("2");
    });
  });
});
