import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { MessagingModule } from "../messaging.module.js";
import { StorageModule } from "../../storage/storage.module.js";
import type { SentMessage, MessageTemplate } from "@simple-proto/messaging-types";

describe("SentMessageService (e2e)", () => {
  let app: INestApplication;
  let testTemplate: MessageTemplate;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [StorageModule, MessagingModule],
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
    // Clear sent messages before each test
    await request(getServer()).delete("/messaging/messages");

    // Create a test template
    const response = await request(getServer())
      .post("/messaging/templates")
      .send({
        name: `test-template-${String(Date.now())}`,
        subject: "Hello {{name}}",
        body: "Welcome {{name}} to {{company}}!",
        type: "email",
      });
    testTemplate = response.body as MessageTemplate;
  });

  describe("POST /messaging/send", () => {
    it("should send a message using a template", async () => {
      const response = await request(getServer())
        .post("/messaging/send")
        .send({
          templateId: testTemplate.id,
          recipient: "user@example.com",
          variables: { name: "John", company: "Acme" },
        })
        .expect(201);

      const sentMessage = response.body as SentMessage;
      expect(sentMessage.templateId).toBe(testTemplate.id);
      expect(sentMessage.recipient).toBe("user@example.com");
      expect(sentMessage.subject).toBe("Hello John");
      expect(sentMessage.body).toBe("Welcome John to Acme!");
      expect(sentMessage.status).toBe("sent");
      expect(sentMessage.id).toBeDefined();
      expect(sentMessage.sentAt).toBeDefined();
    });
  });

  describe("POST /messaging/send/bulk", () => {
    it("should send messages to multiple recipients", async () => {
      const response = await request(getServer())
        .post("/messaging/send/bulk")
        .send({
          templateId: testTemplate.id,
          recipients: ["user1@example.com", "user2@example.com", "user3@example.com"],
          variables: { name: "Team", company: "Acme" },
        })
        .expect(201);

      expect(response.body).toMatchObject({
        total: 3,
        sent: 3,
        failed: 0,
      });
      expect((response.body as { messages: SentMessage[] }).messages).toHaveLength(3);
    });
  });

  describe("GET /messaging/messages", () => {
    it("should return all sent messages", async () => {
      // Send two messages
      await request(getServer())
        .post("/messaging/send")
        .send({
          templateId: testTemplate.id,
          recipient: "user1@example.com",
        });

      await request(getServer())
        .post("/messaging/send")
        .send({
          templateId: testTemplate.id,
          recipient: "user2@example.com",
        });

      const response = await request(getServer()).get("/messaging/messages").expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect((response.body as SentMessage[]).length).toBe(2);
    });
  });

  describe("GET /messaging/messages/:id", () => {
    it("should return a sent message by id", async () => {
      const sendResponse = await request(getServer())
        .post("/messaging/send")
        .send({
          templateId: testTemplate.id,
          recipient: "user@example.com",
        });

      const sentMessage = sendResponse.body as SentMessage;

      const response = await request(getServer())
        .get(`/messaging/messages/${sentMessage.id}`)
        .expect(200);

      expect((response.body as SentMessage).id).toBe(sentMessage.id);
    });

    it("should return 404 for non-existent message", async () => {
      await request(getServer()).get("/messaging/messages/non-existent-id").expect(404);
    });
  });

  describe("GET /messaging/messages/by-recipient/:recipient", () => {
    it("should return messages by recipient", async () => {
      await request(getServer())
        .post("/messaging/send")
        .send({
          templateId: testTemplate.id,
          recipient: "user1@example.com",
        });

      await request(getServer())
        .post("/messaging/send")
        .send({
          templateId: testTemplate.id,
          recipient: "user1@example.com",
        });

      await request(getServer())
        .post("/messaging/send")
        .send({
          templateId: testTemplate.id,
          recipient: "user2@example.com",
        });

      const response = await request(getServer())
        .get("/messaging/messages/by-recipient/user1@example.com")
        .expect(200);

      const messages = response.body as SentMessage[];
      expect(messages.length).toBe(2);
      expect(messages.every((m) => m.recipient === "user1@example.com")).toBe(true);
    });
  });

  describe("GET /messaging/messages/by-status/:status", () => {
    it("should return messages by status", async () => {
      await request(getServer())
        .post("/messaging/send")
        .send({
          templateId: testTemplate.id,
          recipient: "user@example.com",
        });

      const response = await request(getServer())
        .get("/messaging/messages/by-status/sent")
        .expect(200);

      const messages = response.body as SentMessage[];
      expect(messages.length).toBeGreaterThan(0);
      expect(messages.every((m) => m.status === "sent")).toBe(true);
    });
  });

  describe("PUT /messaging/messages/:id/status", () => {
    it("should update message status", async () => {
      const sendResponse = await request(getServer())
        .post("/messaging/send")
        .send({
          templateId: testTemplate.id,
          recipient: "user@example.com",
        });

      const sentMessage = sendResponse.body as SentMessage;

      const response = await request(getServer())
        .put(`/messaging/messages/${sentMessage.id}/status`)
        .send({ status: "delivered" })
        .expect(200);

      expect((response.body as SentMessage).status).toBe("delivered");
      expect((response.body as SentMessage).updatedAt).toBeDefined();
    });

    it("should update message status with error", async () => {
      const sendResponse = await request(getServer())
        .post("/messaging/send")
        .send({
          templateId: testTemplate.id,
          recipient: "user@example.com",
        });

      const sentMessage = sendResponse.body as SentMessage;

      const response = await request(getServer())
        .put(`/messaging/messages/${sentMessage.id}/status`)
        .send({ status: "failed", error: "Mailbox not found" })
        .expect(200);

      expect((response.body as SentMessage).status).toBe("failed");
      expect((response.body as SentMessage).error).toBe("Mailbox not found");
    });
  });

  describe("DELETE /messaging/messages", () => {
    it("should clear all sent messages", async () => {
      await request(getServer())
        .post("/messaging/send")
        .send({
          templateId: testTemplate.id,
          recipient: "user@example.com",
        });

      await request(getServer()).delete("/messaging/messages").expect(200);

      const response = await request(getServer()).get("/messaging/messages").expect(200);

      expect((response.body as SentMessage[]).length).toBe(0);
    });
  });
});
