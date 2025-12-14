import type { Entry, EntryInput, Filter, AggregateOptions } from "@simple-proto/storage-types";

/** Status of a report definition */
export type ReportStatus = "draft" | "active" | "archived";

/** Column definition for report output */
export interface ReportColumn {
  /** Field path to extract (e.g., "user.email" or "amount") */
  field: string;
  /** Display label for the column */
  label: string;
  /** Optional format hint (e.g., "date", "currency", "number") */
  format?: string;
}

/** Report definition stored in the system */
export interface Report extends Entry {
  /** Report name */
  name: string;
  /** Optional description */
  description?: string;
  /** Collection to query */
  collection: string;
  /** Filter to apply (optional) */
  filter?: Filter<Entry & Record<string, unknown>>;
  /** Aggregation options (optional, for aggregate reports) */
  aggregation?: AggregateOptions<Entry & Record<string, unknown>>;
  /** Columns to include in output */
  columns?: ReportColumn[];
  /** Report status */
  status: ReportStatus;
  /** Maximum rows to return (default: 1000) */
  limit?: number;
  /** Created timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
  /** Last executed timestamp */
  lastRunAt?: Date;
}

/** Input for creating a report */
export interface ReportInput extends EntryInput {
  name: string;
  description?: string;
  collection: string;
  filter?: Filter<Entry & Record<string, unknown>>;
  aggregation?: AggregateOptions<Entry & Record<string, unknown>>;
  columns?: ReportColumn[];
  status?: ReportStatus;
  limit?: number;
}

/** Result row from report execution */
export type ReportRow = Record<string, unknown>;

/** Metadata about report execution */
export interface ReportExecutionMetadata {
  /** Report ID that was executed */
  reportId: string;
  /** Report name */
  reportName: string;
  /** When execution started */
  startedAt: Date;
  /** When execution completed */
  completedAt: Date;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Total rows returned */
  rowCount: number;
  /** Whether results were truncated due to limit */
  truncated: boolean;
}

/** Result of executing a report */
export interface ReportResult {
  /** Execution metadata */
  metadata: ReportExecutionMetadata;
  /** Column definitions (if specified in report) */
  columns?: ReportColumn[];
  /** Result rows */
  rows: ReportRow[];
}

/** Result of executing an aggregate report */
export interface AggregateReportResult {
  /** Execution metadata */
  metadata: ReportExecutionMetadata;
  /** Aggregation results */
  results: Record<string, unknown>[];
}
