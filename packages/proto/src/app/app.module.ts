import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { CalcModule } from "../calc/calc.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { MessagingModule } from "../messaging/messaging.module.js";

@Module({
  imports: [StorageModule, CalcModule, MessagingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
