# @simple-proto/storage

In-memory storage with collection-based entity management.

## Installation

```bash
pnpm add @simple-proto/storage
```

## Usage

```typescript
import { Storage, Entity } from "@simple-proto/storage";

interface User extends Entity {
  name: string;
  email: string;
}

const storage = new Storage();

// Create
const user = storage.create<User>("users", {
  id: "1",
  name: "John",
  email: "john@example.com",
});

// Read
const found = storage.findById("users", "1"); // User | null
const foundOrThrow = storage.findByIdOrThrow("users", "1"); // User (throws if not found)
const all = storage.findAll("users"); // User[]

// Update
const updated = storage.update("users", "1", { ...user, name: "Jane" }); // User | null
const updatedOrThrow = storage.updateOrThrow("users", "1", { ...user, name: "Jane" }); // User (throws if not found)

// Delete
const deleted = storage.delete("users", "1"); // boolean

// Clear
storage.clear("users"); // Clear single collection
storage.clearAll(); // Clear all collections
```

## API

### Entity

Base interface for all entities:

```typescript
interface Entity {
  id: string;
}
```

### IStorage

Interface for storage implementations:

| Method                                   | Returns          | Description                              |
| ---------------------------------------- | ---------------- | ---------------------------------------- |
| `create<T>(collection, data)`            | `T`              | Create entity, throws if id exists       |
| `findById(collection, id)`               | `Entity \| null` | Find by id, returns null if not found    |
| `findByIdOrThrow(collection, id)`        | `Entity`         | Find by id, throws if not found          |
| `findAll(collection)`                    | `Entity[]`       | Get all entities in collection           |
| `update<T>(collection, id, data)`        | `T \| null`      | Update entity, returns null if not found |
| `updateOrThrow<T>(collection, id, data)` | `T`              | Update entity, throws if not found       |
| `delete(collection, id)`                 | `boolean`        | Delete entity, returns success status    |
| `clear(collection)`                      | `void`           | Clear single collection                  |
| `clearAll()`                             | `void`           | Clear all collections                    |

## Errors

Custom error classes for handling storage operations:

```typescript
import { StorageError, EntityNotFoundError, EntityAlreadyExistsError } from "@simple-proto/storage";
```

### StorageError

Base error class for all storage errors.

### EntityNotFoundError

Thrown when an entity is not found (by `findByIdOrThrow`, `updateOrThrow`).

Properties:

- `collection: string` - Collection name
- `id: string` - Entity id

### EntityAlreadyExistsError

Thrown when creating an entity with a duplicate id.

Properties:

- `collection: string` - Collection name
- `id: string` - Entity id

## License

MIT
