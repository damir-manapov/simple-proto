import { describe, it, expect } from "vitest";
import { StorageService } from "../storage.service.js";
import { Storage } from "@simple-proto/storage";
import type { Schema } from "@simple-proto/storage";

const anySchema: Schema = { type: "object", additionalProperties: true };

describe("StorageService", () => {
  it("should be an instance of Storage", () => {
    const service = new StorageService();
    expect(service).toBeInstanceOf(Storage);
  });

  it("should have all Storage methods", () => {
    const service = new StorageService();
    expect(typeof service.registerCollection).toBe("function");
    expect(typeof service.hasCollection).toBe("function");
    expect(typeof service.getCollections).toBe("function");
    expect(typeof service.create).toBe("function");
    expect(typeof service.findById).toBe("function");
    expect(typeof service.findAll).toBe("function");
    expect(typeof service.update).toBe("function");
    expect(typeof service.delete).toBe("function");
    expect(typeof service.clear).toBe("function");
    expect(typeof service.clearAll).toBe("function");
  });

  it("should require collection registration before use", () => {
    const service = new StorageService();
    service.registerCollection({ name: "test", schema: anySchema });
    expect(service.hasCollection("test")).toBe(true);
    const entity = service.create("test", { id: "1" });
    expect(entity.id).toBe("1");
  });
});
