import type { Entry, EntryInput } from "@simple-proto/storage-types";

// ==================== Match Rule Types ====================

/** Match algorithm type */
export type MatchType =
  | "exact" // Exact string match
  | "exactCaseInsensitive" // Case-insensitive exact match
  | "fuzzy" // Levenshtein distance-based fuzzy match
  | "phonetic" // Soundex phonetic matching
  | "normalized" // Normalized comparison (trim, lowercase)
  | "numeric" // Numeric equality with tolerance
  | "date"; // Date match with tolerance

/** A single match rule for comparing a field */
export interface MatchRule {
  /** Field path to compare (e.g., "name", "address.city") */
  field: string;
  /** Type of matching algorithm */
  type: MatchType;
  /** Weight of this rule in overall match score (0.0 - 1.0) */
  weight: number;
  /** Threshold for this rule to be considered a match (0.0 - 1.0) */
  threshold?: number;
  /** Additional options for specific match types */
  options?: MatchRuleOptions;
}

/** Options for specific match types */
export interface MatchRuleOptions {
  /** Max Levenshtein distance for fuzzy matching */
  maxDistance?: number;
  /** Tolerance for numeric matching (absolute difference) */
  numericTolerance?: number;
  /** Tolerance for date matching in days */
  dateTolerance?: number;
}

/** Configuration for matching entities of a specific type */
export interface MatchConfig extends Entry {
  /** Entity type this config applies to (e.g., "customer", "product") */
  entityType: string;
  /** Name for this match configuration */
  name: string;
  /** Optional description */
  description?: string;
  /** Match rules to apply */
  rules: MatchRule[];
  /** Overall threshold for a match (0.0 - 1.0), defaults to 0.7 */
  threshold: number;
  /** Whether this config is active */
  active: boolean;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/** Input for creating a match configuration */
export interface MatchConfigInput extends EntryInput {
  entityType: string;
  name: string;
  description?: string;
  rules: MatchRule[];
  threshold?: number;
  active?: boolean;
}

// ==================== Source Record Types ====================

/** A record from a source system */
export interface SourceRecord extends Entry {
  /** Entity type (e.g., "customer", "product") */
  entityType: string;
  /** Source system identifier (e.g., "salesforce", "erp", "manual") */
  sourceSystem: string;
  /** Record ID in the source system */
  sourceId: string;
  /** The actual data from the source */
  data: Record<string, unknown>;
  /** Confidence score for this record (0.0 - 1.0) */
  confidence: number;
  /** When this record was last updated in the source */
  sourceUpdatedAt: Date;
  /** When this record was ingested */
  ingestedAt: Date;
  /** ID of the golden record this is linked to (if matched) */
  goldenRecordId?: string;
  /** Match score when linked to golden record */
  matchScore?: number;
}

/** Input for creating a source record */
export interface SourceRecordInput extends EntryInput {
  entityType: string;
  sourceSystem: string;
  sourceId: string;
  data: Record<string, unknown>;
  confidence?: number;
  sourceUpdatedAt?: Date;
}

// ==================== Survivorship Rule Types ====================

/** Strategy for selecting the winning value */
export type SurvivorshipStrategy =
  | "mostRecent" // Most recently updated value
  | "mostFrequent" // Most common value across sources
  | "highestConfidence" // Value from highest confidence source
  | "sourceRanking" // Based on explicit source priority
  | "longestValue" // Longest non-empty string value
  | "manual"; // Manually set value (never overwritten)

/** A survivorship rule for a specific field */
export interface SurvivorshipRule {
  /** Field path this rule applies to */
  field: string;
  /** Strategy to use for selecting winning value */
  strategy: SurvivorshipStrategy;
  /** For sourceRanking strategy: ordered list of source systems */
  sourceRanking?: string[];
  /** Default value if no sources have a value */
  defaultValue?: unknown;
}

/** Configuration for golden record survivorship */
export interface SurvivorshipConfig extends Entry {
  /** Entity type this config applies to */
  entityType: string;
  /** Name for this survivorship configuration */
  name: string;
  /** Optional description */
  description?: string;
  /** Survivorship rules by field */
  rules: SurvivorshipRule[];
  /** Default strategy for fields not covered by rules */
  defaultStrategy: SurvivorshipStrategy;
  /** Default source ranking for sourceRanking strategy */
  defaultSourceRanking?: string[];
  /** Whether this config is active */
  active: boolean;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/** Input for creating a survivorship configuration */
export interface SurvivorshipConfigInput extends EntryInput {
  entityType: string;
  name: string;
  description?: string;
  rules: SurvivorshipRule[];
  defaultStrategy?: SurvivorshipStrategy;
  defaultSourceRanking?: string[];
  active?: boolean;
}

// ==================== Golden Record Types ====================

/** Source contribution info for golden record */
export interface SourceContribution {
  /** Source system */
  sourceSystem: string;
  /** Source record ID */
  sourceRecordId: string;
  /** Fields contributed by this source */
  contributedFields: string[];
  /** Last update from this source */
  lastUpdatedAt: Date;
}

/** The master/golden record created from merged sources */
export interface GoldenRecord extends Entry {
  /** Entity type */
  entityType: string;
  /** The merged/mastered data */
  data: Record<string, unknown>;
  /** Source records contributing to this golden record */
  sources: SourceContribution[];
  /** IDs of matched source records */
  matchedSourceIds: string[];
  /** Overall confidence score (0.0 - 1.0) */
  confidence: number;
  /** Whether this record needs manual review */
  needsReview: boolean;
  /** Review notes if manually reviewed */
  reviewNotes?: string;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
  /** Last merged timestamp */
  lastMergedAt: Date;
}

/** Input for manually creating a golden record */
export interface GoldenRecordInput extends EntryInput {
  entityType: string;
  data: Record<string, unknown>;
  matchedSourceIds?: string[];
  confidence?: number;
  needsReview?: boolean;
  reviewNotes?: string;
}

// ==================== Match Result Types ====================

/** Result of comparing two records */
export interface MatchResult {
  /** Source record being matched */
  sourceRecordId: string;
  /** Golden record or source record matched against */
  matchedRecordId: string;
  /** Whether it's a match against golden record or another source */
  matchedRecordType: "golden" | "source";
  /** Overall match score (0.0 - 1.0) */
  score: number;
  /** Whether this exceeds the match threshold */
  isMatch: boolean;
  /** Breakdown of scores by rule/field */
  ruleScores: RuleScore[];
}

/** Score for a single rule in matching */
export interface RuleScore {
  /** Field that was compared */
  field: string;
  /** Match type used */
  matchType: MatchType;
  /** Score for this rule (0.0 - 1.0) */
  score: number;
  /** Weighted score (score * weight) */
  weightedScore: number;
  /** Values that were compared */
  comparedValues: {
    source: unknown;
    target: unknown;
  };
}

/** Result of a merge operation */
export interface MergeResult {
  /** The resulting golden record */
  goldenRecord: GoldenRecord;
  /** Source records that were merged */
  mergedSourceIds: string[];
  /** Field-level merge decisions */
  mergeDecisions: MergeDecision[];
}

/** Decision made for a single field during merge */
export interface MergeDecision {
  /** Field path */
  field: string;
  /** Final value selected */
  selectedValue: unknown;
  /** Strategy used to select */
  strategy: SurvivorshipStrategy;
  /** Source that provided the value */
  sourceSystem: string;
  /** All candidate values considered */
  candidates: {
    sourceSystem: string;
    value: unknown;
    confidence: number;
    updatedAt: Date;
  }[];
}
