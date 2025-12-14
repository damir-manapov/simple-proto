import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { CampaignsModule } from "../campaigns.module.js";
import { StorageModule } from "../../storage/storage.module.js";
import { MessagingModule } from "../../messaging/messaging.module.js";
import type { Campaign, CampaignRunResult } from "@simple-proto/marketing-campaigns";
import type { MessageTemplate } from "@simple-proto/messaging-types";

describe("CampaignsController (e2e)", () => {
  let app: INestApplication;
  let testTemplate: MessageTemplate;

  // Use unique collection name to avoid conflicts with other tests
  const usersCollection = "campaign_test_users";

  const getServer = (): Parameters<typeof request>[0] =>
    app.getHttpServer() as Parameters<typeof request>[0];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [StorageModule, MessagingModule, CampaignsModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    // Register users collection once
    await request(getServer())
      .post("/storage/collections")
      .send({
        name: usersCollection,
        schema: {
          type: "object",
          properties: {
            email: { type: "string" },
            name: { type: "string" },
          },
        },
      });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clear campaigns before each test
    await request(getServer()).delete("/campaigns");

    // Clear users before each test
    await request(getServer()).delete(`/storage/entities/${usersCollection}`);

    // Create test users
    await request(getServer())
      .post("/storage/entities")
      .send({
        collection: usersCollection,
        data: { email: "user1@example.com", name: "User One" },
      });
    await request(getServer())
      .post("/storage/entities")
      .send({
        collection: usersCollection,
        data: { email: "user2@example.com", name: "User Two" },
      });

    // Create a test template
    const templateRes = await request(getServer())
      .post("/messaging/templates")
      .send({
        name: `campaign-template-${String(Date.now())}`,
        subject: "Hello {{name}}",
        body: "Welcome {{name}}!",
        type: "email",
      });
    testTemplate = templateRes.body as MessageTemplate;
  });

  describe("POST /campaigns", () => {
    it("should create a campaign", async () => {
      const response = await request(getServer())
        .post("/campaigns")
        .send({
          name: "Test Campaign",
          templateId: testTemplate.id,
          entityConfig: {
            collection: usersCollection,
            recipientField: "email",
          },
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: "Test Campaign",
        templateId: testTemplate.id,
        status: "draft",
      });
    });
  });

  describe("GET /campaigns", () => {
    it("should return all campaigns", async () => {
      await request(getServer())
        .post("/campaigns")
        .send({
          name: "Campaign 1",
          templateId: testTemplate.id,
          entityConfig: { collection: usersCollection, recipientField: "email" },
        });

      await request(getServer())
        .post("/campaigns")
        .send({
          name: "Campaign 2",
          templateId: testTemplate.id,
          entityConfig: { collection: usersCollection, recipientField: "email" },
        });

      const response = await request(getServer()).get("/campaigns");

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it("should filter campaigns by status", async () => {
      const createRes = await request(getServer())
        .post("/campaigns")
        .send({
          name: "Draft Campaign",
          templateId: testTemplate.id,
          entityConfig: { collection: usersCollection, recipientField: "email" },
        });
      const campaign = createRes.body as Campaign;

      await request(getServer()).put(`/campaigns/${campaign.id}/status`).send({ status: "active" });

      const draftRes = await request(getServer()).get("/campaigns?status=draft");
      const activeRes = await request(getServer()).get("/campaigns?status=active");

      expect(draftRes.body).toHaveLength(0);
      expect(activeRes.body).toHaveLength(1);
    });
  });

  describe("GET /campaigns/:id", () => {
    it("should return a campaign by id", async () => {
      const createRes = await request(getServer())
        .post("/campaigns")
        .send({
          name: "My Campaign",
          templateId: testTemplate.id,
          entityConfig: { collection: usersCollection, recipientField: "email" },
        });
      const campaign = createRes.body as Campaign;

      const response = await request(getServer()).get(`/campaigns/${campaign.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ name: "My Campaign" });
    });

    it("should return 404 for non-existent campaign", async () => {
      const response = await request(getServer()).get("/campaigns/non-existent");

      expect(response.status).toBe(404);
    });
  });

  describe("GET /campaigns/:id/preview", () => {
    it("should preview campaign recipients", async () => {
      const createRes = await request(getServer())
        .post("/campaigns")
        .send({
          name: "Preview Campaign",
          templateId: testTemplate.id,
          entityConfig: { collection: usersCollection, recipientField: "email" },
        });
      const campaign = createRes.body as Campaign;

      const response = await request(getServer()).get(`/campaigns/${campaign.id}/preview`);
      const preview = response.body as { recipients: string[]; total: number; skipped: number };

      expect(response.status).toBe(200);
      expect(preview).toMatchObject({
        total: 2,
        skipped: 0,
      });
      expect(preview.recipients).toContain("user1@example.com");
      expect(preview.recipients).toContain("user2@example.com");
    });
  });

  describe("PUT /campaigns/:id/status", () => {
    it("should update campaign status", async () => {
      const createRes = await request(getServer())
        .post("/campaigns")
        .send({
          name: "Status Campaign",
          templateId: testTemplate.id,
          entityConfig: { collection: usersCollection, recipientField: "email" },
        });
      const campaign = createRes.body as Campaign;

      const response = await request(getServer())
        .put(`/campaigns/${campaign.id}/status`)
        .send({ status: "active" });
      const updated = response.body as Campaign;

      expect(response.status).toBe(200);
      expect(updated.status).toBe("active");
    });
  });

  describe("POST /campaigns/:id/run", () => {
    it("should run a campaign and send messages", async () => {
      const createRes = await request(getServer())
        .post("/campaigns")
        .send({
          name: "Run Campaign",
          templateId: testTemplate.id,
          entityConfig: { collection: usersCollection, recipientField: "email" },
          variableMappings: { name: "name" },
        });
      const campaign = createRes.body as Campaign;

      const response = await request(getServer()).post(`/campaigns/${campaign.id}/run`);
      const result = response.body as CampaignRunResult;

      expect(response.status).toBe(201);
      expect(result.success).toBe(true);
      expect(result.stats.totalRecipients).toBe(2);
      expect(result.stats.sent).toBe(2);
      expect(result.stats.failed).toBe(0);
    });
  });

  describe("DELETE /campaigns/:id", () => {
    it("should delete a campaign", async () => {
      const createRes = await request(getServer())
        .post("/campaigns")
        .send({
          name: "Delete Campaign",
          templateId: testTemplate.id,
          entityConfig: { collection: usersCollection, recipientField: "email" },
        });
      const campaign = createRes.body as Campaign;

      const deleteRes = await request(getServer()).delete(`/campaigns/${campaign.id}`);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body).toEqual({ deleted: true });

      const getRes = await request(getServer()).get(`/campaigns/${campaign.id}`);
      expect(getRes.status).toBe(404);
    });
  });
});
