import { describe, it, expect, beforeEach } from "vitest";
import { Storage } from "../src/storage.js";
import type { Entity, EntityInput } from "../src/storage.js";
import {
  CollectionAlreadyExistsError,
  CollectionNotFoundError,
  EntityAlreadyExistsError,
  EntityNotFoundError,
  ValidationError,
} from "../src/errors.js";

interface TestEntity extends Entity {
  name: string;
  value: number;
}

interface TestEntityInput extends EntityInput {
  name: string;
  value: number;
}

describe("Storage", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = new Storage();
  });

  describe("registerCollection", () => {
    it("should register a collection", () => {
      storage.registerCollection({ name: "test" });
      expect(storage.hasCollection("test")).toBe(true);
    });

    it("should throw CollectionAlreadyExistsError for duplicate registration", () => {
      storage.registerCollection({ name: "test" });
      expect(() => {
        storage.registerCollection({ name: "test" });
      }).toThrow(CollectionAlreadyExistsError);
      expect(() => {
        storage.registerCollection({ name: "test" });
      }).toThrow("Collection test is already registered");
    });

    it("should register collection with validation", () => {
      storage.registerCollection<TestEntityInput>({
        name: "test",
        validate: (data) => {
          return data.name ? true : "Name is required";
        },
      });
      expect(storage.hasCollection("test")).toBe(true);
    });
  });

  describe("hasCollection", () => {
    it("should return false for unregistered collection", () => {
      expect(storage.hasCollection("unknown")).toBe(false);
    });

    it("should return true for registered collection", () => {
      storage.registerCollection({ name: "test" });
      expect(storage.hasCollection("test")).toBe(true);
    });
  });

  describe("getCollections", () => {
    it("should return empty array when no collections", () => {
      expect(storage.getCollections()).toEqual([]);
    });

    it("should return all registered collection names", () => {
      storage.registerCollection({ name: "users" });
      storage.registerCollection({ name: "posts" });
      expect(storage.getCollections()).toEqual(["users", "posts"]);
    });
  });

  describe("create", () => {
    beforeEach(() => {
      storage.registerCollection({ name: "test" });
    });

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
        "Entity with id 1 already exists in collection test"
      );
    });

    it("should throw CollectionNotFoundError for unregistered collection", () => {
      expect(() => storage.create("unknown", { id: "1", name: "test", value: 42 })).toThrow(
        CollectionNotFoundError
      );
      expect(() => storage.create("unknown", { id: "1", name: "test", value: 42 })).toThrow(
        "Collection unknown is not registered"
      );
    });
  });

  describe("validation", () => {
    it("should validate on create", () => {
      storage.registerCollection<TestEntityInput>({
        name: "validated",
        validate: (data) => {
          return data.value > 0 ? true : "Value must be positive";
        },
      });
      const invalidInput: TestEntityInput = { name: "test", value: -1 };
      expect(() => storage.create("validated", invalidInput)).toThrow(ValidationError);
      expect(() => storage.create("validated", invalidInput)).toThrow(
        "Validation failed for collection validated: Value must be positive"
      );
    });

    it("should validate on update", () => {
      storage.registerCollection<TestEntityInput>({
        name: "validated",
        validate: (data) => {
          return data.value > 0 ? true : "Value must be positive";
        },
      });
      const validInput: TestEntityInput = { id: "1", name: "test", value: 1 };
      storage.create("validated", validInput);
      const invalidUpdate: TestEntity = { id: "1", name: "test", value: -1 };
      expect(() => storage.update("validated", "1", invalidUpdate)).toThrow(ValidationError);
    });

    it("should pass validation for valid data", () => {
      storage.registerCollection<TestEntityInput>({
        name: "validated",
        validate: (data) => {
          return data.value > 0 ? true : "Value must be positive";
        },
      });
      const input: TestEntityInput = { name: "test", value: 42 };
      const result = storage.create<TestEntityInput>("validated", input);
      expect(result.value).toBe(42);
    });
  });

  describe("findById", () => {
    beforeEach(() => {
      storage.registerCollection({ name: "test" });
    });

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

    it("should throw CollectionNotFoundError for unregistered collection", () => {
      expect(() => storage.findById("unknown", "1")).toThrow(CollectionNotFoundError);
    });
  });

  describe("findByIdOrThrow", () => {
    beforeEach(() => {
      storage.registerCollection({ name: "test" });
    });

    it("should find entity by id", () => {
      const entity: TestEntity = { id: "1", name: "test", value: 42 };
      storage.create("test", entity);
      const result = storage.findByIdOrThrow("test", "1");
      expect(result).toEqual(entity);
    });

    it("should throw EntityNotFoundError for non-existent id", () => {
      expect(() => storage.findByIdOrThrow("test", "999")).toThrow(EntityNotFoundError);
      expect(() => storage.findByIdOrThrow("test", "999")).toThrow(
        "Entity with id 999 not found in collection test"
      );
    });
  });

  describe("findAll", () => {
    beforeEach(() => {
      storage.registerCollection({ name: "test" });
    });

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
    beforeEach(() => {
      storage.registerCollection({ name: "test" });
    });

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
    beforeEach(() => {
      storage.registerCollection({ name: "test" });
    });

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
        "Entity with id 999 not found in collection test"
      );
    });
  });

  describe("delete", () => {
    beforeEach(() => {
      storage.registerCollection({ name: "test" });
    });

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
      storage.registerCollection({ name: "test" });
      storage.create("test", { id: "1", name: "test", value: 1 });
      storage.create("test", { id: "2", name: "test2", value: 2 });
      storage.clear("test");
      expect(storage.findAll("test")).toEqual([]);
    });

    it("should throw CollectionNotFoundError for unregistered collection", () => {
      expect(() => {
        storage.clear("unknown");
      }).toThrow(CollectionNotFoundError);
    });
  });

  describe("clearAll", () => {
    it("should clear all collections", () => {
      storage.registerCollection({ name: "test1" });
      storage.registerCollection({ name: "test2" });
      storage.create("test1", { id: "1", name: "test", value: 1 });
      storage.create("test2", { id: "1", name: "test", value: 1 });
      storage.clearAll();
      expect(storage.findAll("test1")).toEqual([]);
      expect(storage.findAll("test2")).toEqual([]);
    });

    it("should keep collection registrations after clearAll", () => {
      storage.registerCollection({ name: "test" });
      storage.create("test", { id: "1", name: "test", value: 1 });
      storage.clearAll();
      expect(storage.hasCollection("test")).toBe(true);
      expect(storage.findAll("test")).toEqual([]);
    });
  });
});
