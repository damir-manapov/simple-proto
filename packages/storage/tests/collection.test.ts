import { describe, it, expect, beforeEach } from "vitest";
import {
  Storage,
  EntityCollectionAlreadyExistsError,
  EntityCollectionNotFoundError,
} from "../src/index.js";
import type { Schema } from "../src/index.js";

const testEntitySchema: Schema = {
  type: "object",
  properties: {
    id: { type: "string", nullable: true },
    name: { type: "string" },
    value: { type: "number" },
  },
  required: ["name", "value"],
  additionalProperties: false,
};

const anySchema: Schema = { type: "object", additionalProperties: true };

describe("Storage - Collection Management", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = new Storage();
  });

  describe("registerCollection", () => {
    it("should register a collection", () => {
      storage.registerCollection({ name: "test", schema: anySchema });
      expect(storage.hasCollection("test")).toBe(true);
    });

    it("should throw EntityCollectionAlreadyExistsError for duplicate registration", () => {
      storage.registerCollection({ name: "test", schema: anySchema });
      expect(() => {
        storage.registerCollection({ name: "test", schema: anySchema });
      }).toThrow(EntityCollectionAlreadyExistsError);
      expect(() => {
        storage.registerCollection({ name: "test", schema: anySchema });
      }).toThrow("Collection test is already registered");
    });

    it("should register collection with schema", () => {
      storage.registerCollection({
        name: "test",
        schema: testEntitySchema,
      });
      expect(storage.hasCollection("test")).toBe(true);
    });
  });

  describe("hasCollection", () => {
    it("should return false for unregistered collection", () => {
      expect(storage.hasCollection("unknown")).toBe(false);
    });

    it("should return true for registered collection", () => {
      storage.registerCollection({ name: "test", schema: anySchema });
      expect(storage.hasCollection("test")).toBe(true);
    });
  });

  describe("getCollections", () => {
    it("should return empty array when no collections", () => {
      expect(storage.getCollections()).toEqual([]);
    });

    it("should return all registered collection names", () => {
      storage.registerCollection({ name: "users", schema: anySchema });
      storage.registerCollection({ name: "posts", schema: anySchema });
      expect(storage.getCollections()).toEqual(["users", "posts"]);
    });
  });

  describe("getCollectionSchema", () => {
    it("should return schema for collection", () => {
      storage.registerCollection({ name: "test", schema: testEntitySchema });
      expect(storage.getCollectionSchema("test")).toEqual(testEntitySchema);
    });

    it("should throw EntityCollectionNotFoundError for unregistered collection", () => {
      expect(() => storage.getCollectionSchema("unknown")).toThrow(EntityCollectionNotFoundError);
    });
  });

  describe("getCollectionRelations", () => {
    it("should return empty object for schema without relations", () => {
      storage.registerCollection({ name: "test", schema: testEntitySchema });
      expect(storage.getCollectionRelations("test")).toEqual({});
    });

    it("should extract x-link-to from schema properties", () => {
      const schemaWithRelation = {
        type: "object",
        properties: {
          id: { type: "string", nullable: true },
          title: { type: "string" },
          authorId: { type: "string", "x-link-to": "users" },
        },
        required: ["title", "authorId"],
        additionalProperties: false,
      };
      storage.registerCollection({ name: "posts", schema: schemaWithRelation });
      expect(storage.getCollectionRelations("posts")).toEqual({ authorId: "users" });
    });

    it("should extract x-link-to from array items", () => {
      const schemaWithArrayRelation = {
        type: "object",
        properties: {
          id: { type: "string", nullable: true },
          title: { type: "string" },
          tagIds: {
            type: "array",
            items: { type: "string", "x-link-to": "tags" },
          },
        },
        required: ["title"],
        additionalProperties: false,
      };
      storage.registerCollection({ name: "articles", schema: schemaWithArrayRelation });
      expect(storage.getCollectionRelations("articles")).toEqual({ tagIds: "tags" });
    });

    it("should extract multiple relations", () => {
      const schemaWithMultipleRelations = {
        type: "object",
        properties: {
          id: { type: "string", nullable: true },
          title: { type: "string" },
          authorId: { type: "string", "x-link-to": "users" },
          categoryId: { type: "string", "x-link-to": "categories" },
          tagIds: {
            type: "array",
            items: { type: "string", "x-link-to": "tags" },
          },
        },
        required: ["title", "authorId"],
        additionalProperties: false,
      };
      storage.registerCollection({ name: "posts", schema: schemaWithMultipleRelations });
      expect(storage.getCollectionRelations("posts")).toEqual({
        authorId: "users",
        categoryId: "categories",
        tagIds: "tags",
      });
    });

    it("should throw EntityCollectionNotFoundError for unregistered collection", () => {
      expect(() => storage.getCollectionRelations("unknown")).toThrow(
        EntityCollectionNotFoundError
      );
    });
  });

  describe("unregistered collection errors", () => {
    it("should throw EntityCollectionNotFoundError for create on unregistered collection", () => {
      expect(() => storage.create("unknown", { id: "1", name: "test", value: 42 })).toThrow(
        EntityCollectionNotFoundError
      );
    });

    it("should throw EntityCollectionNotFoundError for findById on unregistered collection", () => {
      expect(() => storage.findById("unknown", "1")).toThrow(EntityCollectionNotFoundError);
    });

    it("should throw EntityCollectionNotFoundError for clear on unregistered collection", () => {
      expect(() => {
        storage.clear("unknown");
      }).toThrow(EntityCollectionNotFoundError);
    });
  });
});
