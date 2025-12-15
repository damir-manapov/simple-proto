import { Injectable } from "@nestjs/common";
import { DiscountService } from "@simple-proto/discounts";
import type {
  Discount,
  DiscountInput,
  DiscountStatus,
  CartContext,
  DiscountResult,
  StackingStrategy,
  DiscountUsage,
  DiscountUsageInput,
  CodeGenerationOptions,
  GeneratedCode,
  CodeValidationInput,
  CodeValidationResult,
} from "@simple-proto/discounts-types";
import { StorageService } from "../storage/storage.service.js";

@Injectable()
export class DiscountsService {
  private discountService: DiscountService;

  constructor(storage: StorageService) {
    this.discountService = new DiscountService(storage);
  }

  // ==================== Discount CRUD ====================

  createDiscount(input: DiscountInput): Discount {
    return this.discountService.createDiscount(input);
  }

  getDiscount(id: string): Discount | null {
    return this.discountService.getDiscount(id);
  }

  getDiscountByCode(code: string): Discount | null {
    return this.discountService.getDiscountByCode(code);
  }

  listDiscounts(filter?: { status?: DiscountStatus }): Discount[] {
    return this.discountService.listDiscounts(filter);
  }

  updateDiscount(id: string, input: Partial<DiscountInput>): Discount | null {
    return this.discountService.updateDiscount(id, input);
  }

  deleteDiscount(id: string): boolean {
    return this.discountService.deleteDiscount(id);
  }

  // ==================== Discount Evaluation ====================

  calculateDiscounts(
    context: CartContext,
    options?: { stackingStrategy?: StackingStrategy; maxDiscounts?: number }
  ): DiscountResult {
    if (!options) {
      return this.discountService.calculateDiscounts(context);
    }
    const calcOptions: { stackingStrategy: StackingStrategy; maxDiscountsToApply?: number } = {
      stackingStrategy: options.stackingStrategy ?? "all",
    };
    if (options.maxDiscounts !== undefined) {
      calcOptions.maxDiscountsToApply = options.maxDiscounts;
    }
    return this.discountService.calculateDiscounts(context, calcOptions);
  }

  // ==================== Usage Tracking ====================

  recordUsage(input: DiscountUsageInput): DiscountUsage {
    return this.discountService.recordUsage(input);
  }

  getCustomerUsageCount(discountId: string, customerId: string): number {
    return this.discountService.getCustomerUsage(discountId, customerId);
  }

  // ==================== Code Generation ====================

  generateCode(discountId: string, options: CodeGenerationOptions): string {
    return this.discountService.generateCode(discountId, options);
  }

  generateCodeBatch(
    discountId: string,
    count: number,
    options: CodeGenerationOptions
  ): GeneratedCode[] {
    return this.discountService.generateCodeBatch(discountId, count, options);
  }

  getGeneratedCode(code: string): GeneratedCode | null {
    return this.discountService.getGeneratedCode(code);
  }

  getGeneratedCodesForDiscount(discountId: string): GeneratedCode[] {
    return this.discountService.getGeneratedCodesForDiscount(discountId);
  }

  redeemCode(code: string, customerId: string, orderId: string): GeneratedCode | null {
    return this.discountService.redeemGeneratedCode(code, customerId, orderId);
  }

  // ==================== Code Validation ====================

  validateCode(input: CodeValidationInput): CodeValidationResult {
    return this.discountService.validateCode(input);
  }
}
