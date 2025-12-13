export { Storage } from "./storage.js";
export type { Entity, EntityInput, CollectionConfig, IStorage } from "./storage.js";
export type { JSONSchemaType, Schema } from "ajv";
export {
  StorageError,
  CollectionNotFoundError,
  CollectionAlreadyExistsError,
  ValidationError,
  EntityNotFoundError,
  EntityAlreadyExistsError,
} from "./errors.js";
