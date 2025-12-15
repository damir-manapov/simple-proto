import { Injectable } from "@nestjs/common";
import { TransformService } from "@simple-proto/transform";
import type {
  TransformPipeline,
  PipelineInput,
  PipelineRun,
  RunOptions,
  ValidationResult,
  TransformStepInput,
  PipelineStatus,
} from "@simple-proto/transform-types";
import { StorageService } from "../storage/storage.service.js";

@Injectable()
export class TransformNestService {
  private transformService: TransformService;

  constructor(storage: StorageService) {
    this.transformService = new TransformService(storage);
  }

  // ==================== Pipeline CRUD ====================

  createPipeline(input: PipelineInput): TransformPipeline {
    return this.transformService.createPipeline(input);
  }

  getPipeline(id: string): TransformPipeline | null {
    return this.transformService.getPipeline(id);
  }

  listPipelines(filter?: { status?: PipelineStatus }): TransformPipeline[] {
    return this.transformService.listPipelines(filter);
  }

  updatePipeline(
    id: string,
    updates: Partial<Pick<PipelineInput, "name" | "description" | "steps" | "status" | "schedule">>,
  ): TransformPipeline | null {
    return this.transformService.updatePipeline(id, updates);
  }

  deletePipeline(id: string): boolean {
    return this.transformService.deletePipeline(id);
  }

  // ==================== Pipeline Execution ====================

  runPipeline(id: string, options?: RunOptions): PipelineRun {
    return this.transformService.runPipeline(id, options);
  }

  getPipelineRun(runId: string): PipelineRun | null {
    return this.transformService.getPipelineRun(runId);
  }

  getPipelineRuns(pipelineId: string): PipelineRun[] {
    return this.transformService.listPipelineRuns(pipelineId);
  }

  // ==================== Preview ====================

  previewStep(
    step: TransformStepInput,
    limit?: number,
  ): { data: Record<string, unknown>[]; count: number } {
    return this.transformService.previewStep(step, limit);
  }

  // ==================== Validation ====================

  validatePipeline(input: PipelineInput): ValidationResult {
    return this.transformService.validatePipeline(input);
  }
}
