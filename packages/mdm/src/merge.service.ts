/**
 * Merge Service for MDM
 * Implements golden record creation and survivorship rules
 */

import type {
  GoldenRecord,
  MergeDecision,
  MergeResult,
  SourceContribution,
  SourceRecord,
  SurvivorshipConfig,
  SurvivorshipRule,
  SurvivorshipStrategy,
} from "@simple-proto/mdm-types";
import { getValueByPath, setValueByPath } from "./utils.js";

interface Candidate {
  sourceSystem: string;
  sourceRecordId: string;
  value: unknown;
  confidence: number;
  updatedAt: Date;
}

export class MergeService {
  /**
   * Get all unique field paths from source records
   */
  private getAllFields(sources: SourceRecord[]): string[] {
    const fields = new Set<string>();

    const extractFields = (obj: Record<string, unknown>, prefix = ""): void => {
      for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (
          value !== null &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          !(value instanceof Date)
        ) {
          extractFields(value as Record<string, unknown>, path);
        } else {
          fields.add(path);
        }
      }
    };

    for (const source of sources) {
      extractFields(source.data);
    }

    return Array.from(fields);
  }

  /**
   * Get all candidates for a field from source records
   */
  private getCandidates(field: string, sources: SourceRecord[]): Candidate[] {
    const candidates: Candidate[] = [];

    for (const source of sources) {
      const value = getValueByPath(source.data, field);
      if (value !== undefined && value !== null && value !== "") {
        candidates.push({
          sourceSystem: source.sourceSystem,
          sourceRecordId: source.id,
          value,
          confidence: source.confidence,
          updatedAt: source.sourceUpdatedAt,
        });
      }
    }

    return candidates;
  }

  /**
   * Select winning value using a survivorship strategy
   */
  selectWinner(
    candidates: Candidate[],
    strategy: SurvivorshipStrategy,
    sourceRanking?: string[]
  ): {
    value: unknown;
    sourceSystem: string;
  } | null {
    if (candidates.length === 0) return null;

    const first = candidates[0];
    if (!first) return null;

    if (candidates.length === 1) {
      return {
        value: first.value,
        sourceSystem: first.sourceSystem,
      };
    }

    switch (strategy) {
      case "mostRecent": {
        const sorted = [...candidates].sort(
          (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
        );
        const winner = sorted[0];
        if (!winner) return null;
        return {
          value: winner.value,
          sourceSystem: winner.sourceSystem,
        };
      }

      case "highestConfidence": {
        const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
        const winner = sorted[0];
        if (!winner) return null;
        return {
          value: winner.value,
          sourceSystem: winner.sourceSystem,
        };
      }

      case "sourceRanking": {
        if (!sourceRanking || sourceRanking.length === 0) {
          // Fall back to first candidate
          return {
            value: first.value,
            sourceSystem: first.sourceSystem,
          };
        }

        for (const source of sourceRanking) {
          const candidate = candidates.find((c) => c.sourceSystem === source);
          if (candidate) {
            return {
              value: candidate.value,
              sourceSystem: candidate.sourceSystem,
            };
          }
        }

        // No match in ranking, use first candidate
        return {
          value: first.value,
          sourceSystem: first.sourceSystem,
        };
      }

      case "mostFrequent": {
        // Count occurrences of each value
        const valueCounts = new Map<string, { count: number; candidate: Candidate }>();

        for (const candidate of candidates) {
          const key = JSON.stringify(candidate.value);
          const existing = valueCounts.get(key);
          if (existing) {
            existing.count++;
          } else {
            valueCounts.set(key, { count: 1, candidate });
          }
        }

        let maxCount = 0;
        let winner: Candidate | null = null;

        for (const { count, candidate } of valueCounts.values()) {
          if (count > maxCount) {
            maxCount = count;
            winner = candidate;
          }
        }

        return winner ? { value: winner.value, sourceSystem: winner.sourceSystem } : null;
      }

      case "longestValue": {
        const sorted = [...candidates].sort((a, b) => {
          const lenA = String(a.value).length;
          const lenB = String(b.value).length;
          return lenB - lenA;
        });
        const winner = sorted[0];
        if (!winner) return null;
        return {
          value: winner.value,
          sourceSystem: winner.sourceSystem,
        };
      }

      case "manual":
        // For manual strategy, return first (existing golden record value would be passed in)
        return {
          value: first.value,
          sourceSystem: first.sourceSystem,
        };

      default:
        return {
          value: first.value,
          sourceSystem: first.sourceSystem,
        };
    }
  }

  /**
   * Find the survivorship rule for a field
   */
  private findRuleForField(field: string, config: SurvivorshipConfig): SurvivorshipRule | null {
    // Direct match
    const directMatch = config.rules.find((r) => r.field === field);
    if (directMatch) return directMatch;

    // Check for parent path matches (e.g., "address" rule applies to "address.city")
    const parts = field.split(".");
    for (let i = parts.length - 1; i >= 0; i--) {
      const parentPath = parts.slice(0, i).join(".");
      const parentMatch = config.rules.find((r) => r.field === parentPath);
      if (parentMatch) return parentMatch;
    }

    return null;
  }

  /**
   * Merge source records into a golden record
   */
  merge(
    sources: SourceRecord[],
    config: SurvivorshipConfig,
    existingGoldenRecord?: GoldenRecord
  ): MergeResult {
    if (sources.length === 0) {
      throw new Error("Cannot merge empty source records");
    }

    const firstSource = sources[0];
    if (!firstSource) {
      throw new Error("Cannot merge empty source records");
    }

    const entityType = firstSource.entityType;
    const fields = this.getAllFields(sources);
    const mergeDecisions: MergeDecision[] = [];
    const data: Record<string, unknown> = {};
    const sourceContributions = new Map<string, Set<string>>();

    for (const field of fields) {
      const candidates = this.getCandidates(field, sources);
      const rule = this.findRuleForField(field, config);

      // Determine strategy
      const strategy = rule?.strategy ?? config.defaultStrategy;
      const sourceRanking = rule?.sourceRanking ?? config.defaultSourceRanking;

      // Check for manual values in existing golden record
      if (strategy === "manual" && existingGoldenRecord) {
        const existingValue = getValueByPath(existingGoldenRecord.data, field);
        if (existingValue !== undefined) {
          setValueByPath(data, field, existingValue);
          mergeDecisions.push({
            field,
            selectedValue: existingValue,
            strategy: "manual",
            sourceSystem: "golden",
            candidates: candidates.map((c) => ({
              sourceSystem: c.sourceSystem,
              value: c.value,
              confidence: c.confidence,
              updatedAt: c.updatedAt,
            })),
          });
          continue;
        }
      }

      const winner = this.selectWinner(candidates, strategy, sourceRanking);

      if (winner) {
        setValueByPath(data, field, winner.value);

        // Track source contributions
        let contrib = sourceContributions.get(winner.sourceSystem);
        if (!contrib) {
          contrib = new Set();
          sourceContributions.set(winner.sourceSystem, contrib);
        }
        contrib.add(field);

        mergeDecisions.push({
          field,
          selectedValue: winner.value,
          strategy,
          sourceSystem: winner.sourceSystem,
          candidates: candidates.map((c) => ({
            sourceSystem: c.sourceSystem,
            value: c.value,
            confidence: c.confidence,
            updatedAt: c.updatedAt,
          })),
        });
      } else if (rule?.defaultValue !== undefined) {
        setValueByPath(data, field, rule.defaultValue);
        mergeDecisions.push({
          field,
          selectedValue: rule.defaultValue,
          strategy,
          sourceSystem: "default",
          candidates: [],
        });
      }
    }

    // Build source contributions array
    const sourceContribArr: SourceContribution[] = [];
    for (const source of sources) {
      const contributedFields = sourceContributions.get(source.sourceSystem);
      if (contributedFields && contributedFields.size > 0) {
        sourceContribArr.push({
          sourceSystem: source.sourceSystem,
          sourceRecordId: source.id,
          contributedFields: Array.from(contributedFields),
          lastUpdatedAt: source.sourceUpdatedAt,
        });
      }
    }

    // Calculate overall confidence (average of source confidences weighted by contribution)
    let totalConfidence = 0;
    let totalFields = 0;
    for (const source of sources) {
      const contributedFields = sourceContributions.get(source.sourceSystem);
      const fieldCount = contributedFields?.size ?? 0;
      totalConfidence += source.confidence * fieldCount;
      totalFields += fieldCount;
    }
    const overallConfidence = totalFields > 0 ? totalConfidence / totalFields : 0.5;

    const now = new Date();

    const goldenRecord: GoldenRecord = {
      id: existingGoldenRecord?.id ?? crypto.randomUUID(),
      entityType,
      data,
      sources: sourceContribArr,
      matchedSourceIds: sources.map((s) => s.id),
      confidence: overallConfidence,
      needsReview: false,
      createdAt: existingGoldenRecord?.createdAt ?? now,
      updatedAt: now,
      lastMergedAt: now,
    };

    return {
      goldenRecord,
      mergedSourceIds: sources.map((s) => s.id),
      mergeDecisions,
    };
  }

  /**
   * Add a source record to an existing golden record
   */
  addToGoldenRecord(
    existingGoldenRecord: GoldenRecord,
    newSource: SourceRecord,
    allSources: SourceRecord[],
    config: SurvivorshipConfig
  ): MergeResult {
    // Re-merge all sources with the new one
    const sourcesToMerge = allSources.filter(
      (s) => existingGoldenRecord.matchedSourceIds.includes(s.id) || s.id === newSource.id
    );

    return this.merge(sourcesToMerge, config, existingGoldenRecord);
  }
}
