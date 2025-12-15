import { describe, it, expect, beforeEach } from "vitest";
import { MergeService } from "../src/merge.service.js";
import type { SourceRecord, SurvivorshipConfig, GoldenRecord } from "@simple-proto/mdm-types";

describe("MergeService", () => {
  let service: MergeService;

  beforeEach(() => {
    service = new MergeService();
  });

  describe("selectWinner", () => {
    const baseCandidates = [
      {
        sourceSystem: "crm",
        sourceRecordId: "crm-1",
        value: "John",
        confidence: 0.9,
        updatedAt: new Date("2024-01-15"),
      },
      {
        sourceSystem: "erp",
        sourceRecordId: "erp-1",
        value: "Johnny",
        confidence: 0.8,
        updatedAt: new Date("2024-01-10"),
      },
      {
        sourceSystem: "manual",
        sourceRecordId: "manual-1",
        value: "Jonathan",
        confidence: 1.0,
        updatedAt: new Date("2024-01-01"),
      },
    ];

    it("returns null for empty candidates", () => {
      const result = service.selectWinner([], "mostRecent");
      expect(result).toBeNull();
    });

    it("returns single candidate when only one exists", () => {
      const candidate = baseCandidates[0];
      if (!candidate) throw new Error("Test setup error");
      const result = service.selectWinner([candidate], "mostRecent");
      expect(result).toBeDefined();
      if (result) {
        expect(result.value).toBe("John");
        expect(result.sourceSystem).toBe("crm");
      }
    });

    describe("mostRecent strategy", () => {
      it("selects value from most recently updated source", () => {
        const result = service.selectWinner(baseCandidates, "mostRecent");
        expect(result).toBeDefined();
        if (result) {
          expect(result.value).toBe("John");
          expect(result.sourceSystem).toBe("crm");
        }
      });
    });

    describe("highestConfidence strategy", () => {
      it("selects value from highest confidence source", () => {
        const result = service.selectWinner(baseCandidates, "highestConfidence");
        expect(result).toBeDefined();
        if (result) {
          expect(result.value).toBe("Jonathan");
          expect(result.sourceSystem).toBe("manual");
        }
      });
    });

    describe("sourceRanking strategy", () => {
      it("selects value based on source priority", () => {
        const result = service.selectWinner(baseCandidates, "sourceRanking", [
          "erp",
          "crm",
          "manual",
        ]);
        expect(result).toBeDefined();
        if (result) {
          expect(result.value).toBe("Johnny");
          expect(result.sourceSystem).toBe("erp");
        }
      });

      it("falls back to first candidate when no ranking provided", () => {
        const result = service.selectWinner(baseCandidates, "sourceRanking", []);
        expect(result).toBeDefined();
        if (result) {
          expect(result.value).toBe("John");
        }
      });

      it("falls back when ranked sources not in candidates", () => {
        const result = service.selectWinner(baseCandidates, "sourceRanking", [
          "unknown1",
          "unknown2",
        ]);
        expect(result).toBeDefined();
        if (result) {
          expect(result.value).toBe("John");
        }
      });
    });

    describe("mostFrequent strategy", () => {
      it("selects most common value", () => {
        const candidates = [
          {
            sourceSystem: "a",
            sourceRecordId: "a-1",
            value: "John",
            confidence: 1,
            updatedAt: new Date(),
          },
          {
            sourceSystem: "b",
            sourceRecordId: "b-1",
            value: "John",
            confidence: 1,
            updatedAt: new Date(),
          },
          {
            sourceSystem: "c",
            sourceRecordId: "c-1",
            value: "Jane",
            confidence: 1,
            updatedAt: new Date(),
          },
        ];
        const result = service.selectWinner(candidates, "mostFrequent");
        expect(result).toBeDefined();
        if (result) {
          expect(result.value).toBe("John");
        }
      });
    });

    describe("longestValue strategy", () => {
      it("selects longest string value", () => {
        const result = service.selectWinner(baseCandidates, "longestValue");
        expect(result).toBeDefined();
        if (result) {
          expect(result.value).toBe("Jonathan");
        }
      });
    });
  });

  describe("merge", () => {
    const baseSourceRecords: SourceRecord[] = [
      {
        id: "source-1",
        entityType: "customer",
        sourceSystem: "crm",
        sourceId: "CRM-001",
        data: {
          firstName: "John",
          lastName: "Smith",
          email: "john@crm.com",
          phone: "123-456-7890",
        },
        confidence: 0.9,
        sourceUpdatedAt: new Date("2024-01-15"),
        ingestedAt: new Date("2024-01-15"),
      },
      {
        id: "source-2",
        entityType: "customer",
        sourceSystem: "erp",
        sourceId: "ERP-001",
        data: {
          firstName: "Johnny",
          lastName: "Smith",
          email: "john@erp.com",
        },
        confidence: 0.8,
        sourceUpdatedAt: new Date("2024-01-10"),
        ingestedAt: new Date("2024-01-10"),
      },
    ];

    const baseSurvivorshipConfig: SurvivorshipConfig = {
      id: "config-1",
      entityType: "customer",
      name: "Customer Survivorship",
      rules: [
        { field: "email", strategy: "sourceRanking", sourceRanking: ["crm", "erp"] },
        { field: "phone", strategy: "longestValue" },
      ],
      defaultStrategy: "mostRecent",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("merges source records into golden record", () => {
      const result = service.merge(baseSourceRecords, baseSurvivorshipConfig);

      expect(result.goldenRecord).toBeDefined();
      expect(result.goldenRecord.entityType).toBe("customer");
      expect(result.mergedSourceIds).toContain("source-1");
      expect(result.mergedSourceIds).toContain("source-2");
    });

    it("applies survivorship rules correctly", () => {
      const result = service.merge(baseSourceRecords, baseSurvivorshipConfig);

      // email should come from crm (sourceRanking)
      expect(result.goldenRecord.data["email"]).toBe("john@crm.com");
    });

    it("uses default strategy for fields without specific rules", () => {
      const result = service.merge(baseSourceRecords, baseSurvivorshipConfig);

      // firstName should use mostRecent (default) = crm source
      expect(result.goldenRecord.data["firstName"]).toBe("John");
    });

    it("includes merge decisions", () => {
      const result = service.merge(baseSourceRecords, baseSurvivorshipConfig);

      expect(result.mergeDecisions.length).toBeGreaterThan(0);

      const emailDecision = result.mergeDecisions.find((d) => d.field === "email");
      expect(emailDecision).toBeDefined();
      if (emailDecision) {
        expect(emailDecision.strategy).toBe("sourceRanking");
        expect(emailDecision.selectedValue).toBe("john@crm.com");
      }
    });

    it("tracks source contributions", () => {
      const result = service.merge(baseSourceRecords, baseSurvivorshipConfig);

      expect(result.goldenRecord.sources.length).toBeGreaterThan(0);

      const crmContribution = result.goldenRecord.sources.find((s) => s.sourceSystem === "crm");
      expect(crmContribution).toBeDefined();
      if (crmContribution) {
        expect(crmContribution.contributedFields.length).toBeGreaterThan(0);
      }
    });

    it("calculates confidence based on contributions", () => {
      const result = service.merge(baseSourceRecords, baseSurvivorshipConfig);

      expect(result.goldenRecord.confidence).toBeGreaterThan(0);
      expect(result.goldenRecord.confidence).toBeLessThanOrEqual(1);
    });

    it("preserves manual values from existing golden record", () => {
      const existingGolden: GoldenRecord = {
        id: "golden-1",
        entityType: "customer",
        data: {
          firstName: "MANUAL_NAME",
        },
        sources: [],
        matchedSourceIds: ["source-1"],
        confidence: 1.0,
        needsReview: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastMergedAt: new Date(),
      };

      const configWithManual: SurvivorshipConfig = {
        ...baseSurvivorshipConfig,
        rules: [{ field: "firstName", strategy: "manual" }, ...baseSurvivorshipConfig.rules],
      };

      const result = service.merge(baseSourceRecords, configWithManual, existingGolden);

      expect(result.goldenRecord.data["firstName"]).toBe("MANUAL_NAME");
    });

    it("throws error for empty source records", () => {
      expect(() => {
        service.merge([], baseSurvivorshipConfig);
      }).toThrow("Cannot merge empty source records");
    });

    it("preserves golden record ID when updating", () => {
      const existingGolden: GoldenRecord = {
        id: "existing-golden-id",
        entityType: "customer",
        data: {},
        sources: [],
        matchedSourceIds: [],
        confidence: 1.0,
        needsReview: false,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date(),
        lastMergedAt: new Date(),
      };

      const result = service.merge(baseSourceRecords, baseSurvivorshipConfig, existingGolden);

      expect(result.goldenRecord.id).toBe("existing-golden-id");
      expect(result.goldenRecord.createdAt).toEqual(existingGolden.createdAt);
    });
  });

  describe("addToGoldenRecord", () => {
    it("merges new source into existing golden record", () => {
      const existingGolden: GoldenRecord = {
        id: "golden-1",
        entityType: "customer",
        data: { firstName: "John", email: "john@old.com" },
        sources: [],
        matchedSourceIds: ["source-1"],
        confidence: 0.9,
        needsReview: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastMergedAt: new Date(),
      };

      const existingSources: SourceRecord[] = [
        {
          id: "source-1",
          entityType: "customer",
          sourceSystem: "crm",
          sourceId: "CRM-001",
          data: { firstName: "John", email: "john@old.com" },
          confidence: 0.9,
          sourceUpdatedAt: new Date("2024-01-01"),
          ingestedAt: new Date(),
        },
      ];

      const newSource: SourceRecord = {
        id: "source-2",
        entityType: "customer",
        sourceSystem: "erp",
        sourceId: "ERP-001",
        data: { firstName: "Johnny", email: "john@new.com" },
        confidence: 0.8,
        sourceUpdatedAt: new Date("2024-01-15"),
        ingestedAt: new Date(),
      };

      const config: SurvivorshipConfig = {
        id: "config-1",
        entityType: "customer",
        name: "Customer Survivorship",
        rules: [],
        defaultStrategy: "mostRecent",
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = service.addToGoldenRecord(
        existingGolden,
        newSource,
        [...existingSources, newSource],
        config
      );

      expect(result.mergedSourceIds).toContain("source-1");
      expect(result.mergedSourceIds).toContain("source-2");
      // Most recent values should come from source-2
      expect(result.goldenRecord.data["firstName"]).toBe("Johnny");
      expect(result.goldenRecord.data["email"]).toBe("john@new.com");
    });
  });
});
