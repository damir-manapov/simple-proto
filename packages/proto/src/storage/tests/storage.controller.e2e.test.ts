import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { StorageModule } from "../storage.module.js";

describe("StorageController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [StorageModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const getServer = (): Parameters<typeof request>[0] =>
    app.getHttpServer() as Parameters<typeof request>[0];

  beforeEach(async () => {
    // Register a test collection before each test
    await request(getServer())
      .post("/storage/collections")
      .send({
        name: "users",
        schema: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            age: { type: "number" },
          },
        },
      });
  });

  describe("Collections", () => {
    it("POST /storage/collections - register collection", async () => {
      const response = await request(getServer())
        .post("/storage/collections")
        .send({
          name: "products",
          schema: { type: "object" },
        })
        .expect(201);

      expect(response.body).toEqual({ success: true });
    });

    it("GET /storage/collections - list collections", async () => {
      const response = await request(getServer()).get("/storage/collections").expect(200);

      expect((response.body as { collections: string[] }).collections).toContain("users");
    });

    it("GET /storage/collections/:name - check collection exists", async () => {
      const response = await request(getServer()).get("/storage/collections/users").expect(200);

      expect(response.body).toEqual({ exists: true });
    });
  });

  describe("CRUD", () => {
    it("POST /storage/entities - create entity", async () => {
      const response = await request(getServer())
        .post("/storage/entities")
        .send({
          collection: "users",
          data: { name: "John", age: 30 },
        })
        .expect(201);

      expect(response.body).toMatchObject({ name: "John", age: 30 });
      expect((response.body as { id: string }).id).toBeDefined();
    });

    it("GET /storage/entities/:collection - find all", async () => {
      // Create an entity first
      await request(getServer())
        .post("/storage/entities")
        .send({ collection: "users", data: { name: "Jane", age: 25 } });

      const response = await request(getServer()).get("/storage/entities/users").expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect((response.body as unknown[]).length).toBeGreaterThan(0);
    });

    it("GET /storage/entities/:collection/:id - find by id", async () => {
      // Create an entity first
      const createRes = await request(getServer())
        .post("/storage/entities")
        .send({ collection: "users", data: { name: "Bob", age: 40 } });

      const id = (createRes.body as { id: string }).id;

      const response = await request(getServer()).get(`/storage/entities/users/${id}`).expect(200);

      expect(response.body).toMatchObject({ id, name: "Bob", age: 40 });
    });

    it("PUT /storage/entities - update entity", async () => {
      // Create an entity first
      const createRes = await request(getServer())
        .post("/storage/entities")
        .send({ collection: "users", data: { name: "Alice", age: 35 } });

      const id = (createRes.body as { id: string }).id;

      const response = await request(getServer())
        .put("/storage/entities")
        .send({
          collection: "users",
          id,
          data: { id, name: "Alice Updated", age: 36 },
        })
        .expect(200);

      expect(response.body).toMatchObject({ id, name: "Alice Updated", age: 36 });
    });

    it("DELETE /storage/entities/:collection/:id - delete entity", async () => {
      // Create an entity first
      const createRes = await request(getServer())
        .post("/storage/entities")
        .send({ collection: "users", data: { name: "ToDelete", age: 20 } });

      const id = (createRes.body as { id: string }).id;

      const response = await request(getServer())
        .delete(`/storage/entities/users/${id}`)
        .expect(200);

      expect(response.body).toEqual({ success: true });

      // Verify it's deleted
      await request(getServer()).get(`/storage/entities/users/${id}`).expect(404);
    });

    it("DELETE /storage/entities/:collection - clear collection", async () => {
      // Create an entity first
      await request(getServer())
        .post("/storage/entities")
        .send({ collection: "users", data: { name: "ToClear", age: 25 } });

      await request(getServer()).delete("/storage/entities/users").expect(200);

      const response = await request(getServer()).get("/storage/entities/users").expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe("Aggregate", () => {
    it("POST /storage/aggregate - count entities", async () => {
      // Create some entities
      await request(getServer())
        .post("/storage/entities")
        .send({ collection: "users", data: { name: "User1", age: 30 } });
      await request(getServer())
        .post("/storage/entities")
        .send({ collection: "users", data: { name: "User2", age: 25 } });

      const response = await request(getServer())
        .post("/storage/aggregate")
        .send({
          collection: "users",
          options: { select: { _count: true } },
        })
        .expect(201);

      expect((response.body as { _count: number })._count).toBeGreaterThanOrEqual(2);
    });

    it("POST /storage/aggregate - aggregation functions", async () => {
      // Clear and create fresh entities
      await request(getServer()).delete("/storage/entities/users");
      await request(getServer())
        .post("/storage/entities")
        .send({ collection: "users", data: { name: "User1", age: 20 } });
      await request(getServer())
        .post("/storage/entities")
        .send({ collection: "users", data: { name: "User2", age: 40 } });

      const response = await request(getServer())
        .post("/storage/aggregate")
        .send({
          collection: "users",
          options: {
            select: {
              _count: true,
              age: { avg: true, min: true, max: true },
            },
          },
        })
        .expect(201);

      const body = response.body as {
        _count: number;
        age: { avg: number; min: number; max: number };
      };
      expect(body._count).toBe(2);
      expect(body.age.avg).toBe(30);
      expect(body.age.min).toBe(20);
      expect(body.age.max).toBe(40);
    });
  });

  describe("Error handling", () => {
    it("returns 400 for unregistered collection", async () => {
      await request(getServer()).get("/storage/entities/nonexistent").expect(400);
    });

    it("returns 404 for non-existent entity", async () => {
      await request(getServer()).get("/storage/entities/users/nonexistent-id").expect(404);
    });
  });
});
