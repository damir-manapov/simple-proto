import { Controller, Get, Post, Put, Delete, Body, Param, NotFoundException } from "@nestjs/common";
import { MessagingService } from "./messaging.service.js";
import { SentMessageService } from "./sent-message.service.js";
import type {
  MessageTemplate,
  MessageTemplateInput,
  RenderedMessage,
} from "./messaging.service.js";
import type { SentMessage, MessageStatus } from "@simple-proto/messaging-types";
import type { SendOptions, BulkSendOptions, BulkSendResult } from "./sent-message.service.js";

interface RenderDto {
  variables?: Record<string, string>;
}

interface UpdateStatusDto {
  status: MessageStatus;
  error?: string;
}

@Controller("messaging")
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly sentMessageService: SentMessageService
  ) {}

  @Post("templates")
  create(@Body() body: MessageTemplateInput): MessageTemplate {
    return this.messagingService.create(body);
  }

  @Get("templates")
  findAll(): MessageTemplate[] {
    return this.messagingService.findAll();
  }

  @Get("templates/by-type/:type")
  findByType(@Param("type") type: MessageTemplate["type"]): MessageTemplate[] {
    return this.messagingService.findByType(type);
  }

  @Get("templates/:id")
  findById(@Param("id") id: string): MessageTemplate {
    const template = this.messagingService.findById(id);
    if (!template) {
      throw new NotFoundException(`Template with id "${id}" not found`);
    }
    return template;
  }

  @Put("templates/:id")
  update(@Param("id") id: string, @Body() body: MessageTemplate): MessageTemplate {
    const updated = this.messagingService.update(id, body);
    if (!updated) {
      throw new NotFoundException(`Template with id "${id}" not found`);
    }
    return updated;
  }

  @Delete("templates/:id")
  delete(@Param("id") id: string): { success: boolean } {
    const deleted = this.messagingService.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Template with id "${id}" not found`);
    }
    return { success: true };
  }

  @Post("templates/:id/render")
  render(@Param("id") id: string, @Body() body: RenderDto): RenderedMessage {
    return this.messagingService.render(id, body.variables ?? {});
  }

  @Get("templates/:id/variables")
  extractVariables(@Param("id") id: string): { variables: string[] } {
    return { variables: this.messagingService.extractVariables(id) };
  }

  // ==================== Sent Messages ====================

  @Post("send")
  send(@Body() body: SendOptions): SentMessage {
    return this.sentMessageService.send(body);
  }

  @Post("send/bulk")
  bulkSend(@Body() body: BulkSendOptions): BulkSendResult {
    return this.sentMessageService.bulkSend(body);
  }

  @Get("messages")
  findAllMessages(): SentMessage[] {
    return this.sentMessageService.findAll();
  }

  @Get("messages/:id")
  findMessageById(@Param("id") id: string): SentMessage {
    return this.sentMessageService.findByIdOrThrow(id);
  }

  @Get("messages/by-recipient/:recipient")
  findMessagesByRecipient(@Param("recipient") recipient: string): SentMessage[] {
    return this.sentMessageService.findByRecipient(recipient);
  }

  @Get("messages/by-template/:templateId")
  findMessagesByTemplateId(@Param("templateId") templateId: string): SentMessage[] {
    return this.sentMessageService.findByTemplateId(templateId);
  }

  @Get("messages/by-status/:status")
  findMessagesByStatus(@Param("status") status: MessageStatus): SentMessage[] {
    return this.sentMessageService.findByStatus(status);
  }

  @Put("messages/:id/status")
  updateMessageStatus(@Param("id") id: string, @Body() body: UpdateStatusDto): SentMessage {
    return this.sentMessageService.updateStatus(id, body.status, body.error);
  }

  @Delete("messages")
  clearMessages(): { success: boolean } {
    this.sentMessageService.clear();
    return { success: true };
  }
}
