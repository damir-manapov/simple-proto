import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { ReportsModule } from "../reports.module.js";
import { StorageModule } from "../../storage/storage.module.js";
import { StorageService } from "../../storage/storage.service.js";
import type { Report, ReportResult, AggregateReportResult } from "@simple-proto/reports-types";
import type { Entry, EntryInput } from "@simple-proto/storage-types";

interface TestUser extends Entry {
  name?: string;
  department?: string;
  active?: boolean;
}

interface TestUserInput extends EntryInput {
  name?: string;
  department?: string;
  active?: boolean;
}

describe("ReportsController (e2e)", () => {
  let app: INestApplication;
  let storageService: StorageService;

  const usersCollection = "report_test_users";

  const getServer = (): Parameters<typeof request>[0] =>
    app.getHttpServer() as Parameters<typeof request>[0];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [StorageModule, ReportsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    storageService = moduleFixture.get<StorageService>(StorageService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Register and seed test collection
    if (!storageService.hasCollection(usersCollection)) {
      storageService.registerCollection({
        name: usersCollection,
        schema: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            department: { type: "string" },
            active: { type: "boolean" },
          },
        },
      });
    }

    // Clear and seed
    const usersRepo = storageService.getRepository<TestUser, TestUserInput>(usersCollection);
    usersRepo.clear();
    usersRepo.create({ name: "Alice", department: "Engineering", active: true });
    usersRepo.create({ name: "Bob", department: "Engineering", active: true });
    usersRepo.create({ name: "Charlie", department: "Sales", active: false });
  });

  describe("POST /reports", () => {
    it("should create a report", async () => {
      const response = await request(getServer())
        .post("/reports")
        .send({
          name: "All Users",
          collection: usersCollection,
        })
        .expect(201);

      const report = response.body as Report;
      expect(report.id).toBeDefined();
      expect(report.name).toBe("All Users");
      expect(report.collection).toBe(usersCollection);
      expect(report.status).toBe("draft");
    });
  });

  describe("GET /reports", () => {
    it("should get all reports", async () => {
      // Create some reports
      await request(getServer())
        .post("/reports")
        .send({ name: "Report 1", collection: usersCollection });
      await request(getServer())
        .post("/reports")
        .send({ name: "Report 2", collection: usersCollection, status: "active" });

      const response = await request(getServer()).get("/reports").expect(200);

      const reports = response.body as Report[];
      expect(reports.length).toBeGreaterThanOrEqual(2);
    });

    it("should filter reports by status", async () => {
      await request(getServer())
        .post("/reports")
        .send({ name: "Draft Report", collection: usersCollection, status: "draft" });
      await request(getServer())
        .post("/reports")
        .send({ name: "Active Report", collection: usersCollection, status: "active" });

      const response = await request(getServer())
        .get("/reports")
        .query({ status: "active" })
        .expect(200);

      const reports = response.body as Report[];
      expect(reports.every((r) => r.status === "active")).toBe(true);
    });
  });

  describe("GET /reports/:id", () => {
    it("should get a report by id", async () => {
      const createResponse = await request(getServer())
        .post("/reports")
        .send({ name: "Test Report", collection: usersCollection });

      const created = createResponse.body as Report;

      const response = await request(getServer()).get(`/reports/${created.id}`).expect(200);

      const report = response.body as Report;
      expect(report.id).toBe(created.id);
      expect(report.name).toBe("Test Report");
    });

    it("should return 404 for non-existent report", async () => {
      await request(getServer()).get("/reports/non-existent").expect(404);
    });
  });

  describe("PUT /reports/:id", () => {
    it("should update a report", async () => {
      const createResponse = await request(getServer())
        .post("/reports")
        .send({ name: "Original", collection: usersCollection });

      const created = createResponse.body as Report;

      const response = await request(getServer())
        .put(`/reports/${created.id}`)
        .send({ name: "Updated", description: "New description" })
        .expect(200);

      const updated = response.body as Report;
      expect(updated.name).toBe("Updated");
      expect(updated.description).toBe("New description");
    });
  });

  describe("PUT /reports/:id/status", () => {
    it("should update report status", async () => {
      const createResponse = await request(getServer())
        .post("/reports")
        .send({ name: "Status Test", collection: usersCollection, status: "draft" });

      const created = createResponse.body as Report;

      const response = await request(getServer())
        .put(`/reports/${created.id}/status`)
        .send({ status: "active" })
        .expect(200);

      const updated = response.body as Report;
      expect(updated.status).toBe("active");
    });
  });

  describe("DELETE /reports/:id", () => {
    it("should delete a report", async () => {
      const createResponse = await request(getServer())
        .post("/reports")
        .send({ name: "To Delete", collection: usersCollection });

      const created = createResponse.body as Report;

      await request(getServer()).delete(`/reports/${created.id}`).expect(200);

      await request(getServer()).get(`/reports/${created.id}`).expect(404);
    });

    it("should return 404 for non-existent report", async () => {
      await request(getServer()).delete("/reports/non-existent").expect(404);
    });
  });

  describe("POST /reports/:id/execute", () => {
    it("should execute a report", async () => {
      const createResponse = await request(getServer())
        .post("/reports")
        .send({ name: "Execute Test", collection: usersCollection, status: "active" });

      const created = createResponse.body as Report;

      const response = await request(getServer())
        .post(`/reports/${created.id}/execute`)
        .expect(201);

      const result = response.body as ReportResult;
      expect(result.metadata.reportId).toBe(created.id);
      expect(result.metadata.rowCount).toBe(3);
      expect(result.rows).toHaveLength(3);
    });

    it("should execute an aggregate report", async () => {
      const createResponse = await request(getServer())
        .post("/reports")
        .send({
          name: "Aggregate Test",
          collection: usersCollection,
          aggregation: {
            groupBy: ["department"],
            select: { _count: true },
          },
          status: "active",
        });

      const created = createResponse.body as Report;

      const response = await request(getServer())
        .post(`/reports/${created.id}/execute`)
        .expect(201);

      const result = response.body as AggregateReportResult;
      expect(result.metadata.reportId).toBe(created.id);
      expect(result.results).toHaveLength(2); // Engineering, Sales
    });
  });

  describe("POST /reports/preview", () => {
    it("should preview a report without saving", async () => {
      const response = await request(getServer())
        .post("/reports/preview")
        .send({
          name: "Preview Test",
          collection: usersCollection,
        })
        .expect(201);

      const result = response.body as ReportResult;
      expect(result.metadata.reportId).toBe("preview");
      expect(result.metadata.rowCount).toBe(3);
    });
  });
});
