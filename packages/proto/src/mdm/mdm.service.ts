import { Injectable } from "@nestjs/common";
import { MdmService as MdmCoreService } from "@simple-proto/mdm";
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
import { StorageService } from "../storage/storage.service.js";

@Injectable()
export class MdmService {
  private mdmService: MdmCoreService;

  constructor(storage: StorageService) {
    this.mdmService = new MdmCoreService(storage);
    this.mdmService.initialize();
  }

  // ==================== Match Config ====================

  createMatchConfig(input: MatchConfigInput): MatchConfig {
    return this.mdmService.createMatchConfig(input);
  }

  getMatchConfig(id: string): MatchConfig | null {
    return this.mdmService.getMatchConfig(id);
  }

  getMatchConfigByEntityType(entityType: string): MatchConfig | null {
    return this.mdmService.getMatchConfigByEntityType(entityType);
  }

  getAllMatchConfigs(): MatchConfig[] {
    return this.mdmService.getAllMatchConfigs();
  }

  updateMatchConfig(id: string, updates: Partial<MatchConfigInput>): MatchConfig | null {
    return this.mdmService.updateMatchConfig(id, updates);
  }

  deleteMatchConfig(id: string): boolean {
    return this.mdmService.deleteMatchConfig(id);
  }

  // ==================== Survivorship Config ====================

  createSurvivorshipConfig(input: SurvivorshipConfigInput): SurvivorshipConfig {
    return this.mdmService.createSurvivorshipConfig(input);
  }

  getSurvivorshipConfig(id: string): SurvivorshipConfig | null {
    return this.mdmService.getSurvivorshipConfig(id);
  }

  getSurvivorshipConfigByEntityType(entityType: string): SurvivorshipConfig | null {
    return this.mdmService.getSurvivorshipConfigByEntityType(entityType);
  }

  getAllSurvivorshipConfigs(): SurvivorshipConfig[] {
    return this.mdmService.getAllSurvivorshipConfigs();
  }

  updateSurvivorshipConfig(
    id: string,
    updates: Partial<SurvivorshipConfigInput>
  ): SurvivorshipConfig | null {
    return this.mdmService.updateSurvivorshipConfig(id, updates);
  }

  deleteSurvivorshipConfig(id: string): boolean {
    return this.mdmService.deleteSurvivorshipConfig(id);
  }

  // ==================== Source Records ====================

  createSourceRecord(input: SourceRecordInput): SourceRecord {
    return this.mdmService.createSourceRecord(input);
  }

  getSourceRecord(id: string): SourceRecord | null {
    return this.mdmService.getSourceRecord(id);
  }

  getSourceRecordsByEntityType(entityType: string): SourceRecord[] {
    return this.mdmService.getSourceRecordsByEntityType(entityType);
  }

  getAllSourceRecords(): SourceRecord[] {
    return this.mdmService.getAllSourceRecords();
  }

  deleteSourceRecord(id: string): boolean {
    return this.mdmService.deleteSourceRecord(id);
  }

  // ==================== Golden Records ====================

  createGoldenRecord(input: GoldenRecordInput): GoldenRecord {
    return this.mdmService.createGoldenRecord(input);
  }

  getGoldenRecord(id: string): GoldenRecord | null {
    return this.mdmService.getGoldenRecord(id);
  }

  getGoldenRecordsByEntityType(entityType: string): GoldenRecord[] {
    return this.mdmService.getGoldenRecordsByEntityType(entityType);
  }

  getAllGoldenRecords(): GoldenRecord[] {
    return this.mdmService.getAllGoldenRecords();
  }

  deleteGoldenRecord(id: string): boolean {
    return this.mdmService.deleteGoldenRecord(id);
  }

  // ==================== Matching Operations ====================

  findMatches(sourceRecordId: string): MatchResult[] {
    return this.mdmService.findMatches(sourceRecordId);
  }

  ingestAndMatch(input: SourceRecordInput): {
    sourceRecord: SourceRecord;
    matches: MatchResult[];
    goldenRecord?: GoldenRecord;
    mergeResult?: MergeResult;
  } {
    return this.mdmService.ingestAndMatch(input);
  }

  // ==================== Linking Operations ====================

  linkSourceToGolden(sourceRecordId: string, goldenRecordId: string): MergeResult | null {
    return this.mdmService.linkSourceToGolden(sourceRecordId, goldenRecordId);
  }

  unlinkSource(sourceRecordId: string): boolean {
    return this.mdmService.unlinkSource(sourceRecordId);
  }

  mergeGoldenRecords(goldenId1: string, goldenId2: string): GoldenRecord | null {
    return this.mdmService.mergeGoldenRecords(goldenId1, goldenId2);
  }
}
