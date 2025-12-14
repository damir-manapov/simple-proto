import { describe, it, expect, beforeEach } from "vitest";
import { Storage } from "../src/index.js";
import { EntryNotFoundError, EntryAlreadyExistsError } from "@simple-proto/storage-types";
import type { Entry, EntryInput, IRepository, Schema } from "@simple-proto/storage-types";

interface User extends Entry {
  name: string;
  email: string;
}

interface UserInput extends EntryInput {
  name: string;
  email: string;
}

const userSchema: Schema = {
  type: "object",
  properties: {
    id: { type: "string", nullable: true },
    name: { type: "string" },
    email: { type: "string" },
  },
  required: ["name", "email"],
  additionalProperties: false,
};

describe("Repository", () => {
  let storage: Storage;
  let userRepo: IRepository<User, UserInput>;

  beforeEach(() => {
    storage = new Storage();
    storage.registerCollection({ name: "users", schema: userSchema });
    userRepo = storage.getRepository<User, UserInput>("users");
  });

  describe("create", () => {
    it("should create an entry with auto-generated id", () => {
      const user = userRepo.create({ name: "John", email: "john@example.com" });
      expect(user.id).toBeDefined();
      expect(user.name).toBe("John");
      expect(user.email).toBe("john@example.com");
    });

    it("should create an entry with provided id", () => {
      const user = userRepo.create({ id: "user-1", name: "John", email: "john@example.com" });
      expect(user.id).toBe("user-1");
    });

    it("should throw EntryAlreadyExistsError for duplicate id", () => {
      userRepo.create({ id: "user-1", name: "John", email: "john@example.com" });
      expect(() => {
        userRepo.create({ id: "user-1", name: "Jane", email: "jane@example.com" });
      }).toThrow(EntryAlreadyExistsError);
    });
  });

  describe("findById", () => {
    it("should find an entry by id", () => {
      const created = userRepo.create({ id: "user-1", name: "John", email: "john@example.com" });
      const found = userRepo.findById("user-1");
      expect(found).toEqual(created);
    });

    it("should return null for non-existent id", () => {
      const found = userRepo.findById("non-existent");
      expect(found).toBeNull();
    });
  });

  describe("findByIdOrThrow", () => {
    it("should find an entry by id", () => {
      const created = userRepo.create({ id: "user-1", name: "John", email: "john@example.com" });
      const found = userRepo.findByIdOrThrow("user-1");
      expect(found).toEqual(created);
    });

    it("should throw EntryNotFoundError for non-existent id", () => {
      expect(() => {
        userRepo.findByIdOrThrow("non-existent");
      }).toThrow(EntryNotFoundError);
    });
  });

  describe("findAll", () => {
    it("should return all entries", () => {
      userRepo.create({ id: "user-1", name: "John", email: "john@example.com" });
      userRepo.create({ id: "user-2", name: "Jane", email: "jane@example.com" });
      const all = userRepo.findAll();
      expect(all).toHaveLength(2);
    });

    it("should return empty array when no entries", () => {
      const all = userRepo.findAll();
      expect(all).toEqual([]);
    });

    it("should filter by exact value with eq", () => {
      userRepo.create({ id: "user-1", name: "John", email: "john@example.com" });
      userRepo.create({ id: "user-2", name: "Jane", email: "jane@example.com" });
      const filtered = userRepo.findAll({ name: { eq: "John" } });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.name).toBe("John");
    });

    it("should filter with eq operator", () => {
      userRepo.create({ id: "user-1", name: "John", email: "john@example.com" });
      userRepo.create({ id: "user-2", name: "Jane", email: "jane@example.com" });
      const filtered = userRepo.findAll({ name: { eq: "Jane" } });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.name).toBe("Jane");
    });

    it("should filter with ne operator", () => {
      userRepo.create({ id: "user-1", name: "John", email: "john@example.com" });
      userRepo.create({ id: "user-2", name: "Jane", email: "jane@example.com" });
      const filtered = userRepo.findAll({ name: { ne: "John" } });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.name).toBe("Jane");
    });

    it("should filter with in operator", () => {
      userRepo.create({ id: "user-1", name: "John", email: "john@example.com" });
      userRepo.create({ id: "user-2", name: "Jane", email: "jane@example.com" });
      userRepo.create({ id: "user-3", name: "Jack", email: "jack@example.com" });
      const filtered = userRepo.findAll({ name: { in: ["John", "Jack"] } });
      expect(filtered).toHaveLength(2);
      expect(filtered.map((u) => u.name)).toEqual(["John", "Jack"]);
    });

    it("should filter with nin operator", () => {
      userRepo.create({ id: "user-1", name: "John", email: "john@example.com" });
      userRepo.create({ id: "user-2", name: "Jane", email: "jane@example.com" });
      userRepo.create({ id: "user-3", name: "Jack", email: "jack@example.com" });
      const filtered = userRepo.findAll({ name: { nin: ["John", "Jack"] } });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.name).toBe("Jane");
    });

    it("should filter with contains operator", () => {
      userRepo.create({ id: "user-1", name: "John", email: "john@example.com" });
      userRepo.create({ id: "user-2", name: "Jane", email: "jane@example.com" });
      const filtered = userRepo.findAll({ name: { contains: "an" } });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.name).toBe("Jane");
    });

    it("should filter with startsWith operator", () => {
      userRepo.create({ id: "user-1", name: "John", email: "john@example.com" });
      userRepo.create({ id: "user-2", name: "Jane", email: "jane@example.com" });
      userRepo.create({ id: "user-3", name: "Jack", email: "jack@example.com" });
      const filtered = userRepo.findAll({ name: { startsWith: "Ja" } });
      expect(filtered).toHaveLength(2);
      expect(filtered.map((u) => u.name)).toEqual(["Jane", "Jack"]);
    });

    it("should filter with endsWith operator", () => {
      userRepo.create({ id: "user-1", name: "John", email: "john@example.com" });
      userRepo.create({ id: "user-2", name: "Jane", email: "jane@example.com" });
      const filtered = userRepo.findAll({ email: { endsWith: "@example.com" } });
      expect(filtered).toHaveLength(2);
    });

    it("should combine multiple filter conditions (AND)", () => {
      userRepo.create({ id: "user-1", name: "John", email: "john@example.com" });
      userRepo.create({ id: "user-2", name: "Jane", email: "jane@test.com" });
      userRepo.create({ id: "user-3", name: "Jane", email: "jane@example.com" });
      const filtered = userRepo.findAll({
        name: { eq: "Jane" },
        email: { endsWith: "@example.com" },
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.id).toBe("user-3");
    });

    it("should return empty array when filter matches nothing", () => {
      userRepo.create({ id: "user-1", name: "John", email: "john@example.com" });
      const filtered = userRepo.findAll({ name: { eq: "Nobody" } });
      expect(filtered).toEqual([]);
    });
  });

  describe("update", () => {
    it("should update an entry", () => {
      userRepo.create({ id: "user-1", name: "John", email: "john@example.com" });
      const updated = userRepo.update("user-1", {
        id: "user-1",
        name: "Johnny",
        email: "johnny@example.com",
      });
      expect(updated?.name).toBe("Johnny");
    });

    it("should return null for non-existent id", () => {
      const updated = userRepo.update("non-existent", {
        id: "non-existent",
        name: "John",
        email: "john@example.com",
      });
      expect(updated).toBeNull();
    });
  });

  describe("updateOrThrow", () => {
    it("should update an entry", () => {
      userRepo.create({ id: "user-1", name: "John", email: "john@example.com" });
      const updated = userRepo.updateOrThrow("user-1", {
        id: "user-1",
        name: "Johnny",
        email: "johnny@example.com",
      });
      expect(updated.name).toBe("Johnny");
    });

    it("should throw EntryNotFoundError for non-existent id", () => {
      expect(() => {
        userRepo.updateOrThrow("non-existent", {
          id: "non-existent",
          name: "John",
          email: "john@example.com",
        });
      }).toThrow(EntryNotFoundError);
    });
  });

  describe("delete", () => {
    it("should delete an entry", () => {
      userRepo.create({ id: "user-1", name: "John", email: "john@example.com" });
      const deleted = userRepo.delete("user-1");
      expect(deleted).toBe(true);
      expect(userRepo.findById("user-1")).toBeNull();
    });

    it("should return false for non-existent id", () => {
      const deleted = userRepo.delete("non-existent");
      expect(deleted).toBe(false);
    });
  });

  describe("clear", () => {
    it("should clear all entries", () => {
      userRepo.create({ id: "user-1", name: "John", email: "john@example.com" });
      userRepo.create({ id: "user-2", name: "Jane", email: "jane@example.com" });
      userRepo.clear();
      expect(userRepo.findAll()).toEqual([]);
    });
  });
});
