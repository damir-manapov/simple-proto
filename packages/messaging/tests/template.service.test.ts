import { describe, it, expect, beforeEach } from "vitest";
import { Storage } from "@simple-proto/storage";
import { TemplateService } from "../src/index.js";

describe("TemplateService", () => {
  let storage: Storage;
  let templateService: TemplateService;

  beforeEach(() => {
    storage = new Storage();
    templateService = new TemplateService(storage);
  });

  describe("create", () => {
    it("should create a template", () => {
      const template = templateService.create({
        name: "welcome",
        subject: "Welcome to {{appName}}",
        body: "Hello {{name}}, welcome to our platform!",
        type: "email",
      });

      expect(template.id).toBeDefined();
      expect(template.name).toBe("welcome");
      expect(template.type).toBe("email");
    });

    it("should throw on duplicate name", () => {
      templateService.create({
        name: "welcome",
        body: "Hello",
        type: "email",
      });

      expect(() =>
        templateService.create({
          name: "welcome",
          body: "Hi",
          type: "email",
        })
      ).toThrow('Template with name "welcome" already exists');
    });
  });

  describe("findByName", () => {
    it("should find template by name", () => {
      templateService.create({
        name: "reset-password",
        body: "Reset your password here: {{link}}",
        type: "email",
      });

      const found = templateService.findByName("reset-password");
      expect(found).not.toBeNull();
      expect(found?.name).toBe("reset-password");
    });

    it("should return null for non-existent name", () => {
      const found = templateService.findByName("non-existent");
      expect(found).toBeNull();
    });
  });

  describe("findByType", () => {
    it("should find templates by type", () => {
      templateService.create({ name: "email1", body: "Email 1", type: "email" });
      templateService.create({ name: "sms1", body: "SMS 1", type: "sms" });
      templateService.create({ name: "email2", body: "Email 2", type: "email" });

      const emails = templateService.findByType("email");
      expect(emails).toHaveLength(2);

      const sms = templateService.findByType("sms");
      expect(sms).toHaveLength(1);
    });
  });

  describe("render", () => {
    it("should render template with variables", () => {
      templateService.create({
        name: "welcome",
        subject: "Welcome to {{appName}}",
        body: "Hello {{name}}, welcome to {{appName}}!",
        type: "email",
      });

      const rendered = templateService.render("welcome", {
        name: "John",
        appName: "MyApp",
      });

      expect(rendered.subject).toBe("Welcome to MyApp");
      expect(rendered.body).toBe("Hello John, welcome to MyApp!");
      expect(rendered.type).toBe("email");
    });

    it("should keep unmatched variables as-is", () => {
      templateService.create({
        name: "partial",
        body: "Hello {{name}}, your code is {{code}}",
        type: "sms",
      });

      const rendered = templateService.render("partial", { name: "Jane" });
      expect(rendered.body).toBe("Hello Jane, your code is {{code}}");
    });

    it("should throw for non-existent template", () => {
      expect(() => templateService.render("non-existent", {})).toThrow(
        'Template "non-existent" not found'
      );
    });
  });

  describe("extractVariables", () => {
    it("should extract variable names from template", () => {
      templateService.create({
        name: "invoice",
        subject: "Invoice #{{invoiceNumber}}",
        body: "Dear {{customerName}}, your invoice for {{amount}} is ready.",
        type: "email",
      });

      const vars = templateService.extractVariables("invoice");
      expect(vars).toContain("invoiceNumber");
      expect(vars).toContain("customerName");
      expect(vars).toContain("amount");
      expect(vars).toHaveLength(3);
    });

    it("should return unique variables", () => {
      templateService.create({
        name: "repeat",
        body: "{{name}} {{name}} {{name}}",
        type: "sms",
      });

      const vars = templateService.extractVariables("repeat");
      expect(vars).toEqual(["name"]);
    });
  });

  describe("update and delete", () => {
    it("should update a template", () => {
      const template = templateService.create({
        name: "test",
        body: "Original",
        type: "email",
      });

      const updated = templateService.update(template.id, {
        ...template,
        body: "Updated",
      });

      expect(updated?.body).toBe("Updated");
    });

    it("should delete a template", () => {
      const template = templateService.create({
        name: "to-delete",
        body: "Delete me",
        type: "push",
      });

      const deleted = templateService.delete(template.id);
      expect(deleted).toBe(true);

      const found = templateService.findById(template.id);
      expect(found).toBeNull();
    });
  });
});
