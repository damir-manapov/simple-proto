import { Controller, Get, Post, Put, Delete, Body, Param, NotFoundException } from "@nestjs/common";
import { MessagingService } from "./messaging.service.js";
import type {
  MessageTemplate,
  MessageTemplateInput,
  RenderedMessage,
} from "./messaging.service.js";

interface RenderDto {
  variables?: Record<string, string>;
}

@Controller("messaging")
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post("templates")
  create(@Body() body: MessageTemplateInput): MessageTemplate {
    return this.messagingService.create(body);
  }

  @Get("templates")
  findAll(): MessageTemplate[] {
    return this.messagingService.findAll();
  }

  @Get("templates/by-name/:name")
  findByName(@Param("name") name: string): MessageTemplate {
    const template = this.messagingService.findByName(name);
    if (!template) {
      throw new NotFoundException(`Template "${name}" not found`);
    }
    return template;
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
    return this.messagingService.renderById(id, body.variables ?? {});
  }

  @Get("templates/:id/variables")
  extractVariables(@Param("id") id: string): { variables: string[] } {
    return { variables: this.messagingService.extractVariablesById(id) };
  }
}
