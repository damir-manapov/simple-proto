/**
 * MDM Service
 * Main orchestration service for Master Data Management
 */

import type {
  GoldenRecord,
  GoldenRecordInput,
  MatchConfig,
  MatchConfigInput,
  MatchResult,
  MergeResult,
  SourceRecord,
  SourceRecordInput,
  SurvivorshipConfig,
  SurvivorshipConfigInput,
} from "@simple-proto/mdm-types";
import type { IStorage, Filter } from "@simple-proto/storage-types";
import { MatchingService } from "./matching.service.js";
import { MergeService } from "./merge.service.js";

// Storage collection names
const MATCH_CONFIGS = "mdm_match_configs";
const SURVIVORSHIP_CONFIGS = "mdm_survivorship_configs";
const SOURCE_RECORDS = "mdm_source_records";
const GOLDEN_RECORDS = "mdm_golden_records";

export class MdmService {
  private readonly matchingService: MatchingService;
  private readonly mergeService: MergeService;

  constructor(private readonly storage: IStorage) {
    this.matchingService = new MatchingService();
    this.mergeService = new MergeService();
  }

  /**
   * Initialize MDM collections in storage
   */
  initialize(): void {
    const collections = [MATCH_CONFIGS, SURVIVORSHIP_CONFIGS, SOURCE_RECORDS, GOLDEN_RECORDS];

    for (const name of collections) {
      const exists = this.storage.hasCollection(name);
      if (!exists) {
        this.storage.registerCollection({ name, schema: {} });
      }
    }
  }

  // ==================== Match Config CRUD ====================

  createMatchConfig(input: MatchConfigInput): MatchConfig {
    const repo = this.storage.getRepository<MatchConfig>(MATCH_CONFIGS);
    const now = new Date();

    const config: MatchConfig = {
      id: input.id ?? crypto.randomUUID(),
      entityType: input.entityType,
      name: input.name,
      ...(input.description !== undefined && { description: input.description }),
      rules: input.rules,
      threshold: input.threshold ?? 0.7,
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    };

    repo.create(config);
    return config;
  }

  getMatchConfig(id: string): MatchConfig | null {
    const repo = this.storage.getRepository<MatchConfig>(MATCH_CONFIGS);
    return repo.findById(id);
  }

  getMatchConfigByEntityType(entityType: string): MatchConfig | null {
    const repo = this.storage.getRepository<MatchConfig>(MATCH_CONFIGS);
    const filter = {
      entityType: { eq: entityType },
      active: { eq: true },
    } as unknown as Filter<MatchConfig>;
    const configs = repo.findAll(filter);
    return configs[0] ?? null;
  }

  getAllMatchConfigs(): MatchConfig[] {
    const repo = this.storage.getRepository<MatchConfig>(MATCH_CONFIGS);
    return repo.findAll();
  }

  updateMatchConfig(id: string, updates: Partial<MatchConfigInput>): MatchConfig | null {
    const repo = this.storage.getRepository<MatchConfig>(MATCH_CONFIGS);
    const existing = repo.findById(id);
    if (!existing) return null;

    const updated: MatchConfig = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    return repo.update(id, updated);
  }

  deleteMatchConfig(id: string): boolean {
    const repo = this.storage.getRepository<MatchConfig>(MATCH_CONFIGS);
    return repo.delete(id);
  }

  // ==================== Survivorship Config CRUD ====================

  createSurvivorshipConfig(input: SurvivorshipConfigInput): SurvivorshipConfig {
    const repo = this.storage.getRepository<SurvivorshipConfig>(SURVIVORSHIP_CONFIGS);
    const now = new Date();

    const config: SurvivorshipConfig = {
      id: input.id ?? crypto.randomUUID(),
      entityType: input.entityType,
      name: input.name,
      ...(input.description !== undefined && { description: input.description }),
      rules: input.rules,
      defaultStrategy: input.defaultStrategy ?? "mostRecent",
      ...(input.defaultSourceRanking !== undefined && {
        defaultSourceRanking: input.defaultSourceRanking,
      }),
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    };

    repo.create(config);
    return config;
  }

  getSurvivorshipConfig(id: string): SurvivorshipConfig | null {
    const repo = this.storage.getRepository<SurvivorshipConfig>(SURVIVORSHIP_CONFIGS);
    return repo.findById(id);
  }

  getSurvivorshipConfigByEntityType(entityType: string): SurvivorshipConfig | null {
    const repo = this.storage.getRepository<SurvivorshipConfig>(SURVIVORSHIP_CONFIGS);
    const filter = {
      entityType: { eq: entityType },
      active: { eq: true },
    } as unknown as Filter<SurvivorshipConfig>;
    const configs = repo.findAll(filter);
    return configs[0] ?? null;
  }

  getAllSurvivorshipConfigs(): SurvivorshipConfig[] {
    const repo = this.storage.getRepository<SurvivorshipConfig>(SURVIVORSHIP_CONFIGS);
    return repo.findAll();
  }

  updateSurvivorshipConfig(
    id: string,
    updates: Partial<SurvivorshipConfigInput>
  ): SurvivorshipConfig | null {
    const repo = this.storage.getRepository<SurvivorshipConfig>(SURVIVORSHIP_CONFIGS);
    const existing = repo.findById(id);
    if (!existing) return null;

    const updated: SurvivorshipConfig = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    return repo.update(id, updated);
  }

  deleteSurvivorshipConfig(id: string): boolean {
    const repo = this.storage.getRepository<SurvivorshipConfig>(SURVIVORSHIP_CONFIGS);
    return repo.delete(id);
  }

  // ==================== Source Record CRUD ====================

  createSourceRecord(input: SourceRecordInput): SourceRecord {
    const repo = this.storage.getRepository<SourceRecord>(SOURCE_RECORDS);
    const now = new Date();

    const record: SourceRecord = {
      id: input.id ?? crypto.randomUUID(),
      entityType: input.entityType,
      sourceSystem: input.sourceSystem,
      sourceId: input.sourceId,
      data: input.data,
      confidence: input.confidence ?? 1.0,
      sourceUpdatedAt: input.sourceUpdatedAt ?? now,
      ingestedAt: now,
    };

    repo.create(record);
    return record;
  }

  getSourceRecord(id: string): SourceRecord | null {
    const repo = this.storage.getRepository<SourceRecord>(SOURCE_RECORDS);
    return repo.findById(id);
  }

  getSourceRecordsByEntityType(entityType: string): SourceRecord[] {
    const repo = this.storage.getRepository<SourceRecord>(SOURCE_RECORDS);
    const filter = { entityType: { eq: entityType } } as unknown as Filter<SourceRecord>;
    return repo.findAll(filter);
  }

  getSourceRecordsByGoldenRecord(goldenRecordId: string): SourceRecord[] {
    const repo = this.storage.getRepository<SourceRecord>(SOURCE_RECORDS);
    const filter = { goldenRecordId: { eq: goldenRecordId } } as unknown as Filter<SourceRecord>;
    return repo.findAll(filter);
  }

  getUnmatchedSourceRecords(entityType: string): SourceRecord[] {
    // Get records without a goldenRecordId
    const all = this.getSourceRecordsByEntityType(entityType);
    return all.filter((r) => !r.goldenRecordId);
  }

  getAllSourceRecords(): SourceRecord[] {
    const repo = this.storage.getRepository<SourceRecord>(SOURCE_RECORDS);
    return repo.findAll();
  }

  updateSourceRecord(id: string, updates: Partial<SourceRecordInput>): SourceRecord | null {
    const repo = this.storage.getRepository<SourceRecord>(SOURCE_RECORDS);
    const existing = repo.findById(id);
    if (!existing) return null;

    const updated: SourceRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      ingestedAt: existing.ingestedAt,
    };

    return repo.update(id, updated);
  }

  deleteSourceRecord(id: string): boolean {
    const repo = this.storage.getRepository<SourceRecord>(SOURCE_RECORDS);
    return repo.delete(id);
  }

  // ==================== Golden Record CRUD ====================

  createGoldenRecord(input: GoldenRecordInput): GoldenRecord {
    const repo = this.storage.getRepository<GoldenRecord>(GOLDEN_RECORDS);
    const now = new Date();

    const record: GoldenRecord = {
      id: input.id ?? crypto.randomUUID(),
      entityType: input.entityType,
      data: input.data,
      sources: [],
      matchedSourceIds: input.matchedSourceIds ?? [],
      confidence: input.confidence ?? 1.0,
      needsReview: input.needsReview ?? false,
      ...(input.reviewNotes !== undefined && { reviewNotes: input.reviewNotes }),
      createdAt: now,
      updatedAt: now,
      lastMergedAt: now,
    };

    repo.create(record);
    return record;
  }

  getGoldenRecord(id: string): GoldenRecord | null {
    const repo = this.storage.getRepository<GoldenRecord>(GOLDEN_RECORDS);
    return repo.findById(id);
  }

  getGoldenRecordsByEntityType(entityType: string): GoldenRecord[] {
    const repo = this.storage.getRepository<GoldenRecord>(GOLDEN_RECORDS);
    const filter = { entityType: { eq: entityType } } as unknown as Filter<GoldenRecord>;
    return repo.findAll(filter);
  }

  getAllGoldenRecords(): GoldenRecord[] {
    const repo = this.storage.getRepository<GoldenRecord>(GOLDEN_RECORDS);
    return repo.findAll();
  }

  updateGoldenRecord(id: string, updates: Partial<GoldenRecordInput>): GoldenRecord | null {
    const repo = this.storage.getRepository<GoldenRecord>(GOLDEN_RECORDS);
    const existing = repo.findById(id);
    if (!existing) return null;

    const updated: GoldenRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    return repo.update(id, updated);
  }

  deleteGoldenRecord(id: string): boolean {
    const repo = this.storage.getRepository<GoldenRecord>(GOLDEN_RECORDS);
    return repo.delete(id);
  }

  // ==================== Matching Operations ====================

  /**
   * Find potential matches for a source record
   */
  findMatches(sourceRecordId: string): MatchResult[] {
    const sourceRecord = this.getSourceRecord(sourceRecordId);
    if (!sourceRecord) {
      throw new Error(`Source record not found: ${sourceRecordId}`);
    }

    const matchConfig = this.getMatchConfigByEntityType(sourceRecord.entityType);
    if (!matchConfig) {
      throw new Error(`No match config found for entity type: ${sourceRecord.entityType}`);
    }

    const goldenRecords = this.getGoldenRecordsByEntityType(sourceRecord.entityType);
    const sourceRecords = this.getSourceRecordsByEntityType(sourceRecord.entityType);

    return this.matchingService.findAllMatches(
      sourceRecord,
      goldenRecords,
      sourceRecords,
      matchConfig
    );
  }

  /**
   * Match two specific records
   */
  matchRecords(
    sourceId: string,
    targetId: string,
    targetType: "golden" | "source"
  ): MatchResult | null {
    const sourceRecord = this.getSourceRecord(sourceId);
    if (!sourceRecord) return null;

    const matchConfig = this.getMatchConfigByEntityType(sourceRecord.entityType);
    if (!matchConfig) return null;

    let targetData: Record<string, unknown>;
    if (targetType === "golden") {
      const golden = this.getGoldenRecord(targetId);
      if (!golden) return null;
      targetData = golden.data;
    } else {
      const source = this.getSourceRecord(targetId);
      if (!source) return null;
      targetData = source.data;
    }

    return this.matchingService.matchRecords(
      { id: sourceRecord.id, data: sourceRecord.data },
      { id: targetId, type: targetType, data: targetData },
      matchConfig
    );
  }

  // ==================== Merging Operations ====================

  /**
   * Ingest a source record and automatically match/merge
   */
  ingestAndMatch(input: SourceRecordInput): {
    sourceRecord: SourceRecord;
    matches: MatchResult[];
    goldenRecord?: GoldenRecord;
    mergeResult?: MergeResult;
  } {
    // Create the source record
    const sourceRecord = this.createSourceRecord(input);

    // Get configs
    const matchConfig = this.getMatchConfigByEntityType(sourceRecord.entityType);
    const survivorshipConfig = this.getSurvivorshipConfigByEntityType(sourceRecord.entityType);

    if (!matchConfig || !survivorshipConfig) {
      return { sourceRecord, matches: [] };
    }

    // Find matches
    const goldenRecords = this.getGoldenRecordsByEntityType(sourceRecord.entityType);
    const matches = this.matchingService.findMatchesInGoldenRecords(
      sourceRecord,
      goldenRecords,
      matchConfig
    );

    // If we have a match, merge into existing golden record
    if (matches.length > 0) {
      const bestMatch = matches[0];
      if (!bestMatch) {
        return { sourceRecord, matches };
      }
      const existingGolden = this.getGoldenRecord(bestMatch.matchedRecordId);

      if (existingGolden) {
        const allSources = this.getSourceRecordsByEntityType(sourceRecord.entityType);
        const mergeResult = this.mergeService.addToGoldenRecord(
          existingGolden,
          sourceRecord,
          allSources,
          survivorshipConfig
        );

        // Update golden record
        const goldenRepo = this.storage.getRepository<GoldenRecord>(GOLDEN_RECORDS);
        goldenRepo.update(mergeResult.goldenRecord.id, mergeResult.goldenRecord);

        // Link source record to golden record
        const sourceRepo = this.storage.getRepository<SourceRecord>(SOURCE_RECORDS);
        const linkedSource: SourceRecord = {
          ...sourceRecord,
          goldenRecordId: mergeResult.goldenRecord.id,
          matchScore: bestMatch.score,
        };
        sourceRepo.update(sourceRecord.id, linkedSource);

        return {
          sourceRecord: linkedSource,
          matches,
          goldenRecord: mergeResult.goldenRecord,
          mergeResult,
        };
      }
    }

    // No matches - create new golden record
    const mergeResult = this.mergeService.merge([sourceRecord], survivorshipConfig);

    // Save golden record
    const goldenRepo = this.storage.getRepository<GoldenRecord>(GOLDEN_RECORDS);
    goldenRepo.create(mergeResult.goldenRecord);

    // Link source record to golden record
    const sourceRepo = this.storage.getRepository<SourceRecord>(SOURCE_RECORDS);
    const linkedSource: SourceRecord = {
      ...sourceRecord,
      goldenRecordId: mergeResult.goldenRecord.id,
      matchScore: 1.0,
    };
    sourceRepo.update(sourceRecord.id, linkedSource);

    return {
      sourceRecord: linkedSource,
      matches,
      goldenRecord: mergeResult.goldenRecord,
      mergeResult,
    };
  }

  /**
   * Manually link a source record to a golden record
   */
  linkSourceToGolden(sourceRecordId: string, goldenRecordId: string): MergeResult | null {
    const sourceRecord = this.getSourceRecord(sourceRecordId);
    const goldenRecord = this.getGoldenRecord(goldenRecordId);

    if (!sourceRecord || !goldenRecord) return null;

    const survivorshipConfig = this.getSurvivorshipConfigByEntityType(sourceRecord.entityType);
    if (!survivorshipConfig) return null;

    const allSources = this.getSourceRecordsByEntityType(sourceRecord.entityType);
    const mergeResult = this.mergeService.addToGoldenRecord(
      goldenRecord,
      sourceRecord,
      allSources,
      survivorshipConfig
    );

    // Update golden record
    const goldenRepo = this.storage.getRepository<GoldenRecord>(GOLDEN_RECORDS);
    goldenRepo.update(mergeResult.goldenRecord.id, mergeResult.goldenRecord);

    // Link source record
    const sourceRepo = this.storage.getRepository<SourceRecord>(SOURCE_RECORDS);
    const linkedSource: SourceRecord = {
      ...sourceRecord,
      goldenRecordId,
      matchScore: 1.0, // Manual link
    };
    sourceRepo.update(sourceRecordId, linkedSource);

    return mergeResult;
  }

  /**
   * Unlink a source record from its golden record
   */
  unlinkSource(sourceRecordId: string): boolean {
    const sourceRecord = this.getSourceRecord(sourceRecordId);
    if (!sourceRecord?.goldenRecordId) return false;

    const goldenRecordId = sourceRecord.goldenRecordId;

    // Unlink source - create new record without optional linked fields
    const sourceRepo = this.storage.getRepository<SourceRecord>(SOURCE_RECORDS);
    const unlinkedSource: SourceRecord = {
      id: sourceRecord.id,
      entityType: sourceRecord.entityType,
      sourceSystem: sourceRecord.sourceSystem,
      sourceId: sourceRecord.sourceId,
      data: sourceRecord.data,
      confidence: sourceRecord.confidence,
      sourceUpdatedAt: sourceRecord.sourceUpdatedAt,
      ingestedAt: sourceRecord.ingestedAt,
    };
    sourceRepo.update(sourceRecordId, unlinkedSource);

    // Re-merge golden record without this source
    const survivorshipConfig = this.getSurvivorshipConfigByEntityType(sourceRecord.entityType);
    if (survivorshipConfig) {
      const remainingSources = this.getSourceRecordsByGoldenRecord(goldenRecordId);

      if (remainingSources.length === 0) {
        // No more sources - delete golden record
        this.deleteGoldenRecord(goldenRecordId);
      } else {
        // Re-merge remaining sources
        const existingGolden = this.getGoldenRecord(goldenRecordId);
        if (existingGolden) {
          const mergeResult = this.mergeService.merge(
            remainingSources,
            survivorshipConfig,
            existingGolden
          );
          const goldenRepo = this.storage.getRepository<GoldenRecord>(GOLDEN_RECORDS);
          goldenRepo.update(goldenRecordId, mergeResult.goldenRecord);
        }
      }
    }

    return true;
  }

  /**
   * Merge two golden records into one
   */
  mergeGoldenRecords(goldenId1: string, goldenId2: string): GoldenRecord | null {
    const golden1 = this.getGoldenRecord(goldenId1);
    const golden2 = this.getGoldenRecord(goldenId2);

    if (!golden1 || !golden2) return null;
    if (golden1.entityType !== golden2.entityType) return null;

    // Get all source records for both golden records
    const sources1 = this.getSourceRecordsByGoldenRecord(goldenId1);
    const sources2 = this.getSourceRecordsByGoldenRecord(goldenId2);
    const allSources = [...sources1, ...sources2];

    const survivorshipConfig = this.getSurvivorshipConfigByEntityType(golden1.entityType);
    if (!survivorshipConfig) return null;

    // Merge into first golden record
    const mergeResult = this.mergeService.merge(allSources, survivorshipConfig, golden1);

    // Update first golden record
    const goldenRepo = this.storage.getRepository<GoldenRecord>(GOLDEN_RECORDS);
    goldenRepo.update(goldenId1, mergeResult.goldenRecord);

    // Update source records from second golden record to point to first
    const sourceRepo = this.storage.getRepository<SourceRecord>(SOURCE_RECORDS);
    for (const source of sources2) {
      const updated: SourceRecord = { ...source, goldenRecordId: golden1.id };
      sourceRepo.update(source.id, updated);
    }

    // Delete second golden record
    this.deleteGoldenRecord(goldenId2);

    return mergeResult.goldenRecord;
  }

  /**
   * Re-merge a golden record from its source records
   */
  refreshGoldenRecord(goldenRecordId: string): MergeResult | null {
    const goldenRecord = this.getGoldenRecord(goldenRecordId);
    if (!goldenRecord) return null;

    const sources = this.getSourceRecordsByGoldenRecord(goldenRecordId);
    if (sources.length === 0) return null;

    const survivorshipConfig = this.getSurvivorshipConfigByEntityType(goldenRecord.entityType);
    if (!survivorshipConfig) return null;

    const mergeResult = this.mergeService.merge(sources, survivorshipConfig, goldenRecord);

    // Update golden record
    const goldenRepo = this.storage.getRepository<GoldenRecord>(GOLDEN_RECORDS);
    goldenRepo.update(goldenRecordId, mergeResult.goldenRecord);

    return mergeResult;
  }
}
