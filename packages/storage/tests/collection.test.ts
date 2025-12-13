import { describe, it, expect, beforeEach } from "vitest";
import { Storage } from "../src/index.js";
import type { EntityInput, JSONSchemaType } from "../src/index.js";
import { CollectionAlreadyExistsError, CollectionNotFoundError } from "../src/errors.js";

interface TestEntityInput extends EntityInput {
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

describe("Storage - Collection Management", () => {
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

  describe("unregistered collection errors", () => {
    it("should throw CollectionNotFoundError for create on unregistered collection", () => {
      expect(() => storage.create("unknown", { id: "1", name: "test", value: 42 })).toThrow(
        CollectionNotFoundError
      );
    });

    it("should throw CollectionNotFoundError for findById on unregistered collection", () => {
      expect(() => storage.findById("unknown", "1")).toThrow(CollectionNotFoundError);
    });

    it("should throw CollectionNotFoundError for clear on unregistered collection", () => {
      expect(() => {
        storage.clear("unknown");
      }).toThrow(CollectionNotFoundError);
    });
  });
});
