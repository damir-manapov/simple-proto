import type { Entry, EntryInput, Filter } from "@simple-proto/storage-types";
import type { SentMessage } from "@simple-proto/messaging-types";

/** Campaign status */
export type CampaignStatus = "draft" | "active" | "paused" | "completed" | "failed";

/** Configuration for resolving target entities */
export interface EntityConfig {
  /** Collection name to query */
  collection: string;
  /** Filter to apply when querying entities */
  filter?: Filter<Record<string, unknown>>;
  /** Path to the email/recipient field (e.g., "email" or "contact.email") */
  recipientField: string;
}

/** Campaign entity */
export interface Campaign extends Entry {
  /** Campaign name */
  name: string;
  /** Campaign description */
  description?: string;
  /** Template ID to use for sending */
  templateId: string;
  /** Entity configuration */
  entityConfig: EntityConfig;
  /** Variable mappings: template variable -> entity field path */
  variableMappings?: Record<string, string>;
  /** Campaign status */
  status: CampaignStatus;
  /** Scheduled execution time */
  scheduledAt?: Date;
  /** When the campaign was last run */
  lastRunAt?: Date;
  /** Statistics from the last run */
  stats?: CampaignStats;
}

/** Input for creating a campaign */
export interface CampaignInput extends EntryInput {
  name: string;
  description?: string;
  templateId: string;
  entityConfig: EntityConfig;
  variableMappings?: Record<string, string>;
  status?: CampaignStatus;
  scheduledAt?: Date;
}

/** Campaign execution statistics */
export interface CampaignStats {
  /** Total recipients found */
  totalRecipients: number;
  /** Successfully sent */
  sent: number;
  /** Failed to send */
  failed: number;
  /** Skipped (e.g., no email) */
  skipped: number;
  /** Execution start time */
  startedAt: Date;
  /** Execution end time */
  completedAt?: Date;
}

/** Result of running a campaign */
export interface CampaignRunResult {
  campaignId: string;
  success: boolean;
  stats: CampaignStats;
  errors?: string[];
}

/** Interface for message sender (to decouple from specific implementation) */
export interface IMessageSender {
  send(options: {
    templateId: string;
    recipient: string;
    variables?: Record<string, string>;
  }): SentMessage;
}
