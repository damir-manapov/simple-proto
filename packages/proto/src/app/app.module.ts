import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { CalcModule } from "../calc/calc.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { MessagingModule } from "../messaging/messaging.module.js";
import { MessagingTransportModule } from "../messaging-transport/messaging-transport.module.js";
import { CampaignsModule } from "../campaigns/campaigns.module.js";
import { ReportsModule } from "../reports/reports.module.js";
import { MdmModule } from "../mdm/mdm.module.js";

@Module({
  imports: [
    StorageModule,
    CalcModule,
    MessagingModule,
    MessagingTransportModule,
    CampaignsModule,
    ReportsModule,
    MdmModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
