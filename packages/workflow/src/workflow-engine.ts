import type {
  Workflow,
  WorkflowExecution,
  WorkflowStep,
  ExecutionHistoryEntry,
  ConditionStep,
  ActionStep,
  PauseStep,
  SubWorkflowStep,
  EndStep,
  ValueSource,
} from "@simple-proto/workflow-types";
import type { ConditionEvaluator } from "./condition-evaluator.js";
import type { ActionExecutor } from "./action-executor.js";
import { generateId, getNestedValue, setNestedValue, toSafeString } from "./utils.js";

/**
 * Resolves a ValueSource to its actual value
 */
function resolveValue(source: ValueSource, context: Record<string, unknown>): unknown {
  if (source.type === "constant") {
    return source.value;
  }
  return getNestedValue(context, source.path);
}

export interface WorkflowEngineCallbacks {
  /**
   * Called to retrieve a workflow by ID (for sub-workflows)
   */
  getWorkflow: (id: string) => Promise<Workflow | null>;

  /**
   * Called to save execution state
   */
  saveExecution: (execution: WorkflowExecution) => Promise<void>;

  /**
   * Called to start a sub-workflow
   */
  startSubWorkflow?: (
    workflowId: string,
    parentExecutionId: string,
    context: Record<string, unknown>
  ) => Promise<WorkflowExecution>;
}

export interface WorkflowEngineDependencies {
  conditionEvaluator: ConditionEvaluator;
  actionExecutor: ActionExecutor;
  callbacks: WorkflowEngineCallbacks;
}

/**
 * The core workflow execution engine
 */
export class WorkflowEngine {
  private readonly conditionEvaluator: ConditionEvaluator;
  private readonly actionExecutor: ActionExecutor;
  private readonly callbacks: WorkflowEngineCallbacks;

  constructor(deps: WorkflowEngineDependencies) {
    this.conditionEvaluator = deps.conditionEvaluator;
    this.actionExecutor = deps.actionExecutor;
    this.callbacks = deps.callbacks;
  }

  /**
   * Create a new execution for a workflow
   */
  createExecution(workflow: Workflow, initialContext?: Record<string, unknown>): WorkflowExecution {
    const firstStep = workflow.steps[0];
    if (!firstStep) {
      throw new Error("Workflow has no steps");
    }

    return {
      id: generateId(),
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      status: "pending",
      currentStepId: firstStep.id,
      context: { ...workflow.initialContext, ...initialContext },
      history: [],
      startedAt: new Date(),
    };
  }

  /**
   * Run execution until it completes, pauses, or fails
   */
  async run(execution: WorkflowExecution, workflow: Workflow): Promise<WorkflowExecution> {
    execution.status = "running";

    while (execution.status === "running" && execution.currentStepId) {
      const step = this.findStep(workflow, execution.currentStepId);
      if (!step) {
        execution.status = "failed";
        execution.error = `Step ${execution.currentStepId} not found`;
        break;
      }

      const historyEntry: ExecutionHistoryEntry = {
        stepId: step.id,
        stepType: step.type,
        status: "started",
        timestamp: new Date(),
      };

      try {
        const startTime = Date.now();
        const nextStepId = await this.executeStep(step, execution, workflow);
        historyEntry.durationMs = Date.now() - startTime;
        historyEntry.status = "completed";
        execution.history.push(historyEntry);

        if (nextStepId === null) {
          // Workflow completed
          execution.currentStepId = null;
          execution.status = "completed";
          execution.completedAt = new Date();
        } else {
          execution.currentStepId = nextStepId;
        }
      } catch (error) {
        historyEntry.status = "failed";
        historyEntry.error = error instanceof Error ? error.message : toSafeString(error);
        execution.history.push(historyEntry);
        execution.status = "failed";
        execution.error = historyEntry.error;
        execution.completedAt = new Date();
      }

      await this.callbacks.saveExecution(execution);
    }

    return execution;
  }

  /**
   * Resume a paused execution
   */
  async resume(
    execution: WorkflowExecution,
    workflow: Workflow,
    additionalContext?: Record<string, unknown>
  ): Promise<WorkflowExecution> {
    if (execution.status !== "paused") {
      throw new Error(`Cannot resume execution with status ${execution.status}`);
    }

    if (additionalContext) {
      Object.assign(execution.context, additionalContext);
    }

    // Move to next step from pause
    const currentStep = this.findStep(workflow, execution.currentStepId ?? "");
    if (currentStep && "next" in currentStep) {
      execution.currentStepId = currentStep.next;
    }

    execution.status = "running";
    delete (execution as Partial<Pick<WorkflowExecution, "pausedAt">> & WorkflowExecution).pausedAt;

    return this.run(execution, workflow);
  }

  /**
   * Execute a single step
   * Returns the next step ID or null to end
   */
  private async executeStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    workflow: Workflow
  ): Promise<string | null> {
    switch (step.type) {
      case "condition":
        return this.executeConditionStep(step, execution);
      case "action":
        return this.executeActionStep(step, execution);
      case "pause":
        return this.executePauseStep(step, execution);
      case "subWorkflow":
        return this.executeSubWorkflowStep(step, execution, workflow);
      case "end":
        return this.executeEndStep(step, execution);
    }
  }

  private async executeConditionStep(
    step: ConditionStep,
    execution: WorkflowExecution
  ): Promise<string | null> {
    const result = await this.conditionEvaluator.evaluate(step.condition, execution.context);
    return result ? step.onTrue : step.onFalse;
  }

  private async executeActionStep(
    step: ActionStep,
    execution: WorkflowExecution
  ): Promise<string | null> {
    const result = await this.actionExecutor.execute(step.action, execution.context);

    if (!result.success) {
      if (step.onError === "continue") {
        return step.next;
      }
      if (step.onError && step.onError !== "fail") {
        // onError is a step ID
        return step.onError;
      }
      throw new Error(result.error ?? "Action failed");
    }

    return step.next;
  }

  private async executePauseStep(
    step: PauseStep,
    execution: WorkflowExecution
  ): Promise<string | null> {
    // Check if auto-resume condition is met
    if (step.resumeCondition) {
      const shouldResume = await this.conditionEvaluator.evaluate(
        step.resumeCondition,
        execution.context
      );
      if (shouldResume) {
        return step.next;
      }
    }

    // Pause execution
    execution.status = "paused";
    execution.pausedAt = new Date();

    // Return current step to indicate we're staying here
    return step.id;
  }

  private async executeSubWorkflowStep(
    step: SubWorkflowStep,
    execution: WorkflowExecution,
    _workflow: Workflow
  ): Promise<string | null> {
    const subWorkflow = await this.callbacks.getWorkflow(step.workflowId);
    if (!subWorkflow) {
      throw new Error(`Sub-workflow ${step.workflowId} not found`);
    }

    // Build input context from mappings
    const subContext: Record<string, unknown> = {};
    for (const [key, source] of Object.entries(step.inputMapping)) {
      const value = resolveValue(source, execution.context);
      setNestedValue(subContext, key, value);
    }

    if (step.waitForCompletion) {
      // Execute sub-workflow synchronously
      if (!this.callbacks.startSubWorkflow) {
        throw new Error("startSubWorkflow callback not provided");
      }

      const subExecution = await this.callbacks.startSubWorkflow(
        step.workflowId,
        execution.id,
        subContext
      );

      // Map outputs back
      if (subExecution.status === "completed") {
        for (const [key, source] of Object.entries(step.outputMapping)) {
          const value = resolveValue(source, subExecution.context);
          setNestedValue(execution.context, key, value);
        }
      }

      if (subExecution.status === "failed") {
        throw new Error(`Sub-workflow failed: ${subExecution.error ?? "Unknown error"}`);
      }
    } else {
      // Fire and forget - just start the sub-workflow
      if (this.callbacks.startSubWorkflow) {
        // Don't await - fire and forget
        void this.callbacks.startSubWorkflow(step.workflowId, execution.id, subContext);
      }
    }

    return step.next;
  }

  private executeEndStep(step: EndStep, execution: WorkflowExecution): null {
    if (step.status === "failed") {
      execution.status = "failed";
      if (step.reason) {
        execution.error = step.reason;
      }
    } else {
      execution.status = "completed";
    }
    execution.completedAt = new Date();
    return null;
  }

  private findStep(workflow: Workflow, stepId: string): WorkflowStep | undefined {
    return workflow.steps.find((s) => s.id === stepId);
  }
}
