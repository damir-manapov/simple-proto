import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { WorkflowModule } from "../workflow.module.js";
import { StorageModule } from "../../storage/storage.module.js";
import { StorageService } from "../../storage/storage.service.js";
import { MessagingTransportModule } from "../../messaging-transport/messaging-transport.module.js";
import type { Workflow, WorkflowExecution } from "@simple-proto/workflow-types";

describe("Workflow Controllers (e2e)", () => {
  let app: INestApplication;
  let storageService: StorageService;

  const getServer = (): Parameters<typeof request>[0] =>
    app.getHttpServer() as Parameters<typeof request>[0];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [StorageModule, MessagingTransportModule, WorkflowModule],
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

  describe("WorkflowController", () => {
    describe("POST /workflows", () => {
      it("should create a workflow", async () => {
        const response = await request(getServer())
          .post("/workflows")
          .send({
            name: "Test Workflow",
            description: "A test workflow",
            steps: [{ id: "end", type: "end" }],
          })
          .expect(201);

        const workflow = response.body as Workflow;
        expect(workflow.id).toBeDefined();
        expect(workflow.name).toBe("Test Workflow");
        expect(workflow.status).toBe("draft");
        expect(workflow.steps).toHaveLength(1);
      });
    });

    describe("GET /workflows", () => {
      it("should get all workflows", async () => {
        await request(getServer()).post("/workflows").send({
          name: "Workflow 1",
          steps: [{ id: "end", type: "end" }],
        });
        await request(getServer()).post("/workflows").send({
          name: "Workflow 2",
          steps: [{ id: "end", type: "end" }],
        });

        const response = await request(getServer()).get("/workflows").expect(200);

        const workflows = response.body as Workflow[];
        expect(workflows).toHaveLength(2);
      });
    });

    describe("GET /workflows/:id", () => {
      it("should get a workflow by id", async () => {
        const createResponse = await request(getServer()).post("/workflows").send({
          name: "Test Workflow",
          steps: [{ id: "end", type: "end" }],
        });
        const created = createResponse.body as Workflow;

        const response = await request(getServer()).get(`/workflows/${created.id}`).expect(200);

        const workflow = response.body as Workflow;
        expect(workflow.id).toBe(created.id);
        expect(workflow.name).toBe("Test Workflow");
      });

      it("should return 404 for non-existent workflow", async () => {
        await request(getServer()).get("/workflows/nonexistent").expect(404);
      });
    });

    describe("PUT /workflows/:id", () => {
      it("should update a workflow", async () => {
        const createResponse = await request(getServer()).post("/workflows").send({
          name: "Original",
          steps: [{ id: "end", type: "end" }],
        });
        const created = createResponse.body as Workflow;

        const response = await request(getServer())
          .put(`/workflows/${created.id}`)
          .send({ name: "Updated", status: "active" })
          .expect(200);

        const workflow = response.body as Workflow;
        expect(workflow.name).toBe("Updated");
        expect(workflow.status).toBe("active");
      });
    });

    describe("DELETE /workflows/:id", () => {
      it("should delete a workflow", async () => {
        const createResponse = await request(getServer()).post("/workflows").send({
          name: "ToDelete",
          steps: [{ id: "end", type: "end" }],
        });
        const created = createResponse.body as Workflow;

        await request(getServer()).delete(`/workflows/${created.id}`).expect(200);
        await request(getServer()).get(`/workflows/${created.id}`).expect(404);
      });
    });
  });

  describe("ExecutionController", () => {
    describe("POST /workflow-executions", () => {
      it("should start an execution", async () => {
        // First create an active workflow
        const createResponse = await request(getServer()).post("/workflows").send({
          name: "Executable",
          status: "active",
          steps: [{ id: "end", type: "end" }],
        });
        const workflow = createResponse.body as Workflow;

        const response = await request(getServer())
          .post("/workflow-executions")
          .send({
            workflowId: workflow.id,
            context: { userId: "user1" },
          })
          .expect(201);

        const execution = response.body as WorkflowExecution;
        expect(execution.id).toBeDefined();
        expect(execution.workflowId).toBe(workflow.id);
        expect(execution.status).toBe("completed");
        expect(execution.context["userId"]).toBe("user1");
      });

      it("should return error for non-existent workflow", async () => {
        await request(getServer())
          .post("/workflow-executions")
          .send({
            workflowId: "nonexistent",
            context: {},
          })
          .expect(400);
      });
    });

    describe("GET /workflow-executions", () => {
      it("should list executions", async () => {
        const createResponse = await request(getServer()).post("/workflows").send({
          name: "Executable",
          status: "active",
          steps: [{ id: "end", type: "end" }],
        });
        const workflow = createResponse.body as Workflow;

        await request(getServer())
          .post("/workflow-executions")
          .send({ workflowId: workflow.id, context: { run: 1 } });
        await request(getServer())
          .post("/workflow-executions")
          .send({ workflowId: workflow.id, context: { run: 2 } });

        const response = await request(getServer())
          .get(`/workflow-executions?workflowId=${workflow.id}`)
          .expect(200);

        const executions = response.body as WorkflowExecution[];
        expect(executions).toHaveLength(2);
      });
    });

    describe("GET /workflow-executions/:id", () => {
      it("should get an execution by id", async () => {
        const createResponse = await request(getServer()).post("/workflows").send({
          name: "Executable",
          status: "active",
          steps: [{ id: "end", type: "end" }],
        });
        const workflow = createResponse.body as Workflow;

        const startResponse = await request(getServer())
          .post("/workflow-executions")
          .send({ workflowId: workflow.id, context: {} });
        const started = startResponse.body as WorkflowExecution;

        const response = await request(getServer())
          .get(`/workflow-executions/${started.id}`)
          .expect(200);

        const execution = response.body as WorkflowExecution;
        expect(execution.id).toBe(started.id);
      });

      it("should return 404 for non-existent execution", async () => {
        await request(getServer()).get("/workflow-executions/nonexistent").expect(404);
      });
    });

    describe("POST /workflow-executions/:id/resume", () => {
      it("should resume a paused execution", async () => {
        const createResponse = await request(getServer()).post("/workflows").send({
          name: "Pausable",
          status: "active",
          steps: [
            { id: "wait", type: "pause", reason: "Waiting", next: "end" },
            { id: "end", type: "end" },
          ],
        });
        const workflow = createResponse.body as Workflow;

        const startResponse = await request(getServer())
          .post("/workflow-executions")
          .send({ workflowId: workflow.id, context: {} });
        const started = startResponse.body as WorkflowExecution;
        expect(started.status).toBe("paused");

        const response = await request(getServer())
          .post(`/workflow-executions/${started.id}/resume`)
          .send({ context: { approved: true } })
          .expect(201);

        const execution = response.body as WorkflowExecution;
        expect(execution.status).toBe("completed");
        expect(execution.context["approved"]).toBe(true);
      });
    });

    describe("POST /workflow-executions/:id/cancel", () => {
      it("should cancel an execution", async () => {
        const createResponse = await request(getServer()).post("/workflows").send({
          name: "Pausable",
          status: "active",
          steps: [
            { id: "wait", type: "pause", reason: "Waiting", next: "end" },
            { id: "end", type: "end" },
          ],
        });
        const workflow = createResponse.body as Workflow;

        const startResponse = await request(getServer())
          .post("/workflow-executions")
          .send({ workflowId: workflow.id, context: {} });
        const started = startResponse.body as WorkflowExecution;
        expect(started.status).toBe("paused");

        const response = await request(getServer())
          .post(`/workflow-executions/${started.id}/cancel`)
          .send()
          .expect(201);

        const execution = response.body as WorkflowExecution;
        expect(execution.status).toBe("cancelled");
      });
    });
  });
});
