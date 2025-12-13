import { randomUUID } from "node:crypto";
import {
  CollectionAlreadyExistsError,
  CollectionNotFoundError,
  EntityAlreadyExistsError,
  EntityNotFoundError,
  ValidationError,
} from "./errors.js";

export interface Entity {
  id: string;
}

export interface EntityInput {
  id?: string;
}

export type ValidateFn<T extends EntityInput = EntityInput> = (data: T) => true | string;

export interface CollectionConfig<T extends EntityInput = EntityInput> {
  name: string;
  validate?: ValidateFn<T>;
}

export interface IStorage {
  registerCollection<T extends EntityInput>(config: CollectionConfig<T>): void;
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

interface CollectionData {
  config: CollectionConfig;
  entities: Map<string, Entity>;
}

export class Storage implements IStorage {
  private readonly collections = new Map<string, CollectionData>();

  registerCollection<T extends EntityInput>(config: CollectionConfig<T>): void {
    if (this.collections.has(config.name)) {
      throw new CollectionAlreadyExistsError(config.name);
    }
    this.collections.set(config.name, {
      config: config as CollectionConfig,
      entities: new Map(),
    });
  }

  hasCollection(name: string): boolean {
    return this.collections.has(name);
  }

  getCollections(): string[] {
    return Array.from(this.collections.keys());
  }

  private getCollectionData(name: string): CollectionData {
    const data = this.collections.get(name);
    if (!data) {
      throw new CollectionNotFoundError(name);
    }
    return data;
  }

  private validate(collection: string, data: EntityInput, config: CollectionConfig): void {
    if (config.validate) {
      const result = config.validate(data);
      if (result !== true) {
        throw new ValidationError(collection, result);
      }
    }
  }

  create<T extends EntityInput>(collection: string, data: T): T & Entity {
    const { config, entities } = this.getCollectionData(collection);
    this.validate(collection, data, config);
    const id = data.id ?? randomUUID();
    const entity = { ...data, id } as T & Entity;
    if (entities.has(id)) {
      throw new EntityAlreadyExistsError(collection, id);
    }
    entities.set(id, entity);
    return entity;
  }

  findById(collection: string, id: string): Entity | null {
    const { entities } = this.getCollectionData(collection);
    return entities.get(id) ?? null;
  }

  findByIdOrThrow(collection: string, id: string): Entity {
    const entity = this.findById(collection, id);
    if (entity === null) {
      throw new EntityNotFoundError(collection, id);
    }
    return entity;
  }

  findAll(collection: string): Entity[] {
    const { entities } = this.getCollectionData(collection);
    return Array.from(entities.values());
  }

  update<T extends Entity>(collection: string, id: string, data: T): T | null {
    const { config, entities } = this.getCollectionData(collection);
    this.validate(collection, data, config);
    const existing = entities.get(id);
    if (!existing) {
      return null;
    }
    entities.set(id, data);
    return data;
  }

  updateOrThrow<T extends Entity>(collection: string, id: string, data: T): T {
    const result = this.update(collection, id, data);
    if (result === null) {
      throw new EntityNotFoundError(collection, id);
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
