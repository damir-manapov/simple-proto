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
import { ReportsService } from "./reports.service.js";
import type {
  Report,
  ReportInput,
  ReportStatus,
  ReportResult,
  AggregateReportResult,
} from "@simple-proto/reports-types";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  create(@Body() input: ReportInput): Report {
    return this.reportsService.create(input);
  }

  @Get()
  getAll(@Query("status") status?: ReportStatus): Report[] {
    if (status) {
      return this.reportsService.getByStatus(status);
    }
    return this.reportsService.getAll();
  }

  @Get(":id")
  get(@Param("id") id: string): Report {
    const report = this.reportsService.get(id);
    if (!report) {
      throw new NotFoundException(`Report not found: ${id}`);
    }
    return report;
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() input: Partial<ReportInput>): Report {
    const report = this.reportsService.get(id);
    if (!report) {
      throw new NotFoundException(`Report not found: ${id}`);
    }
    return this.reportsService.update(id, input);
  }

  @Put(":id/status")
  updateStatus(@Param("id") id: string, @Body("status") status: ReportStatus): Report {
    const report = this.reportsService.get(id);
    if (!report) {
      throw new NotFoundException(`Report not found: ${id}`);
    }
    return this.reportsService.updateStatus(id, status);
  }

  @Delete(":id")
  delete(@Param("id") id: string): { deleted: boolean } {
    const deleted = this.reportsService.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Report not found: ${id}`);
    }
    return { deleted: true };
  }

  @Post(":id/execute")
  execute(@Param("id") id: string): ReportResult | AggregateReportResult {
    const report = this.reportsService.get(id);
    if (!report) {
      throw new NotFoundException(`Report not found: ${id}`);
    }
    return this.reportsService.execute(id);
  }

  @Post("preview")
  preview(@Body() input: ReportInput): ReportResult | AggregateReportResult {
    return this.reportsService.preview(input);
  }
}
