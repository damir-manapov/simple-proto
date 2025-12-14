import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStorage } from "../../src/index.js";
import type { Entry, EntryInput } from "@simple-proto/storage-types";

interface User extends Entry {
  name: string;
  age: number;
  country: string;
  score: number;
}

interface UserInput extends EntryInput {
  name: string;
  age: number;
  country: string;
  score: number;
}

describe("Aggregate", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();

    storage.registerCollection({
      name: "users",
      schema: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          age: { type: "number" },
          country: { type: "string" },
          score: { type: "number" },
        },
        required: ["name", "age", "country", "score"],
      },
    });
  });

  describe("without groupBy (entire collection)", () => {
    it("should count all entities", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");
      userRepo.create({ name: "John", age: 30, country: "US", score: 100 });
      userRepo.create({ name: "Jane", age: 25, country: "UK", score: 80 });
      userRepo.create({ name: "Jack", age: 35, country: "US", score: 90 });

      const result = userRepo.aggregate({
        select: { _count: true },
      }) as { _count: number };

      expect(result._count).toBe(3);
    });

    it("should compute aggregation functions on entire collection", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");
      userRepo.create({ name: "John", age: 30, country: "US", score: 100 });
      userRepo.create({ name: "Jane", age: 20, country: "UK", score: 80 });
      userRepo.create({ name: "Jack", age: 40, country: "US", score: 90 });

      const result = userRepo.aggregate({
        select: {
          _count: true,
          age: { avg: true, min: true, max: true },
          score: { sum: true, avg: true },
        },
      }) as {
        _count: number;
        age: { avg: number; min: number; max: number };
        score: { sum: number; avg: number };
      };

      expect(result._count).toBe(3);
      expect(result.age.avg).toBe(30);
      expect(result.age.min).toBe(20);
      expect(result.age.max).toBe(40);
      expect(result.score.sum).toBe(270);
      expect(result.score.avg).toBe(90);
    });

    it("should apply pre-filter before aggregation", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");
      userRepo.create({ name: "John", age: 30, country: "US", score: 100 });
      userRepo.create({ name: "Jane", age: 20, country: "UK", score: 80 });
      userRepo.create({ name: "Jack", age: 40, country: "US", score: 90 });

      const result = userRepo.aggregate({
        filter: { country: { eq: "US" } },
        select: {
          _count: true,
          age: { avg: true },
        },
      }) as { _count: number; age: { avg: number } };

      expect(result._count).toBe(2);
      expect(result.age.avg).toBe(35); // (30 + 40) / 2
    });
  });

  describe("with groupBy", () => {
    it("should group by a single field", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");
      userRepo.create({ name: "John", age: 30, country: "US", score: 100 });
      userRepo.create({ name: "Jane", age: 25, country: "UK", score: 80 });
      userRepo.create({ name: "Jack", age: 35, country: "US", score: 90 });

      const result = userRepo.aggregate({
        groupBy: ["country"],
        select: {
          country: true,
          _count: true,
        },
      }) as { country: string; _count: number }[];

      expect(result).toHaveLength(2);

      const usGroup = result.find((r) => r.country === "US");
      const ukGroup = result.find((r) => r.country === "UK");

      expect(usGroup?._count).toBe(2);
      expect(ukGroup?._count).toBe(1);
    });

    it("should group by multiple fields", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");
      userRepo.create({ name: "John", age: 30, country: "US", score: 100 });
      userRepo.create({ name: "Jane", age: 30, country: "US", score: 80 });
      userRepo.create({ name: "Jack", age: 25, country: "US", score: 90 });
      userRepo.create({ name: "Jill", age: 30, country: "UK", score: 70 });

      const result = userRepo.aggregate({
        groupBy: ["country", "age"],
        select: {
          country: true,
          age: true,
          _count: true,
        },
      }) as { country: string; age: number; _count: number }[];

      expect(result).toHaveLength(3);

      const us30 = result.find((r) => r.country === "US" && r.age === 30);
      const us25 = result.find((r) => r.country === "US" && r.age === 25);
      const uk30 = result.find((r) => r.country === "UK" && r.age === 30);

      expect(us30?._count).toBe(2);
      expect(us25?._count).toBe(1);
      expect(uk30?._count).toBe(1);
    });

    it("should compute aggregations per group", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");
      userRepo.create({ name: "John", age: 30, country: "US", score: 100 });
      userRepo.create({ name: "Jane", age: 40, country: "US", score: 80 });
      userRepo.create({ name: "Jack", age: 25, country: "UK", score: 90 });

      const result = userRepo.aggregate({
        groupBy: ["country"],
        select: {
          country: true,
          _count: true,
          age: { avg: true, max: true },
          score: { sum: true },
        },
      }) as {
        country: string;
        _count: number;
        age: { avg: number; max: number };
        score: { sum: number };
      }[];

      const usGroup = result.find((r) => r.country === "US");
      const ukGroup = result.find((r) => r.country === "UK");

      expect(usGroup?._count).toBe(2);
      expect(usGroup?.age.avg).toBe(35);
      expect(usGroup?.age.max).toBe(40);
      expect(usGroup?.score.sum).toBe(180);

      expect(ukGroup?._count).toBe(1);
      expect(ukGroup?.age.avg).toBe(25);
      expect(ukGroup?.score.sum).toBe(90);
    });
  });

  describe("having clause", () => {
    it("should filter groups by _count", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");
      userRepo.create({ name: "John", age: 30, country: "US", score: 100 });
      userRepo.create({ name: "Jane", age: 25, country: "US", score: 80 });
      userRepo.create({ name: "Jack", age: 35, country: "UK", score: 90 });

      const result = userRepo.aggregate({
        groupBy: ["country"],
        select: {
          country: true,
          _count: true,
        },
        having: {
          _count: { gt: 1 },
        },
      }) as { country: string; _count: number }[];

      expect(result).toHaveLength(1);
      expect(result[0]?.country).toBe("US");
      expect(result[0]?._count).toBe(2);
    });

    it("should filter groups by aggregated field values", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");
      userRepo.create({ name: "John", age: 30, country: "US", score: 100 });
      userRepo.create({ name: "Jane", age: 40, country: "US", score: 80 });
      userRepo.create({ name: "Jack", age: 20, country: "UK", score: 90 });

      const result = userRepo.aggregate({
        groupBy: ["country"],
        select: {
          country: true,
          age: { avg: true },
        },
        having: {
          age: { avg: { gt: 30 } },
        },
      }) as { country: string; age: { avg: number } }[];

      expect(result).toHaveLength(1);
      expect(result[0]?.country).toBe("US");
      expect(result[0]?.age.avg).toBe(35);
    });

    it("should combine multiple having conditions", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");
      userRepo.create({ name: "John", age: 30, country: "US", score: 100 });
      userRepo.create({ name: "Jane", age: 40, country: "US", score: 80 });
      userRepo.create({ name: "Jack", age: 25, country: "UK", score: 90 });
      userRepo.create({ name: "Jill", age: 35, country: "UK", score: 85 });

      const result = userRepo.aggregate({
        groupBy: ["country"],
        select: {
          country: true,
          _count: true,
          age: { avg: true },
        },
        having: {
          _count: { gte: 2 },
          age: { avg: { lt: 35 } },
        },
      }) as { country: string; _count: number; age: { avg: number } }[];

      expect(result).toHaveLength(1);
      expect(result[0]?.country).toBe("UK");
    });
  });

  describe("edge cases", () => {
    it("should return zero for empty collection", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");

      const result = userRepo.aggregate({
        select: { _count: true },
      }) as { _count: number };

      expect(result._count).toBe(0);
    });

    it("should return zero for aggregations on empty collection", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");

      const result = userRepo.aggregate({
        select: {
          _count: true,
          age: { sum: true, avg: true },
        },
      }) as { _count: number; age: { sum: number; avg: number } };

      expect(result._count).toBe(0);
      expect(result.age.sum).toBe(0);
      expect(result.age.avg).toBe(0);
    });

    it("should return empty array when all groups filtered by having", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");
      userRepo.create({ name: "John", age: 30, country: "US", score: 100 });

      const result = userRepo.aggregate({
        groupBy: ["country"],
        select: {
          country: true,
          _count: true,
        },
        having: {
          _count: { gt: 10 },
        },
      }) as { country: string; _count: number }[];

      expect(result).toHaveLength(0);
    });
  });
});
