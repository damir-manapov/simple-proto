# @simple-proto/storage

In-memory storage with collection-based entity management and JSON Schema validation.

## ToDo

- Filter validation
- Discrovery if sertain field of certain entity used somewhere in filter
- String/number id, autogen/manual
- Add special columns: \_notDeleteable, \_hidden, \_createdBy, \_updateBy, \_createdAt, \_updateAt
- Forbid creating fields starting by "\_"
- Validate field names
- Add metadata manipulation
- Add hooks
- Add hooks with previous value

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
| `getRepository<T, TInput>(collection)`   | `IRepository`   | Get typed repository for a collection            |

### IRepository

Interface for typed repository operations on a specific collection:

| Method                    | Returns              | Description                                |
| ------------------------- | -------------------- | ------------------------------------------ |
| `create(data)`            | `T`                  | Create entry, auto-generates id if missing |
| `findById(id)`            | `T \| null`          | Find by id, returns null if not found      |
| `findByIdOrThrow(id)`     | `T`                  | Find by id, throws if not found            |
| `findAll()`               | `T[]`                | Get all entries in collection              |
| `update(id, data)`        | `T \| null`          | Update entry, returns null if not found    |
| `updateOrThrow(id, data)` | `T`                  | Update entry, throws if not found          |
| `delete(id)`              | `boolean`            | Delete entry, returns success status       |
| `clear()`                 | `void`               | Clear all entries in collection            |
| `aggregate(options)`      | `AggregateRow \| []` | Aggregate with groupBy, sum/avg/min/max    |

#### Repository Usage

```typescript
interface User extends Entry {
  name: string;
  email: string;
}

interface UserInput extends EntryInput {
  name: string;
  email: string;
}

const storage = new Storage();
storage.registerCollection({ name: "users" });

// Get typed repository
const userRepo = storage.getRepository<User, UserInput>("users");

// All operations are now typed
const user = userRepo.create({ name: "John", email: "john@example.com" });
const found = userRepo.findById(user.id); // User | null
const all = userRepo.findAll(); // User[]
userRepo.update(user.id, { ...user, name: "Johnny" });
userRepo.delete(user.id);
```

### Aggregation

Repositories support powerful aggregation queries with optional grouping, aggregation functions, and post-aggregation filtering.

#### Basic Count

```typescript
// Count all users
const result = userRepo.aggregate({
  select: { _count: true },
});
// Returns: { _count: 42 }
```

#### Aggregation Functions

Supported functions: `sum`, `avg`, `min`, `max`

```typescript
// Compute aggregations on entire collection
const result = userRepo.aggregate({
  select: {
    _count: true,
    age: { avg: true, min: true, max: true },
    score: { sum: true, avg: true },
  },
});
// Returns: { _count: 3, age: { avg: 30, min: 20, max: 40 }, score: { sum: 270, avg: 90 } }
```

#### GroupBy

When `groupBy` is provided, the result is an array of rows (one per group):

```typescript
// Group by country
const results = userRepo.aggregate({
  groupBy: ["country"],
  select: {
    country: true,
    _count: true,
    age: { avg: true },
  },
});
// Returns: [
//   { country: "US", _count: 10, age: { avg: 32 } },
//   { country: "UK", _count: 5, age: { avg: 28 } }
// ]
```

#### Pre-filter

Apply a filter before aggregation:

```typescript
// Only aggregate US users
const result = userRepo.aggregate({
  filter: { country: { eq: "US" } },
  select: { _count: true, age: { avg: true } },
});
```

#### Having (Post-aggregation filter)

Filter groups after aggregation using `having`:

```typescript
// Only return countries with more than 5 users
const results = userRepo.aggregate({
  groupBy: ["country"],
  select: { country: true, _count: true },
  having: { _count: { gt: 5 } },
});

// Filter by aggregated field value
const results = userRepo.aggregate({
  groupBy: ["country"],
  select: { country: true, _count: true, age: { avg: true } },
  having: { age: { avg: { gte: 30 } } },
});
```

#### Return Type

- **Without groupBy**: Returns a single `AggregateRow` object
- **With groupBy**: Returns an `AggregateRow[]` array

## Errors

Custom error classes for handling storage operations:

```typescript
import {
  StorageError,
  EntityCollectionNotFoundError,
  EntityCollectionAlreadyExistsError,
  ValidationError,
  EntryNotFoundError,
  EntryAlreadyExistsError,
} from "@simple-proto/storage";
```

### StorageError

Base error class for all storage errors.

### EntityCollectionNotFoundError

Thrown when accessing an unregistered collection.

Properties:

- `collection: string` - Collection name

### EntityCollectionAlreadyExistsError

Thrown when registering a collection that already exists.

Properties:

- `collection: string` - Collection name

### ValidationError

Thrown when validation fails on create or update.

Properties:

- `collection: string` - Collection name
- `reason: string` - Validation error message

### EntryNotFoundError

Thrown when an entity is not found (by `findByIdOrThrow`, `updateOrThrow`).

Properties:

- `collection: string` - Collection name
- `id: string` - Entry id

### EntryAlreadyExistsError

Thrown when creating an entity with a duplicate id.

Properties:

- `collection: string` - Collection name
- `id: string` - Entry id

## License

MIT
