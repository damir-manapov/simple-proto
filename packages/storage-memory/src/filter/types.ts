// Re-export all filter types from storage-types
export type {
  AnyOperator,
  NumberOperator,
  StringOperator,
  DateOperator,
  FilterOperatorFor,
  FilterCondition,
  Filter,
} from "@simple-proto/storage-types";

import type { Filter } from "@simple-proto/storage-types";

// Relation operator is only used internally in the implementation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RelationOperator<TRelated = any> =
  | { some: Filter<TRelated> | true }
  | { none: Filter<TRelated> | true }
  | { every: Filter<TRelated> };
