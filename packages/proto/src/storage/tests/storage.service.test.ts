import { describe, it, expect, beforeEach } from "vitest";
import { StorageService } from "../storage.service.js";
import type { Entity } from "../storage.service.js";

interface TestEntity extends Entity {
  name: string;
  value: number;
}

describe("StorageService", () => {
  let service: StorageService;

  beforeEach(() => {
    service = new StorageService();
  });

  describe("create", () => {
    it("should create an entity", () => {
      const entity: TestEntity = { id: "1", name: "test", value: 42 };
      const result = service.create("test", entity);
      expect(result).toEqual(entity);
    });

    it("should throw error when creating duplicate id", () => {
      const entity: TestEntity = { id: "1", name: "test", value: 42 };
      service.create("test", entity);
      expect(() => service.create("test", entity)).toThrow("Entity with id 1 already exists");
    });
  });

  describe("findById", () => {
    it("should find entity by id", () => {
      const entity: TestEntity = { id: "1", name: "test", value: 42 };
      service.create("test", entity);
      const result = service.findById("test", "1");
      expect(result).toEqual(entity);
    });

    it("should return undefined for non-existent id", () => {
      const result = service.findById("test", "999");
      expect(result).toBeUndefined();
    });
  });

  describe("findAll", () => {
    it("should return all entities", () => {
      const entity1: TestEntity = { id: "1", name: "test1", value: 1 };
      const entity2: TestEntity = { id: "2", name: "test2", value: 2 };
      service.create("test", entity1);
      service.create("test", entity2);
      const result = service.findAll("test");
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(entity1);
      expect(result).toContainEqual(entity2);
    });

    it("should return empty array for empty collection", () => {
      const result = service.findAll("test");
      expect(result).toEqual([]);
    });
  });

  describe("update", () => {
    it("should update an entity", () => {
      const entity: TestEntity = { id: "1", name: "test", value: 42 };
      service.create("test", entity);
      const updated: TestEntity = { id: "1", name: "updated", value: 42 };
      const result = service.update("test", "1", updated);
      expect(result).toEqual(updated);
    });

    it("should return undefined for non-existent id", () => {
      const updated: TestEntity = { id: "999", name: "updated", value: 42 };
      const result = service.update("test", "999", updated);
      expect(result).toBeUndefined();
    });
  });

  describe("delete", () => {
    it("should delete an entity", () => {
      const entity: TestEntity = { id: "1", name: "test", value: 42 };
      service.create("test", entity);
      const result = service.delete("test", "1");
      expect(result).toBe(true);
      expect(service.findById("test", "1")).toBeUndefined();
    });

    it("should return false for non-existent id", () => {
      const result = service.delete("test", "999");
      expect(result).toBe(false);
    });
  });

  describe("clear", () => {
    it("should clear a collection", () => {
      service.create("test", { id: "1", name: "test", value: 1 });
      service.create("test", { id: "2", name: "test2", value: 2 });
      service.clear("test");
      expect(service.findAll("test")).toEqual([]);
    });
  });

  describe("clearAll", () => {
    it("should clear all collections", () => {
      service.create("test1", { id: "1", name: "test", value: 1 });
      service.create("test2", { id: "1", name: "test", value: 1 });
      service.clearAll();
      expect(service.findAll("test1")).toEqual([]);
      expect(service.findAll("test2")).toEqual([]);
    });
  });
});
