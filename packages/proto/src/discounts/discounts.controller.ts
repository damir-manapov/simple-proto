import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpException,
  HttpStatus,
  HttpCode,
} from "@nestjs/common";
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
import { DiscountsService } from "./discounts.service.js";

// ==================== Discount Controller ====================

@Controller("discounts")
export class DiscountsController {
  constructor(private readonly service: DiscountsService) {}

  @Post()
  create(@Body() input: DiscountInput): Discount {
    return this.service.createDiscount(input);
  }

  @Get()
  list(@Query("status") status?: DiscountStatus): Discount[] {
    return this.service.listDiscounts(status ? { status } : undefined);
  }

  @Get("by-code/:code")
  getByCode(@Param("code") code: string): Discount {
    const discount = this.service.getDiscountByCode(code);
    if (!discount) {
      throw new HttpException("Discount not found", HttpStatus.NOT_FOUND);
    }
    return discount;
  }

  @Get(":id")
  get(@Param("id") id: string): Discount {
    const discount = this.service.getDiscount(id);
    if (!discount) {
      throw new HttpException("Discount not found", HttpStatus.NOT_FOUND);
    }
    return discount;
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() input: Partial<DiscountInput>): Discount {
    const updated = this.service.updateDiscount(id, input);
    if (!updated) {
      throw new HttpException("Discount not found", HttpStatus.NOT_FOUND);
    }
    return updated;
  }

  @Delete(":id")
  delete(@Param("id") id: string): { success: boolean } {
    const deleted = this.service.deleteDiscount(id);
    if (!deleted) {
      throw new HttpException("Discount not found", HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }

  @Post("calculate")
  calculate(
    @Body()
    body: {
      context: CartContext;
      stackingStrategy?: StackingStrategy;
      maxDiscounts?: number;
    },
  ): DiscountResult {
    const options: { stackingStrategy?: StackingStrategy; maxDiscounts?: number } = {};
    if (body.stackingStrategy !== undefined) {
      options.stackingStrategy = body.stackingStrategy;
    }
    if (body.maxDiscounts !== undefined) {
      options.maxDiscounts = body.maxDiscounts;
    }
    return this.service.calculateDiscounts(body.context, options);
  }

  @Post("validate")
  validate(@Body() input: CodeValidationInput): CodeValidationResult {
    return this.service.validateCode(input);
  }
}

// ==================== Usage Controller ====================

@Controller("discount-usages")
export class UsageController {
  constructor(private readonly service: DiscountsService) {}

  @Post()
  record(@Body() input: DiscountUsageInput): DiscountUsage {
    return this.service.recordUsage(input);
  }

  @Get("count")
  getCount(
    @Query("discountId") discountId: string,
    @Query("customerId") customerId: string,
  ): { count: number } {
    if (!discountId || !customerId) {
      throw new HttpException("discountId and customerId are required", HttpStatus.BAD_REQUEST);
    }
    const count = this.service.getCustomerUsageCount(discountId, customerId);
    return { count };
  }
}

// ==================== Generated Codes Controller ====================

@Controller("discount-codes")
export class GeneratedCodesController {
  constructor(private readonly service: DiscountsService) {}

  @Post()
  generate(
    @Body()
    body: { discountId: string; count: number; options?: CodeGenerationOptions },
  ): { codes: GeneratedCode[] } {
    try {
      const codes = this.service.generateCodeBatch(
        body.discountId,
        body.count,
        body.options ?? { pattern: "alphanumeric", length: 8 },
      );
      return { codes };
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "Failed to generate codes",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post("validate")
  @HttpCode(200)
  validate(@Body() body: CodeValidationInput): CodeValidationResult {
    return this.service.validateCode(body);
  }

  @Get()
  list(@Query("discountId") discountId: string): { codes: GeneratedCode[] } {
    if (!discountId) {
      throw new HttpException("discountId is required", HttpStatus.BAD_REQUEST);
    }
    const codes = this.service.getGeneratedCodesForDiscount(discountId);
    return { codes };
  }

  @Get(":code")
  get(@Param("code") code: string): GeneratedCode {
    const generated = this.service.getGeneratedCode(code);
    if (!generated) {
      throw new HttpException("Code not found", HttpStatus.NOT_FOUND);
    }
    return generated;
  }

  @Post(":code/redeem")
  @HttpCode(200)
  redeem(
    @Param("code") code: string,
    @Body() body: { customerId: string; orderId?: string },
  ): { success: boolean; code: GeneratedCode } {
    const generated = this.service.getGeneratedCode(code);
    if (!generated) {
      throw new HttpException("Code not found", HttpStatus.NOT_FOUND);
    }
    try {
      const redeemed = this.service.redeemCode(
        code,
        body.customerId,
        body.orderId ?? `order-${String(Date.now())}`,
      );
      if (!redeemed) {
        throw new HttpException("Code not found", HttpStatus.NOT_FOUND);
      }
      return { success: true, code: redeemed };
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "Failed to redeem code",
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
