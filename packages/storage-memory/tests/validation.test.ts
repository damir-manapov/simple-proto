import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStorage } from "../src/index.js";
import { ValidationError } from "@simple-proto/storage-types";
import type { Entry, EntryInput, Schema } from "@simple-proto/storage-types";

interface TestEntity extends Entry {
  name: string;
  value: number;
}

interface TestEntityInput extends EntryInput {
  name: string;
  value: number;
}

const testEntitySchema: Schema = {
  type: "object",
  properties: {
    id: { type: "string", nullable: true },
    name: { type: "string" },
    value: { type: "number", minimum: 1 },
  },
  required: ["name", "value"],
  additionalProperties: false,
};

describe("Storage - Validation", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it("should validate on create", () => {
    storage.registerCollection({
      name: "validated",
      schema: testEntitySchema,
    });
    const invalidInput: TestEntityInput = { name: "test", value: -1 };
    expect(() => storage.create("validated", invalidInput)).toThrow(ValidationError);
    expect(() => storage.create("validated", invalidInput)).toThrow(
      "Validation failed for collection validated: data/value must be >= 1"
    );
  });

  it("should validate on update", () => {
    storage.registerCollection({
      name: "validated",
      schema: testEntitySchema,
    });
    const validInput: TestEntityInput = { id: "1", name: "test", value: 1 };
    storage.create("validated", validInput);
    const invalidUpdate: TestEntity = { id: "1", name: "test", value: -1 };
    expect(() => storage.update("validated", "1", invalidUpdate)).toThrow(ValidationError);
  });

  it("should pass validation for valid data", () => {
    storage.registerCollection({
      name: "validated",
      schema: testEntitySchema,
    });
    const input: TestEntityInput = { name: "test", value: 42 };
    const result = storage.create<TestEntityInput>("validated", input);
    expect(result.value).toBe(42);
  });
});
