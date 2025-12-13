import type { Schema } from "ajv";

export type { Schema };

export interface Entry {
  id: string;
}

export interface EntryInput {
  id?: string;
}

export interface CollectionConfig {
  name: string;
  schema?: Schema;
}

export interface IRepository<T extends Entry = Entry, TInput extends EntryInput = EntryInput> {
  create(data: TInput): T;
  findById(id: string): T | null;
  findByIdOrThrow(id: string): T;
  findAll(): T[];
  update(id: string, data: T): T | null;
  updateOrThrow(id: string, data: T): T;
  delete(id: string): boolean;
  clear(): void;
}

export interface IStorage {
  registerCollection(config: CollectionConfig): void;
  hasCollection(name: string): boolean;
  getCollections(): string[];
  getRepository<T extends Entry = Entry, TInput extends EntryInput = EntryInput>(
    collection: string
  ): IRepository<T, TInput>;
  clearAll(): void;
}
