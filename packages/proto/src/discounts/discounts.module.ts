import { Module } from "@nestjs/common";
import { DiscountsController, UsageController, GeneratedCodesController } from "./discounts.controller.js";
import { DiscountsService } from "./discounts.service.js";
import { StorageModule } from "../storage/storage.module.js";

@Module({
  imports: [StorageModule],
  controllers: [DiscountsController, UsageController, GeneratedCodesController],
  providers: [DiscountsService],
  exports: [DiscountsService],
})
export class DiscountsModule {}
