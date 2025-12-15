import type { IStorage, Entry, EntryInput, IRepository } from "@simple-proto/storage-types";
import type {
  TransformPipeline,
  PipelineInput,
  TransformStepInput,
  PipelineRun,
  PipelineStatus,
  StepResult,
  RunOptions,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  TransformStep,
} from "@simple-proto/transform-types";
import { StepExecutor } from "./step-executor.js";

type DataRecord = Entry & Record<string, unknown>;
type DataRecordInput = EntryInput & Record<string, unknown>;

/**
 * Transform Pipeline Service
 * Manages transform pipelines and their execution
 */
export class TransformService {
  private stepExecutor: StepExecutor;

  constructor(private storage: IStorage) {
    this.stepExecutor = new StepExecutor(storage);
    this.ensureCollections();
  }

  private ensureCollections(): void {
    if (!this.storage.hasCollection("transform_pipelines")) {
      this.storage.registerCollection({ name: "transform_pipelines", schema: {} });
    }
    if (!this.storage.hasCollection("transform_runs")) {
      this.storage.registerCollection({ name: "transform_runs", schema: {} });
    }
  }

  private getRepo<T extends Entry, TInput extends EntryInput>(
    collection: string
  ): IRepository<T, TInput> {
    return this.storage.getRepository<T, TInput>(collection);
  }

  // ==================== Pipeline CRUD ====================

  createPipeline(input: PipelineInput): TransformPipeline {
    const now = new Date();
    const pipeline: TransformPipeline = {
      id: this.generateId(),
      name: input.name,
      ...(input.description !== undefined && { description: input.description }),
      steps: this.normalizeSteps(input.steps),
      status: input.status ?? "active",
      ...(input.schedule !== undefined && { schedule: input.schedule }),
      createdAt: now,
      updatedAt: now,
    };

    const repo = this.getRepo<DataRecord, DataRecordInput>("transform_pipelines");
    repo.create(pipeline as unknown as DataRecordInput);

    return pipeline;
  }

  getPipeline(id: string): TransformPipeline | null {
    const repo = this.getRepo<DataRecord, DataRecordInput>("transform_pipelines");
    const entry = repo.findById(id);
    return entry ? this.toPipeline(entry) : null;
  }

  updatePipeline(
    id: string,
    updates: Partial<Pick<PipelineInput, "name" | "description" | "steps" | "status" | "schedule">>
  ): TransformPipeline | null {
    const pipeline = this.getPipeline(id);
    if (!pipeline) return null;

    const updated: TransformPipeline = {
      ...pipeline,
      name: updates.name ?? pipeline.name,
      ...(updates.description !== undefined
        ? { description: updates.description }
        : pipeline.description !== undefined
          ? { description: pipeline.description }
          : {}),
      steps: updates.steps ? this.normalizeSteps(updates.steps) : pipeline.steps,
      status: updates.status ?? pipeline.status,
      ...(updates.schedule !== undefined
        ? { schedule: updates.schedule }
        : pipeline.schedule !== undefined
          ? { schedule: pipeline.schedule }
          : {}),
      updatedAt: new Date(),
    };

    const repo = this.getRepo<DataRecord, DataRecordInput>("transform_pipelines");
    repo.update(id, updated as unknown as DataRecord);

    return updated;
  }

  deletePipeline(id: string): boolean {
    const repo = this.getRepo<DataRecord, DataRecordInput>("transform_pipelines");
    return repo.delete(id);
  }

  listPipelines(filter?: { status?: PipelineStatus }): TransformPipeline[] {
    const repo = this.getRepo<DataRecord, DataRecordInput>("transform_pipelines");
    const all = repo.findAll();
    const pipelines = all.map((e) => this.toPipeline(e));

    if (filter?.status) {
      return pipelines.filter((p) => p.status === filter.status);
    }

    return pipelines;
  }

  // ==================== Pipeline Execution ====================

  runPipeline(pipelineId: string, options?: RunOptions): PipelineRun {
    const pipeline = this.getPipeline(pipelineId);
    if (!pipeline) {
      throw new Error("Pipeline not found");
    }
    if (pipeline.status !== "active") {
      throw new Error("Pipeline is not active");
    }

    const run: PipelineRun = {
      id: this.generateId(),
      pipelineId,
      status: "running",
      stepResults: [],
      startedAt: new Date(),
      createdAt: new Date(),
    };

    const repo = this.getRepo<DataRecord, DataRecordInput>("transform_runs");
    repo.create(run as unknown as DataRecordInput);

    // Execute steps
    const stepResults: StepResult[] = [];
    let failedStep: StepResult | null = null;

    for (const step of pipeline.steps) {
      // Check dependencies
      if (step.dependsOn && step.dependsOn.length > 0) {
        const allDependenciesMet = step.dependsOn.every((depId) =>
          stepResults.some((r) => r.stepId === depId && r.status === "completed")
        );
        if (!allDependenciesMet) {
          stepResults.push({
            stepId: step.id,
            stepType: step.type,
            status: "skipped",
            inputRows: 0,
            outputRows: 0,
            startedAt: new Date(),
            completedAt: new Date(),
            duration: 0,
            error: "Dependencies not met",
          });
          continue;
        }
      }

      // Execute step synchronously
      const result = this.executeStepSync(step);
      stepResults.push(result);

      if (result.status === "failed") {
        failedStep = result;
        if (!options?.continueOnError) {
          break;
        }
      }
    }

    // Update run with results
    const completedRun: PipelineRun = {
      ...run,
      status: failedStep ? "failed" : "completed",
      stepResults,
      completedAt: new Date(),
    };

    repo.update(run.id, completedRun as unknown as DataRecord);

    // Clean up temp collections
    this.cleanupTempCollections();

    return completedRun;
  }

  private executeStepSync(step: TransformStep): StepResult {
    return this.stepExecutor.execute(step);
  }

  getPipelineRun(runId: string): PipelineRun | null {
    const repo = this.getRepo<DataRecord, DataRecordInput>("transform_runs");
    const entry = repo.findById(runId);
    return entry ? this.toRun(entry) : null;
  }

  listPipelineRuns(pipelineId: string): PipelineRun[] {
    const repo = this.getRepo<DataRecord, DataRecordInput>("transform_runs");
    const all = repo.findAll();
    return all.filter((e) => e["pipelineId"] === pipelineId).map((e) => this.toRun(e));
  }

  cancelRun(_runId: string): boolean {
    // For sync execution, runs complete immediately
    // In async implementation, this would signal cancellation
    return false;
  }

  // ==================== Step Preview ====================

  previewStep(
    step: TransformStepInput,
    limit?: number
  ): { data: Record<string, unknown>[]; count: number } {
    // Create a preview output collection
    const previewOutput = `_preview_${this.generateId()}`;
    const normalizedStep = this.normalizeStep(step, 0);

    // Modify step to output to preview collection
    const previewStep: TransformStep = {
      ...normalizedStep,
      config: {
        ...normalizedStep.config,
        output: previewOutput,
      },
    };

    try {
      // Execute the step synchronously
      void this.stepExecutor.execute(previewStep);

      // Get results - check if collection was created
      if (!this.storage.hasCollection(previewOutput)) {
        return { data: [], count: 0 };
      }

      const repo = this.getRepo<DataRecord, DataRecordInput>(previewOutput);
      const allData = repo.findAll();
      const data = limit ? allData.slice(0, limit) : allData;

      // Clean up
      repo.clear();

      return { data, count: allData.length };
    } catch {
      return { data: [], count: 0 };
    }
  }

  // ==================== Validation ====================

  validatePipeline(input: PipelineInput): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate name
    if (!input.name || input.name.trim() === "") {
      errors.push({
        code: "REQUIRED_FIELD",
        field: "name",
        message: "Pipeline name is required",
      });
    }

    // Validate steps
    if (input.steps.length === 0) {
      errors.push({
        code: "REQUIRED_FIELD",
        field: "steps",
        message: "At least one step is required",
      });
    } else {
      input.steps.forEach((step, i) => {
        const stepErrors = this.validateStep(step, i);
        errors.push(...stepErrors);
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateStep(step: TransformStepInput, index: number): ValidationError[] {
    const errors: ValidationError[] = [];
    const config = step.config as unknown as Record<string, unknown>;
    const stepNumber = String(index + 1);

    // Check required fields based on step type
    if (!config["source"] && !config["left"] && !config["sources"]) {
      errors.push({
        code: "REQUIRED_FIELD",
        field: "config.source",
        message: `Step ${stepNumber}: Source collection is required`,
      });
    }

    if (!config["output"]) {
      errors.push({
        code: "REQUIRED_FIELD",
        field: "config.output",
        message: `Step ${stepNumber}: Output collection is required`,
      });
    }

    return errors;
  }

  // ==================== Helpers ====================

  private generateId(): string {
    return `${String(Date.now())}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private normalizeSteps(steps: TransformStepInput[]): TransformStep[] {
    return steps.map((step, index) => this.normalizeStep(step, index));
  }

  private normalizeStep(step: TransformStepInput, index: number): TransformStep {
    return {
      id: step.id ?? this.generateId(),
      type: step.type,
      config: step.config,
      order: step.order ?? index + 1,
      ...(step.dependsOn !== undefined && { dependsOn: step.dependsOn }),
    };
  }

  private toPipeline(entry: DataRecord): TransformPipeline {
    const description = entry["description"] as string | undefined;
    const schedule = entry["schedule"] as TransformPipeline["schedule"] | undefined;
    return {
      id: entry.id,
      name: entry["name"] as string,
      ...(description !== undefined && { description }),
      steps: entry["steps"] as TransformStep[],
      status: entry["status"] as PipelineStatus,
      ...(schedule !== undefined && { schedule }),
      createdAt: new Date(entry["createdAt"] as string),
      updatedAt: new Date(entry["updatedAt"] as string),
    };
  }

  private toRun(entry: DataRecord): PipelineRun {
    const completedAt = entry["completedAt"] ? new Date(entry["completedAt"] as string) : undefined;
    const error = entry["error"] as string | undefined;
    return {
      id: entry.id,
      pipelineId: entry["pipelineId"] as string,
      status: entry["status"] as PipelineRun["status"],
      stepResults: entry["stepResults"] as StepResult[],
      startedAt: new Date(entry["startedAt"] as string),
      ...(completedAt !== undefined && { completedAt }),
      createdAt: new Date(entry["createdAt"] as string),
      ...(error !== undefined && { error }),
    };
  }

  private cleanupTempCollections(): void {
    const collections = this.storage.getCollections();
    for (const collection of collections) {
      if (collection.startsWith("_temp_") || collection.startsWith("_preview_")) {
        const repo = this.getRepo<DataRecord, DataRecordInput>(collection);
        repo.clear();
      }
    }
  }
}
