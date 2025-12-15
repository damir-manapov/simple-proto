import type { TransformStep } from "./step.types.js";

// ==================== Pipeline Types ====================

export type PipelineStatus = "active" | "paused" | "disabled";

export interface TransformPipeline {
  id: string;
  name: string;
  description?: string;
  steps: TransformStep[];
  status: PipelineStatus;
  schedule?: PipelineSchedule;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineSchedule {
  type: "cron" | "interval";
  cron?: string; // Cron expression: "0 0 * * *" (daily at midnight)
  interval?: number; // Interval in milliseconds
  timezone?: string;
  enabled: boolean;
}

export interface PipelineInput {
  name: string;
  description?: string;
  steps: TransformStepInput[];
  status?: PipelineStatus;
  schedule?: PipelineSchedule;
  metadata?: Record<string, unknown>;
}

export interface TransformStepInput {
  id?: string; // Auto-generated if not provided
  type: TransformStep["type"];
  config: TransformStep["config"];
  order?: number; // Auto-assigned based on array index if not provided
  description?: string;
  dependsOn?: string[]; // Step IDs this step depends on
}

// ==================== Pipeline Run Types ====================

export type PipelineRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type StepRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export interface PipelineRun {
  id: string;
  pipelineId: string;
  pipelineName?: string;
  status: PipelineRunStatus;
  triggeredBy?: "manual" | "schedule" | "workflow" | "api";
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // milliseconds
  stepResults: StepResult[];
  error?: string;
  context?: Record<string, unknown>; // Runtime context/parameters
  createdAt?: Date;
}

export interface StepResult {
  stepId: string;
  stepType: TransformStep["type"];
  status: StepRunStatus;
  inputRows: number;
  outputRows: number;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number; // milliseconds
  error?: string;
  outputCollection?: string;
}

// ==================== Run Options ====================

export interface RunOptions {
  context?: Record<string, unknown>;
  dryRun?: boolean; // If true, don't persist outputs
  continueOnError?: boolean; // If true, continue pipeline on error (default: false)
  cleanupTempCollections?: boolean; // If true, delete _temp_* collections after run
}

// ==================== Validation Types ====================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  stepId?: string;
  field?: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  stepId?: string;
  field?: string;
  message: string;
  code: string;
}
