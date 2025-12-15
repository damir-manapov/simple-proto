import { Module } from "@nestjs/common";
import {
  MatchConfigController,
  SurvivorshipConfigController,
  SourceRecordController,
  GoldenRecordController,
} from "./mdm.controller.js";
import { MdmService } from "./mdm.service.js";
import { StorageModule } from "../storage/storage.module.js";

@Module({
  imports: [StorageModule],
  controllers: [
    MatchConfigController,
    SurvivorshipConfigController,
    SourceRecordController,
    GoldenRecordController,
  ],
  providers: [MdmService],
  exports: [MdmService],
})
export class MdmModule {}
