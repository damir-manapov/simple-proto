import type { Schema } from "ajv";

export type { Schema };

export interface Entity {
  id: string;
}

export interface EntityInput {
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
  create<T extends EntityInput>(collection: string, data: T): T & Entity;
  findById(collection: string, id: string): Entity | null;
  findByIdOrThrow(collection: string, id: string): Entity;
  findAll(collection: string): Entity[];
  update<T extends Entity>(collection: string, id: string, data: T): T | null;
  updateOrThrow<T extends Entity>(collection: string, id: string, data: T): T;
  delete(collection: string, id: string): boolean;
  clear(collection: string): void;
  clearAll(): void;
}
