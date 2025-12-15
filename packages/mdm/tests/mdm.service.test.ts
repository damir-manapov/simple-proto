import { describe, it, expect, beforeEach, vi } from "vitest";
import { MdmService } from "../src/mdm.service.js";
import type {
  IStorage,
  IRepository,
  Entry,
  EntryInput,
  Filter,
  AggregateOptions,
  AggregateRow,
} from "@simple-proto/storage-types";

interface MockRepo<T extends Entry> extends IRepository<T, T> {
  _data: Map<string, T>;
}

function createMockRepository<T extends Entry>(): MockRepo<T> {
  const data = new Map<string, T>();

  const aggregate = vi.fn(
    (options: AggregateOptions<T> & { groupBy?: (keyof T)[] }): AggregateRow | AggregateRow[] => {
      if (options.groupBy && options.groupBy.length > 0) {
        return [] as AggregateRow[];
      }
      return { _count: 0 } as AggregateRow;
    }
  );

  return {
    _data: data,
    findById: vi.fn((id: string) => data.get(id) ?? null),
    findByIdOrThrow: vi.fn((id: string) => {
      const item = data.get(id);
      if (!item) throw new Error(`Not found: ${id}`);
      return item;
    }),
    findAll: vi.fn((_filter?: Filter<T>) => {
      return Array.from(data.values());
    }),
    create: vi.fn((input: T) => {
      data.set(input.id, input);
      return input;
    }),
    update: vi.fn((id: string, updated: T) => {
      if (!data.has(id)) return null;
      data.set(id, updated);
      return updated;
    }),
    updateOrThrow: vi.fn((id: string, updated: T) => {
      if (!data.has(id)) throw new Error(`Not found: ${id}`);
      data.set(id, updated);
      return updated;
    }),
    delete: vi.fn((id: string) => {
      return data.delete(id);
    }),
    clear: vi.fn(() => {
      data.clear();
    }),
    aggregate: aggregate as MockRepo<T>["aggregate"],
  };
}

function createMockStorage(): IStorage {
  const collections = new Map<string, MockRepo<Entry>>();

  const mockStorage: IStorage = {
    registerCollection: vi.fn((config: { name: string; schema: unknown }) => {
      if (!collections.has(config.name)) {
        collections.set(config.name, createMockRepository());
      }
    }),
    hasCollection: vi.fn((name: string) => collections.has(name)),
    getCollections: vi.fn(() => Array.from(collections.keys())),
    getCollectionSchema: vi.fn(() => ({})),
    getCollectionRelations: vi.fn(() => ({})),
    getRepository: <T extends Entry, TInput extends EntryInput>(name: string) => {
      if (!collections.has(name)) {
        collections.set(name, createMockRepository());
      }
      return collections.get(name) as unknown as IRepository<T, TInput>;
    },
    clearAll: vi.fn(() => {
      for (const repo of collections.values()) {
        repo.clear();
      }
    }),
  };

  return mockStorage;
}

describe("MdmService", () => {
  let storage: IStorage;
  let service: MdmService;

  beforeEach(() => {
    storage = createMockStorage();
    service = new MdmService(storage);
  });

  describe("initialize", () => {
    it("registers all required collections", () => {
      service.initialize();

      // Check that hasCollection was called for all expected collections
      const calls = vi.mocked(storage).hasCollection.mock.calls.map((c) => c[0]);
      expect(calls).toContain("mdm_match_configs");
      expect(calls).toContain("mdm_survivorship_configs");
      expect(calls).toContain("mdm_source_records");
      expect(calls).toContain("mdm_golden_records");
    });
  });

  describe("MatchConfig CRUD", () => {
    const baseMatchConfigInput = {
      entityType: "customer",
      name: "Customer Matching",
      rules: [
        {
          field: "email",
          type: "exact" as const,
          weight: 1.0,
        },
      ],
      threshold: 0.8,
      active: true,
    };

    it("creates a match config", () => {
      const config = service.createMatchConfig(baseMatchConfigInput);

      expect(config.id).toBeDefined();
      expect(config.entityType).toBe("customer");
      expect(config.name).toBe("Customer Matching");
      expect(config.rules.length).toBe(1);
      expect(config.createdAt).toBeDefined();
    });

    it("gets match config by id", () => {
      const created = service.createMatchConfig(baseMatchConfigInput);
      const retrieved = service.getMatchConfig(created.id);

      expect(retrieved).toBeDefined();
      if (retrieved) {
        expect(retrieved.id).toBe(created.id);
        expect(retrieved.name).toBe("Customer Matching");
      }
    });

    it("returns null for non-existent match config", () => {
      const retrieved = service.getMatchConfig("non-existent");
      expect(retrieved).toBeNull();
    });

    it("gets match configs by entity type", () => {
      service.createMatchConfig(baseMatchConfigInput);
      const config = service.getMatchConfigByEntityType("customer");

      expect(config).toBeDefined();
      if (config) {
        expect(config.entityType).toBe("customer");
      }
    });

    it("gets all match configs", () => {
      service.createMatchConfig(baseMatchConfigInput);
      service.createMatchConfig({ ...baseMatchConfigInput, entityType: "product" });

      const configs = service.getAllMatchConfigs();
      expect(configs.length).toBe(2);
    });

    it("updates match config", () => {
      const created = service.createMatchConfig(baseMatchConfigInput);
      const updated = service.updateMatchConfig(created.id, { name: "Updated Name" });

      expect(updated).toBeDefined();
      if (updated) {
        expect(updated.name).toBe("Updated Name");
        expect(updated.entityType).toBe("customer");
      }
    });

    it("deletes match config", () => {
      const created = service.createMatchConfig(baseMatchConfigInput);
      const deleted = service.deleteMatchConfig(created.id);

      expect(deleted).toBe(true);
      expect(service.getMatchConfig(created.id)).toBeNull();
    });
  });

  describe("SurvivorshipConfig CRUD", () => {
    const baseSurvivorshipConfigInput = {
      entityType: "customer",
      name: "Customer Survivorship",
      rules: [
        { field: "email", strategy: "sourceRanking" as const, sourceRanking: ["crm", "erp"] },
      ],
      defaultStrategy: "mostRecent" as const,
      active: true,
    };

    it("creates a survivorship config", () => {
      const config = service.createSurvivorshipConfig(baseSurvivorshipConfigInput);

      expect(config.id).toBeDefined();
      expect(config.entityType).toBe("customer");
      expect(config.rules.length).toBe(1);
      expect(config.defaultStrategy).toBe("mostRecent");
    });

    it("gets survivorship config by id", () => {
      const created = service.createSurvivorshipConfig(baseSurvivorshipConfigInput);
      const retrieved = service.getSurvivorshipConfig(created.id);

      expect(retrieved).toBeDefined();
      if (retrieved) {
        expect(retrieved.id).toBe(created.id);
      }
    });

    it("gets survivorship config by entity type", () => {
      service.createSurvivorshipConfig(baseSurvivorshipConfigInput);
      const config = service.getSurvivorshipConfigByEntityType("customer");

      expect(config).toBeDefined();
      if (config) {
        expect(config.entityType).toBe("customer");
      }
    });

    it("gets all survivorship configs", () => {
      service.createSurvivorshipConfig(baseSurvivorshipConfigInput);
      service.createSurvivorshipConfig({ ...baseSurvivorshipConfigInput, entityType: "product" });

      const configs = service.getAllSurvivorshipConfigs();
      expect(configs.length).toBe(2);
    });
  });

  describe("SourceRecord operations", () => {
    const baseSourceInput = {
      id: "source-1",
      entityType: "customer",
      sourceSystem: "crm",
      sourceId: "CRM-001",
      data: {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      },
      confidence: 0.9,
      sourceUpdatedAt: new Date(),
    };

    it("creates a source record", () => {
      const source = service.createSourceRecord(baseSourceInput);

      expect(source.id).toBeDefined();
      expect(source.entityType).toBe("customer");
      expect(source.sourceSystem).toBe("crm");
      expect(source.data["firstName"]).toBe("John");
    });

    it("gets source record by id", () => {
      const created = service.createSourceRecord(baseSourceInput);
      const retrieved = service.getSourceRecord(created.id);

      expect(retrieved).toBeDefined();
      if (retrieved) {
        expect(retrieved.id).toBe(created.id);
      }
    });

    it("gets all source records", () => {
      service.createSourceRecord(baseSourceInput);
      service.createSourceRecord({
        ...baseSourceInput,
        id: "source-2",
        sourceId: "CRM-002",
      });

      const sources = service.getAllSourceRecords();
      expect(sources.length).toBe(2);
    });

    it("deletes source record", () => {
      const created = service.createSourceRecord(baseSourceInput);
      const deleted = service.deleteSourceRecord(created.id);

      expect(deleted).toBe(true);
      expect(service.getSourceRecord(created.id)).toBeNull();
    });
  });

  describe("GoldenRecord operations", () => {
    const baseGoldenInput = {
      id: "golden-1",
      entityType: "customer",
      data: { firstName: "John" },
      matchedSourceIds: [],
      confidence: 1.0,
      needsReview: false,
    };

    it("creates golden record", () => {
      const golden = service.createGoldenRecord(baseGoldenInput);

      expect(golden.id).toBeDefined();
      expect(golden.entityType).toBe("customer");
      expect(golden.data["firstName"]).toBe("John");
    });

    it("gets golden record by id", () => {
      const created = service.createGoldenRecord(baseGoldenInput);
      const retrieved = service.getGoldenRecord(created.id);

      expect(retrieved).toBeDefined();
      if (retrieved) {
        expect(retrieved.id).toBe(created.id);
      }
    });

    it("gets all golden records", () => {
      service.createGoldenRecord(baseGoldenInput);
      service.createGoldenRecord({
        ...baseGoldenInput,
        id: "golden-2",
        entityType: "product",
      });

      const all = service.getAllGoldenRecords();
      expect(all.length).toBe(2);
    });

    it("deletes golden record", () => {
      const created = service.createGoldenRecord(baseGoldenInput);
      const deleted = service.deleteGoldenRecord(created.id);

      expect(deleted).toBe(true);
      expect(service.getGoldenRecord(created.id)).toBeNull();
    });
  });

  describe("linkSourceToGolden", () => {
    it("links source to golden record", () => {
      // Setup configs
      service.createSurvivorshipConfig({
        entityType: "customer",
        name: "Customer Survivorship",
        rules: [],
        defaultStrategy: "mostRecent",
        active: true,
      });

      const source = service.createSourceRecord({
        id: "source-1",
        entityType: "customer",
        sourceSystem: "crm",
        sourceId: "CRM-001",
        data: { firstName: "John" },
        confidence: 0.9,
        sourceUpdatedAt: new Date(),
      });

      const golden = service.createGoldenRecord({
        id: "golden-1",
        entityType: "customer",
        data: { firstName: "Jonathan" },
        matchedSourceIds: [],
        confidence: 1.0,
        needsReview: false,
      });

      const result = service.linkSourceToGolden(source.id, golden.id);

      expect(result).toBeDefined();
      if (result) {
        expect(result.goldenRecord.matchedSourceIds).toContain(source.id);
      }
    });

    it("returns null for non-existent source", () => {
      service.createSurvivorshipConfig({
        entityType: "customer",
        name: "Customer Survivorship",
        rules: [],
        defaultStrategy: "mostRecent",
        active: true,
      });

      const golden = service.createGoldenRecord({
        id: "golden-1",
        entityType: "customer",
        data: {},
        matchedSourceIds: [],
        confidence: 1.0,
        needsReview: false,
      });

      const result = service.linkSourceToGolden("bad-source", golden.id);
      expect(result).toBeNull();
    });
  });

  describe("unlinkSource", () => {
    it("removes source linkage and updates golden", () => {
      service.createSurvivorshipConfig({
        entityType: "customer",
        name: "Survivor",
        rules: [],
        defaultStrategy: "mostRecent",
        active: true,
      });

      const source1 = service.createSourceRecord({
        id: "source-1",
        entityType: "customer",
        sourceSystem: "crm",
        sourceId: "CRM-001",
        data: { firstName: "John" },
        confidence: 0.9,
        sourceUpdatedAt: new Date(),
      });

      const source2 = service.createSourceRecord({
        id: "source-2",
        entityType: "customer",
        sourceSystem: "erp",
        sourceId: "ERP-001",
        data: { firstName: "Jane" },
        confidence: 0.8,
        sourceUpdatedAt: new Date(),
      });

      const golden = service.createGoldenRecord({
        id: "golden-1",
        entityType: "customer",
        data: { firstName: "John" },
        matchedSourceIds: [],
        confidence: 1.0,
        needsReview: false,
      });

      // Link sources to golden
      service.linkSourceToGolden(source1.id, golden.id);
      service.linkSourceToGolden(source2.id, golden.id);

      // Unlink source1
      const result = service.unlinkSource(source1.id);
      expect(result).toBe(true);

      const updatedSource = service.getSourceRecord(source1.id);
      expect(updatedSource).toBeDefined();
      if (updatedSource) {
        expect(updatedSource.goldenRecordId).toBeUndefined();
      }
    });

    it("returns false for non-existent source", () => {
      const result = service.unlinkSource("non-existent");
      expect(result).toBe(false);
    });
  });
});
