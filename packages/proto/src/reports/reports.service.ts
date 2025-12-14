import { Injectable } from "@nestjs/common";
import { ReportService } from "@simple-proto/reports";
import type {
  Report,
  ReportInput,
  ReportStatus,
  ReportResult,
  AggregateReportResult,
} from "@simple-proto/reports-types";
import { StorageService } from "../storage/storage.service.js";

@Injectable()
export class ReportsService {
  private reportService: ReportService;

  constructor(storage: StorageService) {
    this.reportService = new ReportService(storage);
  }

  create(input: ReportInput): Report {
    return this.reportService.create(input);
  }

  get(id: string): Report | undefined {
    return this.reportService.get(id);
  }

  getAll(): Report[] {
    return this.reportService.getAll();
  }

  getByStatus(status: ReportStatus): Report[] {
    return this.reportService.getByStatus(status);
  }

  update(id: string, input: Partial<ReportInput>): Report {
    return this.reportService.update(id, input);
  }

  updateStatus(id: string, status: ReportStatus): Report {
    return this.reportService.updateStatus(id, status);
  }

  delete(id: string): boolean {
    return this.reportService.delete(id);
  }

  execute(id: string): ReportResult | AggregateReportResult {
    return this.reportService.execute(id);
  }

  preview(input: ReportInput): ReportResult | AggregateReportResult {
    return this.reportService.preview(input);
  }
}
