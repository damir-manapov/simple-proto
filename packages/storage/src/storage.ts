import { randomUUID } from "node:crypto";
import AjvModule from "ajv";
import type { ValidateFunction } from "ajv";
import {
  EntityCollectionAlreadyExistsError,
  EntityCollectionNotFoundError,
  EntryAlreadyExistsError,
  EntryNotFoundError,
  ValidationError,
} from "./errors.js";
import type { CollectionConfig, Entry, EntryInput, IRepository, IStorage } from "./types.js";

// Handle CommonJS/ESM interop
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const Ajv = AjvModule.default ?? AjvModule;

interface CollectionData {
  config: CollectionConfig;
  entities: Map<string, Entry>;
  validator?: ValidateFunction;
}

class Repository<
  T extends Entry = Entry,
  TInput extends EntryInput = EntryInput,
> implements IRepository<T, TInput> {
  constructor(
    private readonly collectionName: string,
    private readonly storage: Storage
  ) {}

  create(data: TInput): T {
    return this.storage.create<TInput>(this.collectionName, data) as unknown as T;
  }

  findById(id: string): T | null {
    return this.storage.findById(this.collectionName, id) as T | null;
  }

  findByIdOrThrow(id: string): T {
    return this.storage.findByIdOrThrow(this.collectionName, id) as T;
  }

  findAll(): T[] {
    return this.storage.findAll(this.collectionName) as T[];
  }

  update(id: string, data: T): T | null {
    return this.storage.update<T>(this.collectionName, id, data);
  }

  updateOrThrow(id: string, data: T): T {
    return this.storage.updateOrThrow<T>(this.collectionName, id, data);
  }

  delete(id: string): boolean {
    return this.storage.delete(this.collectionName, id);
  }

  clear(): void {
    this.storage.clear(this.collectionName);
  }
}

export class Storage implements IStorage {
  private readonly collections = new Map<string, CollectionData>();
  private readonly ajv = new Ajv();

  registerCollection(config: CollectionConfig): void {
    if (this.collections.has(config.name)) {
      throw new EntityCollectionAlreadyExistsError(config.name);
    }
    const collectionData: CollectionData = {
      config,
      entities: new Map(),
    };
    if (config.schema) {
      collectionData.validator = this.ajv.compile(config.schema);
    }
    this.collections.set(config.name, collectionData);
  }

  hasCollection(name: string): boolean {
    return this.collections.has(name);
  }

  getCollections(): string[] {
    return Array.from(this.collections.keys());
  }

  getRepository<T extends Entry = Entry, TInput extends EntryInput = EntryInput>(
    collection: string
  ): IRepository<T, TInput> {
    // Verify collection exists
    this.getCollectionData(collection);
    return new Repository<T, TInput>(collection, this);
  }

  private getCollectionData(name: string): CollectionData {
    const data = this.collections.get(name);
    if (!data) {
      throw new EntityCollectionNotFoundError(name);
    }
    return data;
  }

  private validate(collection: string, data: EntryInput, collectionData: CollectionData): void {
    const { validator } = collectionData;
    if (validator) {
      const valid = validator(data);
      if (!valid) {
        const message = this.ajv.errorsText(validator.errors);
        throw new ValidationError(collection, message);
      }
    }
  }

  create<T extends EntryInput>(collection: string, data: T): T & Entry {
    const collectionData = this.getCollectionData(collection);
    this.validate(collection, data, collectionData);
    const id = data.id ?? randomUUID();
    const entity = { ...data, id } as T & Entry;
    if (collectionData.entities.has(id)) {
      throw new EntryAlreadyExistsError(collection, id);
    }
    collectionData.entities.set(id, entity);
    return entity;
  }

  findById(collection: string, id: string): Entry | null {
    const { entities } = this.getCollectionData(collection);
    return entities.get(id) ?? null;
  }

  findByIdOrThrow(collection: string, id: string): Entry {
    const entity = this.findById(collection, id);
    if (entity === null) {
      throw new EntryNotFoundError(collection, id);
    }
    return entity;
  }

  findAll(collection: string): Entry[] {
    const { entities } = this.getCollectionData(collection);
    return Array.from(entities.values());
  }

  update<T extends Entry>(collection: string, id: string, data: T): T | null {
    const collectionData = this.getCollectionData(collection);
    this.validate(collection, data, collectionData);
    const existing = collectionData.entities.get(id);
    if (!existing) {
      return null;
    }
    collectionData.entities.set(id, data);
    return data;
  }

  updateOrThrow<T extends Entry>(collection: string, id: string, data: T): T {
    const result = this.update(collection, id, data);
    if (result === null) {
      throw new EntryNotFoundError(collection, id);
    }
    return result;
  }

  delete(collection: string, id: string): boolean {
    const { entities } = this.getCollectionData(collection);
    return entities.delete(id);
  }

  clear(collection: string): void {
    const { entities } = this.getCollectionData(collection);
    entities.clear();
  }

  clearAll(): void {
    for (const data of this.collections.values()) {
      data.entities.clear();
    }
  }
}
