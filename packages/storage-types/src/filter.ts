// Operators that work on any type
export type AnyOperator<T> = { eq: T } | { ne: T } | { in: T[] } | { nin: T[] };

// Operators only for numbers
export type NumberOperator = { gt: number } | { gte: number } | { lt: number } | { lte: number };

// Operators only for strings
export type StringOperator = { contains: string } | { startsWith: string } | { endsWith: string };

// Operators only for dates
export type DateOperator = { before: Date } | { after: Date } | { between: [Date, Date] };

// Relation existence operators (for reverse relation queries)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RelationOperator<TRelated = any> =
  | { some: Filter<TRelated> | true }
  | { none: Filter<TRelated> | true }
  | { every: Filter<TRelated> };

// Combined based on field type
export type FilterOperatorFor<T> = T extends Date
  ? AnyOperator<T> | DateOperator
  : T extends number
    ? AnyOperator<T> | NumberOperator
    : T extends string
      ? AnyOperator<T> | StringOperator
      : AnyOperator<T>;

export type FilterCondition<T> = {
  [K in keyof T]?: FilterOperatorFor<T[K]>;
};

export type Filter<T> = FilterCondition<T> | { and: Filter<T>[] } | { or: Filter<T>[] };
