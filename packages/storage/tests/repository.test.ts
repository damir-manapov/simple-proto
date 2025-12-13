import { describe, it, expect, beforeEach } from "vitest";
import { Storage, EntryNotFoundError, EntryAlreadyExistsError } from "../src/index.js";
import type { Entry, EntryInput, IRepository } from "../src/index.js";

interface User extends Entry {
  name: string;
  email: string;
}

interface UserInput extends EntryInput {
  name: string;
  email: string;
}

describe("Repository", () => {
  let storage: Storage;
  let userRepo: IRepository<User, UserInput>;

  beforeEach(() => {
    storage = new Storage();
    storage.registerCollection({ name: "users" });
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
