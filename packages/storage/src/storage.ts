export interface Entity {
  id: string;
}

export interface IStorage {
  create<T extends Entity>(collection: string, entity: T): T;
  findById(collection: string, id: string): Entity | undefined;
  findAll(collection: string): Entity[];
  update<T extends Entity>(collection: string, id: string, data: T): T | undefined;
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

  create<T extends Entity>(collection: string, entity: T): T {
    const col = this.getCollection(collection);
    if (col.has(entity.id)) {
      throw new Error(`Entity with id ${entity.id} already exists`);
    }
    col.set(entity.id, entity);
    return entity;
  }

  findById(collection: string, id: string): Entity | undefined {
    return this.getCollection(collection).get(id);
  }

  findAll(collection: string): Entity[] {
    return Array.from(this.getCollection(collection).values());
  }

  update<T extends Entity>(collection: string, id: string, data: T): T | undefined {
    const col = this.getCollection(collection);
    const existing = col.get(id);
    if (!existing) {
      return undefined;
    }
    col.set(id, data);
    return data;
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
