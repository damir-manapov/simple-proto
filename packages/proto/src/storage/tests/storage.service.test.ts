import { describe, it, expect } from "vitest";
import { StorageService } from "../storage.service.js";
import { Storage } from "@simple-proto/storage";

describe("StorageService", () => {
  it("should be an instance of Storage", () => {
    const service = new StorageService();
    expect(service).toBeInstanceOf(Storage);
  });

  it("should have all Storage methods", () => {
    const service = new StorageService();
    expect(typeof service.create).toBe("function");
    expect(typeof service.findById).toBe("function");
    expect(typeof service.findAll).toBe("function");
    expect(typeof service.update).toBe("function");
    expect(typeof service.delete).toBe("function");
    expect(typeof service.clear).toBe("function");
    expect(typeof service.clearAll).toBe("function");
  });
});
