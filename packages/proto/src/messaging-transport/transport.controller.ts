import { Controller, Get, Post, Body, Param, Delete, NotFoundException } from "@nestjs/common";
import { TransportService } from "./transport.service.js";
import type { SentMessage } from "./transport.service.js";

interface SendMessageDto {
  templateId: string;
  recipient: string;
  subject: string;
  body: string;
}

@Controller("messaging/transport")
export class TransportController {
  constructor(private readonly transportService: TransportService) {}

  @Post("send")
  send(@Body() body: SendMessageDto): SentMessage {
    return this.transportService.send(body);
  }

  @Get("messages")
  findAll(): SentMessage[] {
    return this.transportService.findAll();
  }

  @Get("messages/:id")
  findById(@Param("id") id: string): SentMessage {
    const message = this.transportService.findById(id);
    if (!message) {
      throw new NotFoundException(`Message with id "${id}" not found`);
    }
    return message;
  }

  @Get("messages/by-recipient/:recipient")
  findByRecipient(@Param("recipient") recipient: string): SentMessage[] {
    return this.transportService.findByRecipient(recipient);
  }

  @Get("messages/by-template/:templateId")
  findByTemplateId(@Param("templateId") templateId: string): SentMessage[] {
    return this.transportService.findByTemplateId(templateId);
  }

  @Delete("messages")
  clear(): { success: boolean } {
    this.transportService.clear();
    return { success: true };
  }
}
