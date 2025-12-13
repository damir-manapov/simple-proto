export interface Entity {
  id: string;
}

export interface IStorage {
  create<T extends Entity>(collection: string, data: T): T;
  findById(collection: string, id: string): Entity | null;
  findByIdOrThrow(collection: string, id: string): Entity;
  findAll(collection: string): Entity[];
  update<T extends Entity>(collection: string, id: string, data: T): T | null;
  updateOrThrow<T extends Entity>(collection: string, id: string, data: T): T;
  delete(collection: string, id: string): boolean;
  clear(collection: string): void;
  clearAll(): void;
}

export class Storage implements IStorage {
  private readonly collections = new Map<string, Map<string, Entity>>();

  private getCollection(name: string): Map<string, Entity> {
    if (!this.collections.has(name)) {
      this.collections.set(name, new Map());
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.collections.get(name)!;
  }

  create<T extends Entity>(collection: string, data: T): T {
    const col = this.getCollection(collection);
    if (col.has(data.id)) {
      throw new Error(`Entity with id ${data.id} already exists`);
    }
    col.set(data.id, data);
    return data;
  }

  findById(collection: string, id: string): Entity | null {
    return this.getCollection(collection).get(id) ?? null;
  }

  findByIdOrThrow(collection: string, id: string): Entity {
    const entity = this.findById(collection, id);
    if (entity === null) {
      throw new Error(`Entity with id ${id} not found in collection ${collection}`);
    }
    return entity;
  }

  findAll(collection: string): Entity[] {
    return Array.from(this.getCollection(collection).values());
  }

  update<T extends Entity>(collection: string, id: string, data: T): T | null {
    const col = this.getCollection(collection);
    const existing = col.get(id);
    if (!existing) {
      return null;
    }
    col.set(id, data);
    return data;
  }

  updateOrThrow<T extends Entity>(collection: string, id: string, data: T): T {
    const result = this.update(collection, id, data);
    if (result === null) {
      throw new Error(`Entity with id ${id} not found in collection ${collection}`);
    }
    return result;
  }

  delete(collection: string, id: string): boolean {
    return this.getCollection(collection).delete(id);
  }

  clear(collection: string): void {
    this.getCollection(collection).clear();
  }

  clearAll(): void {
    this.collections.clear();
  }
}
