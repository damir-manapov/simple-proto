export type {
  Filter,
  FilterCondition,
  FilterOperatorFor,
  AnyOperator,
  NumberOperator,
  StringOperator,
  DateOperator,
  RelationOperator,
} from "./types.js";
export { isOperator, isRelationOperator, matchesFilter, matchesOperator } from "./filter.js";
