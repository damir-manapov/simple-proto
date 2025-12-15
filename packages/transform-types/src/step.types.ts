import type { FieldMapping, ExpressionCondition } from "./expression.types.js";

// ==================== Transform Step Types ====================

export type TransformStepType =
  | "filter"
  | "map"
  | "aggregate"
  | "join"
  | "lookup"
  | "union"
  | "deduplicate"
  | "sort"
  | "limit"
  | "pivot"
  | "unpivot"
  | "flatten";

export interface TransformStep {
  id: string;
  type: TransformStepType;
  config: TransformStepConfig;
  order: number;
  description?: string;
  dependsOn?: string[]; // Step IDs this step depends on
}

export type TransformStepConfig =
  | FilterStepConfig
  | MapStepConfig
  | AggregateStepConfig
  | JoinStepConfig
  | LookupStepConfig
  | UnionStepConfig
  | DeduplicateStepConfig
  | SortStepConfig
  | LimitStepConfig
  | PivotStepConfig
  | UnpivotStepConfig
  | FlattenStepConfig;

// ==================== Step Configurations ====================

/**
 * Filter: Keep records matching conditions
 */
export interface FilterStepConfig {
  source: string;
  conditions: FilterCondition[];
  conditionLogic?: "and" | "or";
  output: string;
}

export interface FilterCondition {
  field: string;
  operator:
    | "eq"
    | "ne"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "in"
    | "notIn"
    | "contains"
    | "startsWith"
    | "endsWith"
    | "exists"
    | "isNull"
    | "regex";
  value?: unknown;
}

/**
 * Map: Transform each record with field mappings
 */
export interface MapStepConfig {
  source: string;
  mappings: FieldMapping[];
  includeOriginal?: boolean; // If true, include all original fields plus mappings
  output: string;
}

/**
 * Aggregate: Group and compute aggregations
 */
export interface AggregateStepConfig {
  source: string;
  groupBy: string[]; // Fields to group by (empty = single group for entire collection)
  aggregations: Aggregation[];
  having?: ExpressionCondition[]; // Filter groups after aggregation
  output: string;
}

export interface Aggregation {
  field: string; // Source field (use "*" for count)
  function: AggregateFunction;
  as: string; // Output field name
}

export type AggregateFunction =
  | "sum"
  | "avg"
  | "count"
  | "min"
  | "max"
  | "first"
  | "last"
  | "collect" // Collect all values into array
  | "countDistinct";

/**
 * Join: Combine two collections
 */
export interface JoinStepConfig {
  left: string;
  right: string;
  on: JoinCondition[];
  type: "inner" | "left" | "right" | "full";
  select?: JoinSelect;
  prefix?: {
    // Prefix to avoid field name collisions
    left?: string;
    right?: string;
  };
  output: string;
}

export interface JoinCondition {
  leftField: string;
  rightField: string;
}

export interface JoinSelect {
  left: string[] | "*";
  right: string[] | "*";
}

/**
 * Lookup: Enrich records with data from another collection (1:1 or 1:many)
 */
export interface LookupStepConfig {
  source: string;
  from: string; // Collection to lookup from
  localField: string; // Field in source
  foreignField: string; // Field in lookup collection
  as: string; // Output field name
  multiple?: boolean; // If true, returns array; if false, returns first match or null
  output: string;
}

/**
 * Union: Combine multiple collections
 */
export interface UnionStepConfig {
  sources: string[];
  mode: "all" | "distinct";
  distinctKeys?: string[]; // Fields to use for distinct (if mode is "distinct")
  output: string;
}

/**
 * Deduplicate: Remove duplicate records
 */
export interface DeduplicateStepConfig {
  source: string;
  keys: string[]; // Fields that define uniqueness
  keep: "first" | "last";
  orderBy?: SortField; // Order before deduplication (determines which is first/last)
  output: string;
}

/**
 * Sort: Order records
 */
export interface SortStepConfig {
  source: string;
  orderBy: SortField[];
  output: string;
}

export interface SortField {
  field: string;
  direction: "asc" | "desc";
  nulls?: "first" | "last";
}

/**
 * Limit: Take subset of records
 */
export interface LimitStepConfig {
  source: string;
  limit: number;
  offset?: number;
  output: string;
}

/**
 * Pivot: Transform rows to columns
 */
export interface PivotStepConfig {
  source: string;
  groupBy: string[]; // Row identifiers
  pivotField: string; // Field whose values become column names
  valueField: string; // Field containing values
  aggregation: AggregateFunction;
  output: string;
}

/**
 * Unpivot: Transform columns to rows
 */
export interface UnpivotStepConfig {
  source: string;
  idFields: string[]; // Fields to keep as-is
  unpivotFields: string[]; // Fields to convert to rows
  nameField: string; // Output column for original field names
  valueField: string; // Output column for values
  output: string;
}

/**
 * Flatten: Expand array fields into multiple records
 */
export interface FlattenStepConfig {
  source: string;
  field: string; // Array field to flatten
  as?: string; // Output field name (defaults to original field name)
  preserveEmpty?: boolean; // Keep records with empty/null arrays
  output: string;
}
