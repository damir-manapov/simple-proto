import { describe, it, expect, beforeEach } from "vitest";
import {
  Storage,
  EntityCollectionAlreadyExistsError,
  EntityCollectionNotFoundError,
} from "../src/index.js";
import type { EntryInput, JSONSchemaType, Schema } from "../src/index.js";

interface TestEntityInput extends EntryInput {
  name: string;
  value: number;
}

const testEntitySchema: JSONSchemaType<TestEntityInput> = {
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
