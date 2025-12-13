export { Storage } from "./storage.js";
export type { Entity, EntityInput, CollectionConfig, Schema, IStorage } from "./types.js";
export type { JSONSchemaType } from "ajv";
export {
  StorageError,
  CollectionNotFoundError,
  CollectionAlreadyExistsError,
  ValidationError,
  EntityNotFoundError,
  EntityAlreadyExistsError,
} from "./errors.js";
