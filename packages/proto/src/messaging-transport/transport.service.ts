import { Injectable } from "@nestjs/common";
import type { Entry, EntryInput } from "@simple-proto/storage-types";
import { StorageService } from "../storage/storage.service.js";

export interface SentMessageData {
  templateId: string;
  recipient: string;
  subject: string;
  body: string;
  sentAt: Date;
}

export interface SentMessage extends Entry, SentMessageData {}

export interface SentMessageInput extends EntryInput, SentMessageData {}

const COLLECTION_NAME = "sent_messages";

@Injectable()
export class TransportService {
  constructor(private readonly storage: StorageService) {
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
            sentAt: {},
          },
          required: ["templateId", "recipient", "subject", "body", "sentAt"],
        },
      });
    }
  }

  send(message: Omit<SentMessageData, "sentAt">): SentMessage {
    const repo = this.storage.getRepository<SentMessage, SentMessageInput>(COLLECTION_NAME);
    return repo.create({
      ...message,
      sentAt: new Date(),
    });
  }

  findAll(): SentMessage[] {
    const repo = this.storage.getRepository<SentMessage, SentMessageInput>(COLLECTION_NAME);
    return repo.findAll();
  }

  findById(id: string): SentMessage | null {
    const repo = this.storage.getRepository<SentMessage, SentMessageInput>(COLLECTION_NAME);
    return repo.findById(id);
  }

  findByRecipient(recipient: string): SentMessage[] {
    const repo = this.storage.getRepository<SentMessage, SentMessageInput>(COLLECTION_NAME);
    return repo.findAll({ recipient: { eq: recipient } });
  }

  findByTemplateId(templateId: string): SentMessage[] {
    const repo = this.storage.getRepository<SentMessage, SentMessageInput>(COLLECTION_NAME);
    return repo.findAll({ templateId: { eq: templateId } });
  }

  clear(): void {
    const repo = this.storage.getRepository<SentMessage, SentMessageInput>(COLLECTION_NAME);
    repo.clear();
  }
}
