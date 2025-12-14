import type { Filter, NumberOperator } from "../filter/types.js";

// Supported aggregation functions
export type AggregateFunction = "sum" | "avg" | "min" | "max";

// Per-field aggregation selection: { sum: true, avg: true, ... }
export type AggregateFieldSelect = Partial<Record<AggregateFunction, true>>;

// Select specification: field -> true (include value) or aggregation functions
export type AggregateSelect<T> = {
  [K in keyof T]?: true | AggregateFieldSelect;
} & { _count?: true };

// Having clause for post-aggregation filtering
export type AggregateHaving<T> = {
  _count?: NumberOperator;
} & {
  [K in keyof T]?: Partial<Record<AggregateFunction, NumberOperator>>;
};

// Full aggregate options
export interface AggregateOptions<T> {
  filter?: Filter<T>;
  groupBy?: (keyof T)[];
  select: AggregateSelect<T>;
  having?: AggregateHaving<T>;
}

// Result row type - simplified to avoid inference issues
export interface AggregateRow {
  _count?: number;
  [key: string]: unknown;
}
