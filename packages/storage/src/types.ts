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

export interface IStorage {
  registerCollection(config: CollectionConfig): void;
  hasCollection(name: string): boolean;
  getCollections(): string[];
  create<T extends EntryInput>(collection: string, data: T): T & Entry;
  findById(collection: string, id: string): Entry | null;
  findByIdOrThrow(collection: string, id: string): Entry;
  findAll(collection: string): Entry[];
  update<T extends Entry>(collection: string, id: string, data: T): T | null;
  updateOrThrow<T extends Entry>(collection: string, id: string, data: T): T;
  delete(collection: string, id: string): boolean;
  clear(collection: string): void;
  clearAll(): void;
}
