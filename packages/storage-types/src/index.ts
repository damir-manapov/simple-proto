// Types and interfaces
export type {
  Entry,
  EntryInput,
  CollectionConfig,
  CollectionRelations,
  Schema,
  IRepository,
  IStorage,
} from "./types.js";

// Filter types
export type {
  Filter,
  FilterCondition,
  FilterOperatorFor,
  AnyOperator,
  NumberOperator,
  StringOperator,
  DateOperator,
} from "./filter.js";

// Aggregate types
export type {
  AggregateFunction,
  AggregateFieldSelect,
  AggregateSelect,
  AggregateHaving,
  AggregateOptions,
  AggregateRow,
} from "./aggregate.js";

// Error classes
export {
  StorageError,
  EntityCollectionNotFoundError,
  EntityCollectionAlreadyExistsError,
  ValidationError,
  EntryNotFoundError,
  EntryAlreadyExistsError,
} from "./errors.js";
