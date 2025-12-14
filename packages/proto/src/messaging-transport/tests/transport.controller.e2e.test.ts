import { describe, it, expect, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { StorageModule } from "../../storage/storage.module.js";
import { MessagingTransportModule } from "../messaging-transport.module.js";

describe("TransportController (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [StorageModule, MessagingTransportModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // Clear messages before each test
    await request(app.getHttpServer()).delete("/messaging/transport/messages");
  });

  describe("POST /messaging/transport/send", () => {
    it("should send a message", async () => {
      const response = await request(app.getHttpServer())
        .post("/messaging/transport/send")
        .send({
          templateId: "template-1",
          recipient: "user@example.com",
          subject: "Hello",
          body: "Hello, World!",
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        templateId: "template-1",
        recipient: "user@example.com",
        subject: "Hello",
        body: "Hello, World!",
        sentAt: expect.any(String),
      });
    });
  });

  describe("GET /messaging/transport/messages", () => {
    it("should return all sent messages", async () => {
      // Send two messages
      await request(app.getHttpServer())
        .post("/messaging/transport/send")
        .send({
          templateId: "template-1",
          recipient: "user1@example.com",
          subject: "Hello 1",
          body: "Body 1",
        });

      await request(app.getHttpServer())
        .post("/messaging/transport/send")
        .send({
          templateId: "template-2",
          recipient: "user2@example.com",
          subject: "Hello 2",
          body: "Body 2",
        });

      const response = await request(app.getHttpServer())
        .get("/messaging/transport/messages")
        .expect(200);

      expect(response.body).toHaveLength(2);
    });
  });

  describe("GET /messaging/transport/messages/:id", () => {
    it("should return a message by id", async () => {
      const sendResponse = await request(app.getHttpServer())
        .post("/messaging/transport/send")
        .send({
          templateId: "template-1",
          recipient: "user@example.com",
          subject: "Hello",
          body: "Body",
        });

      const response = await request(app.getHttpServer())
        .get(`/messaging/transport/messages/${sendResponse.body.id}`)
        .expect(200);

      expect(response.body.id).toBe(sendResponse.body.id);
    });

    it("should return 404 for non-existent message", async () => {
      await request(app.getHttpServer())
        .get("/messaging/transport/messages/non-existent-id")
        .expect(404);
    });
  });

  describe("GET /messaging/transport/messages/by-recipient/:recipient", () => {
    it("should return messages by recipient", async () => {
      await request(app.getHttpServer())
        .post("/messaging/transport/send")
        .send({
          templateId: "template-1",
          recipient: "user1@example.com",
          subject: "Hello",
          body: "Body",
        });

      await request(app.getHttpServer())
        .post("/messaging/transport/send")
        .send({
          templateId: "template-2",
          recipient: "user1@example.com",
          subject: "Hello again",
          body: "Body 2",
        });

      await request(app.getHttpServer())
        .post("/messaging/transport/send")
        .send({
          templateId: "template-1",
          recipient: "user2@example.com",
          subject: "Different user",
          body: "Body 3",
        });

      const response = await request(app.getHttpServer())
        .get("/messaging/transport/messages/by-recipient/user1@example.com")
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.every((m: { recipient: string }) => m.recipient === "user1@example.com")).toBe(true);
    });
  });

  describe("GET /messaging/transport/messages/by-template/:templateId", () => {
    it("should return messages by template id", async () => {
      await request(app.getHttpServer())
        .post("/messaging/transport/send")
        .send({
          templateId: "template-1",
          recipient: "user1@example.com",
          subject: "Hello",
          body: "Body",
        });

      await request(app.getHttpServer())
        .post("/messaging/transport/send")
        .send({
          templateId: "template-1",
          recipient: "user2@example.com",
          subject: "Hello again",
          body: "Body 2",
        });

      await request(app.getHttpServer())
        .post("/messaging/transport/send")
        .send({
          templateId: "template-2",
          recipient: "user1@example.com",
          subject: "Different template",
          body: "Body 3",
        });

      const response = await request(app.getHttpServer())
        .get("/messaging/transport/messages/by-template/template-1")
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.every((m: { templateId: string }) => m.templateId === "template-1")).toBe(true);
    });
  });

  describe("DELETE /messaging/transport/messages", () => {
    it("should clear all messages", async () => {
      await request(app.getHttpServer())
        .post("/messaging/transport/send")
        .send({
          templateId: "template-1",
          recipient: "user@example.com",
          subject: "Hello",
          body: "Body",
        });

      await request(app.getHttpServer())
        .delete("/messaging/transport/messages")
        .expect(200);

      const response = await request(app.getHttpServer())
        .get("/messaging/transport/messages")
        .expect(200);

      expect(response.body).toHaveLength(0);
    });
  });
});
