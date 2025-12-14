import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  NotFoundException,
} from "@nestjs/common";
import { CampaignsService } from "./campaigns.service.js";
import type {
  Campaign,
  CampaignInput,
  CampaignStatus,
  CampaignRunResult,
} from "@simple-proto/marketing-campaigns-types";

@Controller("campaigns")
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  create(@Body() input: CampaignInput): Campaign {
    return this.campaignsService.create(input);
  }

  @Get()
  findAll(@Query("status") status?: CampaignStatus): Campaign[] {
    if (status) {
      return this.campaignsService.findByStatus(status);
    }
    return this.campaignsService.findAll();
  }

  @Get(":id")
  findById(@Param("id") id: string): Campaign {
    const campaign = this.campaignsService.findById(id);
    if (!campaign) {
      throw new NotFoundException(`Campaign "${id}" not found`);
    }
    return campaign;
  }

  @Get(":id/preview")
  preview(@Param("id") id: string): { recipients: string[]; total: number; skipped: number } {
    return this.campaignsService.preview(id);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() data: Campaign): Campaign {
    const updated = this.campaignsService.update(id, data);
    if (!updated) {
      throw new NotFoundException(`Campaign "${id}" not found`);
    }
    return updated;
  }

  @Put(":id/status")
  updateStatus(@Param("id") id: string, @Body() body: { status: CampaignStatus }): Campaign {
    return this.campaignsService.updateStatus(id, body.status);
  }

  @Post(":id/run")
  run(@Param("id") id: string): CampaignRunResult {
    return this.campaignsService.run(id);
  }

  @Delete(":id")
  delete(@Param("id") id: string): { deleted: boolean } {
    const deleted = this.campaignsService.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Campaign "${id}" not found`);
    }
    return { deleted };
  }

  @Delete()
  clear(): { success: boolean } {
    this.campaignsService.clear();
    return { success: true };
  }
}
