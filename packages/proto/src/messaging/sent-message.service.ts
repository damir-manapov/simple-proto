import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  SentMessage,
  MessageStatus,
} from "@simple-proto/messaging-types";
import type { Entry, EntryInput, IRepository } from "@simple-proto/storage-types";
import { StorageService } from "../storage/storage.service.js";
import { MessagingService } from "./messaging.service.js";

/** Internal sent message type extending Entry */
interface SentMessageEntry extends Entry {
  templateId: string;
  recipient: string;
  subject: string;
  body: string;
  status: MessageStatus;
  sentAt: Date;
  updatedAt?: Date;
  error?: string;
}

interface SentMessageEntryInput extends EntryInput {
  templateId: string;
  recipient: string;
  subject: string;
  body: string;
  status: MessageStatus;
  sentAt: Date;
  updatedAt?: Date;
  error?: string;
}

const COLLECTION_NAME = "sent_messages";

export interface SendOptions {
  templateId: string;
  recipient: string;
  variables?: Record<string, string>;
}

export interface BulkSendOptions {
  templateId: string;
  recipients: string[];
  variables?: Record<string, string>;
}

export interface BulkSendResult {
  total: number;
  sent: number;
  failed: number;
  messages: SentMessage[];
}

@Injectable()
export class SentMessageService {
  constructor(
    private readonly storage: StorageService,
    private readonly messagingService: MessagingService
  ) {
    if (!this.storage.hasCollection(COLLECTION_NAME)) {
      this.storage.registerCollection({
        name: COLLECTION_NAME,
        schema: {
          type: "object",
          properties: {
            templateId: { type: "string" },
            recipient: { type: "string" },
            subject: { type: "string" },
            body: { type: "string" },
            status: { type: "string", enum: ["pending", "sent", "delivered", "failed"] },
            sentAt: {},
            updatedAt: {},
            error: { type: "string" },
          },
          required: ["templateId", "recipient", "subject", "body", "status", "sentAt"],
        },
      });
    }
  }

  private get repo(): IRepository<SentMessageEntry, SentMessageEntryInput> {
    return this.storage.getRepository<SentMessageEntry, SentMessageEntryInput>(COLLECTION_NAME);
  }

  /**
   * Send a message using a template
   */
  send(options: SendOptions): SentMessage {
    const rendered = this.messagingService.render(options.templateId, options.variables ?? {});

    const message = this.repo.create({
      templateId: options.templateId,
      recipient: options.recipient,
      subject: rendered.subject ?? "",
      body: rendered.body,
      status: "sent",
      sentAt: new Date(),
    });

    return message;
  }

  /**
   * Send a message to multiple recipients
   */
  bulkSend(options: BulkSendOptions): BulkSendResult {
    const messages: SentMessage[] = [];
    let sent = 0;
    let failed = 0;

    for (const recipient of options.recipients) {
      try {
        const message = this.send({
          templateId: options.templateId,
          recipient,
          ...(options.variables !== undefined ? { variables: options.variables } : {}),
        });
        messages.push(message);
        sent++;
      } catch {
        failed++;
      }
    }

    return {
      total: options.recipients.length,
      sent,
      failed,
      messages,
    };
  }

  /**
   * Find all sent messages
   */
  findAll(): SentMessage[] {
    return this.repo.findAll();
  }

  /**
   * Find a sent message by ID
   */
  findById(id: string): SentMessage | null {
    return this.repo.findById(id);
  }

  /**
   * Find a sent message by ID or throw
   */
  findByIdOrThrow(id: string): SentMessage {
    const message = this.repo.findById(id);
    if (!message) {
      throw new NotFoundException(`Sent message with id "${id}" not found`);
    }
    return message;
  }

  /**
   * Find sent messages by recipient
   */
  findByRecipient(recipient: string): SentMessage[] {
    return this.repo.findAll({ recipient: { eq: recipient } });
  }

  /**
   * Find sent messages by template ID
   */
  findByTemplateId(templateId: string): SentMessage[] {
    return this.repo.findAll({ templateId: { eq: templateId } });
  }

  /**
   * Find sent messages by status
   */
  findByStatus(status: MessageStatus): SentMessage[] {
    return this.repo.findAll({ status: { eq: status } });
  }

  /**
   * Update message status
   */
  updateStatus(id: string, status: MessageStatus, error?: string): SentMessage {
    const message = this.findByIdOrThrow(id);
    const updated = this.repo.update(id, {
      ...message,
      status,
      updatedAt: new Date(),
      ...(error !== undefined ? { error } : {}),
    });
    if (!updated) {
      throw new NotFoundException(`Sent message with id "${id}" not found`);
    }
    return updated;
  }

  /**
   * Clear all sent messages
   */
  clear(): void {
    this.repo.clear();
  }
}
