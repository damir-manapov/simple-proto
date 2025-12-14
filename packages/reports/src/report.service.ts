import type { IStorage, IRepository, Entry, Filter } from "@simple-proto/storage-types";
import type {
  Report,
  ReportInput,
  ReportStatus,
  ReportResult,
  AggregateReportResult,
  ReportRow,
} from "@simple-proto/reports-types";

const DEFAULT_COLLECTION_NAME = "reports";
const DEFAULT_LIMIT = 1000;

const REPORT_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    collection: { type: "string" },
    filter: { type: "object" },
    aggregation: { type: "object" },
    columns: { type: "array" },
    status: { type: "string", enum: ["draft", "active", "archived"] },
    limit: { type: "number" },
    createdAt: {},
    updatedAt: {},
    lastRunAt: {},
  },
  required: ["name", "collection", "status"],
};

export interface ReportServiceOptions {
  /** Collection name to store reports (default: "reports") */
  collectionName?: string;
}

export class ReportService {
  private repository: IRepository<Report>;
  private storage: IStorage;

  constructor(storage: IStorage, options?: ReportServiceOptions) {
    this.storage = storage;
    const collectionName = options?.collectionName ?? DEFAULT_COLLECTION_NAME;

    if (!storage.hasCollection(collectionName)) {
      storage.registerCollection({
        name: collectionName,
        schema: REPORT_SCHEMA,
      });
    }

    this.repository = storage.getRepository<Report>(collectionName);
  }

  /** Create a new report definition */
  create(input: ReportInput): Report {
    const now = new Date();
    const reportData = {
      name: input.name,
      collection: input.collection,
      status: input.status ?? ("draft" as ReportStatus),
      createdAt: now,
      updatedAt: now,
      ...(input.description !== undefined && { description: input.description }),
      ...(input.filter !== undefined && { filter: input.filter }),
      ...(input.aggregation !== undefined && { aggregation: input.aggregation }),
      ...(input.columns !== undefined && { columns: input.columns }),
      ...(input.limit !== undefined && { limit: input.limit }),
    };
    return this.repository.create(
      reportData as unknown as Parameters<typeof this.repository.create>[0]
    );
  }

  /** Get a report by ID */
  get(id: string): Report | undefined {
    return this.repository.findById(id) ?? undefined;
  }

  /** Get all reports */
  getAll(): Report[] {
    return this.repository.findAll();
  }

  /** Get reports by status */
  getByStatus(status: ReportStatus): Report[] {
    return this.repository.findAll({ status: { eq: status } } as unknown as Filter<Report>);
  }

  /** Update a report */
  update(id: string, input: Partial<ReportInput>): Report {
    const existing = this.repository.findById(id);
    if (!existing) {
      throw new Error(`Report not found: ${id}`);
    }

    const updated: Report = {
      ...existing,
      ...input,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    const result = this.repository.update(id, updated);
    if (!result) {
      throw new Error(`Failed to update report: ${id}`);
    }
    return result;
  }

  /** Update report status */
  updateStatus(id: string, status: ReportStatus): Report {
    return this.update(id, { status });
  }

  /** Delete a report */
  delete(id: string): boolean {
    const existing = this.repository.findById(id);
    if (!existing) {
      return false;
    }
    this.repository.delete(id);
    return true;
  }

  /** Execute a report and return results */
  execute(id: string): ReportResult | AggregateReportResult {
    const report = this.repository.findById(id);
    if (!report) {
      throw new Error(`Report not found: ${id}`);
    }

    if (report.status === "archived") {
      throw new Error(`Cannot execute archived report: ${id}`);
    }

    const startedAt = new Date();

    // Ensure target collection exists before getting repository
    if (!this.storage.hasCollection(report.collection)) {
      throw new Error(`Collection not found: ${report.collection}`);
    }

    const targetRepo = this.storage.getRepository<Entry & Record<string, unknown>>(
      report.collection
    );

    // Check if this is an aggregate report
    if (report.aggregation) {
      const aggregationWithGroup = {
        ...report.aggregation,
        groupBy: report.aggregation.groupBy ?? [],
      };
      const rawResults = targetRepo.aggregate(aggregationWithGroup);
      const results = Array.isArray(rawResults) ? rawResults : [rawResults];
      const completedAt = new Date();

      // Update last run time
      this.repository.update(report.id, {
        ...report,
        lastRunAt: completedAt,
        updatedAt: completedAt,
      });

      return {
        metadata: {
          reportId: report.id,
          reportName: report.name,
          startedAt,
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          rowCount: results.length,
          truncated: false,
        },
        results,
      } satisfies AggregateReportResult;
    }

    // Standard query report
    const limit = report.limit ?? DEFAULT_LIMIT;
    const allRows = targetRepo.findAll(report.filter);
    const truncated = allRows.length > limit;
    const rows: ReportRow[] = allRows.slice(0, limit);

    // Apply column projection if specified
    let projectedRows = rows;
    const reportColumns = report.columns;
    if (reportColumns && reportColumns.length > 0) {
      projectedRows = rows.map((row) => {
        const projected: ReportRow = {};
        for (const col of reportColumns) {
          projected[col.field] = this.getNestedValue(row, col.field);
        }
        return projected;
      });
    }

    const completedAt = new Date();

    // Update last run time
    this.repository.update(report.id, {
      ...report,
      lastRunAt: completedAt,
      updatedAt: completedAt,
    });

    const result: ReportResult = {
      metadata: {
        reportId: report.id,
        reportName: report.name,
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        rowCount: projectedRows.length,
        truncated,
      },
      rows: projectedRows,
    };

    if (report.columns) {
      result.columns = report.columns;
    }

    return result;
  }

  /** Preview a report without saving (executes a temporary report definition) */
  preview(input: ReportInput): ReportResult | AggregateReportResult {
    const startedAt = new Date();

    // Ensure target collection exists before getting repository
    if (!this.storage.hasCollection(input.collection)) {
      throw new Error(`Collection not found: ${input.collection}`);
    }

    const targetRepo = this.storage.getRepository<Entry & Record<string, unknown>>(
      input.collection
    );

    // Check if this is an aggregate report
    if (input.aggregation) {
      const aggregationWithGroup = {
        ...input.aggregation,
        groupBy: input.aggregation.groupBy ?? [],
      };
      const rawResults = targetRepo.aggregate(aggregationWithGroup);
      const results = Array.isArray(rawResults) ? rawResults : [rawResults];
      const completedAt = new Date();

      return {
        metadata: {
          reportId: "preview",
          reportName: input.name,
          startedAt,
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          rowCount: results.length,
          truncated: false,
        },
        results,
      } satisfies AggregateReportResult;
    }

    // Standard query report
    const limit = input.limit ?? DEFAULT_LIMIT;
    const allRows = targetRepo.findAll(input.filter);
    const truncated = allRows.length > limit;
    const rows: ReportRow[] = allRows.slice(0, limit);

    // Apply column projection if specified
    let projectedRows = rows;
    const inputColumns = input.columns;
    if (inputColumns && inputColumns.length > 0) {
      projectedRows = rows.map((row) => {
        const projected: ReportRow = {};
        for (const col of inputColumns) {
          projected[col.field] = this.getNestedValue(row, col.field);
        }
        return projected;
      });
    }

    const completedAt = new Date();

    const result: ReportResult = {
      metadata: {
        reportId: "preview",
        reportName: input.name,
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        rowCount: projectedRows.length,
        truncated,
      },
      rows: projectedRows,
    };

    if (input.columns) {
      result.columns = input.columns;
    }

    return result;
  }

  /** Get nested value from object using dot notation */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }
}
