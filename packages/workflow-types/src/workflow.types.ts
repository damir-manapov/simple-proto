import type { WorkflowStep } from "./step.types.js";

/**
 * Workflow definition and execution types
 */

/**
 * Trigger configuration for auto-starting workflows
 */
export interface ManualTrigger {
  type: "manual";
}

export interface EventTrigger {
  type: "event";
  eventName: string;
  filter?: Record<string, unknown>;
}

export interface ScheduleTrigger {
  type: "schedule";
  cron: string;
}

export interface EntityChangeTrigger {
  type: "entityChange";
  collection: string;
  operation: "create" | "update" | "delete";
  filter?: Record<string, unknown>;
}

export type WorkflowTrigger = ManualTrigger | EventTrigger | ScheduleTrigger | EntityChangeTrigger;

/**
 * Workflow definition
 */
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  version: number;
  status: "draft" | "active" | "archived";
  trigger?: WorkflowTrigger;
  steps: WorkflowStep[];
  initialContext?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a workflow
 */
export interface WorkflowInput {
  id?: string;
  name: string;
  description?: string;
  version?: number;
  status?: "draft" | "active" | "archived";
  trigger?: WorkflowTrigger;
  steps: WorkflowStep[];
  initialContext?: Record<string, unknown>;
}

/**
 * Execution status
 */
export type ExecutionStatus =
  | "pending"
  | "running"
  | "paused"
  | "waitingForSubWorkflow"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * History entry for execution steps
 */
export interface ExecutionHistoryEntry {
  stepId: string;
  stepType: string;
  status: "started" | "completed" | "failed" | "skipped";
  input?: unknown;
  output?: unknown;
  error?: string;
  timestamp: Date;
  durationMs?: number;
}

/**
 * Workflow execution state
 */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowVersion: number;
  parentExecutionId?: string; // For sub-workflows
  status: ExecutionStatus;
  currentStepId: string | null;
  context: Record<string, unknown>; // Mutable execution data
  history: ExecutionHistoryEntry[];
  error?: string;
  result?: unknown;
  startedAt: Date;
  pausedAt?: Date;
  completedAt?: Date;
}

/**
 * Input for creating an execution
 */
export interface WorkflowExecutionInput {
  id?: string;
  workflowId: string;
  workflowVersion: number;
  parentExecutionId?: string;
  status?: ExecutionStatus;
  currentStepId?: string | null;
  context?: Record<string, unknown>;
  history?: ExecutionHistoryEntry[];
}

/**
 * Filter for listing executions
 */
export interface ExecutionFilter {
  workflowId?: string;
  status?: ExecutionStatus | ExecutionStatus[];
  startedAfter?: Date;
  startedBefore?: Date;
}
