import type { Entry, EntryInput } from "@simple-proto/storage";

/** Message template entity stored in the database */
export interface MessageTemplate extends Entry {
  /** Unique template name/slug */
  name: string;
  /** Template subject (for emails) */
  subject?: string;
  /** Template body with placeholders like {{variable}} */
  body: string;
  /** Template type: email, sms, push, etc */
  type: MessageType;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/** Input for creating a message template */
export interface MessageTemplateInput extends EntryInput {
  name: string;
  subject?: string;
  body: string;
  type: MessageType;
  metadata?: Record<string, unknown>;
}

/** Supported message types */
export type MessageType = "email" | "sms" | "push" | "webhook";

/** Rendered message ready to send */
export interface RenderedMessage {
  templateId: string;
  templateName: string;
  type: MessageType;
  subject?: string;
  body: string;
  variables: Record<string, string>;
}

/** Options for sending a message */
export interface SendMessageOptions {
  /** Template name to use */
  template: string;
  /** Variables to interpolate in the template */
  variables?: Record<string, string>;
  /** Recipient (email, phone, device token, url) */
  to: string;
}

/** Result of sending a message */
export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  rendered: RenderedMessage;
}
