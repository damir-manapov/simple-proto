import { Injectable } from "@nestjs/common";
import { WorkflowService as WorkflowCoreService } from "@simple-proto/workflow";
import type { MessageHandler, HttpClient, Logger } from "@simple-proto/workflow";
import type {
  Workflow,
  WorkflowInput,
  WorkflowExecution,
  ExecutionFilter,
} from "@simple-proto/workflow-types";
import { StorageService } from "../storage/storage.service.js";
import { TransportService } from "../messaging-transport/transport.service.js";

@Injectable()
export class WorkflowService {
  private workflowService: WorkflowCoreService;

  constructor(storage: StorageService, transport: TransportService) {
    const messageHandler: MessageHandler = {
      send(
        channel: string,
        recipient: unknown,
        message: unknown,
        template?: string
      ): Promise<void> {
        transport.send({
          templateId: channel,
          recipient: String(recipient),
          subject: template ?? "Workflow Message",
          body: String(message),
        });
        return Promise.resolve();
      },
    };

    const httpClient: HttpClient = {
      async request(
        method: string,
        url: string,
        options?: { headers?: Record<string, string>; body?: unknown }
      ): Promise<unknown> {
        const body = options?.body ? JSON.stringify(options.body) : undefined;
        const headers = options?.headers;
        const response = await fetch(url, {
          method,
          ...(headers !== undefined && { headers }),
          ...(body !== undefined && { body }),
        });
        return response.json();
      },
    };

    const logger: Logger = {
      log(level: string, message: string, data?: Record<string, unknown>): void {
        if (level === "error") {
          console.error(`[WORKFLOW] ${message}`, data);
        } else if (level === "warn") {
          console.warn(`[WORKFLOW] ${message}`, data);
        } else {
          console.log(`[WORKFLOW] ${message}`, data);
        }
      },
    };

    this.workflowService = new WorkflowCoreService({
      storage,
      messageHandler,
      httpClient,
      logger,
    });
  }

  // ==================== Workflow CRUD ====================

  createWorkflow(input: WorkflowInput): Workflow {
    return this.workflowService.createWorkflow(input);
  }

  getWorkflow(id: string): Workflow | null {
    return this.workflowService.getWorkflowSync(id);
  }

  listWorkflows(): Workflow[] {
    return this.workflowService.listWorkflows();
  }

  updateWorkflow(id: string, input: Partial<WorkflowInput>): Workflow | null {
    return this.workflowService.updateWorkflow(id, input);
  }

  deleteWorkflow(id: string): boolean {
    return this.workflowService.deleteWorkflow(id);
  }

  // ==================== Workflow Execution ====================

  async startExecution(
    workflowId: string,
    context: Record<string, unknown>
  ): Promise<WorkflowExecution> {
    return this.workflowService.startExecution(workflowId, context);
  }

  async getExecution(id: string): Promise<WorkflowExecution | null> {
    return this.workflowService.getExecution(id);
  }

  listExecutions(filter?: ExecutionFilter): WorkflowExecution[] {
    return this.workflowService.listExecutions(filter);
  }

  async resumeExecution(id: string, context: Record<string, unknown>): Promise<WorkflowExecution> {
    return this.workflowService.resumeExecution(id, context);
  }

  async cancelExecution(id: string): Promise<WorkflowExecution> {
    return this.workflowService.cancelExecution(id);
  }
}
