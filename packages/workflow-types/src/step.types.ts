import type { Action } from "./action.types.js";
import type { Condition, ValueSource } from "./condition.types.js";

/**
 * Step types for workflow definition
 */

/**
 * Base properties for all steps
 */
export interface BaseStep {
  id: string;
  name?: string;
}

/**
 * Condition step - branches based on condition evaluation
 */
export interface ConditionStep extends BaseStep {
  type: "condition";
  condition: Condition;
  onTrue: string; // stepId to go if true
  onFalse: string | null; // stepId to go if false, null = end
}

/**
 * Action step - executes an action
 */
export interface ActionStep extends BaseStep {
  type: "action";
  action: Action;
  next: string; // Next step ID
  onError?: string; // 'fail', 'continue', or stepId on error
}

/**
 * Pause step - pauses execution until manually resumed
 */
export interface PauseStep extends BaseStep {
  type: "pause";
  reason?: string;
  next: string; // Next step ID after resume
  resumeCondition?: Condition; // Optional: auto-resume when condition met
  timeoutMs?: number; // Optional: auto-fail after timeout
}

/**
 * Sub-workflow step - runs another workflow
 */
export interface SubWorkflowStep extends BaseStep {
  type: "subWorkflow";
  workflowId: string;
  inputMapping: Record<string, ValueSource>; // Map parent context to child input
  outputMapping: Record<string, ValueSource>; // Map child result to parent context
  next: string; // Next step ID
  waitForCompletion?: boolean; // If true, wait for sub-workflow to complete
}

/**
 * End step - explicitly ends the workflow
 */
export interface EndStep {
  id: string;
  type: "end";
  name?: string;
  status?: "completed" | "failed";
  reason?: string;
}

/**
 * All possible step types
 */
export type WorkflowStep = ConditionStep | ActionStep | PauseStep | SubWorkflowStep | EndStep;
