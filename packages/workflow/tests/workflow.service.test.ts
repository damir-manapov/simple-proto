import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { WorkflowService } from "../src/workflow.service.js";
import { type MessageHandler } from "../src/action-executor.js";
import { MemoryStorage } from "@simple-proto/storage-memory";
import type { Entry } from "@simple-proto/storage-types";
import type {
  WorkflowInput,
  ConditionStep,
  ActionStep,
  PauseStep,
  EndStep,
} from "@simple-proto/workflow-types";

// Custom entry types for tests
interface OrderEntry extends Entry {
  customerId?: string;
  total?: number;
  status?: string;
  productId?: string;
  quantity?: number;
}

interface InventoryEntry extends Entry {
  productId?: string;
  quantity?: number;
}

describe("WorkflowService", () => {
  let storage: MemoryStorage;
  let service: WorkflowService;
  let sendMock: Mock<MessageHandler["send"]>;

  beforeEach(() => {
    storage = new MemoryStorage();
    sendMock = vi.fn().mockResolvedValue(undefined);

    service = new WorkflowService({
      storage,
      messageHandler: { send: sendMock },
    });
  });

  describe("workflow CRUD", () => {
    it("should create a workflow", () => {
      const input: WorkflowInput = {
        name: "Test Workflow",
        description: "A test workflow",
        steps: [{ id: "end", type: "end" }],
      };

      const workflow = service.createWorkflow(input);

      expect(workflow.id).toBeDefined();
      expect(workflow.name).toBe("Test Workflow");
      expect(workflow.description).toBe("A test workflow");
      expect(workflow.version).toBe(1);
      expect(workflow.status).toBe("draft");
      expect(workflow.steps).toHaveLength(1);
    });

    it("should get a workflow by id", async () => {
      const created = service.createWorkflow({
        name: "Test",
        status: "active",
        steps: [{ id: "end", type: "end" }],
      });

      const found = await service.getWorkflow(created.id);

      expect(found).not.toBeNull();
      expect(found?.name).toBe("Test");
    });

    it("should return null for non-existent workflow", async () => {
      const found = await service.getWorkflow("nonexistent");
      expect(found).toBeNull();
    });

    it("should update a workflow", () => {
      const created = service.createWorkflow({
        name: "Original",
        status: "active",
        steps: [{ id: "end", type: "end" }],
      });

      const updated = service.updateWorkflow(created.id, {
        name: "Updated",
        status: "active",
      });

      expect(updated).not.toBeNull();
      expect(updated?.name).toBe("Updated");
      expect(updated?.status).toBe("active");
    });

    it("should delete a workflow", async () => {
      const created = service.createWorkflow({
        name: "ToDelete",
        status: "active",
        steps: [{ id: "end", type: "end" }],
      });

      const deleted = service.deleteWorkflow(created.id);
      expect(deleted).toBe(true);

      const found = await service.getWorkflow(created.id);
      expect(found).toBeNull();
    });

    it("should list workflows", () => {
      service.createWorkflow({ name: "W1", steps: [{ id: "end", type: "end" }] });
      service.createWorkflow({ name: "W2", steps: [{ id: "end", type: "end" }] });

      const list = service.listWorkflows();

      expect(list).toHaveLength(2);
    });
  });

  describe("workflow execution", () => {
    it("should start a workflow execution", async () => {
      const workflow = service.createWorkflow({
        name: "Test",
        status: "active",
        steps: [{ id: "end", type: "end" } as EndStep],
      });

      const execution = await service.startExecution(workflow.id, {
        userId: "user1",
      });

      expect(execution.workflowId).toBe(workflow.id);
      expect(execution.status).toBe("completed");
      expect(execution.context["userId"]).toBe("user1");
    });

    it("should throw for non-existent workflow", async () => {
      await expect(service.startExecution("nonexistent", {})).rejects.toThrow(
        "Workflow nonexistent not found",
      );
    });

    it("should get execution by id", async () => {
      const workflow = service.createWorkflow({
        name: "Test",
        status: "active",
        steps: [{ id: "end", type: "end" }],
      });

      const execution = await service.startExecution(workflow.id, {});
      const found = await service.getExecution(execution.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(execution.id);
    });

    it("should list executions for a workflow", async () => {
      const workflow = service.createWorkflow({
        name: "Test",
        status: "active",
        steps: [{ id: "end", type: "end" }],
      });

      await service.startExecution(workflow.id, { run: 1 });
      await service.startExecution(workflow.id, { run: 2 });

      const executions = service.listExecutions({ workflowId: workflow.id });

      expect(executions).toHaveLength(2);
    });
  });

  describe("condition execution", () => {
    it("should execute workflow with passing condition", async () => {
      const conditionStep: ConditionStep = {
        id: "check",
        type: "condition",
        condition: {
          type: "compare",
          left: { type: "field", path: "value" },
          operator: ">",
          right: { type: "constant", value: 10 },
        },
        onTrue: "pass",
        onFalse: "fail",
      };

      const workflow = service.createWorkflow({
        name: "Condition Test",
        status: "active",
        steps: [
          conditionStep,
          { id: "pass", type: "action", action: { type: "log", message: "passed" }, next: "end" } as ActionStep,
          { id: "fail", type: "action", action: { type: "log", message: "failed" }, next: "end" } as ActionStep,
          { id: "end", type: "end" },
        ],
      });

      const execution = await service.startExecution(workflow.id, { value: 15 });

      expect(execution.status).toBe("completed");
      const historyItem = execution.history[1];
      expect(historyItem).toBeDefined();
      expect(historyItem?.stepId).toBe("pass");
    });

    it("should execute workflow with failing condition", async () => {
      const conditionStep: ConditionStep = {
        id: "check",
        type: "condition",
        condition: {
          type: "compare",
          left: { type: "field", path: "value" },
          operator: ">",
          right: { type: "constant", value: 10 },
        },
        onTrue: "pass",
        onFalse: "fail",
      };

      const workflow = service.createWorkflow({
        name: "Condition Test",
        status: "active",
        steps: [
          conditionStep,
          { id: "pass", type: "action", action: { type: "log", message: "passed" }, next: "end" } as ActionStep,
          { id: "fail", type: "action", action: { type: "log", message: "failed" }, next: "end" } as ActionStep,
          { id: "end", type: "end" },
        ],
      });

      const execution = await service.startExecution(workflow.id, { value: 5 });

      expect(execution.status).toBe("completed");
      const historyItem = execution.history[1];
      expect(historyItem).toBeDefined();
      expect(historyItem?.stepId).toBe("fail");
    });

    it("should compare nested fields", async () => {
      const conditionStep: ConditionStep = {
        id: "check",
        type: "condition",
        condition: {
          type: "compare",
          left: { type: "field", path: "user.age" },
          operator: ">=",
          right: { type: "constant", value: 18 },
        },
        onTrue: "adult",
        onFalse: "minor",
      };

      const workflow = service.createWorkflow({
        name: "Age Check",
        status: "active",
        steps: [
          conditionStep,
          { id: "adult", type: "action", action: { type: "log", message: "adult" }, next: "end" } as ActionStep,
          { id: "minor", type: "action", action: { type: "log", message: "minor" }, next: "end" } as ActionStep,
          { id: "end", type: "end" },
        ],
      });

      const execution = await service.startExecution(workflow.id, {
        user: { name: "John", age: 25 },
      });

      expect(execution.status).toBe("completed");
      const historyItem = execution.history[1];
      expect(historyItem).toBeDefined();
      expect(historyItem?.stepId).toBe("adult");
    });
  });

  describe("action execution", () => {
    it("should send message action", async () => {
      const actionStep: ActionStep = {
        id: "send",
        type: "action",
        action: {
          type: "sendMessage",
          channel: "email",
          recipient: { type: "field", path: "email" },
          message: { type: "constant", value: "Hello!" },
        },
        next: "end",
      };

      const workflow = service.createWorkflow({
        name: "Send Message",
        status: "active",
        steps: [actionStep, { id: "end", type: "end" }],
      });

      await service.startExecution(workflow.id, { email: "test@example.com" });

      expect(sendMock).toHaveBeenCalledWith("email", "test@example.com", "Hello!", undefined);
    });

    it("should create entity action", async () => {
      storage.registerCollection({ name: "orders", schema: { type: "object" } });

      const actionStep: ActionStep = {
        id: "create",
        type: "action",
        action: {
          type: "createEntity",
          collection: "orders",
          data: {
            customerId: { type: "field", path: "customerId" },
            total: { type: "constant", value: 100 },
          },
        },
        next: "end",
      };

      const workflow = service.createWorkflow({
        name: "Create Order",
        status: "active",
        steps: [actionStep, { id: "end", type: "end" }],
      });

      await service.startExecution(workflow.id, { customerId: "cust1" });

      const repo = storage.getRepository<OrderEntry>("orders");
      const orders = repo.findAll();

      expect(orders).toHaveLength(1);
      expect(orders[0]?.customerId).toBe("cust1");
      expect(orders[0]?.total).toBe(100);
    });

    it("should set context action", async () => {
      const actionStep: ActionStep = {
        id: "setContext",
        type: "action",
        action: {
          type: "setContext",
          values: {
            computed: { type: "field", path: "input" },
            static: { type: "constant", value: "fixed" },
          },
        },
        next: "end",
      };

      const workflow = service.createWorkflow({
        name: "Set Context",
        status: "active",
        steps: [actionStep, { id: "end", type: "end" }],
      });

      const execution = await service.startExecution(workflow.id, {
        input: "dynamic",
      });

      expect(execution.context["computed"]).toBe("dynamic");
      expect(execution.context["static"]).toBe("fixed");
    });
  });

  describe("pause and resume", () => {
    it("should pause execution", async () => {
      const pauseStep: PauseStep = {
        id: "wait",
        type: "pause",
        reason: "Waiting for approval",
        next: "end",
      };

      const workflow = service.createWorkflow({
        name: "Pausable",
        status: "active",
        steps: [pauseStep, { id: "end", type: "end" }],
      });

      const execution = await service.startExecution(workflow.id, {});

      expect(execution.status).toBe("paused");
      expect(execution.pausedAt).toBeDefined();
      expect(execution.currentStepId).toBe("wait");
    });

    it("should resume paused execution", async () => {
      const pauseStep: PauseStep = {
        id: "wait",
        type: "pause",
        reason: "Waiting",
        next: "end",
      };

      const workflow = service.createWorkflow({
        name: "Resumable",
        status: "active",
        steps: [pauseStep, { id: "end", type: "end" }],
      });

      const paused = await service.startExecution(workflow.id, {});
      expect(paused.status).toBe("paused");

      const resumed = await service.resumeExecution(paused.id, {
        approved: true,
      });

      expect(resumed.status).toBe("completed");
      expect(resumed.context["approved"]).toBe(true);
    });

    it("should throw when resuming non-paused execution", async () => {
      const workflow = service.createWorkflow({
        name: "Quick",
        status: "active",
        steps: [{ id: "end", type: "end" }],
      });

      const execution = await service.startExecution(workflow.id, {});
      expect(execution.status).toBe("completed");

      await expect(service.resumeExecution(execution.id, {})).rejects.toThrow(
        "Cannot resume execution with status completed",
      );
    });

    it("should throw when resuming non-existent execution", async () => {
      await expect(service.resumeExecution("nonexistent", {})).rejects.toThrow(
        "Execution nonexistent not found",
      );
    });
  });

  describe("entity existence checks", () => {
    it("should check if entity exists", async () => {
      storage.registerCollection({ name: "orders", schema: { type: "object" } });
      const repo = storage.getRepository<OrderEntry>("orders");
      repo.create({ customerId: "cust1", status: "active" } as OrderEntry);

      const conditionStep: ConditionStep = {
        id: "checkExists",
        type: "condition",
        condition: {
          type: "exists",
          collection: "orders",
          filter: {
            field: "customerId",
            operator: "==",
            value: { type: "field", path: "customerId" },
          },
        },
        onTrue: "found",
        onFalse: "notFound",
      };

      const workflow = service.createWorkflow({
        name: "Check Exists",
        status: "active",
        steps: [
          conditionStep,
          { id: "found", type: "action", action: { type: "log", message: "found" }, next: "end" } as ActionStep,
          { id: "notFound", type: "action", action: { type: "log", message: "not found" }, next: "end" } as ActionStep,
          { id: "end", type: "end" },
        ],
      });

      const execution = await service.startExecution(workflow.id, {
        customerId: "cust1",
      });

      expect(execution.status).toBe("completed");
      const historyItem = execution.history[1];
      expect(historyItem).toBeDefined();
      expect(historyItem?.stepId).toBe("found");
    });

    it("should detect non-existent entity", async () => {
      storage.registerCollection({ name: "orders", schema: { type: "object" } });

      const conditionStep: ConditionStep = {
        id: "checkExists",
        type: "condition",
        condition: {
          type: "exists",
          collection: "orders",
          filter: {
            field: "customerId",
            operator: "==",
            value: { type: "constant", value: "nonexistent" },
          },
        },
        onTrue: "found",
        onFalse: "notFound",
      };

      const workflow = service.createWorkflow({
        name: "Check Not Exists",
        status: "active",
        steps: [
          conditionStep,
          { id: "found", type: "action", action: { type: "log", message: "found" }, next: "end" } as ActionStep,
          { id: "notFound", type: "action", action: { type: "log", message: "not found" }, next: "end" } as ActionStep,
          { id: "end", type: "end" },
        ],
      });

      const execution = await service.startExecution(workflow.id, {});

      expect(execution.status).toBe("completed");
      const historyItem = execution.history[1];
      expect(historyItem).toBeDefined();
      expect(historyItem?.stepId).toBe("notFound");
    });
  });

  describe("sub-workflow execution", () => {
    it("should execute sub-workflow", async () => {
      // Create child workflow
      const childWorkflow = service.createWorkflow({
        name: "Child",
        status: "active",
        steps: [
          {
            id: "setResult",
            type: "action",
            action: {
              type: "setContext",
              values: {
                childResult: { type: "constant", value: "from-child" },
              },
            },
            next: "end",
          } as ActionStep,
          { id: "end", type: "end" },
        ],
      });

      // Create parent workflow
      const parentWorkflow = service.createWorkflow({
        name: "Parent",
        status: "active",
        steps: [
          {
            id: "runChild",
            type: "subWorkflow",
            workflowId: childWorkflow.id,
            inputMapping: {},
            outputMapping: {
              result: { type: "field", path: "childResult" },
            },
            next: "end",
            waitForCompletion: true,
          },
          { id: "end", type: "end" },
        ],
      });

      const execution = await service.startExecution(parentWorkflow.id, {});

      expect(execution.status).toBe("completed");
      expect(execution.context["result"]).toBe("from-child");
    });

    it("should pass input to sub-workflow", async () => {
      // Create child workflow that uses input
      const childWorkflow = service.createWorkflow({
        name: "Child",
        status: "active",
        steps: [
          {
            id: "double",
            type: "action",
            action: {
              type: "setContext",
              values: {
                doubled: { type: "field", path: "value" },
              },
            },
            next: "end",
          } as ActionStep,
          { id: "end", type: "end" },
        ],
      });

      // Create parent workflow
      const parentWorkflow = service.createWorkflow({
        name: "Parent",
        status: "active",
        steps: [
          {
            id: "runChild",
            type: "subWorkflow",
            workflowId: childWorkflow.id,
            inputMapping: {
              value: { type: "field", path: "originalValue" },
            },
            outputMapping: {
              result: { type: "field", path: "doubled" },
            },
            next: "end",
            waitForCompletion: true,
          },
          { id: "end", type: "end" },
        ],
      });

      const execution = await service.startExecution(parentWorkflow.id, {
        originalValue: 42,
      });

      expect(execution.status).toBe("completed");
      expect(execution.context["result"]).toBe(42);
    });
  });

  describe("complex workflows", () => {
    it("should execute order processing workflow", async () => {
      // Setup inventory
      storage.registerCollection({ name: "inventory", schema: { type: "object" } });
      storage.registerCollection({ name: "orders", schema: { type: "object" } });
      const inventoryRepo = storage.getRepository<InventoryEntry>("inventory");
      inventoryRepo.create({ productId: "prod1", quantity: 10 } as InventoryEntry);

      const workflow = service.createWorkflow({
        name: "Order Processing",
        status: "active",
        steps: [
          // Check inventory exists
          {
            id: "checkInventory",
            type: "condition",
            condition: {
              type: "exists",
              collection: "inventory",
              filter: {
                field: "productId",
                operator: "==",
                value: { type: "field", path: "productId" },
              },
            },
            onTrue: "checkQuantity",
            onFalse: "outOfStock",
          } as ConditionStep,
          // Check quantity
          {
            id: "checkQuantity",
            type: "condition",
            condition: {
              type: "compare",
              left: { type: "field", path: "requestedQty" },
              operator: "<=",
              right: { type: "constant", value: 10 },
            },
            onTrue: "createOrder",
            onFalse: "insufficientStock",
          } as ConditionStep,
          // Create order
          {
            id: "createOrder",
            type: "action",
            action: {
              type: "createEntity",
              collection: "orders",
              data: {
                productId: { type: "field", path: "productId" },
                quantity: { type: "field", path: "requestedQty" },
                status: { type: "constant", value: "created" },
              },
            },
            next: "notify",
          } as ActionStep,
          // Notify
          {
            id: "notify",
            type: "action",
            action: {
              type: "sendMessage",
              channel: "email",
              recipient: { type: "field", path: "customerEmail" },
              message: { type: "constant", value: "Order created!" },
            },
            next: "end",
          } as ActionStep,
          // Out of stock
          {
            id: "outOfStock",
            type: "action",
            action: {
              type: "setContext",
              values: {
                error: { type: "constant", value: "Product not found" },
              },
            },
            next: "end",
          } as ActionStep,
          // Insufficient stock
          {
            id: "insufficientStock",
            type: "action",
            action: {
              type: "setContext",
              values: {
                error: { type: "constant", value: "Insufficient stock" },
              },
            },
            next: "end",
          } as ActionStep,
          { id: "end", type: "end" },
        ],
      });

      const execution = await service.startExecution(workflow.id, {
        productId: "prod1",
        requestedQty: 5,
        customerEmail: "customer@example.com",
      });

      expect(execution.status).toBe("completed");
      expect(sendMock).toHaveBeenCalledWith(
        "email",
        "customer@example.com",
        "Order created!",
        undefined,
      );

      const ordersRepo = storage.getRepository<OrderEntry>("orders");
      const orders = ordersRepo.findAll();
      expect(orders).toHaveLength(1);
      expect(orders[0]?.status).toBe("created");
    });
  });
});
