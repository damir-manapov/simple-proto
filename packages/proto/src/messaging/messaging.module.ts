import { Module } from "@nestjs/common";
import { MessagingService } from "./messaging.service.js";
import { SentMessageService } from "./sent-message.service.js";
import { MessagingController } from "./messaging.controller.js";

@Module({
  controllers: [MessagingController],
  providers: [MessagingService, SentMessageService],
  exports: [MessagingService, SentMessageService],
})
export class MessagingModule {}
