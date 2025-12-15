import type {
  Action,
  ActionResult,
  SendMessageAction,
  CreateEntityAction,
  UpdateEntityAction,
  DeleteEntityAction,
  SetContextAction,
  HttpCallAction,
  LogAction,
} from "@simple-proto/workflow-types";
import type { IStorage, EntryInput } from "@simple-proto/storage-types";
import {
  resolveValue,
  resolveRecord,
  setNestedValue,
  toSafeString,
} from "./utils.js";

/**
 * Message handler interface for SendMessageAction
 */
export interface MessageHandler {
  send(
    channel: string,
    recipient: unknown,
    message: unknown,
    template?: string
  ): Promise<void>;
}

/**
 * HTTP client interface for HttpCallAction
 */
export interface HttpClient {
  request(
    method: string,
    url: string,
    options?: { headers?: Record<string, string>; body?: unknown }
  ): Promise<unknown>;
}

/**
 * Logger interface for LogAction
 */
export interface Logger {
  log(level: string, message: string, data?: Record<string, unknown>): void;
}

/**
 * Default no-op implementations
 */
const noopMessageHandler: MessageHandler = {
  async send() {
    // No-op
  },
};

const noopHttpClient: HttpClient = {
  request() {
    return Promise.resolve(null);
  },
};

const consoleLogger: Logger = {
  log(level, message, data) {
    const logFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    logFn(`[${level.toUpperCase()}] ${message}`, data ?? "");
  },
};

export interface ActionExecutorDependencies {
  storage: IStorage;
  messageHandler?: MessageHandler;
  httpClient?: HttpClient;
  logger?: Logger;
}

/**
 * Executes workflow actions
 */
export class ActionExecutor {
  private readonly storage: IStorage;
  private readonly messageHandler: MessageHandler;
  private readonly httpClient: HttpClient;
  private readonly logger: Logger;

  constructor(deps: ActionExecutorDependencies) {
    this.storage = deps.storage;
    this.messageHandler = deps.messageHandler ?? noopMessageHandler;
    this.httpClient = deps.httpClient ?? noopHttpClient;
    this.logger = deps.logger ?? consoleLogger;
  }

  /**
   * Execute an action and return the result
   * Also mutates context if the action has saveResultTo
   */
  async execute(action: Action, context: Record<string, unknown>): Promise<ActionResult> {
    try {
      switch (action.type) {
        case "sendMessage":
          return await this.executeSendMessage(action, context);
        case "createEntity":
          return this.executeCreateEntity(action, context);
        case "updateEntity":
          return this.executeUpdateEntity(action, context);
        case "deleteEntity":
          return this.executeDeleteEntity(action, context);
        case "setContext":
          return this.executeSetContext(action, context);
        case "httpCall":
          return await this.executeHttpCall(action, context);
        case "log":
          return this.executeLog(action, context);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : toSafeString(error),
      };
    }
  }

  private async executeSendMessage(
    action: SendMessageAction,
    context: Record<string, unknown>
  ): Promise<ActionResult> {
    const recipient = resolveValue(action.recipient, context);
    const message = resolveValue(action.message, context);

    await this.messageHandler.send(action.channel, recipient, message, action.template);

    return { success: true, data: { channel: action.channel, recipient } };
  }

  private executeCreateEntity(
    action: CreateEntityAction,
    context: Record<string, unknown>
  ): ActionResult {
    if (!this.storage.hasCollection(action.collection)) {
      return { success: false, error: `Collection ${action.collection} not found` };
    }

    const repo = this.storage.getRepository(action.collection);
    const data = resolveRecord(action.data, context) as EntryInput;
    const created = repo.create(data);

    if (action.saveResultTo) {
      setNestedValue(context, action.saveResultTo, created);
    }

    return { success: true, data: created };
  }

  private executeUpdateEntity(
    action: UpdateEntityAction,
    context: Record<string, unknown>
  ): ActionResult {
    if (!this.storage.hasCollection(action.collection)) {
      return { success: false, error: `Collection ${action.collection} not found` };
    }

    const repo = this.storage.getRepository(action.collection);
    const id = String(resolveValue(action.id, context));
    const updates = resolveRecord(action.data, context);

    const existing = repo.findById(id);
    if (!existing) {
      return { success: false, error: `Entity ${id} not found in ${action.collection}` };
    }

    // Merge updates with existing entry
    const updatedData = { ...existing, ...updates };
    const updated = repo.update(id, updatedData);
    return { success: true, data: updated };
  }

  private executeDeleteEntity(
    action: DeleteEntityAction,
    context: Record<string, unknown>
  ): ActionResult {
    if (!this.storage.hasCollection(action.collection)) {
      return { success: false, error: `Collection ${action.collection} not found` };
    }

    const repo = this.storage.getRepository(action.collection);
    const id = String(resolveValue(action.id, context));

    const deleted = repo.delete(id);
    return { success: true, data: { deleted } };
  }

  private executeSetContext(
    action: SetContextAction,
    context: Record<string, unknown>
  ): ActionResult {
    const resolved = resolveRecord(action.values, context);
    for (const [key, value] of Object.entries(resolved)) {
      setNestedValue(context, key, value);
    }
    return { success: true, data: resolved };
  }

  private async executeHttpCall(
    action: HttpCallAction,
    context: Record<string, unknown>
  ): Promise<ActionResult> {
    const body = action.body ? resolveRecord(action.body, context) : undefined;

    const options: { headers?: Record<string, string>; body?: unknown } = {};
    if (action.headers) options.headers = action.headers;
    if (body) options.body = body;

    const result = await this.httpClient.request(action.method, action.url, options);

    if (action.saveResultTo) {
      setNestedValue(context, action.saveResultTo, result);
    }

    return { success: true, data: result };
  }

  private executeLog(action: LogAction, context: Record<string, unknown>): ActionResult {
    const data = action.data ? resolveRecord(action.data, context) : undefined;
    this.logger.log(action.level ?? "info", action.message, data);
    return { success: true };
  }
}
