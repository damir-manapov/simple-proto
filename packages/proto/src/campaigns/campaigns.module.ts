import { Module } from "@nestjs/common";
import { CampaignsService } from "./campaigns.service.js";
import { CampaignsController } from "./campaigns.controller.js";
import { MessagingModule } from "../messaging/messaging.module.js";

@Module({
  imports: [MessagingModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
