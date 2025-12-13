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
import { isOperator, matchesOperator } from "./filter/index.js";
import type {
  CollectionConfig,
  CollectionRelations,
  Entry,
  EntryInput,
  Filter,
  IRepository,
  IStorage,
  Schema,
} from "./types.js";

// Handle CommonJS/ESM interop
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const Ajv = AjvModule.default ?? AjvModule;

interface CollectionData {
  config: CollectionConfig;
  entities: Map<string, Entry>;
  validator: ValidateFunction;
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

  findAll(filter?: Filter<T>): T[] {
    const all = this.storage.findAll(this.collectionName) as T[];
    if (!filter) return all;

    return all.filter((entry) => this.matchesFilterWithRelations(entry, filter));
  }

  private matchesFilterWithRelations(entry: T, filter: Filter<T>): boolean {
    // Handle and/or operators
    if ("and" in filter) {
      return filter.and.every((subFilter) => this.matchesFilterWithRelations(entry, subFilter));
    }
    if ("or" in filter) {
      return filter.or.some((subFilter) => this.matchesFilterWithRelations(entry, subFilter));
    }

    // Handle filter condition
    const relations = this.storage.getCollectionRelations(this.collectionName);

    for (const key of Object.keys(filter)) {
      const filterValue = (filter as Record<string, unknown>)[key];
      if (filterValue === undefined) continue;

      // Check if this is a relation filter (object but not an operator)
      if (typeof filterValue === "object" && filterValue !== null && !isOperator(filterValue)) {
        const targetCollection = relations[key];
        if (targetCollection) {
          // This is a relation filter - resolve it
          const foreignKeyValue = (entry as Record<string, unknown>)[key];
          if (
            !this.matchesRelation(foreignKeyValue, targetCollection, filterValue as Filter<Entry>)
          ) {
            return false;
          }
          continue;
        }
      }

      // Regular field filter
      const entryValue = (entry as Record<string, unknown>)[key];
      if (!matchesOperator(entryValue, filterValue as Parameters<typeof matchesOperator>[1])) {
        return false;
      }
    }

    return true;
  }

  private matchesRelation(
    foreignKeyValue: unknown,
    targetCollection: string,
    relationFilter: Filter<Entry>
  ): boolean {
    // Handle array of foreign keys (e.g., tagIds: ["tag-1", "tag-2"])
    if (Array.isArray(foreignKeyValue)) {
      // At least one related entity must match
      return foreignKeyValue.some((fkId) => {
        if (typeof fkId !== "string") return false;
        const related = this.storage.findById(targetCollection, fkId);
        if (!related) return false;
        return this.storage
          .getRepository(targetCollection)
          .findAll(relationFilter)
          .some((e) => e.id === fkId);
      });
    }

    // Single foreign key
    if (typeof foreignKeyValue !== "string") return false;
    const related = this.storage.findById(targetCollection, foreignKeyValue);
    if (!related) return false;

    // Check if the related entity matches the filter
    const matchingRelated = this.storage.getRepository(targetCollection).findAll(relationFilter);
    return matchingRelated.some((e) => e.id === foreignKeyValue);
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
  private readonly ajv = new Ajv({ strict: "log", keywords: ["x-link-to"] });

  registerCollection(config: CollectionConfig): void {
    if (this.collections.has(config.name)) {
      throw new EntityCollectionAlreadyExistsError(config.name);
    }
    const collectionData: CollectionData = {
      config,
      entities: new Map(),
      validator: this.ajv.compile(config.schema),
    };
    this.collections.set(config.name, collectionData);
  }

  hasCollection(name: string): boolean {
    return this.collections.has(name);
  }

  getCollections(): string[] {
    return Array.from(this.collections.keys());
  }

  getCollectionSchema(name: string): Schema {
    const data = this.getCollectionData(name);
    return data.config.schema;
  }

  getCollectionRelations(name: string): CollectionRelations {
    const data = this.getCollectionData(name);
    const schema = data.config.schema as Record<string, unknown> | null;
    const relations: CollectionRelations = {};

    if (!schema || typeof schema !== "object") {
      return relations;
    }

    const properties = schema["properties"] as Record<string, Record<string, unknown>> | undefined;
    if (!properties || typeof properties !== "object") {
      return relations;
    }

    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      // Check direct x-link-to on field
      const linkTo = fieldSchema["x-link-to"];
      if (typeof linkTo === "string") {
        relations[fieldName] = linkTo;
        continue;
      }

      // Check x-link-to on array items
      const items = fieldSchema["items"] as Record<string, unknown> | undefined;
      if (items && typeof items === "object") {
        const itemsLinkTo = items["x-link-to"];
        if (typeof itemsLinkTo === "string") {
          relations[fieldName] = itemsLinkTo;
        }
      }
    }

    return relations;
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
    const valid = validator(data);
    if (!valid) {
      const message = this.ajv.errorsText(validator.errors);
      throw new ValidationError(collection, message);
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
