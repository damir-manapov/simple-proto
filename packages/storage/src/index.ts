export { Storage } from "./storage.js";
export type { Entry, EntryInput, CollectionConfig, Schema, IStorage } from "./types.js";
export type { JSONSchemaType } from "ajv";
export {
  StorageError,
  EntityCollectionNotFoundError,
  EntityCollectionAlreadyExistsError,
  ValidationError,
  EntryNotFoundError,
  EntryAlreadyExistsError,
} from "./errors.js";
