import { describe, it, expect, beforeEach } from "vitest";
import { Storage } from "../src/storage.js";
import type { Entity, EntityInput } from "../src/storage.js";
import { ValidationError } from "../src/errors.js";

interface TestEntity extends Entity {
  name: string;
  value: number;
}

interface TestEntityInput extends EntityInput {
  name: string;
  value: number;
}

describe("Storage - Validation", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = new Storage();
  });

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

  it("should skip validation when not configured", () => {
    storage.registerCollection({ name: "novalidation" });
    const input: TestEntityInput = { name: "test", value: -1 };
    const result = storage.create("novalidation", input);
    expect(result.id).toBeDefined();
  });
});
