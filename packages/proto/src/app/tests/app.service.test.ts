import { describe, it, expect } from "vitest";
import { AppService } from "../app.service.js";

describe("AppService", () => {
  it("should return hello message", () => {
    const service = new AppService();
    expect(service.getHello()).toBe("Hello World!");
  });
});
