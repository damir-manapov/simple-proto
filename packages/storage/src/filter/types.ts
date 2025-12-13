export type FilterOperator =
  | { $eq: unknown }
  | { $ne: unknown }
  | { $gt: number }
  | { $gte: number }
  | { $lt: number }
  | { $lte: number }
  | { $in: unknown[] }
  | { $nin: unknown[] }
  | { $contains: string }
  | { $startsWith: string }
  | { $endsWith: string };

export type FilterCondition<T> = {
  [K in keyof T]?: FilterOperator;
};

export type Filter<T> = FilterCondition<T> | { $and: Filter<T>[] } | { $or: Filter<T>[] };
