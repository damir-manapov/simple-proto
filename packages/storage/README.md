# @simple-proto/storage

In-memory storage with collection-based entity management.

## Installation

```bash
pnpm add @simple-proto/storage
```

## Usage

```typescript
import { Storage, Entity, EntityInput } from "@simple-proto/storage";

interface User extends Entity {
  name: string;
  email: string;
}

interface UserInput extends EntityInput {
  name: string;
  email: string;
}

const storage = new Storage();

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
const found = storage.findById("users", user.id); // Entity | null
const foundOrThrow = storage.findByIdOrThrow("users", user.id); // Entity (throws if not found)
const all = storage.findAll("users"); // Entity[]

// Update
const updated = storage.update("users", user.id, { ...user, name: "Johnny" }); // Entity | null
const updatedOrThrow = storage.updateOrThrow("users", user.id, { ...user, name: "Johnny" }); // Entity (throws if not found)

// Delete
const deleted = storage.delete("users", user.id); // boolean

// Clear
storage.clear("users"); // Clear single collection
storage.clearAll(); // Clear all collections
```

## API

### Entity

Base interface for entities (output with guaranteed id):

```typescript
interface Entity {
  id: string;
}
```

### EntityInput

Base interface for entity input (id is optional, auto-generated if not provided):

```typescript
interface EntityInput {
  id?: string;
}
```

### IStorage

Interface for storage implementations:

| Method                                   | Returns          | Description                                      |
| ---------------------------------------- | ---------------- | ------------------------------------------------ |
| `create<T>(collection, data)`            | `T & Entity`     | Create entity, auto-generates id if not provided |
| `findById(collection, id)`               | `Entity \| null` | Find by id, returns null if not found            |
| `findByIdOrThrow(collection, id)`        | `Entity`         | Find by id, throws if not found                  |
| `findAll(collection)`                    | `Entity[]`       | Get all entities in collection                   |
| `update<T>(collection, id, data)`        | `T \| null`      | Update entity, returns null if not found         |
| `updateOrThrow<T>(collection, id, data)` | `T`              | Update entity, throws if not found               |
| `delete(collection, id)`                 | `boolean`        | Delete entity, returns success status            |
| `clear(collection)`                      | `void`           | Clear single collection                          |
| `clearAll()`                             | `void`           | Clear all collections                            |

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
