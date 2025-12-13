import { describe, it, expect, beforeEach } from "vitest";
import { Storage, ValidationError } from "../src/index.js";
import type { Entity, EntityInput, JSONSchemaType } from "../src/index.js";

interface TestEntity extends Entity {
  name: string;
  value: number;
}

interface TestEntityInput extends EntityInput {
  name: string;
  value: number;
}

const testEntitySchema: JSONSchemaType<TestEntityInput> = {
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
  let storage: Storage;

  beforeEach(() => {
    storage = new Storage();
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

  it("should skip validation when not configured", () => {
    storage.registerCollection({ name: "novalidation" });
    const input: TestEntityInput = { name: "test", value: -1 };
    const result = storage.create("novalidation", input);
    expect(result.id).toBeDefined();
  });
});
