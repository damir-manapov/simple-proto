import { Module } from "@nestjs/common";
import { WorkflowController, ExecutionController } from "./workflow.controller.js";
import { WorkflowService } from "./workflow.service.js";
import { StorageModule } from "../storage/storage.module.js";
import { MessagingTransportModule } from "../messaging-transport/messaging-transport.module.js";

@Module({
  imports: [StorageModule, MessagingTransportModule],
  controllers: [WorkflowController, ExecutionController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
