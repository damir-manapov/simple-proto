import { describe, it, expect, beforeEach } from "vitest";
import { MatchingService } from "../src/matching.service.js";
import type { MatchConfig, SourceRecord, GoldenRecord } from "@simple-proto/mdm-types";

describe("MatchingService", () => {
  let service: MatchingService;

  beforeEach(() => {
    service = new MatchingService();
  });

  describe("compareValues", () => {
    describe("exact match", () => {
      it("returns 1.0 for identical values", () => {
        const score = service.compareValues("hello", "hello", {
          field: "test",
          type: "exact",
          weight: 1.0,
        });
        expect(score).toBe(1.0);
      });

      it("returns 0.0 for different values", () => {
        const score = service.compareValues("hello", "world", {
          field: "test",
          type: "exact",
          weight: 1.0,
        });
        expect(score).toBe(0.0);
      });

      it("is case sensitive", () => {
        const score = service.compareValues("Hello", "hello", {
          field: "test",
          type: "exact",
          weight: 1.0,
        });
        expect(score).toBe(0.0);
      });
    });

    describe("exactCaseInsensitive match", () => {
      it("returns 1.0 for case-different strings", () => {
        const score = service.compareValues("Hello", "hello", {
          field: "test",
          type: "exactCaseInsensitive",
          weight: 1.0,
        });
        expect(score).toBe(1.0);
      });

      it("returns 0.0 for different strings", () => {
        const score = service.compareValues("hello", "world", {
          field: "test",
          type: "exactCaseInsensitive",
          weight: 1.0,
        });
        expect(score).toBe(0.0);
      });
    });

    describe("normalized match", () => {
      it("returns 1.0 for normalized equivalent strings", () => {
        const score = service.compareValues("  Hello World  ", "hello world", {
          field: "test",
          type: "normalized",
          weight: 1.0,
        });
        expect(score).toBe(1.0);
      });
    });

    describe("fuzzy match", () => {
      it("returns 1.0 for identical strings", () => {
        const score = service.compareValues("hello", "hello", {
          field: "test",
          type: "fuzzy",
          weight: 1.0,
        });
        expect(score).toBe(1.0);
      });

      it("returns high score for similar strings", () => {
        const score = service.compareValues("hello", "hallo", {
          field: "test",
          type: "fuzzy",
          weight: 1.0,
        });
        expect(score).toBeGreaterThan(0.7);
        expect(score).toBeLessThan(1.0);
      });

      it("returns 0.0 when exceeds maxDistance", () => {
        const score = service.compareValues("hello", "world", {
          field: "test",
          type: "fuzzy",
          weight: 1.0,
          options: { maxDistance: 1 },
        });
        expect(score).toBe(0.0);
      });

      it("returns score when within maxDistance", () => {
        const score = service.compareValues("hello", "hallo", {
          field: "test",
          type: "fuzzy",
          weight: 1.0,
          options: { maxDistance: 2 },
        });
        expect(score).toBeGreaterThan(0);
      });
    });

    describe("phonetic match", () => {
      it("returns 1.0 for phonetically similar names", () => {
        const score = service.compareValues("Robert", "Rupert", {
          field: "test",
          type: "phonetic",
          weight: 1.0,
        });
        expect(score).toBe(1.0);
      });

      it("returns low score for phonetically different names", () => {
        const score = service.compareValues("Robert", "John", {
          field: "test",
          type: "phonetic",
          weight: 1.0,
        });
        expect(score).toBeLessThan(0.5);
      });
    });

    describe("numeric match", () => {
      it("returns 1.0 for equal numbers", () => {
        const score = service.compareValues(100, 100, {
          field: "test",
          type: "numeric",
          weight: 1.0,
        });
        expect(score).toBe(1.0);
      });

      it("returns 0.0 for different numbers without tolerance", () => {
        const score = service.compareValues(100, 105, {
          field: "test",
          type: "numeric",
          weight: 1.0,
        });
        expect(score).toBe(0.0);
      });

      it("returns score within tolerance", () => {
        const score = service.compareValues(100, 102, {
          field: "test",
          type: "numeric",
          weight: 1.0,
          options: { numericTolerance: 5 },
        });
        expect(score).toBeGreaterThan(0);
      });

      it("returns 0.0 for non-numeric values", () => {
        const score = service.compareValues("abc", 100, {
          field: "test",
          type: "numeric",
          weight: 1.0,
        });
        expect(score).toBe(0.0);
      });
    });

    describe("date match", () => {
      it("returns 1.0 for equal dates", () => {
        const date = new Date("2024-01-15");
        const score = service.compareValues(date, date, {
          field: "test",
          type: "date",
          weight: 1.0,
        });
        expect(score).toBe(1.0);
      });

      it("returns score within tolerance", () => {
        const date1 = new Date("2024-01-15");
        const date2 = new Date("2024-01-17");
        const score = service.compareValues(date1, date2, {
          field: "test",
          type: "date",
          weight: 1.0,
          options: { dateTolerance: 5 },
        });
        expect(score).toBeGreaterThan(0);
      });

      it("returns 0.0 for dates outside tolerance", () => {
        const date1 = new Date("2024-01-15");
        const date2 = new Date("2024-01-25");
        const score = service.compareValues(date1, date2, {
          field: "test",
          type: "date",
          weight: 1.0,
          options: { dateTolerance: 5 },
        });
        expect(score).toBe(0.0);
      });
    });

    describe("null handling", () => {
      it("returns 1.0 when both are null", () => {
        const score = service.compareValues(null, null, {
          field: "test",
          type: "exact",
          weight: 1.0,
        });
        expect(score).toBe(1.0);
      });

      it("returns 0.0 when only source is null", () => {
        const score = service.compareValues(null, "hello", {
          field: "test",
          type: "exact",
          weight: 1.0,
        });
        expect(score).toBe(0.0);
      });

      it("returns 0.0 when only target is null", () => {
        const score = service.compareValues("hello", null, {
          field: "test",
          type: "exact",
          weight: 1.0,
        });
        expect(score).toBe(0.0);
      });
    });
  });

  describe("matchRecords", () => {
    const config: MatchConfig = {
      id: "config-1",
      entityType: "customer",
      name: "Customer Match",
      rules: [
        { field: "firstName", type: "fuzzy", weight: 0.3 },
        { field: "lastName", type: "phonetic", weight: 0.3 },
        { field: "email", type: "exactCaseInsensitive", weight: 0.4 },
      ],
      threshold: 0.7,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("returns high score for matching records", () => {
      const result = service.matchRecords(
        {
          id: "source-1",
          data: {
            firstName: "John",
            lastName: "Smith",
            email: "john.smith@example.com",
          },
        },
        {
          id: "golden-1",
          type: "golden",
          data: {
            firstName: "Jon",
            lastName: "Smyth",
            email: "john.smith@example.com",
          },
        },
        config
      );

      expect(result.isMatch).toBe(true);
      expect(result.score).toBeGreaterThan(0.7);
      expect(result.ruleScores).toHaveLength(3);
    });

    it("returns low score for non-matching records", () => {
      const result = service.matchRecords(
        {
          id: "source-1",
          data: {
            firstName: "John",
            lastName: "Smith",
            email: "john.smith@example.com",
          },
        },
        {
          id: "golden-2",
          type: "golden",
          data: {
            firstName: "Jane",
            lastName: "Doe",
            email: "jane.doe@example.com",
          },
        },
        config
      );

      expect(result.isMatch).toBe(false);
      expect(result.score).toBeLessThan(0.7);
    });

    it("includes rule scores breakdown", () => {
      const result = service.matchRecords(
        { id: "source-1", data: { firstName: "John" } },
        { id: "golden-1", type: "golden", data: { firstName: "John" } },
        config
      );

      const firstNameScore = result.ruleScores.find((r) => r.field === "firstName");
      expect(firstNameScore).toBeDefined();
      if (firstNameScore) {
        expect(firstNameScore.score).toBe(1.0);
        expect(firstNameScore.weightedScore).toBeCloseTo(0.3);
      }
    });
  });

  describe("findMatchesInGoldenRecords", () => {
    const config: MatchConfig = {
      id: "config-1",
      entityType: "customer",
      name: "Customer Match",
      rules: [{ field: "email", type: "exact", weight: 1.0 }],
      threshold: 0.9,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const sourceRecord: SourceRecord = {
      id: "source-1",
      entityType: "customer",
      sourceSystem: "crm",
      sourceId: "CRM-001",
      data: { email: "john@example.com" },
      confidence: 1.0,
      sourceUpdatedAt: new Date(),
      ingestedAt: new Date(),
    };

    it("finds matching golden records", () => {
      const goldenRecords: GoldenRecord[] = [
        {
          id: "golden-1",
          entityType: "customer",
          data: { email: "john@example.com" },
          sources: [],
          matchedSourceIds: [],
          confidence: 1.0,
          needsReview: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastMergedAt: new Date(),
        },
        {
          id: "golden-2",
          entityType: "customer",
          data: { email: "jane@example.com" },
          sources: [],
          matchedSourceIds: [],
          confidence: 1.0,
          needsReview: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastMergedAt: new Date(),
        },
      ];

      const matches = service.findMatchesInGoldenRecords(sourceRecord, goldenRecords, config);

      expect(matches).toHaveLength(1);
      const firstMatch = matches[0];
      expect(firstMatch).toBeDefined();
      if (firstMatch) {
        expect(firstMatch.matchedRecordId).toBe("golden-1");
        expect(firstMatch.matchedRecordType).toBe("golden");
        expect(firstMatch.isMatch).toBe(true);
      }
    });

    it("skips golden records with different entity type", () => {
      const goldenRecords: GoldenRecord[] = [
        {
          id: "golden-1",
          entityType: "product", // Different entity type
          data: { email: "john@example.com" },
          sources: [],
          matchedSourceIds: [],
          confidence: 1.0,
          needsReview: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastMergedAt: new Date(),
        },
      ];

      const matches = service.findMatchesInGoldenRecords(sourceRecord, goldenRecords, config);

      expect(matches).toHaveLength(0);
    });

    it("sorts matches by score descending", () => {
      const configMulti: MatchConfig = {
        ...config,
        rules: [{ field: "name", type: "fuzzy", weight: 1.0 }],
        threshold: 0.5,
      };

      const sourceWithName: SourceRecord = {
        ...sourceRecord,
        data: { name: "John Smith" },
      };

      const goldenRecords: GoldenRecord[] = [
        {
          id: "golden-1",
          entityType: "customer",
          data: { name: "John Smyth" }, // Higher match
          sources: [],
          matchedSourceIds: [],
          confidence: 1.0,
          needsReview: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastMergedAt: new Date(),
        },
        {
          id: "golden-2",
          entityType: "customer",
          data: { name: "Jane Smith" }, // Lower match
          sources: [],
          matchedSourceIds: [],
          confidence: 1.0,
          needsReview: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastMergedAt: new Date(),
        },
      ];

      const matches = service.findMatchesInGoldenRecords(
        sourceWithName,
        goldenRecords,
        configMulti
      );

      expect(matches.length).toBeGreaterThan(0);
      // Verify descending order
      for (let i = 1; i < matches.length; i++) {
        const prev = matches[i - 1];
        const curr = matches[i];
        if (prev && curr) {
          expect(prev.score).toBeGreaterThanOrEqual(curr.score);
        }
      }
    });
  });

  describe("findMatchesInSourceRecords", () => {
    const config: MatchConfig = {
      id: "config-1",
      entityType: "customer",
      name: "Customer Match",
      rules: [{ field: "email", type: "exact", weight: 1.0 }],
      threshold: 0.9,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("skips itself when matching", () => {
      const sourceRecord: SourceRecord = {
        id: "source-1",
        entityType: "customer",
        sourceSystem: "crm",
        sourceId: "CRM-001",
        data: { email: "john@example.com" },
        confidence: 1.0,
        sourceUpdatedAt: new Date(),
        ingestedAt: new Date(),
      };

      const otherRecords: SourceRecord[] = [
        sourceRecord, // Same record
        {
          id: "source-2",
          entityType: "customer",
          sourceSystem: "erp",
          sourceId: "ERP-001",
          data: { email: "john@example.com" },
          confidence: 1.0,
          sourceUpdatedAt: new Date(),
          ingestedAt: new Date(),
        },
      ];

      const matches = service.findMatchesInSourceRecords(sourceRecord, otherRecords, config);

      expect(matches).toHaveLength(1);
      const firstMatch = matches[0];
      expect(firstMatch).toBeDefined();
      if (firstMatch) {
        expect(firstMatch.matchedRecordId).toBe("source-2");
        expect(firstMatch.matchedRecordType).toBe("source");
      }
    });
  });
});
