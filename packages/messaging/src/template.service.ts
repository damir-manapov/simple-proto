import type { IStorage, IRepository } from "@simple-proto/storage";
import type { MessageTemplate, MessageTemplateInput, RenderedMessage } from "./types.js";

const DEFAULT_COLLECTION_NAME = "message_templates";

const TEMPLATE_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    subject: { type: "string" },
    body: { type: "string" },
    type: { type: "string", enum: ["email", "sms", "push", "webhook"] },
    metadata: { type: "object" },
  },
  required: ["name", "body", "type"],
};

export interface TemplateServiceOptions {
  /** Collection name for storing templates. Defaults to "message_templates" */
  collectionName?: string;
}

/**
 * Service for managing message templates.
 * Templates support variable interpolation using {{variableName}} syntax.
 */
export class TemplateService {
  private repo: IRepository<MessageTemplate, MessageTemplateInput>;

  constructor(storage: IStorage, options: TemplateServiceOptions = {}) {
    const collectionName = options.collectionName ?? DEFAULT_COLLECTION_NAME;

    // Register collection if not already registered
    if (!storage.hasCollection(collectionName)) {
      storage.registerCollection({
        name: collectionName,
        schema: TEMPLATE_SCHEMA,
      });
    }
    this.repo = storage.getRepository<MessageTemplate, MessageTemplateInput>(collectionName);
  }

  /**
   * Create a new message template.
   */
  create(input: MessageTemplateInput): MessageTemplate {
    // Check for duplicate name
    const existing = this.findByName(input.name);
    if (existing) {
      throw new Error(`Template with name "${input.name}" already exists`);
    }
    return this.repo.create(input);
  }

  /**
   * Find a template by ID.
   */
  findById(id: string): MessageTemplate | null {
    return this.repo.findById(id);
  }

  /**
   * Find a template by name.
   */
  findByName(name: string): MessageTemplate | null {
    const templates = this.repo.findAll({ name: { eq: name } });
    return templates[0] ?? null;
  }

  /**
   * Find a template by name or throw if not found.
   */
  findByNameOrThrow(name: string): MessageTemplate {
    const template = this.findByName(name);
    if (!template) {
      throw new Error(`Template "${name}" not found`);
    }
    return template;
  }

  /**
   * Get all templates.
   */
  findAll(): MessageTemplate[] {
    return this.repo.findAll();
  }

  /**
   * Get all templates of a specific type.
   */
  findByType(type: MessageTemplate["type"]): MessageTemplate[] {
    return this.repo.findAll({ type: { eq: type } });
  }

  /**
   * Update a template.
   */
  update(id: string, data: MessageTemplate): MessageTemplate | null {
    return this.repo.update(id, data);
  }

  /**
   * Delete a template.
   */
  delete(id: string): boolean {
    return this.repo.delete(id);
  }

  /**
   * Render a template with the given variables.
   * Replaces {{variableName}} with the corresponding value.
   */
  render(templateName: string, variables: Record<string, string> = {}): RenderedMessage {
    const template = this.findByNameOrThrow(templateName);

    const renderText = (text: string): string => {
      return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
        return variables[key] ?? `{{${key}}}`;
      });
    };

    const result: RenderedMessage = {
      templateId: template.id,
      templateName: template.name,
      type: template.type,
      body: renderText(template.body),
      variables,
    };

    if (template.subject) {
      result.subject = renderText(template.subject);
    }

    return result;
  }

  /**
   * Extract variable names from a template body.
   */
  extractVariables(templateName: string): string[] {
    const template = this.findByNameOrThrow(templateName);
    const allText = `${template.subject ?? ""} ${template.body}`;
    const matches = allText.matchAll(/\{\{(\w+)\}\}/g);
    const variables = new Set<string>();
    for (const match of matches) {
      if (match[1]) {
        variables.add(match[1]);
      }
    }
    return [...variables];
  }

  /**
   * Clear all templates.
   */
  clear(): void {
    this.repo.clear();
  }
}
