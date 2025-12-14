import { Injectable } from "@nestjs/common";
import { TemplateService } from "@simple-proto/messaging";
import type {
  MessageTemplate,
  MessageTemplateInput,
  RenderedMessage,
} from "@simple-proto/messaging";
import { StorageService } from "../storage/storage.service.js";

export type { MessageTemplate, MessageTemplateInput, RenderedMessage };

@Injectable()
export class MessagingService extends TemplateService {
  // Constructor required for NestJS dependency injection
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(storage: StorageService) {
    super(storage);
  }
}
