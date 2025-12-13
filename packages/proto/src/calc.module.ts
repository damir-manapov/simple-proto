import { Module } from "@nestjs/common";
import { CalcController } from "./calc.controller.js";
import { CalcService } from "./calc.service.js";

@Module({
  controllers: [CalcController],
  providers: [CalcService],
})
export class CalcModule {}
