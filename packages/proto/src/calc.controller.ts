import { Controller, Get, Query, BadRequestException } from "@nestjs/common";
import { CalcService } from "./calc.service.js";

@Controller("calc")
export class CalcController {
  constructor(private readonly calcService: CalcService) {}

  @Get("add")
  add(@Query("a") a: string, @Query("b") b: string): { result: number } {
    const numA = this.parseNumber(a, "a");
    const numB = this.parseNumber(b, "b");
    return { result: this.calcService.add(numA, numB) };
  }

  @Get("subtract")
  subtract(@Query("a") a: string, @Query("b") b: string): { result: number } {
    const numA = this.parseNumber(a, "a");
    const numB = this.parseNumber(b, "b");
    return { result: this.calcService.subtract(numA, numB) };
  }

  private parseNumber(value: string | undefined, param: string): number {
    if (value === undefined) {
      throw new BadRequestException(`Missing required parameter: ${param}`);
    }
    const num = Number(value);
    if (Number.isNaN(num)) {
      throw new BadRequestException(`Invalid number for parameter: ${param}`);
    }
    return num;
  }
}
