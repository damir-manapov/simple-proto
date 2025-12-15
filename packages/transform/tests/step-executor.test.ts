import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStorage } from "@simple-proto/storage-memory";
import { StepExecutor } from "../src/step-executor.js";
import type {
  FilterStepConfig,
  MapStepConfig,
  AggregateStepConfig,
  JoinStepConfig,
  LookupStepConfig,
  UnionStepConfig,
  DeduplicateStepConfig,
  SortStepConfig,
  LimitStepConfig,
} from "@simple-proto/transform-types";
import type { Entry, EntryInput } from "@simple-proto/storage-types";

type DataRecord = Entry & Record<string, unknown>;
type DataRecordInput = EntryInput & Record<string, unknown>;

function getRecords(storage: MemoryStorage, collection: string): DataRecord[] {
  return storage.getRepository<DataRecord, DataRecordInput>(collection).findAll();
}

describe("StepExecutor", () => {
  let storage: MemoryStorage;
  let executor: StepExecutor;

  beforeEach(() => {
    storage = new MemoryStorage();
    executor = new StepExecutor(storage);
  });

  describe("filter step", () => {
    beforeEach(() => {
      storage.registerCollection({ name: "users", schema: {} });
      storage.create("users", { id: "1", name: "Alice", age: 25, status: "active" });
      storage.create("users", { id: "2", name: "Bob", age: 35, status: "inactive" });
      storage.create("users", { id: "3", name: "Charlie", age: 45, status: "active" });
    });

    it("should filter by equality", () => {
      const config: FilterStepConfig = {
        source: "users",
        conditions: [{ field: "status", operator: "eq", value: "active" }],
        output: "active_users",
      };

      const result = executor.execute({ id: "step1", type: "filter", config, order: 1 });

      expect(result.status).toBe("completed");
      expect(result.inputRows).toBe(3);
      expect(result.outputRows).toBe(2);

      const output = getRecords(storage, "active_users");
      expect(output).toHaveLength(2);
    });

    it("should filter by greater than", () => {
      const config: FilterStepConfig = {
        source: "users",
        conditions: [{ field: "age", operator: "gt", value: 30 }],
        output: "older_users",
      };

      const result = executor.execute({ id: "step1", type: "filter", config, order: 1 });

      expect(result.outputRows).toBe(2);
    });
  });

  describe("map step", () => {
    beforeEach(() => {
      storage.registerCollection({ name: "products", schema: {} });
      storage.create("products", { id: "p1", name: "Widget", price: 100 });
      storage.create("products", { id: "p2", name: "Gadget", price: 200 });
    });

    it("should map fields with expressions", () => {
      const config: MapStepConfig = {
        source: "products",
        mappings: [
          { target: "displayName", expression: { type: "field", path: "name" } },
          {
            target: "priceWithTax",
            expression: {
              type: "math",
              operator: "*",
              left: { type: "field", path: "price" },
              right: { type: "literal", value: 1.2 },
            },
          },
        ],
        includeOriginal: true,
        output: "mapped_products",
      };

      const result = executor.execute({ id: "step1", type: "map", config, order: 1 });

      expect(result.status).toBe("completed");
      expect(result.outputRows).toBe(2);

      const output = getRecords(storage, "mapped_products");
      expect(output[0]).toHaveProperty("priceWithTax");
      expect(output[0]?.["priceWithTax"]).toBe(120);
    });

    it("should map without original fields", () => {
      const config: MapStepConfig = {
        source: "products",
        mappings: [{ target: "itemName", expression: { type: "field", path: "name" } }],
        includeOriginal: false,
        output: "minimal_products",
      };

      executor.execute({ id: "step1", type: "map", config, order: 1 });

      const output = getRecords(storage, "minimal_products");
      expect(output[0]).not.toHaveProperty("price");
      expect(output[0]).toHaveProperty("itemName");
    });
  });

  describe("aggregate step", () => {
    beforeEach(() => {
      storage.registerCollection({ name: "sales", schema: {} });
      storage.create("sales", { id: "s1", region: "North", amount: 100 });
      storage.create("sales", { id: "s2", region: "North", amount: 150 });
      storage.create("sales", { id: "s3", region: "South", amount: 200 });
    });

    it("should aggregate by group", () => {
      const config: AggregateStepConfig = {
        source: "sales",
        groupBy: ["region"],
        aggregations: [
          { field: "amount", function: "sum", as: "totalAmount" },
          { field: "*", function: "count", as: "count" },
        ],
        output: "regional_sales",
      };

      const result = executor.execute({ id: "step1", type: "aggregate", config, order: 1 });

      expect(result.status).toBe("completed");

      const output = getRecords(storage, "regional_sales");
      expect(output).toHaveLength(2);

      const north = output.find((r) => r["region"] === "North");
      expect(north?.["totalAmount"]).toBe(250);
      expect(north?.["count"]).toBe(2);
    });

    it("should aggregate without grouping", () => {
      const config: AggregateStepConfig = {
        source: "sales",
        groupBy: [],
        aggregations: [
          { field: "amount", function: "sum", as: "total" },
          { field: "amount", function: "avg", as: "average" },
        ],
        output: "summary",
      };

      executor.execute({ id: "step1", type: "aggregate", config, order: 1 });

      const output = getRecords(storage, "summary");
      expect(output).toHaveLength(1);
      expect(output[0]?.["total"]).toBe(450);
      expect(output[0]?.["average"]).toBeCloseTo(150, 2);
    });
  });

  describe("join step", () => {
    beforeEach(() => {
      storage.registerCollection({ name: "orders", schema: {} });
      storage.registerCollection({ name: "customers", schema: {} });

      storage.create("customers", { id: "c1", name: "Alice" });
      storage.create("customers", { id: "c2", name: "Bob" });

      storage.create("orders", { id: "o1", customerId: "c1", amount: 100 });
      storage.create("orders", { id: "o2", customerId: "c1", amount: 200 });
      storage.create("orders", { id: "o3", customerId: "c3", amount: 150 }); // No matching customer
    });

    it("should perform inner join", () => {
      const config: JoinStepConfig = {
        left: "orders",
        right: "customers",
        on: [{ leftField: "customerId", rightField: "id" }],
        type: "inner",
        output: "joined",
      };

      const result = executor.execute({ id: "step1", type: "join", config, order: 1 });

      expect(result.status).toBe("completed");

      const output = getRecords(storage, "joined");
      expect(output).toHaveLength(2); // Only 2 orders have matching customers
    });

    it("should perform left join", () => {
      const config: JoinStepConfig = {
        left: "orders",
        right: "customers",
        on: [{ leftField: "customerId", rightField: "id" }],
        type: "left",
        output: "left_joined",
      };

      executor.execute({ id: "step1", type: "join", config, order: 1 });

      const output = getRecords(storage, "left_joined");
      expect(output).toHaveLength(3); // All orders included
    });
  });

  describe("lookup step", () => {
    beforeEach(() => {
      storage.registerCollection({ name: "orders", schema: {} });
      storage.registerCollection({ name: "products", schema: {} });

      storage.create("products", { id: "p1", name: "Widget", price: 100 });
      storage.create("products", { id: "p2", name: "Gadget", price: 200 });

      storage.create("orders", { id: "o1", productId: "p1", quantity: 2 });
      storage.create("orders", { id: "o2", productId: "p2", quantity: 1 });
    });

    it("should lookup single record", () => {
      const config: LookupStepConfig = {
        source: "orders",
        from: "products",
        localField: "productId",
        foreignField: "id",
        as: "product",
        output: "orders_with_products",
      };

      const result = executor.execute({ id: "step1", type: "lookup", config, order: 1 });

      expect(result.status).toBe("completed");

      const output = getRecords(storage, "orders_with_products");
      expect(output[0]?.["product"]).toHaveProperty("name");
    });

    it("should lookup multiple records", () => {
      // Add another product with same id pattern
      storage.registerCollection({ name: "tags", schema: {} });
      storage.create("tags", { id: "t1", productId: "p1", tag: "new" });
      storage.create("tags", { id: "t2", productId: "p1", tag: "sale" });

      storage.registerCollection({ name: "productsWithTags", schema: {} });
      storage.create("productsWithTags", { id: "p1", name: "Widget" });

      const config: LookupStepConfig = {
        source: "productsWithTags",
        from: "tags",
        localField: "id",
        foreignField: "productId",
        as: "tags",
        multiple: true,
        output: "products_with_tags",
      };

      executor.execute({ id: "step1", type: "lookup", config, order: 1 });

      const output = getRecords(storage, "products_with_tags");
      const tags = output[0]?.["tags"];
      expect(Array.isArray(tags)).toBe(true);
      expect(tags).toHaveLength(2);
    });
  });

  describe("deduplicate step", () => {
    beforeEach(() => {
      storage.registerCollection({ name: "events", schema: {} });
      storage.create("events", { id: "e1", userId: "u1", type: "click", timestamp: 1 });
      storage.create("events", { id: "e2", userId: "u1", type: "click", timestamp: 2 });
      storage.create("events", { id: "e3", userId: "u2", type: "click", timestamp: 3 });
    });

    it("should keep first occurrence", () => {
      const config: DeduplicateStepConfig = {
        source: "events",
        keys: ["userId", "type"],
        keep: "first",
        output: "unique_events",
      };

      const result = executor.execute({
        id: "step1",
        type: "deduplicate",
        config,
        order: 1,
      });

      expect(result.status).toBe("completed");

      const output = getRecords(storage, "unique_events");
      expect(output).toHaveLength(2);
    });

    it("should keep last occurrence", () => {
      const config: DeduplicateStepConfig = {
        source: "events",
        keys: ["userId"],
        keep: "last",
        output: "latest_events",
      };

      executor.execute({ id: "step1", type: "deduplicate", config, order: 1 });

      const output = getRecords(storage, "latest_events");
      expect(output).toHaveLength(2);
    });
  });

  describe("union step", () => {
    beforeEach(() => {
      storage.registerCollection({ name: "pending_orders", schema: {} });
      storage.registerCollection({ name: "completed_orders", schema: {} });

      storage.create("pending_orders", { id: "o1", status: "pending" });
      storage.create("pending_orders", { id: "o2", status: "pending" });
      storage.create("completed_orders", { id: "o3", status: "completed" });
    });

    it("should union all records", () => {
      const config: UnionStepConfig = {
        sources: ["pending_orders", "completed_orders"],
        mode: "all",
        output: "all_orders",
      };

      const result = executor.execute({ id: "step1", type: "union", config, order: 1 });

      expect(result.status).toBe("completed");

      const output = getRecords(storage, "all_orders");
      expect(output).toHaveLength(3);
    });
  });

  describe("sort step", () => {
    beforeEach(() => {
      storage.registerCollection({ name: "items", schema: {} });
      storage.create("items", { id: "i1", name: "Charlie", score: 75 });
      storage.create("items", { id: "i2", name: "Alice", score: 90 });
      storage.create("items", { id: "i3", name: "Bob", score: 85 });
    });

    it("should sort ascending", () => {
      const config: SortStepConfig = {
        source: "items",
        orderBy: [{ field: "name", direction: "asc" }],
        output: "sorted_items",
      };

      const result = executor.execute({ id: "step1", type: "sort", config, order: 1 });

      expect(result.status).toBe("completed");

      const output = getRecords(storage, "sorted_items");
      expect(output[0]?.["name"]).toBe("Alice");
      expect(output[1]?.["name"]).toBe("Bob");
      expect(output[2]?.["name"]).toBe("Charlie");
    });

    it("should sort descending", () => {
      const config: SortStepConfig = {
        source: "items",
        orderBy: [{ field: "score", direction: "desc" }],
        output: "top_scores",
      };

      executor.execute({ id: "step1", type: "sort", config, order: 1 });

      const output = getRecords(storage, "top_scores");
      expect(output[0]?.["score"]).toBe(90);
    });
  });

  describe("limit step", () => {
    beforeEach(() => {
      storage.registerCollection({ name: "records", schema: {} });
      for (let i = 1; i <= 10; i++) {
        storage.create("records", { id: `r${String(i)}`, value: i });
      }
    });

    it("should limit results", () => {
      const config: LimitStepConfig = {
        source: "records",
        limit: 5,
        output: "limited",
      };

      const result = executor.execute({ id: "step1", type: "limit", config, order: 1 });

      expect(result.status).toBe("completed");
      expect(result.outputRows).toBe(5);
    });

    it("should limit with offset", () => {
      const config: LimitStepConfig = {
        source: "records",
        limit: 3,
        offset: 5,
        output: "paginated",
      };

      executor.execute({ id: "step1", type: "limit", config, order: 1 });

      const output = getRecords(storage, "paginated");
      expect(output).toHaveLength(3);
      expect(output[0]?.["value"]).toBe(6); // 1-indexed starting at offset 5
    });
  });

  describe("pivot step", () => {
    beforeEach(() => {
      storage.registerCollection({ name: "sales_data", schema: {} });
      storage.create("sales_data", { id: "s1", region: "North", quarter: "Q1", amount: 100 });
      storage.create("sales_data", { id: "s2", region: "North", quarter: "Q2", amount: 150 });
      storage.create("sales_data", { id: "s3", region: "South", quarter: "Q1", amount: 200 });
      storage.create("sales_data", { id: "s4", region: "South", quarter: "Q2", amount: 250 });
    });

    it("should pivot data", () => {
      const config = {
        source: "sales_data",
        groupBy: ["region"],
        pivotField: "quarter",
        valueField: "amount",
        aggregation: "sum" as const,
        output: "pivoted_sales",
      };

      const result = executor.execute({ id: "step1", type: "pivot", config, order: 1 });

      expect(result.status).toBe("completed");

      const output = getRecords(storage, "pivoted_sales");
      expect(output).toHaveLength(2);

      const north = output.find((r) => r["region"] === "North");
      expect(north?.["Q1"]).toBe(100);
      expect(north?.["Q2"]).toBe(150);
    });
  });

  describe("unpivot step", () => {
    beforeEach(() => {
      storage.registerCollection({ name: "wide_data", schema: {} });
      storage.create("wide_data", { id: "w1", product: "A", jan: 100, feb: 150 });
      storage.create("wide_data", { id: "w2", product: "B", jan: 200, feb: 250 });
    });

    it("should unpivot data", () => {
      const config = {
        source: "wide_data",
        idFields: ["product"],
        unpivotFields: ["jan", "feb"],
        nameField: "month",
        valueField: "amount",
        output: "narrow_data",
      };

      const result = executor.execute({ id: "step1", type: "unpivot", config, order: 1 });

      expect(result.status).toBe("completed");

      const output = getRecords(storage, "narrow_data");
      expect(output).toHaveLength(4); // 2 products x 2 months
    });
  });
});
