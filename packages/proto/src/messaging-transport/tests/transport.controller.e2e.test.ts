import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { StorageModule } from "../../storage/storage.module.js";
import { MessagingTransportModule } from "../messaging-transport.module.js";
import type { SentMessage } from "../transport.service.js";

describe("TransportController (e2e)", () => {
  let app: INestApplication;

  const getServer = (): Parameters<typeof request>[0] =>
    app.getHttpServer() as Parameters<typeof request>[0];

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [StorageModule, MessagingTransportModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // Clear messages before each test
    await request(getServer()).delete("/messaging/transport/messages");
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /messaging/transport/send", () => {
    it("should send a message", async () => {
      const response = await request(getServer())
        .post("/messaging/transport/send")
        .send({
          templateId: "template-1",
          recipient: "user@example.com",
          subject: "Hello",
          body: "Hello, World!",
        })
        .expect(201);

      expect(response.body).toMatchObject({
        templateId: "template-1",
        recipient: "user@example.com",
        subject: "Hello",
        body: "Hello, World!",
      });
      expect((response.body as SentMessage).id).toBeDefined();
      expect((response.body as SentMessage).sentAt).toBeDefined();
    });
  });

  describe("GET /messaging/transport/messages", () => {
    it("should return all sent messages", async () => {
      // Send two messages
      await request(getServer()).post("/messaging/transport/send").send({
        templateId: "template-1",
        recipient: "user1@example.com",
        subject: "Hello 1",
        body: "Body 1",
      });

      await request(getServer()).post("/messaging/transport/send").send({
        templateId: "template-2",
        recipient: "user2@example.com",
        subject: "Hello 2",
        body: "Body 2",
      });

      const response = await request(getServer())
        .get("/messaging/transport/messages")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect((response.body as SentMessage[]).length).toBe(2);
    });
  });

  describe("GET /messaging/transport/messages/:id", () => {
    it("should return a message by id", async () => {
      const sendResponse = await request(getServer())
        .post("/messaging/transport/send")
        .send({
          templateId: "template-1",
          recipient: "user@example.com",
          subject: "Hello",
          body: "Body",
        });

      const sentMessage = sendResponse.body as SentMessage;

      const response = await request(getServer())
        .get(`/messaging/transport/messages/${sentMessage.id}`)
        .expect(200);

      const fetchedMessage = response.body as SentMessage;
      expect(fetchedMessage.id).toBe(sentMessage.id);
    });

    it("should return 404 for non-existent message", async () => {
      await request(getServer())
        .get("/messaging/transport/messages/non-existent-id")
        .expect(404);
    });
  });

  describe("GET /messaging/transport/messages/by-recipient/:recipient", () => {
    it("should return messages by recipient", async () => {
      await request(getServer()).post("/messaging/transport/send").send({
        templateId: "template-1",
        recipient: "user1@example.com",
        subject: "Hello",
        body: "Body",
      });

      await request(getServer()).post("/messaging/transport/send").send({
        templateId: "template-2",
        recipient: "user1@example.com",
        subject: "Hello again",
        body: "Body 2",
      });

      await request(getServer()).post("/messaging/transport/send").send({
        templateId: "template-1",
        recipient: "user2@example.com",
        subject: "Different user",
        body: "Body 3",
      });

      const response = await request(getServer())
        .get("/messaging/transport/messages/by-recipient/user1@example.com")
        .expect(200);

      const messages = response.body as SentMessage[];
      expect(messages).toHaveLength(2);
      expect(messages.every((m) => m.recipient === "user1@example.com")).toBe(true);
    });
  });

  describe("GET /messaging/transport/messages/by-template/:templateId", () => {
    it("should return messages by template id", async () => {
      await request(getServer()).post("/messaging/transport/send").send({
        templateId: "template-1",
        recipient: "user1@example.com",
        subject: "Hello",
        body: "Body",
      });

      await request(getServer()).post("/messaging/transport/send").send({
        templateId: "template-1",
        recipient: "user2@example.com",
        subject: "Hello again",
        body: "Body 2",
      });

      await request(getServer()).post("/messaging/transport/send").send({
        templateId: "template-2",
        recipient: "user1@example.com",
        subject: "Different template",
        body: "Body 3",
      });

      const response = await request(getServer())
        .get("/messaging/transport/messages/by-template/template-1")
        .expect(200);

      const messages = response.body as SentMessage[];
      expect(messages).toHaveLength(2);
      expect(messages.every((m) => m.templateId === "template-1")).toBe(true);
    });
  });

  describe("DELETE /messaging/transport/messages", () => {
    it("should clear all messages", async () => {
      await request(getServer()).post("/messaging/transport/send").send({
        templateId: "template-1",
        recipient: "user@example.com",
        subject: "Hello",
        body: "Body",
      });

      await request(getServer()).delete("/messaging/transport/messages").expect(200);

      const response = await request(getServer())
        .get("/messaging/transport/messages")
        .expect(200);

      expect(response.body).toHaveLength(0);
    });
  });
});
