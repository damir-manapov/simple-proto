export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

export class EntityNotFoundError extends StorageError {
  constructor(
    public readonly collection: string,
    public readonly id: string
  ) {
    super(`Entity with id ${id} not found in collection ${collection}`);
    this.name = "EntityNotFoundError";
  }
}

export class EntityAlreadyExistsError extends StorageError {
  constructor(
    public readonly collection: string,
    public readonly id: string
  ) {
    super(`Entity with id ${id} already exists in collection ${collection}`);
    this.name = "EntityAlreadyExistsError";
  }
}
