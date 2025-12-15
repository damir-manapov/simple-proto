import type {
  Workflow,
  WorkflowInput,
  WorkflowExecution,
  ExecutionFilter,
  ExecutionStatus,
  WorkflowTrigger,
} from "@simple-proto/workflow-types";
import type { IStorage, Entry, EntryInput } from "@simple-proto/storage-types";
import { ConditionEvaluator } from "./condition-evaluator.js";
import { ActionExecutor, type ActionExecutorDependencies } from "./action-executor.js";
import { WorkflowEngine } from "./workflow-engine.js";

/**
 * Stored workflow entity
 */
interface WorkflowEntry extends Entry {
  name: string;
  description?: string;
  version: number;
  status: "draft" | "active" | "archived";
  trigger?: unknown;
  steps: unknown[];
  initialContext?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowEntryInput extends EntryInput {
  name: string;
  description?: string;
  version?: number;
  status?: "draft" | "active" | "archived";
  trigger?: unknown;
  steps: unknown[];
  initialContext?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Stored execution entity
 */
interface ExecutionEntry extends Entry {
  workflowId: string;
  workflowVersion: number;
  parentExecutionId?: string;
  status: ExecutionStatus;
  currentStepId: string | null;
  context: Record<string, unknown>;
  history: unknown[];
  error?: string;
  result?: unknown;
  startedAt: string;
  pausedAt?: string;
  completedAt?: string;
}

interface ExecutionEntryInput extends EntryInput {
  workflowId: string;
  workflowVersion: number;
  parentExecutionId?: string;
  status?: ExecutionStatus;
  currentStepId?: string | null;
  context?: Record<string, unknown>;
  history?: unknown[];
  error?: string;
  result?: unknown;
  startedAt?: string;
}

const WORKFLOW_COLLECTION = "workflows";
const EXECUTION_COLLECTION = "workflow_executions";

export interface WorkflowServiceDependencies extends Omit<ActionExecutorDependencies, "storage"> {
  storage: IStorage;
}

/**
 * Main workflow service - orchestrates all workflow operations
 */
export class WorkflowService {
  private readonly storage: IStorage;
  private readonly engine: WorkflowEngine;
  private initialized = false;

  constructor(deps: WorkflowServiceDependencies) {
    this.storage = deps.storage;

    const conditionEvaluator = new ConditionEvaluator(deps.storage);
    const actionExecutor = new ActionExecutor(deps);

    this.engine = new WorkflowEngine({
      conditionEvaluator,
      actionExecutor,
      callbacks: {
        getWorkflow: (id): Promise<Workflow | null> => this.getWorkflow(id),
        saveExecution: (execution): Promise<void> => this.saveExecution(execution),
        startSubWorkflow: (workflowId, parentId, context): Promise<WorkflowExecution> =>
          this.startSubWorkflow(workflowId, parentId, context),
      },
    });
  }

  private ensureInitialized(): void {
    if (this.initialized) return;

    if (!this.storage.hasCollection(WORKFLOW_COLLECTION)) {
      this.storage.registerCollection({
        name: WORKFLOW_COLLECTION,
        schema: { type: "object" },
      });
    }

    if (!this.storage.hasCollection(EXECUTION_COLLECTION)) {
      this.storage.registerCollection({
        name: EXECUTION_COLLECTION,
        schema: { type: "object" },
      });
    }

    this.initialized = true;
  }

  // ============ WORKFLOW CRUD ============

  createWorkflow(input: WorkflowInput): Workflow {
    this.ensureInitialized();
    const repo = this.storage.getRepository<WorkflowEntry, WorkflowEntryInput>(WORKFLOW_COLLECTION);

    const now = new Date().toISOString();
    const entryInput: WorkflowEntryInput = {
      name: input.name,
      version: input.version ?? 1,
      status: input.status ?? "draft",
      steps: input.steps,
      createdAt: now,
      updatedAt: now,
    };

    if (input.id) entryInput.id = input.id;
    if (input.description) entryInput.description = input.description;
    if (input.trigger) entryInput.trigger = input.trigger;
    if (input.initialContext) entryInput.initialContext = input.initialContext;

    const entry = repo.create(entryInput);

    return this.entryToWorkflow(entry);
  }

  getWorkflow(id: string): Promise<Workflow | null> {
    this.ensureInitialized();
    const repo = this.storage.getRepository<WorkflowEntry>(WORKFLOW_COLLECTION);
    const entry = repo.findById(id);
    return Promise.resolve(entry ? this.entryToWorkflow(entry) : null);
  }

  getWorkflowSync(id: string): Workflow | null {
    this.ensureInitialized();
    const repo = this.storage.getRepository<WorkflowEntry>(WORKFLOW_COLLECTION);
    const entry = repo.findById(id);
    return entry ? this.entryToWorkflow(entry) : null;
  }

  updateWorkflow(id: string, input: Partial<WorkflowInput>): Workflow | null {
    this.ensureInitialized();
    const repo = this.storage.getRepository<WorkflowEntry>(WORKFLOW_COLLECTION);

    const existing = repo.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated = repo.update(id, {
      ...existing,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.version !== undefined && { version: input.version }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.trigger !== undefined && { trigger: input.trigger }),
      ...(input.steps !== undefined && { steps: input.steps }),
      ...(input.initialContext !== undefined && { initialContext: input.initialContext }),
      updatedAt: now,
    });

    return updated ? this.entryToWorkflow(updated) : null;
  }

  deleteWorkflow(id: string): boolean {
    this.ensureInitialized();
    const repo = this.storage.getRepository(WORKFLOW_COLLECTION);
    return repo.delete(id);
  }

  listWorkflows(): Workflow[] {
    this.ensureInitialized();
    const repo = this.storage.getRepository<WorkflowEntry>(WORKFLOW_COLLECTION);
    return repo.findAll().map((e) => this.entryToWorkflow(e));
  }

  // ============ EXECUTION MANAGEMENT ============

  async startExecution(
    workflowId: string,
    initialContext?: Record<string, unknown>
  ): Promise<WorkflowExecution> {
    this.ensureInitialized();

    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (workflow.status !== "active") {
      throw new Error(`Workflow ${workflowId} is not active (status: ${workflow.status})`);
    }

    const execution = this.engine.createExecution(workflow, initialContext);
    await this.saveExecution(execution);

    return this.engine.run(execution, workflow);
  }

  async pauseExecution(executionId: string): Promise<WorkflowExecution> {
    const execution = await this.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (execution.status !== "running") {
      throw new Error(`Cannot pause execution with status ${execution.status}`);
    }

    execution.status = "paused";
    execution.pausedAt = new Date();
    await this.saveExecution(execution);

    return execution;
  }

  async resumeExecution(
    executionId: string,
    additionalContext?: Record<string, unknown>
  ): Promise<WorkflowExecution> {
    const execution = await this.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const workflow = await this.getWorkflow(execution.workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${execution.workflowId} not found`);
    }

    return this.engine.resume(execution, workflow, additionalContext);
  }

  async cancelExecution(executionId: string): Promise<WorkflowExecution> {
    const execution = await this.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (execution.status === "completed" || execution.status === "failed") {
      throw new Error(`Cannot cancel execution with status ${execution.status}`);
    }

    execution.status = "cancelled";
    execution.completedAt = new Date();
    await this.saveExecution(execution);

    return execution;
  }

  getExecution(id: string): Promise<WorkflowExecution | null> {
    this.ensureInitialized();
    const repo = this.storage.getRepository<ExecutionEntry>(EXECUTION_COLLECTION);
    const entry = repo.findById(id);
    return Promise.resolve(entry ? this.entryToExecution(entry) : null);
  }

  getExecutionSync(id: string): WorkflowExecution | null {
    this.ensureInitialized();
    const repo = this.storage.getRepository<ExecutionEntry>(EXECUTION_COLLECTION);
    const entry = repo.findById(id);
    return entry ? this.entryToExecution(entry) : null;
  }

  listExecutions(filter?: ExecutionFilter): WorkflowExecution[] {
    this.ensureInitialized();
    const repo = this.storage.getRepository<ExecutionEntry>(EXECUTION_COLLECTION);

    let entries = repo.findAll();

    if (filter) {
      if (filter.workflowId) {
        entries = entries.filter((e) => e.workflowId === filter.workflowId);
      }
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        entries = entries.filter((e) => statuses.includes(e.status));
      }
      if (filter.startedAfter) {
        const after = filter.startedAfter.getTime();
        entries = entries.filter((e) => new Date(e.startedAt).getTime() > after);
      }
      if (filter.startedBefore) {
        const before = filter.startedBefore.getTime();
        entries = entries.filter((e) => new Date(e.startedAt).getTime() < before);
      }
    }

    return entries.map((e) => this.entryToExecution(e));
  }

  // ============ INTERNAL HELPERS ============

  private saveExecution(execution: WorkflowExecution): Promise<void> {
    this.ensureInitialized();
    const repo = this.storage.getRepository<ExecutionEntry, ExecutionEntryInput>(
      EXECUTION_COLLECTION
    );

    const existing = repo.findById(execution.id);
    const entryData: ExecutionEntry = {
      id: execution.id,
      workflowId: execution.workflowId,
      workflowVersion: execution.workflowVersion,
      status: execution.status,
      currentStepId: execution.currentStepId,
      context: execution.context,
      history: execution.history,
      startedAt: execution.startedAt.toISOString(),
      ...(execution.parentExecutionId && { parentExecutionId: execution.parentExecutionId }),
      ...(execution.error && { error: execution.error }),
      ...(execution.result !== undefined && { result: execution.result }),
      ...(execution.pausedAt && { pausedAt: execution.pausedAt.toISOString() }),
      ...(execution.completedAt && { completedAt: execution.completedAt.toISOString() }),
    };

    if (existing) {
      repo.update(execution.id, entryData);
    } else {
      repo.create(entryData);
    }

    return Promise.resolve();
  }

  private async startSubWorkflow(
    workflowId: string,
    parentExecutionId: string,
    context: Record<string, unknown>
  ): Promise<WorkflowExecution> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Sub-workflow ${workflowId} not found`);
    }

    const execution = this.engine.createExecution(workflow, context);
    execution.parentExecutionId = parentExecutionId;
    await this.saveExecution(execution);

    return this.engine.run(execution, workflow);
  }

  private entryToWorkflow(entry: WorkflowEntry): Workflow {
    const result: Workflow = {
      id: entry.id,
      name: entry.name,
      version: entry.version,
      status: entry.status,
      steps: entry.steps as Workflow["steps"],
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt),
    };

    if (entry.description) result.description = entry.description;
    if (entry.trigger) {
      result.trigger = entry.trigger as WorkflowTrigger;
    }
    if (entry.initialContext) result.initialContext = entry.initialContext;

    return result;
  }

  private entryToExecution(entry: ExecutionEntry): WorkflowExecution {
    return {
      id: entry.id,
      workflowId: entry.workflowId,
      workflowVersion: entry.workflowVersion,
      status: entry.status,
      currentStepId: entry.currentStepId,
      context: entry.context,
      history: entry.history as WorkflowExecution["history"],
      startedAt: new Date(entry.startedAt),
      ...(entry.parentExecutionId && { parentExecutionId: entry.parentExecutionId }),
      ...(entry.error && { error: entry.error }),
      ...(entry.result !== undefined && { result: entry.result }),
      ...(entry.pausedAt && { pausedAt: new Date(entry.pausedAt) }),
      ...(entry.completedAt && { completedAt: new Date(entry.completedAt) }),
    };
  }
}
