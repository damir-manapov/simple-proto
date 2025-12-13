import type { Schema } from "ajv";

export type { Schema };
export type { Filter, FilterCondition, FilterOperator } from "./filter/types.js";

import type { Filter } from "./filter/types.js";

export interface Entry {
  id: string;
}

export interface EntryInput {
  id?: string;
}

export interface CollectionConfig {
  name: string;
  schema: Schema;
}

/** Map of field name to target collection name (extracted from x-link-to) */
export type CollectionRelations = Record<string, string>;

export interface IRepository<T extends Entry = Entry, TInput extends EntryInput = EntryInput> {
  create(data: TInput): T;
  findById(id: string): T | null;
  findByIdOrThrow(id: string): T;
  findAll(filter?: Filter<T>): T[];
  update(id: string, data: T): T | null;
  updateOrThrow(id: string, data: T): T;
  delete(id: string): boolean;
  clear(): void;
}

export interface IStorage {
  registerCollection(config: CollectionConfig): void;
  hasCollection(name: string): boolean;
  getCollections(): string[];
  getCollectionSchema(name: string): Schema;
  getCollectionRelations(name: string): CollectionRelations;
  getRepository<T extends Entry = Entry, TInput extends EntryInput = EntryInput>(
    collection: string
  ): IRepository<T, TInput>;
  clearAll(): void;
}
