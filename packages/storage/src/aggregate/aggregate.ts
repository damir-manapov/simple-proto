import { matchesOperator } from "../filter/filter.js";
import type { Entry } from "@simple-proto/storage-types";
import type {
  AggregateFunction,
  AggregateHaving,
  AggregateOptions,
  AggregateRow,
  AggregateSelect,
} from "@simple-proto/storage-types";

type GroupKey = string;

/**
 * Compute aggregation on a set of entities.
 * Returns a single row when groupBy is not provided, or an array of rows otherwise.
 */
export function computeAggregate<T extends Entry>(
  entities: T[],
  options: AggregateOptions<T>
): AggregateRow | AggregateRow[] {
  const { groupBy, select, having } = options;

  if (!groupBy || groupBy.length === 0) {
    // No grouping: aggregate entire collection
    return computeRow(entities, select);
  }

  // Group entities by groupBy fields
  const groups = new Map<GroupKey, T[]>();

  for (const entity of entities) {
    const key = groupBy
      .map((field) => String((entity as Record<string, unknown>)[field as string]))
      .join("|||");
    const group = groups.get(key);
    if (group) {
      group.push(entity);
    } else {
      groups.set(key, [entity]);
    }
  }

  // Compute aggregation for each group
  const results: AggregateRow[] = [];

  for (const groupEntities of groups.values()) {
    const row = computeRow(groupEntities, select);

    // Apply having filter if present
    if (having && !matchesHaving(row, having)) {
      continue;
    }

    results.push(row);
  }

  return results;
}

function computeRow<T extends Entry>(entities: T[], select: AggregateSelect<T>): AggregateRow {
  const row: Record<string, unknown> = {};

  for (const [field, spec] of Object.entries(select)) {
    if (field === "_count") {
      row["_count"] = entities.length;
      continue;
    }

    if (spec === true) {
      // Include field value from first entity (should be same for all in group)
      if (entities.length > 0) {
        row[field] = (entities[0] as Record<string, unknown>)[field];
      }
      continue;
    }

    // Aggregation functions - spec is AggregateFieldSelect at this point
    const fieldSpec = spec;
    const values = entities
      .map((e) => (e as Record<string, unknown>)[field])
      .filter((v): v is number => typeof v === "number");

    const aggregations: Record<string, number> = {};

    for (const fn of Object.keys(fieldSpec) as AggregateFunction[]) {
      if (!fieldSpec[fn]) continue;
      aggregations[fn] = computeAggregateFunction(fn, values);
    }

    row[field] = aggregations;
  }

  return row as AggregateRow;
}

function computeAggregateFunction(fn: AggregateFunction, values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  switch (fn) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    default:
      return 0;
  }
}

function matchesHaving<T>(row: AggregateRow, having: AggregateHaving<T>): boolean {
  const rowRecord = row as Record<string, unknown>;

  for (const [field, spec] of Object.entries(having)) {
    if (field === "_count") {
      const count = rowRecord["_count"];
      if (
        typeof count === "number" &&
        !matchesOperator(count, spec as Parameters<typeof matchesOperator>[1])
      ) {
        return false;
      }
      continue;
    }

    // Field aggregation having (e.g., { age: { avg: { gt: 30 } } })
    // spec is Partial<Record<AggregateFunction, NumberOperator>> at this point
    const fieldAggregations = rowRecord[field];
    if (typeof fieldAggregations !== "object" || fieldAggregations === null) {
      return false;
    }

    for (const [fn, operator] of Object.entries(spec as Record<string, unknown>)) {
      const value = (fieldAggregations as Record<string, unknown>)[fn];
      if (
        typeof value === "number" &&
        !matchesOperator(value, operator as Parameters<typeof matchesOperator>[1])
      ) {
        return false;
      }
    }
  }

  return true;
}
