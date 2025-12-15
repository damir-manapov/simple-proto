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
  Workflow,
  WorkflowInput,
  WorkflowExecution,
  ExecutionFilter,
  ExecutionStatus,
} from "@simple-proto/workflow-types";
import { WorkflowService } from "./workflow.service.js";

// ==================== Workflow Controller ====================

@Controller("workflows")
export class WorkflowController {
  constructor(private readonly service: WorkflowService) {}

  @Post()
  create(@Body() input: WorkflowInput): Workflow {
    return this.service.createWorkflow(input);
  }

  @Get()
  list(): Workflow[] {
    return this.service.listWorkflows();
  }

  @Get(":id")
  get(@Param("id") id: string): Workflow {
    const workflow = this.service.getWorkflow(id);
    if (!workflow) {
      throw new HttpException("Workflow not found", HttpStatus.NOT_FOUND);
    }
    return workflow;
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() input: Partial<WorkflowInput>): Workflow {
    const updated = this.service.updateWorkflow(id, input);
    if (!updated) {
      throw new HttpException("Workflow not found", HttpStatus.NOT_FOUND);
    }
    return updated;
  }

  @Delete(":id")
  delete(@Param("id") id: string): { success: boolean } {
    const deleted = this.service.deleteWorkflow(id);
    if (!deleted) {
      throw new HttpException("Workflow not found", HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }
}

// ==================== Execution Controller ====================

@Controller("workflow-executions")
export class ExecutionController {
  constructor(private readonly service: WorkflowService) {}

  @Post()
  async start(
    @Body() body: { workflowId: string; context?: Record<string, unknown> }
  ): Promise<WorkflowExecution> {
    try {
      return await this.service.startExecution(body.workflowId, body.context ?? {});
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "Failed to start execution",
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get()
  list(
    @Query("workflowId") workflowId?: string,
    @Query("status") status?: ExecutionStatus
  ): WorkflowExecution[] {
    const filter: ExecutionFilter = {};
    if (workflowId) filter.workflowId = workflowId;
    if (status) filter.status = status;
    return this.service.listExecutions(filter);
  }

  @Get(":id")
  async get(@Param("id") id: string): Promise<WorkflowExecution> {
    const execution = await this.service.getExecution(id);
    if (!execution) {
      throw new HttpException("Execution not found", HttpStatus.NOT_FOUND);
    }
    return execution;
  }

  @Post(":id/resume")
  async resume(
    @Param("id") id: string,
    @Body() body: { context?: Record<string, unknown> }
  ): Promise<WorkflowExecution> {
    try {
      return await this.service.resumeExecution(id, body.context ?? {});
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "Failed to resume execution",
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post(":id/cancel")
  async cancel(@Param("id") id: string): Promise<WorkflowExecution> {
    try {
      return await this.service.cancelExecution(id);
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "Failed to cancel execution",
        HttpStatus.BAD_REQUEST
      );
    }
  }
}
