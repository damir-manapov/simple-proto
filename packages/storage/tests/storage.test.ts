import { describe, it, expect, beforeEach } from "vitest";
import { Storage } from "../src/storage.js";
import type { Entity } from "../src/storage.js";

interface TestEntity extends Entity {
  name: string;
  value: number;
}

describe("Storage", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = new Storage();
  });

  describe("create", () => {
    it("should create an entity", () => {
      const entity: TestEntity = { id: "1", name: "test", value: 42 };
      const result = storage.create("test", entity);
      expect(result).toEqual(entity);
    });

    it("should throw error when creating duplicate id", () => {
      const entity: TestEntity = { id: "1", name: "test", value: 42 };
      storage.create("test", entity);
      expect(() => storage.create("test", entity)).toThrow("Entity with id 1 already exists");
    });
  });

  describe("findById", () => {
    it("should find entity by id", () => {
      const entity: TestEntity = { id: "1", name: "test", value: 42 };
      storage.create("test", entity);
      const result = storage.findById("test", "1");
      expect(result).toEqual(entity);
    });

    it("should return null for non-existent id", () => {
      const result = storage.findById("test", "999");
      expect(result).toBeNull();
    });
  });

  describe("findByIdOrThrow", () => {
    it("should find entity by id", () => {
      const entity: TestEntity = { id: "1", name: "test", value: 42 };
      storage.create("test", entity);
      const result = storage.findByIdOrThrow("test", "1");
      expect(result).toEqual(entity);
    });

    it("should throw for non-existent id", () => {
      expect(() => storage.findByIdOrThrow("test", "999")).toThrow(
        "Entity with id 999 not found in collection test"
      );
    });
  });

  describe("findAll", () => {
    it("should return all entities", () => {
      const entity1: TestEntity = { id: "1", name: "test1", value: 1 };
      const entity2: TestEntity = { id: "2", name: "test2", value: 2 };
      storage.create("test", entity1);
      storage.create("test", entity2);
      const result = storage.findAll("test");
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(entity1);
      expect(result).toContainEqual(entity2);
    });

    it("should return empty array for empty collection", () => {
      const result = storage.findAll("test");
      expect(result).toEqual([]);
    });
  });

  describe("update", () => {
    it("should update an entity", () => {
      const entity: TestEntity = { id: "1", name: "test", value: 42 };
      storage.create("test", entity);
      const updated: TestEntity = { id: "1", name: "updated", value: 42 };
      const result = storage.update("test", "1", updated);
      expect(result).toEqual(updated);
    });

    it("should return null for non-existent id", () => {
      const updated: TestEntity = { id: "999", name: "updated", value: 42 };
      const result = storage.update("test", "999", updated);
      expect(result).toBeNull();
    });
  });

  describe("updateOrThrow", () => {
    it("should update an entity", () => {
      const entity: TestEntity = { id: "1", name: "test", value: 42 };
      storage.create("test", entity);
      const updated: TestEntity = { id: "1", name: "updated", value: 42 };
      const result = storage.updateOrThrow("test", "1", updated);
      expect(result).toEqual(updated);
    });

    it("should throw for non-existent id", () => {
      const updated: TestEntity = { id: "999", name: "updated", value: 42 };
      expect(() => storage.updateOrThrow("test", "999", updated)).toThrow(
        "Entity with id 999 not found in collection test"
      );
    });
  });

  describe("delete", () => {
    it("should delete an entity", () => {
      const entity: TestEntity = { id: "1", name: "test", value: 42 };
      storage.create("test", entity);
      const result = storage.delete("test", "1");
      expect(result).toBe(true);
      expect(storage.findById("test", "1")).toBeNull();
    });

    it("should return false for non-existent id", () => {
      const result = storage.delete("test", "999");
      expect(result).toBe(false);
    });
  });

  describe("clear", () => {
    it("should clear a collection", () => {
      storage.create("test", { id: "1", name: "test", value: 1 });
      storage.create("test", { id: "2", name: "test2", value: 2 });
      storage.clear("test");
      expect(storage.findAll("test")).toEqual([]);
    });
  });

  describe("clearAll", () => {
    it("should clear all collections", () => {
      storage.create("test1", { id: "1", name: "test", value: 1 });
      storage.create("test2", { id: "1", name: "test", value: 1 });
      storage.clearAll();
      expect(storage.findAll("test1")).toEqual([]);
      expect(storage.findAll("test2")).toEqual([]);
    });
  });
});
