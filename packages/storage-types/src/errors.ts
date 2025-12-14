export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

export class EntityCollectionNotFoundError extends StorageError {
  constructor(public readonly collection: string) {
    super(`Collection ${collection} is not registered`);
    this.name = "EntityCollectionNotFoundError";
  }
}

export class EntityCollectionAlreadyExistsError extends StorageError {
  constructor(public readonly collection: string) {
    super(`Collection ${collection} is already registered`);
    this.name = "EntityCollectionAlreadyExistsError";
  }
}

export class ValidationError extends StorageError {
  constructor(
    public readonly collection: string,
    public readonly reason: string
  ) {
    super(`Validation failed for collection ${collection}: ${reason}`);
    this.name = "ValidationError";
  }
}

export class EntryNotFoundError extends StorageError {
  constructor(
    public readonly collection: string,
    public readonly id: string
  ) {
    super(`Entry with id ${id} not found in collection ${collection}`);
    this.name = "EntryNotFoundError";
  }
}

export class EntryAlreadyExistsError extends StorageError {
  constructor(
    public readonly collection: string,
    public readonly id: string
  ) {
    super(`Entry with id ${id} already exists in collection ${collection}`);
    this.name = "EntryAlreadyExistsError";
  }
}
