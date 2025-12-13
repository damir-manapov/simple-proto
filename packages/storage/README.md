# @simple-proto/storage

In-memory storage with collection-based entity management and JSON Schema validation.

## Installation

```bash
pnpm add @simple-proto/storage
```

## Usage

```typescript
import {
  Storage,
  Entry,
  EntryInput,
  CollectionConfig,
  JSONSchemaType,
} from "@simple-proto/storage";

interface User extends Entry {
  name: string;
  email: string;
}

interface UserInput extends EntryInput {
  name: string;
  email: string;
}

const userSchema: JSONSchemaType<UserInput> = {
  type: "object",
  properties: {
    id: { type: "string", nullable: true },
    name: { type: "string" },
    email: { type: "string", format: "email" },
  },
  required: ["name", "email"],
  additionalProperties: false,
};

const storage = new Storage();

// Register collections before use (strict mode)
storage.registerCollection({ name: "users" });

// Register with JSON Schema validation
storage.registerCollection({
  name: "posts",
  schema: userSchema,
});

// Create with auto-generated ID
const user = storage.create<UserInput>("users", {
  name: "John",
  email: "john@example.com",
});
console.log(user.id); // auto-generated UUID

// Create with custom ID
const user2 = storage.create<UserInput>("users", {
  id: "custom-id",
  name: "Jane",
  email: "jane@example.com",
});

// Read
const found = storage.findById("users", user.id); // Entry | null
const foundOrThrow = storage.findByIdOrThrow("users", user.id); // Entry (throws if not found)
const all = storage.findAll("users"); // Entry[]

// Update
const updated = storage.update("users", user.id, { ...user, name: "Johnny" }); // Entry | null
const updatedOrThrow = storage.updateOrThrow("users", user.id, { ...user, name: "Johnny" }); // Entry (throws if not found)

// Delete
const deleted = storage.delete("users", user.id); // boolean

// Clear
storage.clear("users"); // Clear single collection
storage.clearAll(); // Clear all collections (keeps registrations)

// Introspection
storage.hasCollection("users"); // true
storage.getCollections(); // ["users", "posts"]
```

## API

### Entry

Base interface for entities (output with guaranteed id):

```typescript
interface Entry {
  id: string;
}
```

### EntryInput

Base interface for entity input (id is optional, auto-generated if not provided):

```typescript
interface EntryInput {
  id?: string;
}
```

### CollectionConfig

Configuration for collection registration:

```typescript
interface CollectionConfig {
  name: string;
  schema?: Schema; // JSON Schema for validation
}
```

### IStorage

Interface for storage implementations:

| Method                                   | Returns         | Description                                      |
| ---------------------------------------- | --------------- | ------------------------------------------------ |
| `registerCollection(config)`             | `void`          | Register a collection (required before use)      |
| `hasCollection(name)`                    | `boolean`       | Check if collection is registered                |
| `getCollections()`                       | `string[]`      | Get all registered collection names              |
| `create<T>(collection, data)`            | `T & Entry`     | Create entity, auto-generates id if not provided |
| `findById(collection, id)`               | `Entry \| null` | Find by id, returns null if not found            |
| `findByIdOrThrow(collection, id)`        | `Entry`         | Find by id, throws if not found                  |
| `findAll(collection)`                    | `Entry[]`       | Get all entities in collection                   |
| `update<T>(collection, id, data)`        | `T \| null`     | Update entity, returns null if not found         |
| `updateOrThrow<T>(collection, id, data)` | `T`             | Update entity, throws if not found               |
| `delete(collection, id)`                 | `boolean`       | Delete entity, returns success status            |
| `clear(collection)`                      | `void`          | Clear single collection                          |
| `clearAll()`                             | `void`          | Clear all collections (keeps registrations)      |

## Errors

Custom error classes for handling storage operations:

```typescript
import {
  StorageError,
  CollectionNotFoundError,
  CollectionAlreadyExistsError,
  ValidationError,
  EntityNotFoundError,
  EntityAlreadyExistsError,
} from "@simple-proto/storage";
```

### StorageError

Base error class for all storage errors.

### CollectionNotFoundError

Thrown when accessing an unregistered collection.

Properties:

- `collection: string` - Collection name

### CollectionAlreadyExistsError

Thrown when registering a collection that already exists.

Properties:

- `collection: string` - Collection name

### ValidationError

Thrown when validation fails on create or update.

Properties:

- `collection: string` - Collection name
- `reason: string` - Validation error message

### EntityNotFoundError

Thrown when an entity is not found (by `findByIdOrThrow`, `updateOrThrow`).

Properties:

- `collection: string` - Collection name
- `id: string` - Entry id

### EntityAlreadyExistsError

Thrown when creating an entity with a duplicate id.

Properties:

- `collection: string` - Collection name
- `id: string` - Entry id

## License

MIT
