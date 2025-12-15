import type { ValueSource } from "./condition.types.js";

/**
 * Action types for workflow execution
 */

/**
 * Send a message through various channels
 */
export interface SendMessageAction {
  type: "sendMessage";
  channel: "email" | "sms" | "push" | "webhook" | "queue";
  recipient: ValueSource;
  message: ValueSource;
  template?: string;
}

/**
 * Create an entity in a collection
 */
export interface CreateEntityAction {
  type: "createEntity";
  collection: string;
  data: Record<string, ValueSource>;
  saveResultTo?: string; // Context path to store created entity
}

/**
 * Update an entity in a collection by id
 */
export interface UpdateEntityAction {
  type: "updateEntity";
  collection: string;
  id: ValueSource;
  data: Record<string, ValueSource>;
}

/**
 * Delete an entity from a collection by id
 */
export interface DeleteEntityAction {
  type: "deleteEntity";
  collection: string;
  id: ValueSource;
}

/**
 * Set values in the execution context
 */
export interface SetContextAction {
  type: "setContext";
  values: Record<string, ValueSource>;
}

/**
 * Make an HTTP call
 */
export interface HttpCallAction {
  type: "httpCall";
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  body?: Record<string, ValueSource>;
  saveResultTo?: string;
}

/**
 * Log a message
 */
export interface LogAction {
  type: "log";
  level?: "debug" | "info" | "warn" | "error";
  message: string;
  data?: Record<string, ValueSource>;
}

/**
 * All possible action types
 */
export type Action =
  | SendMessageAction
  | CreateEntityAction
  | UpdateEntityAction
  | DeleteEntityAction
  | SetContextAction
  | HttpCallAction
  | LogAction;

/**
 * Result of executing an action
 */
export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
