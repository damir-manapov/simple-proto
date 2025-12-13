import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import { AppController } from "../app.controller.js";
import { AppService } from "../app.service.js";

describe("AppController", () => {
  let module: TestingModule;
  let controller: AppController;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  afterAll(async () => {
    await module.close();
  });

  it("should return hello message", () => {
    expect(controller.getHello()).toBe("Hello World!");
  });

  it("should return health status", () => {
    expect(controller.getHealth()).toEqual({ status: "ok" });
  });
});
