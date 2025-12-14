import { Injectable } from "@nestjs/common";
import { CampaignService } from "@simple-proto/marketing-campaigns";
import type {
  Campaign,
  CampaignInput,
  CampaignStatus,
  CampaignRunResult,
  IMessageSender,
} from "@simple-proto/marketing-campaigns-types";
import { StorageService } from "../storage/storage.service.js";
import { SentMessageService } from "../messaging/sent-message.service.js";

@Injectable()
export class CampaignsService {
  private campaignService: CampaignService;

  constructor(
    storage: StorageService,
    private readonly sentMessageService: SentMessageService
  ) {
    this.campaignService = new CampaignService(storage);

    // Wire up the sent message service as the message sender
    const sender: IMessageSender = {
      send: (options) => this.sentMessageService.send(options),
    };
    this.campaignService.setMessageSender(sender);
  }

  create(input: CampaignInput): Campaign {
    return this.campaignService.create(input);
  }

  findById(id: string): Campaign | null {
    return this.campaignService.findById(id);
  }

  findByIdOrThrow(id: string): Campaign {
    return this.campaignService.findByIdOrThrow(id);
  }

  findAll(): Campaign[] {
    return this.campaignService.findAll();
  }

  findByStatus(status: CampaignStatus): Campaign[] {
    return this.campaignService.findByStatus(status);
  }

  update(id: string, data: Campaign): Campaign | null {
    return this.campaignService.update(id, data);
  }

  updateStatus(id: string, status: CampaignStatus): Campaign {
    return this.campaignService.updateStatus(id, status);
  }

  delete(id: string): boolean {
    return this.campaignService.delete(id);
  }

  clear(): void {
    this.campaignService.clear();
  }

  run(id: string): CampaignRunResult {
    return this.campaignService.run(id);
  }

  preview(id: string): { recipients: string[]; total: number; skipped: number } {
    return this.campaignService.preview(id);
  }
}
