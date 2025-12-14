import type { IStorage, IRepository, Entry } from "@simple-proto/storage-types";
import type { SentMessage } from "@simple-proto/messaging-types";
import type {
  Campaign,
  CampaignInput,
  CampaignStatus,
  CampaignRunResult,
  CampaignStats,
} from "./types.js";

const DEFAULT_COLLECTION_NAME = "marketing_campaigns";

const CAMPAIGN_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    templateId: { type: "string" },
    entityConfig: { type: "object" },
    variableMappings: { type: "object" },
    status: { type: "string", enum: ["draft", "active", "paused", "completed", "failed"] },
    scheduledAt: {},
    lastRunAt: {},
    stats: { type: "object" },
  },
  required: ["name", "templateId", "entityConfig", "status"],
};

export interface CampaignServiceOptions {
  /** Collection name for storing campaigns. Defaults to "marketing_campaigns" */
  collectionName?: string;
}

/** Interface for message sender (to decouple from specific implementation) */
export interface IMessageSender {
  send(options: {
    templateId: string;
    recipient: string;
    variables?: Record<string, string>;
  }): SentMessage;
}

/**
 * Service for managing marketing campaigns.
 */
export class CampaignService {
  private repo: IRepository<Campaign, CampaignInput>;
  private storage: IStorage;
  private messageSender?: IMessageSender;

  constructor(storage: IStorage, options: CampaignServiceOptions = {}) {
    this.storage = storage;
    const collectionName = options.collectionName ?? DEFAULT_COLLECTION_NAME;

    if (!storage.hasCollection(collectionName)) {
      storage.registerCollection({
        name: collectionName,
        schema: CAMPAIGN_SCHEMA,
      });
    }
    this.repo = storage.getRepository<Campaign, CampaignInput>(collectionName);
  }

  /**
   * Set the message sender for campaign execution
   */
  setMessageSender(sender: IMessageSender): void {
    this.messageSender = sender;
  }

  /**
   * Create a new campaign
   */
  create(input: CampaignInput): Campaign {
    const existing = this.repo.findAll({ name: { eq: input.name } });
    if (existing.length > 0) {
      throw new Error(`Campaign with name "${input.name}" already exists`);
    }
    return this.repo.create({
      ...input,
      status: input.status ?? "draft",
    });
  }

  /**
   * Find a campaign by ID
   */
  findById(id: string): Campaign | null {
    return this.repo.findById(id);
  }

  /**
   * Find a campaign by ID or throw
   */
  findByIdOrThrow(id: string): Campaign {
    return this.repo.findByIdOrThrow(id);
  }

  /**
   * Find all campaigns
   */
  findAll(): Campaign[] {
    return this.repo.findAll();
  }

  /**
   * Find campaigns by status
   */
  findByStatus(status: CampaignStatus): Campaign[] {
    return this.repo.findAll({ status: { eq: status } });
  }

  /**
   * Update a campaign
   */
  update(id: string, data: Campaign): Campaign | null {
    return this.repo.update(id, data);
  }

  /**
   * Update campaign status
   */
  updateStatus(id: string, status: CampaignStatus): Campaign {
    const campaign = this.findByIdOrThrow(id);
    const updated = this.repo.update(id, { ...campaign, status });
    if (!updated) {
      throw new Error(`Failed to update campaign "${id}"`);
    }
    return updated;
  }

  /**
   * Delete a campaign
   */
  delete(id: string): boolean {
    return this.repo.delete(id);
  }

  /**
   * Get the value at a nested path from an object
   */
  private getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  /**
   * Serialize a value to string for template interpolation
   */
  private serializeValue(value: unknown): string {
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return JSON.stringify(value);
  }

  /**
   * Run a campaign - send messages to all matching entities
   */
  run(id: string): CampaignRunResult {
    if (!this.messageSender) {
      throw new Error("Message sender not configured. Call setMessageSender first.");
    }

    const campaign = this.findByIdOrThrow(id);

    if (campaign.status !== "draft" && campaign.status !== "active") {
      throw new Error(`Cannot run campaign with status "${campaign.status}"`);
    }

    const stats: CampaignStats = {
      totalRecipients: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      startedAt: new Date(),
    };
    const errors: string[] = [];

    // Get target entities from storage
    const { collection, filter, recipientField } = campaign.entityConfig;

    if (!this.storage.hasCollection(collection)) {
      throw new Error(`Collection "${collection}" not found`);
    }

    const entityRepo = this.storage.getRepository<Entry & Record<string, unknown>>(collection);
    const entities = filter ? entityRepo.findAll(filter) : entityRepo.findAll();

    stats.totalRecipients = entities.length;

    // Send message to each entity
    for (const entity of entities) {
      const recipient = this.getValueAtPath(entity, recipientField);

      if (typeof recipient !== "string" || !recipient) {
        stats.skipped++;
        continue;
      }

      // Build variables from entity using mappings
      const variables: Record<string, string> = {};
      if (campaign.variableMappings) {
        for (const [templateVar, entityPath] of Object.entries(campaign.variableMappings)) {
          const value = this.getValueAtPath(entity, entityPath);
          if (value !== undefined && value !== null) {
            variables[templateVar] = this.serializeValue(value);
          }
        }
      }

      try {
        this.messageSender.send({
          templateId: campaign.templateId,
          recipient,
          variables,
        });
        stats.sent++;
      } catch (err) {
        stats.failed++;
        errors.push(
          `Failed to send to ${recipient}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    stats.completedAt = new Date();

    // Update campaign with stats
    const newStatus: CampaignStatus = stats.failed === 0 ? "completed" : "failed";
    this.repo.update(id, {
      ...campaign,
      status: newStatus,
      lastRunAt: new Date(),
      stats,
    });

    return {
      campaignId: id,
      success: stats.failed === 0,
      stats,
      ...(errors.length > 0 ? { errors } : {}),
    };
  }

  /**
   * Preview campaign - get list of recipients without sending
   */
  preview(id: string): { recipients: string[]; total: number; skipped: number } {
    const campaign = this.findByIdOrThrow(id);
    const { collection, filter, recipientField } = campaign.entityConfig;

    if (!this.storage.hasCollection(collection)) {
      throw new Error(`Collection "${collection}" not found`);
    }

    const entityRepo = this.storage.getRepository<Entry & Record<string, unknown>>(collection);
    const entities = filter ? entityRepo.findAll(filter) : entityRepo.findAll();

    const recipients: string[] = [];
    let skipped = 0;

    for (const entity of entities) {
      const recipient = this.getValueAtPath(entity, recipientField);
      if (typeof recipient === "string" && recipient) {
        recipients.push(recipient);
      } else {
        skipped++;
      }
    }

    return {
      recipients,
      total: entities.length,
      skipped,
    };
  }
}
