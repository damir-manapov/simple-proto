import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStorage } from "@simple-proto/storage-memory";
import { TransformService } from "../src/transform.service.js";
import type { PipelineInput } from "@simple-proto/transform-types";
import type { Entry, EntryInput } from "@simple-proto/storage-types";

type DataRecord = Entry & Record<string, unknown>;
type DataRecordInput = EntryInput & Record<string, unknown>;

function getRecords(storage: MemoryStorage, collection: string): DataRecord[] {
  return storage.getRepository<DataRecord, DataRecordInput>(collection).findAll();
}

describe("TransformService", () => {
  let storage: MemoryStorage;
  let service: TransformService;

  beforeEach(() => {
    storage = new MemoryStorage();
    service = new TransformService(storage);
  });

  describe("pipeline CRUD", () => {
    it("should create a pipeline", () => {
      const input: PipelineInput = {
        name: "Test Pipeline",
        description: "A test pipeline",
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

      const pipeline = service.createPipeline(input);

      expect(pipeline.id).toBeDefined();
      expect(pipeline.name).toBe("Test Pipeline");
      expect(pipeline.status).toBe("active");
      expect(pipeline.steps).toHaveLength(1);
      expect(pipeline.steps[0]?.id).toBeDefined();
      expect(pipeline.steps[0]?.order).toBe(1);
    });

    it("should get a pipeline", () => {
      const input: PipelineInput = {
        name: "Test Pipeline",
        steps: [],
      };

      const created = service.createPipeline(input);
      const retrieved = service.getPipeline(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe("Test Pipeline");
    });

    it("should return null for non-existent pipeline", () => {
      const result = service.getPipeline("non-existent");
      expect(result).toBeNull();
    });

    it("should update a pipeline", () => {
      const input: PipelineInput = {
        name: "Original Name",
        steps: [],
      };

      const created = service.createPipeline(input);
      const updated = service.updatePipeline(created.id, { name: "Updated Name" });

      expect(updated?.name).toBe("Updated Name");
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
    });

    it("should delete a pipeline", () => {
      const input: PipelineInput = {
        name: "Test Pipeline",
        steps: [],
      };

      const created = service.createPipeline(input);
      const deleted = service.deletePipeline(created.id);

      expect(deleted).toBe(true);
      expect(service.getPipeline(created.id)).toBeNull();
    });

    it("should list pipelines", () => {
      service.createPipeline({ name: "Pipeline 1", steps: [], status: "active" });
      service.createPipeline({ name: "Pipeline 2", steps: [], status: "paused" });
      service.createPipeline({ name: "Pipeline 3", steps: [], status: "active" });

      const all = service.listPipelines();
      expect(all).toHaveLength(3);

      const active = service.listPipelines({ status: "active" });
      expect(active).toHaveLength(2);
    });
  });

  describe("pipeline execution", () => {
    beforeEach(() => {
      storage.registerCollection({ name: "users", schema: {} });
      storage.create("users", { id: "1", name: "Alice", age: 25, active: true });
      storage.create("users", { id: "2", name: "Bob", age: 35, active: false });
      storage.create("users", { id: "3", name: "Charlie", age: 30, active: true });
    });

    it("should run a simple filter pipeline", () => {
      const pipeline = service.createPipeline({
        name: "Active Users Pipeline",
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
      });

      const run = service.runPipeline(pipeline.id);

      expect(run.status).toBe("completed");
      expect(run.stepResults).toHaveLength(1);
      expect(run.stepResults[0]?.status).toBe("completed");
      expect(run.stepResults[0]?.inputRows).toBe(3);
      expect(run.stepResults[0]?.outputRows).toBe(2);
    });

    it("should run a multi-step pipeline", () => {
      const pipeline = service.createPipeline({
        name: "Multi-Step Pipeline",
        steps: [
          {
            type: "filter",
            config: {
              source: "users",
              conditions: [{ field: "active", operator: "eq", value: true }],
              output: "_temp_active",
            },
          },
          {
            type: "sort",
            config: {
              source: "_temp_active",
              orderBy: [{ field: "age", direction: "desc" }],
              output: "active_by_age",
            },
          },
        ],
      });

      const run = service.runPipeline(pipeline.id);

      expect(run.status).toBe("completed");
      expect(run.stepResults).toHaveLength(2);
      expect(run.stepResults[1]?.outputRows).toBe(2);

      const output = getRecords(storage, "active_by_age");
      expect(output[0]?.["age"]).toBe(30); // Charlie (oldest active)
      expect(output[1]?.["age"]).toBe(25); // Alice
    });

    it("should record run history", () => {
      const pipeline = service.createPipeline({
        name: "Test Pipeline",
        steps: [
          {
            type: "filter",
            config: {
              source: "users",
              conditions: [{ field: "active", operator: "eq", value: true }],
              output: "filtered",
            },
          },
        ],
      });

      service.runPipeline(pipeline.id);
      service.runPipeline(pipeline.id);
      service.runPipeline(pipeline.id);

      const runs = service.listPipelineRuns(pipeline.id);
      expect(runs).toHaveLength(3);
    });

    it("should throw for non-existent pipeline", () => {
      expect(() => service.runPipeline("non-existent")).toThrow("Pipeline not found");
    });

    it("should throw for inactive pipeline", () => {
      const pipeline = service.createPipeline({
        name: "Paused Pipeline",
        steps: [],
        status: "paused",
      });

      expect(() => service.runPipeline(pipeline.id)).toThrow("Pipeline is not active");
    });
  });

  describe("validation", () => {
    it("should validate pipeline with missing name", () => {
      const result = service.validatePipeline({
        name: "",
        steps: [
          {
            type: "filter",
            config: {
              source: "users",
              conditions: [],
              output: "filtered",
            },
          },
        ],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "REQUIRED_FIELD", field: "name" })
      );
    });

    it("should validate pipeline with no steps", () => {
      const result = service.validatePipeline({
        name: "Empty Pipeline",
        steps: [],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "REQUIRED_FIELD", field: "steps" })
      );
    });

    it("should validate step with missing output", () => {
      const result = service.validatePipeline({
        name: "Test Pipeline",
        steps: [
          {
            type: "filter",
            config: {
              source: "users",
              conditions: [],
            } as unknown as { source: string; conditions: []; output: string },
          },
        ],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "REQUIRED_FIELD", field: "config.output" })
      );
    });

    it("should validate step with missing source", () => {
      const result = service.validatePipeline({
        name: "Test Pipeline",
        steps: [
          {
            type: "filter",
            config: {
              conditions: [],
              output: "filtered",
            } as unknown as { source: string; conditions: []; output: string },
          },
        ],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "REQUIRED_FIELD", field: "config.source" })
      );
    });

    it("should pass validation for valid pipeline", () => {
      const result = service.validatePipeline({
        name: "Valid Pipeline",
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
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("complex pipeline scenarios", () => {
    beforeEach(() => {
      // Setup orders and customers
      storage.registerCollection({ name: "orders", schema: {} });
      storage.registerCollection({ name: "customers", schema: {} });

      storage.create("customers", { id: "c1", name: "Alice", region: "North" });
      storage.create("customers", { id: "c2", name: "Bob", region: "South" });
      storage.create("customers", { id: "c3", name: "Charlie", region: "North" });

      storage.create("orders", { id: "o1", customerId: "c1", amount: 100, status: "completed" });
      storage.create("orders", { id: "o2", customerId: "c1", amount: 150, status: "completed" });
      storage.create("orders", { id: "o3", customerId: "c2", amount: 200, status: "pending" });
      storage.create("orders", { id: "o4", customerId: "c3", amount: 75, status: "completed" });
    });

    it("should run a sales report pipeline", () => {
      const pipeline = service.createPipeline({
        name: "Sales Report",
        steps: [
          // Step 1: Filter completed orders
          {
            type: "filter",
            config: {
              source: "orders",
              conditions: [{ field: "status", operator: "eq", value: "completed" }],
              output: "_temp_completed_orders",
            },
          },
          // Step 2: Join with customers
          {
            type: "join",
            config: {
              left: "_temp_completed_orders",
              right: "customers",
              on: [{ leftField: "customerId", rightField: "id" }],
              type: "inner",
              output: "_temp_enriched_orders",
            },
          },
          // Step 3: Aggregate by region
          {
            type: "aggregate",
            config: {
              source: "_temp_enriched_orders",
              groupBy: ["region"],
              aggregations: [
                { field: "amount", function: "sum", as: "totalSales" },
                { field: "*", function: "count", as: "orderCount" },
              ],
              output: "sales_by_region",
            },
          },
        ],
      });

      const run = service.runPipeline(pipeline.id);

      expect(run.status).toBe("completed");
      expect(run.stepResults).toHaveLength(3);

      const output = getRecords(storage, "sales_by_region");

      expect(output).toHaveLength(1); // Only North has completed orders

      const northSales = output.find((r) => r["region"] === "North");
      expect(northSales?.["totalSales"]).toBe(325); // 100 + 150 + 75
      expect(northSales?.["orderCount"]).toBe(3);
    });
  });
});
