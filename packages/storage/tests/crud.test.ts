import { describe, it, expect, beforeEach } from "vitest";
import { Storage, EntityAlreadyExistsError, EntityNotFoundError } from "../src/index.js";
import type { Entry, EntryInput } from "../src/index.js";

interface TestEntity extends Entry {
  name: string;
  value: number;
}

interface TestEntityInput extends EntryInput {
  name: string;
  value: number;
}

describe("Storage - CRUD Operations", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = new Storage();
    storage.registerCollection({ name: "test" });
  });

  describe("create", () => {
    it("should create an entity with provided id", () => {
      const entity: TestEntity = { id: "1", name: "test", value: 42 };
      const result = storage.create("test", entity);
      expect(result).toEqual(entity);
    });

    it("should auto-generate id when not provided", () => {
      const input: TestEntityInput = { name: "test", value: 42 };
      const result = storage.create("test", input);
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe("string");
      expect(result.id.length).toBeGreaterThan(0);
      expect(result.name).toBe("test");
      expect(result.value).toBe(42);
    });

    it("should generate unique ids for multiple entities", () => {
      const input1: TestEntityInput = { name: "test1", value: 1 };
      const input2: TestEntityInput = { name: "test2", value: 2 };
      const result1 = storage.create("test", input1);
      const result2 = storage.create("test", input2);
      expect(result1.id).not.toBe(result2.id);
    });

    it("should throw EntityAlreadyExistsError when creating duplicate id", () => {
      const entity: TestEntity = { id: "1", name: "test", value: 42 };
      storage.create("test", entity);
      expect(() => storage.create("test", entity)).toThrow(EntityAlreadyExistsError);
      expect(() => storage.create("test", entity)).toThrow(
        "Entry with id 1 already exists in collection test"
      );
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

    it("should throw EntityNotFoundError for non-existent id", () => {
      expect(() => storage.findByIdOrThrow("test", "999")).toThrow(EntityNotFoundError);
      expect(() => storage.findByIdOrThrow("test", "999")).toThrow(
        "Entry with id 999 not found in collection test"
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

    it("should throw EntityNotFoundError for non-existent id", () => {
      const updated: TestEntity = { id: "999", name: "updated", value: 42 };
      expect(() => storage.updateOrThrow("test", "999", updated)).toThrow(EntityNotFoundError);
      expect(() => storage.updateOrThrow("test", "999", updated)).toThrow(
        "Entry with id 999 not found in collection test"
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
});
