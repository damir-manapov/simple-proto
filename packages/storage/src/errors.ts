export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

export class CollectionNotFoundError extends StorageError {
  constructor(public readonly collection: string) {
    super(`Collection ${collection} is not registered`);
    this.name = "CollectionNotFoundError";
  }
}

export class CollectionAlreadyExistsError extends StorageError {
  constructor(public readonly collection: string) {
    super(`Collection ${collection} is already registered`);
    this.name = "CollectionAlreadyExistsError";
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

export class EntityNotFoundError extends StorageError {
  constructor(
    public readonly collection: string,
    public readonly id: string
  ) {
    super(`Entry with id ${id} not found in collection ${collection}`);
    this.name = "EntityNotFoundError";
  }
}

export class EntityAlreadyExistsError extends StorageError {
  constructor(
    public readonly collection: string,
    public readonly id: string
  ) {
    super(`Entry with id ${id} already exists in collection ${collection}`);
    this.name = "EntityAlreadyExistsError";
  }
}
