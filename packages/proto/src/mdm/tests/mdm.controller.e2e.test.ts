import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { MdmModule } from "../mdm.module.js";
import { StorageModule } from "../../storage/storage.module.js";
import { StorageService } from "../../storage/storage.service.js";
import type {
  MatchConfig,
  SurvivorshipConfig,
  SourceRecord,
  GoldenRecord,
} from "@simple-proto/mdm-types";

describe("MDM Controllers (e2e)", () => {
  let app: INestApplication;
  let storageService: StorageService;

  const getServer = (): Parameters<typeof request>[0] =>
    app.getHttpServer() as Parameters<typeof request>[0];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [StorageModule, MdmModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    storageService = moduleFixture.get<StorageService>(StorageService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    storageService.clearAll();
  });

  describe("MatchConfigController", () => {
    describe("POST /mdm/match-configs", () => {
      it("should create a match config", async () => {
        const response = await request(getServer())
          .post("/mdm/match-configs")
          .send({
            entityType: "customer",
            name: "Customer Matching",
            rules: [{ field: "email", type: "exact", weight: 1.0 }],
            threshold: 0.8,
          })
          .expect(201);

        const config = response.body as MatchConfig;
        expect(config.id).toBeDefined();
        expect(config.entityType).toBe("customer");
        expect(config.name).toBe("Customer Matching");
        expect(config.rules.length).toBe(1);
      });
    });

    describe("GET /mdm/match-configs", () => {
      it("should get all match configs", async () => {
        await request(getServer()).post("/mdm/match-configs").send({
          entityType: "customer",
          name: "Customer Matching",
          rules: [],
        });
        await request(getServer()).post("/mdm/match-configs").send({
          entityType: "product",
          name: "Product Matching",
          rules: [],
        });

        const response = await request(getServer()).get("/mdm/match-configs").expect(200);

        const configs = response.body as MatchConfig[];
        expect(configs.length).toBe(2);
      });

      it("should filter by entity type", async () => {
        await request(getServer()).post("/mdm/match-configs").send({
          entityType: "customer",
          name: "Customer Matching",
          rules: [],
        });

        const response = await request(getServer())
          .get("/mdm/match-configs")
          .query({ entityType: "customer" })
          .expect(200);

        const configs = response.body as MatchConfig[];
        expect(configs.length).toBe(1);
        expect(configs[0]?.entityType).toBe("customer");
      });
    });

    describe("GET /mdm/match-configs/:id", () => {
      it("should get a match config by id", async () => {
        const createResponse = await request(getServer()).post("/mdm/match-configs").send({
          entityType: "customer",
          name: "Customer Matching",
          rules: [],
        });

        const created = createResponse.body as MatchConfig;

        const response = await request(getServer())
          .get(`/mdm/match-configs/${created.id}`)
          .expect(200);

        const config = response.body as MatchConfig;
        expect(config.id).toBe(created.id);
      });

      it("should return 404 for non-existent config", async () => {
        await request(getServer()).get("/mdm/match-configs/non-existent").expect(404);
      });
    });

    describe("DELETE /mdm/match-configs/:id", () => {
      it("should delete a match config", async () => {
        const createResponse = await request(getServer()).post("/mdm/match-configs").send({
          entityType: "customer",
          name: "Customer Matching",
          rules: [],
        });

        const created = createResponse.body as MatchConfig;

        await request(getServer()).delete(`/mdm/match-configs/${created.id}`).expect(200);

        await request(getServer()).get(`/mdm/match-configs/${created.id}`).expect(404);
      });
    });
  });

  describe("SurvivorshipConfigController", () => {
    describe("POST /mdm/survivorship-configs", () => {
      it("should create a survivorship config", async () => {
        const response = await request(getServer())
          .post("/mdm/survivorship-configs")
          .send({
            entityType: "customer",
            name: "Customer Survivorship",
            rules: [{ field: "email", strategy: "sourceRanking", sourceRanking: ["crm"] }],
            defaultStrategy: "mostRecent",
          })
          .expect(201);

        const config = response.body as SurvivorshipConfig;
        expect(config.id).toBeDefined();
        expect(config.entityType).toBe("customer");
        expect(config.defaultStrategy).toBe("mostRecent");
      });
    });

    describe("GET /mdm/survivorship-configs", () => {
      it("should get all survivorship configs", async () => {
        await request(getServer()).post("/mdm/survivorship-configs").send({
          entityType: "customer",
          name: "Customer Survivorship",
          rules: [],
          defaultStrategy: "mostRecent",
        });

        const response = await request(getServer()).get("/mdm/survivorship-configs").expect(200);

        const configs = response.body as SurvivorshipConfig[];
        expect(configs.length).toBe(1);
      });
    });
  });

  describe("SourceRecordController", () => {
    describe("POST /mdm/source-records", () => {
      it("should create a source record", async () => {
        const response = await request(getServer())
          .post("/mdm/source-records")
          .send({
            entityType: "customer",
            sourceSystem: "crm",
            sourceId: "CRM-001",
            data: { firstName: "John", lastName: "Doe" },
            confidence: 0.9,
          })
          .expect(201);

        const record = response.body as SourceRecord;
        expect(record.id).toBeDefined();
        expect(record.entityType).toBe("customer");
        expect(record.sourceSystem).toBe("crm");
        expect(record.data["firstName"]).toBe("John");
      });
    });

    describe("GET /mdm/source-records", () => {
      it("should get all source records", async () => {
        await request(getServer())
          .post("/mdm/source-records")
          .send({
            entityType: "customer",
            sourceSystem: "crm",
            sourceId: "CRM-001",
            data: { name: "John" },
          });
        await request(getServer())
          .post("/mdm/source-records")
          .send({
            entityType: "customer",
            sourceSystem: "erp",
            sourceId: "ERP-001",
            data: { name: "Jane" },
          });

        const response = await request(getServer()).get("/mdm/source-records").expect(200);

        const records = response.body as SourceRecord[];
        expect(records.length).toBe(2);
      });

      it("should filter by entity type", async () => {
        await request(getServer()).post("/mdm/source-records").send({
          entityType: "customer",
          sourceSystem: "crm",
          sourceId: "CRM-001",
          data: {},
        });
        await request(getServer()).post("/mdm/source-records").send({
          entityType: "product",
          sourceSystem: "pim",
          sourceId: "PIM-001",
          data: {},
        });

        const response = await request(getServer())
          .get("/mdm/source-records")
          .query({ entityType: "customer" })
          .expect(200);

        const records = response.body as SourceRecord[];
        expect(records.length).toBe(1);
        expect(records[0]?.entityType).toBe("customer");
      });
    });

    describe("POST /mdm/source-records/ingest", () => {
      it("should ingest and match a source record", async () => {
        // Setup configs
        await request(getServer())
          .post("/mdm/match-configs")
          .send({
            entityType: "customer",
            name: "Customer Matching",
            rules: [{ field: "email", type: "exact", weight: 1.0 }],
            threshold: 0.8,
          });
        await request(getServer()).post("/mdm/survivorship-configs").send({
          entityType: "customer",
          name: "Customer Survivorship",
          rules: [],
          defaultStrategy: "mostRecent",
        });

        const response = await request(getServer())
          .post("/mdm/source-records/ingest")
          .send({
            entityType: "customer",
            sourceSystem: "crm",
            sourceId: "CRM-001",
            data: { email: "john@example.com", name: "John" },
          })
          .expect(201);

        const result = response.body as {
          sourceRecord: SourceRecord;
          matches: unknown[];
          goldenRecord?: GoldenRecord;
        };
        expect(result.sourceRecord).toBeDefined();
        expect(result.sourceRecord.id).toBeDefined();
        expect(result.goldenRecord).toBeDefined();
      });
    });
  });

  describe("GoldenRecordController", () => {
    describe("POST /mdm/golden-records", () => {
      it("should create a golden record", async () => {
        const response = await request(getServer())
          .post("/mdm/golden-records")
          .send({
            entityType: "customer",
            data: { name: "Master John" },
            matchedSourceIds: [],
            confidence: 1.0,
            needsReview: false,
          })
          .expect(201);

        const record = response.body as GoldenRecord;
        expect(record.id).toBeDefined();
        expect(record.entityType).toBe("customer");
        expect(record.data["name"]).toBe("Master John");
      });
    });

    describe("GET /mdm/golden-records", () => {
      it("should get all golden records", async () => {
        await request(getServer())
          .post("/mdm/golden-records")
          .send({
            entityType: "customer",
            data: { name: "Customer 1" },
            matchedSourceIds: [],
          });
        await request(getServer())
          .post("/mdm/golden-records")
          .send({
            entityType: "customer",
            data: { name: "Customer 2" },
            matchedSourceIds: [],
          });

        const response = await request(getServer()).get("/mdm/golden-records").expect(200);

        const records = response.body as GoldenRecord[];
        expect(records.length).toBe(2);
      });
    });

    describe("DELETE /mdm/golden-records/:id", () => {
      it("should delete a golden record", async () => {
        const createResponse = await request(getServer()).post("/mdm/golden-records").send({
          entityType: "customer",
          data: {},
          matchedSourceIds: [],
        });

        const created = createResponse.body as GoldenRecord;

        await request(getServer()).delete(`/mdm/golden-records/${created.id}`).expect(200);

        await request(getServer()).get(`/mdm/golden-records/${created.id}`).expect(404);
      });
    });
  });
});
