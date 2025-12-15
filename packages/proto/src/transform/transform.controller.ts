import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type {
  TransformPipeline,
  PipelineInput,
  PipelineRun,
  RunOptions,
  ValidationResult,
  TransformStepInput,
  PipelineStatus,
} from "@simple-proto/transform-types";
import { TransformNestService } from "./transform.service.js";

// ==================== Pipeline Controller ====================

@Controller("transform/pipelines")
export class TransformController {
  constructor(private readonly service: TransformNestService) {}

  @Post()
  create(@Body() input: PipelineInput): TransformPipeline {
    return this.service.createPipeline(input);
  }

  @Get()
  list(@Query("status") status?: PipelineStatus): TransformPipeline[] {
    return this.service.listPipelines(status ? { status } : undefined);
  }

  @Get(":id")
  get(@Param("id") id: string): TransformPipeline {
    const pipeline = this.service.getPipeline(id);
    if (!pipeline) {
      throw new HttpException("Pipeline not found", HttpStatus.NOT_FOUND);
    }
    return pipeline;
  }

  @Put(":id")
  update(
    @Param("id") id: string,
    @Body() input: Partial<Pick<PipelineInput, "name" | "description" | "steps" | "status" | "schedule">>,
  ): TransformPipeline {
    const updated = this.service.updatePipeline(id, input);
    if (!updated) {
      throw new HttpException("Pipeline not found", HttpStatus.NOT_FOUND);
    }
    return updated;
  }

  @Delete(":id")
  delete(@Param("id") id: string): { success: boolean } {
    const deleted = this.service.deletePipeline(id);
    if (!deleted) {
      throw new HttpException("Pipeline not found", HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }

  @Post(":id/run")
  run(@Param("id") id: string, @Body() options?: RunOptions): PipelineRun {
    try {
      return this.service.runPipeline(id, options);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw new HttpException("Pipeline not found", HttpStatus.NOT_FOUND);
      }
      if (error instanceof Error && error.message.includes("not active")) {
        throw new HttpException("Pipeline is not active", HttpStatus.BAD_REQUEST);
      }
      throw error;
    }
  }

  @Get(":id/runs")
  getRuns(@Param("id") id: string): PipelineRun[] {
    return this.service.getPipelineRuns(id);
  }

  @Post("validate")
  validate(@Body() input: PipelineInput): ValidationResult {
    return this.service.validatePipeline(input);
  }

  @Post("preview")
  previewStep(
    @Body() step: TransformStepInput,
    @Query("limit") limit?: string,
  ): { data: Record<string, unknown>[]; count: number } {
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.service.previewStep(step, limitNum);
  }
}

// ==================== Pipeline Runs Controller ====================

@Controller("transform/runs")
export class TransformRunsController {
  constructor(private readonly service: TransformNestService) {}

  @Get(":id")
  get(@Param("id") id: string): PipelineRun {
    const run = this.service.getPipelineRun(id);
    if (!run) {
      throw new HttpException("Run not found", HttpStatus.NOT_FOUND);
    }
    return run;
  }
}
