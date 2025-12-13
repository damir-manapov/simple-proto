import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { CalcController } from "../calc.controller.js";
import { CalcService } from "../calc.service.js";

describe("CalcController", () => {
  let module: TestingModule;
  let controller: CalcController;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      controllers: [CalcController],
      providers: [CalcService],
    }).compile();

    controller = module.get<CalcController>(CalcController);
  });

  afterAll(async () => {
    await module.close();
  });

  describe("add", () => {
    it("should add two numbers", () => {
      expect(controller.add("2", "3")).toEqual({ result: 5 });
    });

    it("should handle decimal numbers", () => {
      expect(controller.add("1.5", "2.5")).toEqual({ result: 4 });
    });

    it("should throw error for missing parameter a", () => {
      expect(() => controller.add(undefined as unknown as string, "3")).toThrow(
        BadRequestException
      );
    });

    it("should throw error for invalid number", () => {
      expect(() => controller.add("abc", "3")).toThrow(BadRequestException);
    });
  });

  describe("subtract", () => {
    it("should subtract two numbers", () => {
      expect(controller.subtract("5", "3")).toEqual({ result: 2 });
    });

    it("should handle negative results", () => {
      expect(controller.subtract("3", "5")).toEqual({ result: -2 });
    });
  });
});
