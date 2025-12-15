import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import {
  ActionExecutor,
  type MessageHandler,
  type HttpClient,
  type Logger,
} from "../src/action-executor.js";
import { MemoryStorage } from "@simple-proto/storage-memory";
import type { Entry } from "@simple-proto/storage-types";
import type {
  SendMessageAction,
  CreateEntityAction,
  UpdateEntityAction,
  DeleteEntityAction,
  SetContextAction,
  HttpCallAction,
  LogAction,
} from "@simple-proto/workflow-types";

// Custom entry types for tests
interface OrderEntry extends Entry {
  status?: string;
  customerId?: string;
}

describe("ActionExecutor", () => {
  let storage: MemoryStorage;
  let sendMock: Mock<MessageHandler["send"]>;
  let requestMock: Mock<HttpClient["request"]>;
  let logMock: Mock<Logger["log"]>;
  let executor: ActionExecutor;

  beforeEach(() => {
    storage = new MemoryStorage();
    sendMock = vi.fn().mockResolvedValue(undefined);
    requestMock = vi.fn().mockResolvedValue({ data: "response" });
    logMock = vi.fn();

    executor = new ActionExecutor({
      storage,
      messageHandler: { send: sendMock },
      httpClient: { request: requestMock },
      logger: { log: logMock },
    });
  });

  describe("sendMessage action", () => {
    it("should send message with resolved values", async () => {
      const context = {
        user: { email: "john@example.com", name: "John" },
      };

      const action: SendMessageAction = {
        type: "sendMessage",
        channel: "email",
        template: "welcome",
        recipient: { type: "field", path: "user.email" },
        message: { type: "constant", value: "Hello!" },
      };

      const result = await executor.execute(action, context);

      expect(result.success).toBe(true);
      expect(sendMock).toHaveBeenCalledWith("email", "john@example.com", "Hello!", "welcome");
    });
  });

  describe("createEntity action", () => {
    it("should create entity in collection", async () => {
      storage.registerCollection({ name: "orders", schema: { type: "object" } });

      const context: Record<string, unknown> = {
        order: { customerId: "c1", total: 100 },
      };

      const action: CreateEntityAction = {
        type: "createEntity",
        collection: "orders",
        data: {
          customerId: { type: "field", path: "order.customerId" },
          total: { type: "field", path: "order.total" },
          status: { type: "constant", value: "pending" },
        },
        saveResultTo: "createdOrder",
      };

      const result = await executor.execute(action, context);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        customerId: "c1",
        total: 100,
        status: "pending",
      });

      // Should save to context
      expect(context).toHaveProperty("createdOrder");
      expect(context["createdOrder"]).toMatchObject({
        customerId: "c1",
      });

      // Should exist in storage
      const repo = storage.getRepository("orders");
      const entries = repo.findAll();
      expect(entries).toHaveLength(1);
    });

    it("should fail for non-existent collection", async () => {
      const action: CreateEntityAction = {
        type: "createEntity",
        collection: "nonexistent",
        data: { name: { type: "constant", value: "test" } },
      };

      const result = await executor.execute(action, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain("Collection nonexistent not found");
    });
  });

  describe("updateEntity action", () => {
    it("should update entity by id", async () => {
      storage.registerCollection({ name: "orders", schema: { type: "object" } });
      const repo = storage.getRepository<OrderEntry>("orders");
      const created = repo.create({ status: "pending", customerId: "c1" } as OrderEntry);

      const context = { orderId: created.id };

      const action: UpdateEntityAction = {
        type: "updateEntity",
        collection: "orders",
        id: { type: "field", path: "orderId" },
        data: {
          status: { type: "constant", value: "processed" },
        },
      };

      const result = await executor.execute(action, context);

      expect(result.success).toBe(true);

      // Verify update
      const updated = repo.findById(created.id);
      expect(updated).toMatchObject({ status: "processed" });
    });
  });

  describe("deleteEntity action", () => {
    it("should delete entity by id", async () => {
      storage.registerCollection({ name: "orders", schema: { type: "object" } });
      const repo = storage.getRepository<OrderEntry>("orders");
      const created = repo.create({ status: "pending" } as OrderEntry);

      const action: DeleteEntityAction = {
        type: "deleteEntity",
        collection: "orders",
        id: { type: "constant", value: created.id },
      };

      const result = await executor.execute(action, {});

      expect(result.success).toBe(true);

      // Verify delete
      const found = repo.findById(created.id);
      expect(found).toBeNull();
    });
  });

  describe("setContext action", () => {
    it("should set context values", async () => {
      const context: Record<string, unknown> = { existing: "value" };

      const action: SetContextAction = {
        type: "setContext",
        values: {
          newValue: { type: "constant", value: 42 },
          copied: { type: "field", path: "existing" },
        },
      };

      const result = await executor.execute(action, context);

      expect(result.success).toBe(true);
      expect(context["newValue"]).toBe(42);
      expect(context["copied"]).toBe("value");
    });

    it("should set nested context value", async () => {
      const context: Record<string, unknown> = {};

      const action: SetContextAction = {
        type: "setContext",
        values: {
          "result.computed.value": { type: "constant", value: "computed" },
        },
      };

      const result = await executor.execute(action, context);

      expect(result.success).toBe(true);
      expect(context["result"]).toEqual({ computed: { value: "computed" } });
    });
  });

  describe("httpCall action", () => {
    it("should make HTTP request and save result", async () => {
      const context: Record<string, unknown> = {
        orderId: "o123",
      };

      const action: HttpCallAction = {
        type: "httpCall",
        method: "POST",
        url: "https://api.example.com/orders",
        headers: { "Content-Type": "application/json" },
        body: {
          orderId: { type: "field", path: "orderId" },
          action: { type: "constant", value: "process" },
        },
        saveResultTo: "apiResponse",
      };

      const result = await executor.execute(action, context);

      expect(result.success).toBe(true);
      expect(requestMock).toHaveBeenCalledWith("POST", "https://api.example.com/orders", {
        headers: { "Content-Type": "application/json" },
        body: { orderId: "o123", action: "process" },
      });
      expect(context["apiResponse"]).toEqual({ data: "response" });
    });
  });

  describe("log action", () => {
    it("should log message with data", async () => {
      const context = {
        order: { id: "o123", total: 100 },
      };

      const action: LogAction = {
        type: "log",
        level: "info",
        message: "Order processed",
        data: {
          orderId: { type: "field", path: "order.id" },
          total: { type: "field", path: "order.total" },
        },
      };

      const result = await executor.execute(action, context);

      expect(result.success).toBe(true);
      expect(logMock).toHaveBeenCalledWith("info", "Order processed", {
        orderId: "o123",
        total: 100,
      });
    });

    it("should default to info level", async () => {
      const action: LogAction = {
        type: "log",
        message: "Simple log",
      };

      const result = await executor.execute(action, {});

      expect(result.success).toBe(true);
      expect(logMock).toHaveBeenCalledWith("info", "Simple log", undefined);
    });
  });

  describe("error handling", () => {
    it("should catch and return errors", async () => {
      sendMock.mockRejectedValue(new Error("Network error"));

      const action: SendMessageAction = {
        type: "sendMessage",
        channel: "email",
        recipient: { type: "constant", value: "test@test.com" },
        message: { type: "constant", value: "Hello" },
      };

      const result = await executor.execute(action, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });
  });
});
