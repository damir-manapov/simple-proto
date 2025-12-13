export { Storage } from "./storage.js";
export type { Entry, EntryInput, CollectionConfig, Schema, IStorage } from "./types.js";
export type { JSONSchemaType } from "ajv";
export {
  StorageError,
  CollectionNotFoundError,
  CollectionAlreadyExistsError,
  ValidationError,
  EntityNotFoundError,
  EntityAlreadyExistsError,
} from "./errors.js";
