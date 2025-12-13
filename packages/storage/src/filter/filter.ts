import type { Entry } from "../types.js";
import type {
  Filter,
  FilterCondition,
  AnyOperator,
  NumberOperator,
  StringOperator,
} from "./types.js";

// Runtime union of all operator types
type AnyFilterOperator = AnyOperator<unknown> | NumberOperator | StringOperator;

export function isFilterOperator(value: unknown): value is AnyFilterOperator {
  if (typeof value !== "object" || value === null) return false;
  const keys = Object.keys(value);
  if (keys.length !== 1) return false;
  const key = keys[0];
  return (
    key !== undefined &&
    [
      "$eq",
      "$ne",
      "$gt",
      "$gte",
      "$lt",
      "$lte",
      "$in",
      "$nin",
      "$contains",
      "$startsWith",
      "$endsWith",
    ].includes(key)
  );
}

export function matchesOperator(fieldValue: unknown, operator: AnyFilterOperator): boolean {
  if ("$eq" in operator) return fieldValue === operator.$eq;
  if ("$ne" in operator) return fieldValue !== operator.$ne;
  if ("$gt" in operator) return typeof fieldValue === "number" && fieldValue > operator.$gt;
  if ("$gte" in operator) return typeof fieldValue === "number" && fieldValue >= operator.$gte;
  if ("$lt" in operator) return typeof fieldValue === "number" && fieldValue < operator.$lt;
  if ("$lte" in operator) return typeof fieldValue === "number" && fieldValue <= operator.$lte;
  if ("$in" in operator) return operator.$in.includes(fieldValue);
  if ("$nin" in operator) return !operator.$nin.includes(fieldValue);
  if ("$contains" in operator)
    return typeof fieldValue === "string" && fieldValue.includes(operator.$contains);
  if ("$startsWith" in operator)
    return typeof fieldValue === "string" && fieldValue.startsWith(operator.$startsWith);
  if ("$endsWith" in operator)
    return typeof fieldValue === "string" && fieldValue.endsWith(operator.$endsWith);
  return false;
}

function matchesCondition<T extends Entry>(entry: T, condition: FilterCondition<T>): boolean {
  for (const key of Object.keys(condition) as (keyof T)[]) {
    const filterValue = condition[key];
    const entryValue = entry[key];
    if (filterValue !== undefined && !matchesOperator(entryValue, filterValue)) {
      return false;
    }
  }
  return true;
}

export function matchesFilter<T extends Entry>(entry: T, filter: Filter<T>): boolean {
  // Handle $and operator
  if ("$and" in filter) {
    return filter.$and.every((subFilter) => matchesFilter(entry, subFilter));
  }

  // Handle $or operator
  if ("$or" in filter) {
    return filter.$or.some((subFilter) => matchesFilter(entry, subFilter));
  }

  // Handle simple condition
  return matchesCondition(entry, filter);
}
