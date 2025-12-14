import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { MessagingModule } from "../messaging.module.js";
import { StorageModule } from "../../storage/storage.module.js";

describe("MessagingController (e2e)", () => {
  let app: INestApplication;

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
    // Clear templates before each test by creating fresh ones
  });

  describe("Templates CRUD", () => {
    it("POST /messaging/templates - create template", async () => {
      const response = await request(getServer())
        .post("/messaging/templates")
        .send({
          name: "welcome",
          subject: "Welcome to {{appName}}",
          body: "Hello {{name}}, welcome!",
          type: "email",
        })
        .expect(201);

      expect(response.body).toMatchObject({
        name: "welcome",
        type: "email",
      });
      expect((response.body as { id: string }).id).toBeDefined();
    });

    it("GET /messaging/templates - list all templates", async () => {
      const response = await request(getServer()).get("/messaging/templates").expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it("GET /messaging/templates/by-name/:name - find by name", async () => {
      // Create first
      await request(getServer()).post("/messaging/templates").send({
        name: "test-find",
        body: "Test body",
        type: "sms",
      });

      const response = await request(getServer())
        .get("/messaging/templates/by-name/test-find")
        .expect(200);

      expect((response.body as { name: string }).name).toBe("test-find");
    });

    it("GET /messaging/templates/by-type/:type - find by type", async () => {
      await request(getServer()).post("/messaging/templates").send({
        name: "push-notification",
        body: "New message!",
        type: "push",
      });

      const response = await request(getServer())
        .get("/messaging/templates/by-type/push")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect((response.body as { type: string }[]).some((t) => t.type === "push")).toBe(true);
    });

    it("PUT /messaging/templates/:id - update template", async () => {
      const createRes = await request(getServer()).post("/messaging/templates").send({
        name: "to-update",
        body: "Original",
        type: "email",
      });

      const id = (createRes.body as { id: string }).id;

      const response = await request(getServer())
        .put(`/messaging/templates/${id}`)
        .send({
          id,
          name: "to-update",
          body: "Updated body",
          type: "email",
        })
        .expect(200);

      expect((response.body as { body: string }).body).toBe("Updated body");
    });

    it("DELETE /messaging/templates/:id - delete template", async () => {
      const createRes = await request(getServer()).post("/messaging/templates").send({
        name: "to-delete",
        body: "Delete me",
        type: "webhook",
      });

      const id = (createRes.body as { id: string }).id;

      await request(getServer()).delete(`/messaging/templates/${id}`).expect(200);

      await request(getServer()).get(`/messaging/templates/${id}`).expect(404);
    });
  });

  describe("Rendering", () => {
    it("POST /messaging/templates/by-name/:name/render - render template with variables", async () => {
      await request(getServer()).post("/messaging/templates").send({
        name: "render-test",
        subject: "Hello {{name}}",
        body: "Welcome to {{appName}}, {{name}}!",
        type: "email",
      });

      const response = await request(getServer())
        .post("/messaging/templates/by-name/render-test/render")
        .send({
          variables: { name: "John", appName: "MyApp" },
        })
        .expect(201);

      const body = response.body as { subject: string; body: string };
      expect(body.subject).toBe("Hello John");
      expect(body.body).toBe("Welcome to MyApp, John!");
    });

    it("GET /messaging/templates/by-name/:name/variables - extract variables", async () => {
      await request(getServer()).post("/messaging/templates").send({
        name: "vars-test",
        subject: "Order #{{orderId}}",
        body: "Dear {{customerName}}, your total is {{amount}}",
        type: "email",
      });

      const response = await request(getServer())
        .get("/messaging/templates/by-name/vars-test/variables")
        .expect(200);

      const vars = (response.body as { variables: string[] }).variables;
      expect(vars).toContain("orderId");
      expect(vars).toContain("customerName");
      expect(vars).toContain("amount");
    });
  });

  describe("Error handling", () => {
    it("returns 404 for non-existent template by name", async () => {
      await request(getServer()).get("/messaging/templates/by-name/non-existent").expect(404);
    });

    it("returns 404 for non-existent template by id", async () => {
      await request(getServer()).get("/messaging/templates/non-existent-id").expect(404);
    });
  });
});
