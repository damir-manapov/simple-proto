/**
 * Matching Service for MDM
 * Implements record matching using configurable rules
 */

import type {
  MatchConfig,
  MatchRule,
  MatchResult,
  RuleScore,
  SourceRecord,
  GoldenRecord,
} from "@simple-proto/mdm-types";
import {
  levenshteinSimilarity,
  soundexSimilarity,
  normalizeString,
  getValueByPath,
} from "./utils.js";

/**
 * Safely convert a value to string
 */
function toString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
}

export class MatchingService {
  /**
   * Compare two values using the specified match type
   */
  compareValues(sourceValue: unknown, targetValue: unknown, rule: MatchRule): number {
    // Handle null/undefined
    if (sourceValue === null || sourceValue === undefined) {
      return targetValue === null || targetValue === undefined ? 1.0 : 0.0;
    }
    if (targetValue === null || targetValue === undefined) {
      return 0.0;
    }

    switch (rule.type) {
      case "exact":
        return sourceValue === targetValue ? 1.0 : 0.0;

      case "exactCaseInsensitive":
        return toString(sourceValue).toLowerCase() === toString(targetValue).toLowerCase()
          ? 1.0
          : 0.0;

      case "normalized":
        return normalizeString(toString(sourceValue)) === normalizeString(toString(targetValue))
          ? 1.0
          : 0.0;

      case "fuzzy": {
        const strA = toString(sourceValue);
        const strB = toString(targetValue);
        const similarity = levenshteinSimilarity(strA, strB);

        // If maxDistance is specified, check against it
        if (rule.options?.maxDistance !== undefined) {
          const maxLen = Math.max(strA.length, strB.length);
          const actualDistance = Math.round((1 - similarity) * maxLen);
          return actualDistance <= rule.options.maxDistance ? similarity : 0.0;
        }

        return similarity;
      }

      case "phonetic": {
        return soundexSimilarity(toString(sourceValue), toString(targetValue));
      }

      case "numeric": {
        const numA = Number(sourceValue);
        const numB = Number(targetValue);

        if (isNaN(numA) || isNaN(numB)) return 0.0;
        if (numA === numB) return 1.0;

        const tolerance = rule.options?.numericTolerance ?? 0;
        const diff = Math.abs(numA - numB);

        if (diff <= tolerance) {
          // Scale score based on how close within tolerance
          return 1.0 - diff / (tolerance + 1);
        }

        return 0.0;
      }

      case "date": {
        const dateA = sourceValue instanceof Date ? sourceValue : new Date(toString(sourceValue));
        const dateB = targetValue instanceof Date ? targetValue : new Date(toString(targetValue));

        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0.0;
        if (dateA.getTime() === dateB.getTime()) return 1.0;

        const toleranceDays = rule.options?.dateTolerance ?? 0;
        const diffDays = Math.abs(dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24);

        if (diffDays <= toleranceDays) {
          return 1.0 - diffDays / (toleranceDays + 1);
        }

        return 0.0;
      }

      default:
        return 0.0;
    }
  }

  /**
   * Match a source record against a target record using specified rules
   */
  matchRecords(
    source: { id: string; data: Record<string, unknown> },
    target: { id: string; type: "golden" | "source"; data: Record<string, unknown> },
    config: MatchConfig
  ): MatchResult {
    const ruleScores: RuleScore[] = [];
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const rule of config.rules) {
      const sourceValue = getValueByPath(source.data, rule.field);
      const targetValue = getValueByPath(target.data, rule.field);

      const score = this.compareValues(sourceValue, targetValue, rule);
      const weightedScore = score * rule.weight;

      ruleScores.push({
        field: rule.field,
        matchType: rule.type,
        score,
        weightedScore,
        comparedValues: {
          source: sourceValue,
          target: targetValue,
        },
      });

      totalWeightedScore += weightedScore;
      totalWeight += rule.weight;
    }

    // Calculate overall score (weighted average)
    const overallScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

    return {
      sourceRecordId: source.id,
      matchedRecordId: target.id,
      matchedRecordType: target.type,
      score: overallScore,
      isMatch: overallScore >= config.threshold,
      ruleScores,
    };
  }

  /**
   * Find matches for a source record among golden records
   */
  findMatchesInGoldenRecords(
    sourceRecord: SourceRecord,
    goldenRecords: GoldenRecord[],
    config: MatchConfig
  ): MatchResult[] {
    const results: MatchResult[] = [];

    for (const golden of goldenRecords) {
      if (golden.entityType !== sourceRecord.entityType) continue;

      const result = this.matchRecords(
        { id: sourceRecord.id, data: sourceRecord.data },
        { id: golden.id, type: "golden", data: golden.data },
        config
      );

      if (result.isMatch) {
        results.push(result);
      }
    }

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Find matches for a source record among other source records
   */
  findMatchesInSourceRecords(
    sourceRecord: SourceRecord,
    otherRecords: SourceRecord[],
    config: MatchConfig
  ): MatchResult[] {
    const results: MatchResult[] = [];

    for (const other of otherRecords) {
      // Skip self and different entity types
      if (other.id === sourceRecord.id) continue;
      if (other.entityType !== sourceRecord.entityType) continue;

      const result = this.matchRecords(
        { id: sourceRecord.id, data: sourceRecord.data },
        { id: other.id, type: "source", data: other.data },
        config
      );

      if (result.isMatch) {
        results.push(result);
      }
    }

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Find all matches for a source record (both golden and source records)
   */
  findAllMatches(
    sourceRecord: SourceRecord,
    goldenRecords: GoldenRecord[],
    sourceRecords: SourceRecord[],
    config: MatchConfig
  ): MatchResult[] {
    const goldenMatches = this.findMatchesInGoldenRecords(sourceRecord, goldenRecords, config);

    const sourceMatches = this.findMatchesInSourceRecords(sourceRecord, sourceRecords, config);

    // Combine and sort by score
    return [...goldenMatches, ...sourceMatches].sort((a, b) => b.score - a.score);
  }
}
