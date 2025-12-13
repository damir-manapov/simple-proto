import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { CalcModule } from "../calc/calc.module.js";
import { DbModule } from "../db/db.module.js";

@Module({
  imports: [DbModule, CalcModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
