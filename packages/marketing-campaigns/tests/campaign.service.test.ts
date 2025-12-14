import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStorage } from "@simple-proto/storage-memory";
import type { Entry, EntryInput, IRepository } from "@simple-proto/storage-types";
import { CampaignService } from "../src/campaign.service.js";
import type { IMessageSender } from "../src/campaign.service.js";
import type { SentMessage } from "@simple-proto/messaging-types";

interface User extends Entry {
  email?: string;
  name?: string;
  age?: number;
  active?: boolean;
}

interface UserInput extends EntryInput {
  email?: string;
  name?: string;
  age?: number;
  active?: boolean;
}

interface Contact extends Entry {
  profile?: {
    email?: string;
    name?: string;
  };
}

interface ContactInput extends EntryInput {
  profile?: {
    email?: string;
    name?: string;
  };
}

describe("CampaignService", () => {
  let storage: MemoryStorage;
  let service: CampaignService;
  let mockSender: IMessageSender;
  let sentMessages: {
    templateId: string;
    recipient: string;
    variables?: Record<string, string>;
  }[];

  const getUsersRepo = (): IRepository<User, UserInput> =>
    storage.getRepository<User, UserInput>("users");

  beforeEach(() => {
    storage = new MemoryStorage();
    service = new CampaignService(storage);
    sentMessages = [];

    mockSender = {
      send: (options): SentMessage => {
        sentMessages.push(options);
        return {
          id: `msg-${String(sentMessages.length)}`,
          templateId: options.templateId,
          recipient: options.recipient,
          subject: "Test Subject",
          body: "Test Body",
          status: "sent",
          sentAt: new Date(),
        };
      },
    };

    service.setMessageSender(mockSender);

    // Register a users collection for testing
    storage.registerCollection({
      name: "users",
      schema: {
        type: "object",
        properties: {
          email: { type: "string" },
          name: { type: "string" },
          age: { type: "number" },
          active: { type: "boolean" },
        },
      },
    });
  });

  describe("create", () => {
    it("should create a campaign", () => {
      const campaign = service.create({
        name: "Welcome Campaign",
        templateId: "template-1",
        entityConfig: {
          collection: "users",
          recipientField: "email",
        },
      });

      expect(campaign.id).toBeDefined();
      expect(campaign.name).toBe("Welcome Campaign");
      expect(campaign.status).toBe("draft");
    });

    it("should reject duplicate campaign names", () => {
      service.create({
        name: "Welcome Campaign",
        templateId: "template-1",
        entityConfig: {
          collection: "users",
          recipientField: "email",
        },
      });

      expect(() =>
        service.create({
          name: "Welcome Campaign",
          templateId: "template-2",
          entityConfig: {
            collection: "users",
            recipientField: "email",
          },
        })
      ).toThrow('Campaign with name "Welcome Campaign" already exists');
    });
  });

  describe("findById", () => {
    it("should find a campaign by ID", () => {
      const created = service.create({
        name: "Test Campaign",
        templateId: "template-1",
        entityConfig: {
          collection: "users",
          recipientField: "email",
        },
      });

      const found = service.findById(created.id);
      expect(found).toEqual(created);
    });

    it("should return null for non-existent campaign", () => {
      const found = service.findById("non-existent");
      expect(found).toBeNull();
    });
  });

  describe("findByStatus", () => {
    it("should find campaigns by status", () => {
      service.create({
        name: "Draft Campaign",
        templateId: "template-1",
        entityConfig: { collection: "users", recipientField: "email" },
        status: "draft",
      });

      service.create({
        name: "Active Campaign",
        templateId: "template-2",
        entityConfig: { collection: "users", recipientField: "email" },
        status: "active",
      });

      const drafts = service.findByStatus("draft");
      expect(drafts.length).toBe(1);
      expect(drafts[0]?.name).toBe("Draft Campaign");
    });
  });

  describe("updateStatus", () => {
    it("should update campaign status", () => {
      const campaign = service.create({
        name: "Test Campaign",
        templateId: "template-1",
        entityConfig: { collection: "users", recipientField: "email" },
      });

      const updated = service.updateStatus(campaign.id, "active");
      expect(updated.status).toBe("active");
    });
  });

  describe("preview", () => {
    it("should preview campaign recipients", () => {
      const usersRepo = getUsersRepo();
      usersRepo.create({ email: "user1@example.com", name: "User 1" });
      usersRepo.create({ email: "user2@example.com", name: "User 2" });
      usersRepo.create({ name: "No Email User" }); // No email

      const campaign = service.create({
        name: "Test Campaign",
        templateId: "template-1",
        entityConfig: {
          collection: "users",
          recipientField: "email",
        },
      });

      const preview = service.preview(campaign.id);
      expect(preview.recipients).toEqual(["user1@example.com", "user2@example.com"]);
      expect(preview.total).toBe(3);
      expect(preview.skipped).toBe(1);
    });

    it("should filter entities when filter is provided", () => {
      const usersRepo = getUsersRepo();
      usersRepo.create({ email: "active@example.com", name: "Active", active: true });
      usersRepo.create({ email: "inactive@example.com", name: "Inactive", active: false });

      const campaign = service.create({
        name: "Active Users Campaign",
        templateId: "template-1",
        entityConfig: {
          collection: "users",
          recipientField: "email",
          filter: { active: { eq: true } },
        },
      });

      const preview = service.preview(campaign.id);
      expect(preview.recipients).toEqual(["active@example.com"]);
    });
  });

  describe("run", () => {
    it("should send messages to all recipients", () => {
      const usersRepo = getUsersRepo();
      usersRepo.create({ email: "user1@example.com", name: "User 1" });
      usersRepo.create({ email: "user2@example.com", name: "User 2" });

      const campaign = service.create({
        name: "Test Campaign",
        templateId: "template-1",
        entityConfig: {
          collection: "users",
          recipientField: "email",
        },
      });

      const result = service.run(campaign.id);

      expect(result.success).toBe(true);
      expect(result.stats.totalRecipients).toBe(2);
      expect(result.stats.sent).toBe(2);
      expect(result.stats.failed).toBe(0);
      expect(sentMessages.length).toBe(2);
    });

    it("should use variable mappings", () => {
      const usersRepo = getUsersRepo();
      usersRepo.create({ email: "user@example.com", name: "John Doe", age: 30 });

      const campaign = service.create({
        name: "Personalized Campaign",
        templateId: "template-1",
        entityConfig: {
          collection: "users",
          recipientField: "email",
        },
        variableMappings: {
          userName: "name",
          userAge: "age",
        },
      });

      service.run(campaign.id);

      expect(sentMessages[0]?.variables).toEqual({
        userName: "John Doe",
        userAge: "30",
      });
    });

    it("should skip entities without recipient field", () => {
      const usersRepo = getUsersRepo();
      usersRepo.create({ email: "user@example.com", name: "With Email" });
      usersRepo.create({ name: "No Email" });

      const campaign = service.create({
        name: "Test Campaign",
        templateId: "template-1",
        entityConfig: {
          collection: "users",
          recipientField: "email",
        },
      });

      const result = service.run(campaign.id);

      expect(result.stats.sent).toBe(1);
      expect(result.stats.skipped).toBe(1);
    });

    it("should update campaign status to completed", () => {
      const usersRepo = getUsersRepo();
      usersRepo.create({ email: "user@example.com", name: "User" });

      const campaign = service.create({
        name: "Test Campaign",
        templateId: "template-1",
        entityConfig: {
          collection: "users",
          recipientField: "email",
        },
      });

      service.run(campaign.id);

      const updated = service.findById(campaign.id);
      expect(updated?.status).toBe("completed");
      expect(updated?.lastRunAt).toBeDefined();
      expect(updated?.stats).toBeDefined();
    });

    it("should throw if message sender not configured", () => {
      const freshService = new CampaignService(storage);
      const campaign = freshService.create({
        name: "Test Campaign",
        templateId: "template-1",
        entityConfig: {
          collection: "users",
          recipientField: "email",
        },
      });

      expect(() => freshService.run(campaign.id)).toThrow(
        "Message sender not configured. Call setMessageSender first."
      );
    });

    it("should throw for invalid campaign status", () => {
      const usersRepo = getUsersRepo();
      usersRepo.create({ email: "user@example.com" });

      const campaign = service.create({
        name: "Test Campaign",
        templateId: "template-1",
        entityConfig: {
          collection: "users",
          recipientField: "email",
        },
      });

      // Run once to complete
      service.run(campaign.id);

      // Try to run again
      expect(() => service.run(campaign.id)).toThrow('Cannot run campaign with status "completed"');
    });
  });

  describe("nested recipient field", () => {
    it("should resolve nested paths", () => {
      storage.registerCollection({
        name: "contacts",
        schema: {
          type: "object",
          properties: {
            profile: { type: "object" },
          },
        },
      });

      const contactsRepo = storage.getRepository<Contact, ContactInput>("contacts");
      contactsRepo.create({ profile: { email: "nested@example.com", name: "Nested User" } });

      const campaign = service.create({
        name: "Nested Campaign",
        templateId: "template-1",
        entityConfig: {
          collection: "contacts",
          recipientField: "profile.email",
        },
        variableMappings: {
          name: "profile.name",
        },
      });

      const result = service.run(campaign.id);

      expect(result.stats.sent).toBe(1);
      expect(sentMessages[0]?.recipient).toBe("nested@example.com");
      expect(sentMessages[0]?.variables).toEqual({ name: "Nested User" });
    });
  });
});
