import { Injectable } from "@nestjs/common";
import { add, subtract } from "@simple-proto/calc";

@Injectable()
export class CalcService {
  add(a: number, b: number): number {
    return add(a, b);
  }

  subtract(a: number, b: number): number {
    return subtract(a, b);
  }
}
