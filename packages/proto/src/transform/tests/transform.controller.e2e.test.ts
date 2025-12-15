import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import request from "supertest";
import { TransformModule } from "../transform.module.js";
import { StorageModule } from "../../storage/storage.module.js";
import { StorageService } from "../../storage/storage.service.js";
import type {
  TransformPipeline,
  PipelineInput,
  PipelineRun,
  ValidationResult,
} from "@simple-proto/transform-types";

describe("TransformController (e2e)", () => {
  let app: INestApplication;
  let storageService: StorageService;

  const getServer = (): Parameters<typeof request>[0] =>
    app.getHttpServer() as Parameters<typeof request>[0];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [StorageModule, TransformModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    storageService = moduleFixture.get<StorageService>(StorageService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    storageService.clearAll();
  });

  describe("Pipeline CRUD", () => {
    it("should create a pipeline", async () => {
      const input: PipelineInput = {
        name: "Test Pipeline",
        description: "A test pipeline",
        steps: [
          {
            type: "filter",
            config: {
              source: "test_source",
              conditions: [{ field: "active", operator: "eq", value: true }],
              output: "test_output",
            },
          },
        ],
      };

      const response = await request(getServer())
        .post("/transform/pipelines")
        .send(input)
        .expect(201);

      const body = response.body as TransformPipeline;
      expect(body).toHaveProperty("id");
      expect(body.name).toBe("Test Pipeline");
      expect(body.description).toBe("A test pipeline");
      expect(body.steps).toHaveLength(1);
      expect(body.status).toBe("active");
    });

    it("should get a pipeline by id", async () => {
      // Create first
      const createResponse = await request(getServer())
        .post("/transform/pipelines")
        .send({
          name: "Get Test Pipeline",
          steps: [{ type: "filter", config: { source: "s", conditions: [], output: "o" } }],
        })
        .expect(201);

      const created = createResponse.body as TransformPipeline;

      const response = await request(getServer())
        .get(`/transform/pipelines/${created.id}`)
        .expect(200);

      const body = response.body as TransformPipeline;
      expect(body.id).toBe(created.id);
      expect(body.name).toBe("Get Test Pipeline");
    });

    it("should return 404 for non-existent pipeline", async () => {
      await request(getServer())
        .get("/transform/pipelines/non-existent")
        .expect(404);
    });

    it("should list pipelines", async () => {
      // Create first
      await request(getServer())
        .post("/transform/pipelines")
        .send({
          name: "List Test Pipeline",
          steps: [{ type: "filter", config: { source: "s", conditions: [], output: "o" } }],
        })
        .expect(201);

      const response = await request(getServer())
        .get("/transform/pipelines")
        .expect(200);

      const body = response.body as TransformPipeline[];
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });

    it("should update a pipeline", async () => {
      // Create first
      const createResponse = await request(getServer())
        .post("/transform/pipelines")
        .send({
          name: "Update Test Pipeline",
          steps: [{ type: "filter", config: { source: "s", conditions: [], output: "o" } }],
        })
        .expect(201);

      const created = createResponse.body as TransformPipeline;

      const response = await request(getServer())
        .put(`/transform/pipelines/${created.id}`)
        .send({ name: "Updated Pipeline" })
        .expect(200);

      const body = response.body as TransformPipeline;
      expect(body.name).toBe("Updated Pipeline");
    });

    it("should delete a pipeline", async () => {
      // Create first
      const createResponse = await request(getServer())
        .post("/transform/pipelines")
        .send({
          name: "Delete Test Pipeline",
          steps: [{ type: "filter", config: { source: "s", conditions: [], output: "o" } }],
        })
        .expect(201);

      const created = createResponse.body as TransformPipeline;

      const response = await request(getServer())
        .delete(`/transform/pipelines/${created.id}`)
        .expect(200);

      const body = response.body as { success: boolean };
      expect(body.success).toBe(true);

      // Verify deletion
      await request(getServer())
        .get(`/transform/pipelines/${created.id}`)
        .expect(404);
    });
  });

  describe("Pipeline Execution", () => {
    let pipelineId: string;

    beforeEach(async () => {
      // Setup source collection with data
      if (!storageService.hasCollection("users")) {
        storageService.registerCollection({ name: "users", schema: {} });
      }
      storageService.getRepository("users").clear();
      storageService.create("users", { id: "1", name: "Alice", age: 25, active: true });
      storageService.create("users", { id: "2", name: "Bob", age: 35, active: false });
      storageService.create("users", { id: "3", name: "Charlie", age: 30, active: true });

      // Create a pipeline
      const input: PipelineInput = {
        name: "Filter Active Users",
        steps: [
          {
            type: "filter",
            config: {
              source: "users",
              conditions: [{ field: "active", operator: "eq", value: true }],
              output: "active_users",
            },
          },
        ],
      };

      const response = await request(getServer())
        .post("/transform/pipelines")
        .send(input)
        .expect(201);

      pipelineId = (response.body as TransformPipeline).id;
    });

    it("should run a pipeline", async () => {
      const response = await request(getServer())
        .post(`/transform/pipelines/${pipelineId}/run`)
        .send({})
        .expect(201);

      const body = response.body as PipelineRun;
      expect(body).toHaveProperty("id");
      expect(body.status).toBe("completed");
      expect(body.stepResults).toHaveLength(1);
      expect(body.stepResults[0]?.status).toBe("completed");
      expect(body.stepResults[0]?.inputRows).toBe(3);
      expect(body.stepResults[0]?.outputRows).toBe(2);
    });

    it("should get pipeline runs", async () => {
      // First run the pipeline
      await request(getServer())
        .post(`/transform/pipelines/${pipelineId}/run`)
        .send({})
        .expect(201);

      // Get runs
      const response = await request(getServer())
        .get(`/transform/pipelines/${pipelineId}/runs`)
        .expect(200);

      const body = response.body as PipelineRun[];
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Validation", () => {
    it("should validate a valid pipeline", async () => {
      const input: PipelineInput = {
        name: "Valid Pipeline",
        steps: [
          {
            type: "filter",
            config: {
              source: "test_source",
              conditions: [{ field: "active", operator: "eq", value: true }],
              output: "test_output",
            },
          },
        ],
      };

      const response = await request(getServer())
        .post("/transform/pipelines/validate")
        .send(input)
        .expect(201);

      const body = response.body as ValidationResult;
      expect(body.valid).toBe(true);
      expect(body.errors).toHaveLength(0);
    });

    it("should return errors for invalid pipeline", async () => {
      const input: PipelineInput = {
        name: "",
        steps: [],
      };

      const response = await request(getServer())
        .post("/transform/pipelines/validate")
        .send(input)
        .expect(201);

      const body = response.body as ValidationResult;
      expect(body.valid).toBe(false);
      expect(body.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Run Details", () => {
    it("should get a run by id", async () => {
      // Setup data
      if (!storageService.hasCollection("users")) {
        storageService.registerCollection({ name: "users", schema: {} });
      }
      storageService.getRepository("users").clear();
      storageService.create("users", { id: "1", name: "Alice", active: true });

      // Create and run pipeline
      const pipelineInput: PipelineInput = {
        name: "Test Run Details",
        steps: [
          {
            type: "filter",
            config: {
              source: "users",
              conditions: [{ field: "active", operator: "eq", value: true }],
              output: "filtered_users",
            },
          },
        ],
      };

      const pipelineResponse = await request(getServer())
        .post("/transform/pipelines")
        .send(pipelineInput)
        .expect(201);

      const pipeline = pipelineResponse.body as TransformPipeline;

      const runResponse = await request(getServer())
        .post(`/transform/pipelines/${pipeline.id}/run`)
        .send({})
        .expect(201);

      const run = runResponse.body as PipelineRun;

      // Get run details
      const detailsResponse = await request(getServer())
        .get(`/transform/runs/${run.id}`)
        .expect(200);

      const details = detailsResponse.body as PipelineRun;
      expect(details.id).toBe(run.id);
      expect(details.status).toBe("completed");
    });

    it("should return 404 for non-existent run", async () => {
      await request(getServer())
        .get("/transform/runs/non-existent")
        .expect(404);
    });
  });
});
