export type {
  Filter,
  FilterCondition,
  FilterOperatorFor,
  AnyOperator,
  NumberOperator,
  StringOperator,
  DateOperator,
} from "./types.js";
export { isOperator, matchesFilter, matchesOperator } from "./filter.js";
