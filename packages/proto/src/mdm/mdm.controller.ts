import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { MdmService } from "./mdm.service.js";
import type {
  MatchConfig,
  MatchConfigInput,
  SurvivorshipConfig,
  SurvivorshipConfigInput,
  SourceRecord,
  SourceRecordInput,
  GoldenRecord,
  GoldenRecordInput,
  MatchResult,
  MergeResult,
} from "@simple-proto/mdm-types";

// ==================== Match Config Controller ====================

@Controller("mdm/match-configs")
export class MatchConfigController {
  constructor(private readonly mdmService: MdmService) {}

  @Post()
  create(@Body() input: MatchConfigInput): MatchConfig {
    return this.mdmService.createMatchConfig(input);
  }

  @Get()
  getAll(@Query("entityType") entityType?: string): MatchConfig[] {
    if (entityType) {
      const config = this.mdmService.getMatchConfigByEntityType(entityType);
      return config ? [config] : [];
    }
    return this.mdmService.getAllMatchConfigs();
  }

  @Get(":id")
  get(@Param("id") id: string): MatchConfig {
    const config = this.mdmService.getMatchConfig(id);
    if (!config) {
      throw new NotFoundException(`Match config not found: ${id}`);
    }
    return config;
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() input: Partial<MatchConfigInput>): MatchConfig {
    const config = this.mdmService.updateMatchConfig(id, input);
    if (!config) {
      throw new NotFoundException(`Match config not found: ${id}`);
    }
    return config;
  }

  @Delete(":id")
  delete(@Param("id") id: string): { deleted: boolean } {
    const deleted = this.mdmService.deleteMatchConfig(id);
    if (!deleted) {
      throw new NotFoundException(`Match config not found: ${id}`);
    }
    return { deleted: true };
  }
}

// ==================== Survivorship Config Controller ====================

@Controller("mdm/survivorship-configs")
export class SurvivorshipConfigController {
  constructor(private readonly mdmService: MdmService) {}

  @Post()
  create(@Body() input: SurvivorshipConfigInput): SurvivorshipConfig {
    return this.mdmService.createSurvivorshipConfig(input);
  }

  @Get()
  getAll(@Query("entityType") entityType?: string): SurvivorshipConfig[] {
    if (entityType) {
      const config = this.mdmService.getSurvivorshipConfigByEntityType(entityType);
      return config ? [config] : [];
    }
    return this.mdmService.getAllSurvivorshipConfigs();
  }

  @Get(":id")
  get(@Param("id") id: string): SurvivorshipConfig {
    const config = this.mdmService.getSurvivorshipConfig(id);
    if (!config) {
      throw new NotFoundException(`Survivorship config not found: ${id}`);
    }
    return config;
  }

  @Put(":id")
  update(
    @Param("id") id: string,
    @Body() input: Partial<SurvivorshipConfigInput>
  ): SurvivorshipConfig {
    const config = this.mdmService.updateSurvivorshipConfig(id, input);
    if (!config) {
      throw new NotFoundException(`Survivorship config not found: ${id}`);
    }
    return config;
  }

  @Delete(":id")
  delete(@Param("id") id: string): { deleted: boolean } {
    const deleted = this.mdmService.deleteSurvivorshipConfig(id);
    if (!deleted) {
      throw new NotFoundException(`Survivorship config not found: ${id}`);
    }
    return { deleted: true };
  }
}

// ==================== Source Record Controller ====================

@Controller("mdm/source-records")
export class SourceRecordController {
  constructor(private readonly mdmService: MdmService) {}

  @Post()
  create(@Body() input: SourceRecordInput): SourceRecord {
    return this.mdmService.createSourceRecord(input);
  }

  @Post("ingest")
  ingest(@Body() input: SourceRecordInput): {
    sourceRecord: SourceRecord;
    matches: MatchResult[];
    goldenRecord?: GoldenRecord;
    mergeResult?: MergeResult;
  } {
    return this.mdmService.ingestAndMatch(input);
  }

  @Get()
  getAll(@Query("entityType") entityType?: string): SourceRecord[] {
    if (entityType) {
      return this.mdmService.getSourceRecordsByEntityType(entityType);
    }
    return this.mdmService.getAllSourceRecords();
  }

  @Get(":id")
  get(@Param("id") id: string): SourceRecord {
    const record = this.mdmService.getSourceRecord(id);
    if (!record) {
      throw new NotFoundException(`Source record not found: ${id}`);
    }
    return record;
  }

  @Get(":id/matches")
  findMatches(@Param("id") id: string): MatchResult[] {
    const record = this.mdmService.getSourceRecord(id);
    if (!record) {
      throw new NotFoundException(`Source record not found: ${id}`);
    }
    return this.mdmService.findMatches(id);
  }

  @Post(":id/link/:goldenId")
  linkToGolden(@Param("id") id: string, @Param("goldenId") goldenId: string): MergeResult {
    const result = this.mdmService.linkSourceToGolden(id, goldenId);
    if (!result) {
      throw new BadRequestException(`Cannot link source ${id} to golden ${goldenId}`);
    }
    return result;
  }

  @Post(":id/unlink")
  unlink(@Param("id") id: string): { unlinked: boolean } {
    const unlinked = this.mdmService.unlinkSource(id);
    if (!unlinked) {
      throw new BadRequestException(`Cannot unlink source ${id}`);
    }
    return { unlinked: true };
  }

  @Delete(":id")
  delete(@Param("id") id: string): { deleted: boolean } {
    const deleted = this.mdmService.deleteSourceRecord(id);
    if (!deleted) {
      throw new NotFoundException(`Source record not found: ${id}`);
    }
    return { deleted: true };
  }
}

// ==================== Golden Record Controller ====================

@Controller("mdm/golden-records")
export class GoldenRecordController {
  constructor(private readonly mdmService: MdmService) {}

  @Post()
  create(@Body() input: GoldenRecordInput): GoldenRecord {
    return this.mdmService.createGoldenRecord(input);
  }

  @Get()
  getAll(@Query("entityType") entityType?: string): GoldenRecord[] {
    if (entityType) {
      return this.mdmService.getGoldenRecordsByEntityType(entityType);
    }
    return this.mdmService.getAllGoldenRecords();
  }

  @Get(":id")
  get(@Param("id") id: string): GoldenRecord {
    const record = this.mdmService.getGoldenRecord(id);
    if (!record) {
      throw new NotFoundException(`Golden record not found: ${id}`);
    }
    return record;
  }

  @Post(":id/merge/:otherId")
  merge(@Param("id") id: string, @Param("otherId") otherId: string): GoldenRecord {
    const result = this.mdmService.mergeGoldenRecords(id, otherId);
    if (!result) {
      throw new BadRequestException(`Cannot merge golden records ${id} and ${otherId}`);
    }
    return result;
  }

  @Delete(":id")
  delete(@Param("id") id: string): { deleted: boolean } {
    const deleted = this.mdmService.deleteGoldenRecord(id);
    if (!deleted) {
      throw new NotFoundException(`Golden record not found: ${id}`);
    }
    return { deleted: true };
  }
}
