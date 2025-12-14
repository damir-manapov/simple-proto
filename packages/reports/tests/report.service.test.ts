import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStorage } from "@simple-proto/storage-memory";
import type { Entry, EntryInput, Filter } from "@simple-proto/storage-types";
import type { ReportInput, ReportResult, AggregateReportResult } from "@simple-proto/reports-types";
import { ReportService } from "../src/report.service.js";

type AnyFilter = Filter<Entry & Record<string, unknown>>;

interface User extends Entry {
  name?: string;
  email?: string;
  age?: number;
  department?: string;
  active?: boolean;
}

interface UserInput extends EntryInput {
  name?: string;
  email?: string;
  age?: number;
  department?: string;
  active?: boolean;
}

const USER_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    email: { type: "string" },
    age: { type: "number" },
    department: { type: "string" },
    active: { type: "boolean" },
  },
};

describe("ReportService", () => {
  let storage: MemoryStorage;
  let service: ReportService;

  beforeEach(() => {
    storage = new MemoryStorage();

    // Register users collection
    storage.registerCollection({ name: "users", schema: USER_SCHEMA });
    const usersRepo = storage.getRepository<User, UserInput>("users");

    // Seed test data
    usersRepo.create({
      name: "Alice",
      email: "alice@example.com",
      age: 30,
      department: "Engineering",
      active: true,
    });
    usersRepo.create({
      name: "Bob",
      email: "bob@example.com",
      age: 25,
      department: "Engineering",
      active: true,
    });
    usersRepo.create({
      name: "Charlie",
      email: "charlie@example.com",
      age: 35,
      department: "Sales",
      active: false,
    });
    usersRepo.create({
      name: "Diana",
      email: "diana@example.com",
      age: 28,
      department: "Sales",
      active: true,
    });
    usersRepo.create({
      name: "Eve",
      email: "eve@example.com",
      age: 32,
      department: "Marketing",
      active: true,
    });

    service = new ReportService(storage);
  });

  describe("CRUD operations", () => {
    it("should create a report", () => {
      const input: ReportInput = {
        name: "Active Users",
        collection: "users",
        filter: { active: { eq: true } } as unknown as AnyFilter,
      };

      const report = service.create(input);

      expect(report.id).toBeDefined();
      expect(report.name).toBe("Active Users");
      expect(report.collection).toBe("users");
      expect(report.status).toBe("draft");
      expect(report.createdAt).toBeInstanceOf(Date);
      expect(report.updatedAt).toBeInstanceOf(Date);
    });

    it("should create a report with explicit status", () => {
      const input: ReportInput = {
        name: "Sales Report",
        collection: "users",
        status: "active",
      };

      const report = service.create(input);

      expect(report.status).toBe("active");
    });

    it("should get a report by ID", () => {
      const created = service.create({
        name: "Test Report",
        collection: "users",
      });

      const retrieved = service.get(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe("Test Report");
    });

    it("should return undefined for non-existent report", () => {
      const result = service.get("non-existent-id");

      expect(result).toBeUndefined();
    });

    it("should get all reports", () => {
      service.create({ name: "Report 1", collection: "users" });
      service.create({ name: "Report 2", collection: "users" });
      service.create({ name: "Report 3", collection: "users" });

      const all = service.getAll();

      expect(all).toHaveLength(3);
    });

    it("should get reports by status", () => {
      service.create({ name: "Draft 1", collection: "users", status: "draft" });
      service.create({ name: "Active 1", collection: "users", status: "active" });
      service.create({ name: "Active 2", collection: "users", status: "active" });
      service.create({ name: "Archived", collection: "users", status: "archived" });

      const active = service.getByStatus("active");

      expect(active).toHaveLength(2);
      expect(active.every((r) => r.status === "active")).toBe(true);
    });

    it("should update a report", () => {
      const created = service.create({
        name: "Original Name",
        collection: "users",
      });

      const updated = service.update(created.id, {
        name: "Updated Name",
        description: "New description",
      });

      expect(updated.name).toBe("Updated Name");
      expect(updated.description).toBe("New description");
      expect(updated.id).toBe(created.id);
      expect(updated.createdAt).toEqual(created.createdAt);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
    });

    it("should throw when updating non-existent report", () => {
      expect(() => service.update("non-existent", { name: "New" })).toThrow(
        "Report not found: non-existent"
      );
    });

    it("should update report status", () => {
      const created = service.create({
        name: "Test",
        collection: "users",
        status: "draft",
      });

      const updated = service.updateStatus(created.id, "active");

      expect(updated.status).toBe("active");
    });

    it("should delete a report", () => {
      const created = service.create({
        name: "To Delete",
        collection: "users",
      });

      const result = service.delete(created.id);

      expect(result).toBe(true);
      expect(service.get(created.id)).toBeUndefined();
    });

    it("should return false when deleting non-existent report", () => {
      const result = service.delete("non-existent");

      expect(result).toBe(false);
    });
  });

  describe("execute", () => {
    it("should execute a simple report", () => {
      const report = service.create({
        name: "All Users",
        collection: "users",
        status: "active",
      });

      const result = service.execute(report.id) as ReportResult;

      expect(result.metadata.reportId).toBe(report.id);
      expect(result.metadata.reportName).toBe("All Users");
      expect(result.metadata.rowCount).toBe(5);
      expect(result.metadata.truncated).toBe(false);
      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.rows).toHaveLength(5);
    });

    it("should execute a report with filter", () => {
      const report = service.create({
        name: "Engineering Users",
        collection: "users",
        filter: { department: { eq: "Engineering" } } as unknown as AnyFilter,
        status: "active",
      });

      const result = service.execute(report.id) as ReportResult;

      expect(result.metadata.rowCount).toBe(2);
      expect(result.rows).toHaveLength(2);
    });

    it("should execute a report with column projection", () => {
      const report = service.create({
        name: "User Names",
        collection: "users",
        columns: [
          { field: "name", label: "Name" },
          { field: "email", label: "Email" },
        ],
        status: "active",
      });

      const result = service.execute(report.id) as ReportResult;

      expect(result.columns).toHaveLength(2);
      expect(result.rows[0]).toHaveProperty("name");
      expect(result.rows[0]).toHaveProperty("email");
      expect(result.rows[0]).not.toHaveProperty("age");
      expect(result.rows[0]).not.toHaveProperty("department");
    });

    it("should truncate results based on limit", () => {
      const report = service.create({
        name: "Limited Report",
        collection: "users",
        limit: 2,
        status: "active",
      });

      const result = service.execute(report.id) as ReportResult;

      expect(result.metadata.rowCount).toBe(2);
      expect(result.metadata.truncated).toBe(true);
      expect(result.rows).toHaveLength(2);
    });

    it("should execute an aggregate report", () => {
      const report = service.create({
        name: "Users by Department",
        collection: "users",
        aggregation: {
          groupBy: ["department"],
          select: { _count: true },
        },
        status: "active",
      });

      const result = service.execute(report.id) as AggregateReportResult;

      expect(result.metadata.reportName).toBe("Users by Department");
      expect(result.results).toHaveLength(3); // Engineering, Sales, Marketing
    });

    it("should update lastRunAt after execution", () => {
      const report = service.create({
        name: "Test",
        collection: "users",
        status: "active",
      });

      expect(report.lastRunAt).toBeUndefined();

      service.execute(report.id);

      const updated = service.get(report.id);
      expect(updated?.lastRunAt).toBeInstanceOf(Date);
    });

    it("should throw when executing non-existent report", () => {
      expect(() => service.execute("non-existent")).toThrow("Report not found: non-existent");
    });

    it("should throw when executing archived report", () => {
      const report = service.create({
        name: "Archived",
        collection: "users",
        status: "archived",
      });

      expect(() => service.execute(report.id)).toThrow(
        `Cannot execute archived report: ${report.id}`
      );
    });

    it("should throw when collection does not exist", () => {
      const report = service.create({
        name: "Bad Collection",
        collection: "nonexistent",
        status: "active",
      });

      expect(() => service.execute(report.id)).toThrow("Collection not found: nonexistent");
    });
  });

  describe("preview", () => {
    it("should preview a report without saving", () => {
      const input: ReportInput = {
        name: "Preview Test",
        collection: "users",
        filter: { active: { eq: true } } as unknown as AnyFilter,
      };

      const result = service.preview(input) as ReportResult;

      expect(result.metadata.reportId).toBe("preview");
      expect(result.metadata.reportName).toBe("Preview Test");
      expect(result.metadata.rowCount).toBe(4); // 4 active users

      // Ensure no report was saved
      expect(service.getAll()).toHaveLength(0);
    });

    it("should preview an aggregate report", () => {
      const input: ReportInput = {
        name: "Aggregate Preview",
        collection: "users",
        aggregation: {
          groupBy: ["active"],
          select: { age: { avg: true } },
        },
      };

      const result = service.preview(input) as AggregateReportResult;

      expect(result.metadata.reportId).toBe("preview");
      expect(result.results).toHaveLength(2); // true and false
    });

    it("should preview with column projection", () => {
      const input: ReportInput = {
        name: "Column Preview",
        collection: "users",
        columns: [{ field: "name", label: "Name" }],
      };

      const result = service.preview(input) as ReportResult;

      expect(result.rows[0]).toHaveProperty("name");
      expect(Object.keys(result.rows[0] as object)).toHaveLength(1);
    });

    it("should throw when collection does not exist", () => {
      const input: ReportInput = {
        name: "Bad Preview",
        collection: "nonexistent",
      };

      expect(() => service.preview(input)).toThrow("Collection not found: nonexistent");
    });
  });

  describe("nested field access", () => {
    it("should access nested fields in column projection", () => {
      interface Profile extends Entry {
        profile?: { email?: string; name?: string };
      }
      interface ProfileInput extends EntryInput {
        profile?: { email?: string; name?: string };
      }
      const profileSchema = {
        type: "object",
        properties: {
          id: { type: "string" },
          profile: { type: "object" },
        },
      };
      storage.registerCollection({ name: "profiles", schema: profileSchema });
      const profilesRepo = storage.getRepository<Profile, ProfileInput>("profiles");
      profilesRepo.create({
        profile: { email: "test@example.com", name: "Test User" },
      });

      const report = service.create({
        name: "Nested Fields",
        collection: "profiles",
        columns: [
          { field: "profile.email", label: "Email" },
          { field: "profile.name", label: "Name" },
        ],
        status: "active",
      });

      const result = service.execute(report.id) as ReportResult;

      expect(result.rows[0]).toEqual({
        "profile.email": "test@example.com",
        "profile.name": "Test User",
      });
    });
  });
});
