import { Module } from "@nestjs/common";
import { TransformController, TransformRunsController } from "./transform.controller.js";
import { TransformNestService } from "./transform.service.js";
import { StorageModule } from "../storage/storage.module.js";

@Module({
  imports: [StorageModule],
  controllers: [TransformController, TransformRunsController],
  providers: [TransformNestService],
  exports: [TransformNestService],
})
export class TransformModule {}
