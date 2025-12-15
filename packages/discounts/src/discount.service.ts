/**
 * Discount service - CRUD operations and usage tracking
 */

import type { IStorage, Entry, EntryInput } from "@simple-proto/storage-types";
import type {
  Discount,
  DiscountInput,
  DiscountUsage,
  DiscountUsageInput,
  DiscountStatus,
  StackingBehavior,
  DiscountTarget,
  DiscountValue,
  DiscountCondition,
  CartContext,
  CartItem,
  DiscountResult,
  CalculationOptions,
  CodeGenerationOptions,
  GeneratedCode,
  CodeValidationResult,
  CodeValidationInput,
} from "@simple-proto/discounts-types";
import { DiscountEvaluator } from "./discount-evaluator.js";
import { CodeGenerator } from "./code-generator.js";
import { ConditionEvaluator } from "./condition-evaluator.js";

interface DiscountEntry extends Entry {
  name: string;
  description?: string;
  code?: string;
  target: DiscountTarget;
  value: DiscountValue;
  conditions: DiscountCondition[];
  priority: number;
  stacking: StackingBehavior;
  usageLimit?: number;
  usageLimitPerCustomer?: number;
  currentUsage: number;
  validFrom?: string;
  validUntil?: string;
  status: DiscountStatus;
  createdAt: string;
  updatedAt: string;
}

interface DiscountEntryInput extends EntryInput {
  name: string;
  description?: string;
  code?: string;
  target: DiscountTarget;
  value: DiscountValue;
  conditions?: DiscountCondition[];
  priority?: number;
  stacking?: StackingBehavior;
  usageLimit?: number;
  usageLimitPerCustomer?: number;
  currentUsage?: number;
  validFrom?: string;
  validUntil?: string;
  status?: DiscountStatus;
  createdAt?: string;
  updatedAt?: string;
}

interface UsageEntry extends Entry {
  discountId: string;
  customerId?: string;
  orderId: string;
  amount: number;
  usedAt: string;
}

interface UsageEntryInput extends EntryInput {
  discountId: string;
  customerId?: string;
  orderId: string;
  amount: number;
  usedAt?: string;
}

interface GeneratedCodeEntry extends Entry {
  code: string;
  discountId: string;
  usedBy?: string;
  usedAt?: string;
  orderId?: string;
  createdAt: string;
}

interface GeneratedCodeEntryInput extends EntryInput {
  code: string;
  discountId: string;
  createdAt?: string;
}

const DISCOUNT_COLLECTION = "discounts";
const USAGE_COLLECTION = "discount_usage";
const GENERATED_CODES_COLLECTION = "generated_codes";

/**
 * Service for managing discounts
 */
export class DiscountService {
  private readonly storage: IStorage;
  private readonly evaluator: DiscountEvaluator;
  private readonly codeGenerator: CodeGenerator;
  private readonly conditionEvaluator: ConditionEvaluator;
  private initialized = false;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.evaluator = new DiscountEvaluator();
    this.codeGenerator = new CodeGenerator();
    this.conditionEvaluator = new ConditionEvaluator();
  }

  private ensureInitialized(): void {
    if (this.initialized) return;

    if (!this.storage.hasCollection(DISCOUNT_COLLECTION)) {
      this.storage.registerCollection({
        name: DISCOUNT_COLLECTION,
        schema: { type: "object" },
      });
    }

    if (!this.storage.hasCollection(USAGE_COLLECTION)) {
      this.storage.registerCollection({
        name: USAGE_COLLECTION,
        schema: { type: "object" },
      });
    }

    if (!this.storage.hasCollection(GENERATED_CODES_COLLECTION)) {
      this.storage.registerCollection({
        name: GENERATED_CODES_COLLECTION,
        schema: { type: "object" },
      });
    }

    this.initialized = true;
  }

  // ==================== CRUD Operations ====================

  createDiscount(input: DiscountInput): Discount {
    this.ensureInitialized();
    const repo = this.storage.getRepository<DiscountEntry, DiscountEntryInput>(DISCOUNT_COLLECTION);

    const now = new Date().toISOString();
    const entryInput: DiscountEntryInput = {
      name: input.name,
      target: input.target,
      value: input.value,
      conditions: input.conditions ?? [],
      priority: input.priority ?? 0,
      stacking: input.stacking ?? "stackable",
      currentUsage: 0,
      status: input.status ?? "active",
      createdAt: now,
      updatedAt: now,
    };

    if (input.id) entryInput.id = input.id;
    if (input.description) entryInput.description = input.description;
    if (input.code) entryInput.code = input.code;
    if (input.usageLimit !== undefined) entryInput.usageLimit = input.usageLimit;
    if (input.usageLimitPerCustomer !== undefined)
      entryInput.usageLimitPerCustomer = input.usageLimitPerCustomer;
    if (input.validFrom) entryInput.validFrom = input.validFrom.toISOString();
    if (input.validUntil) entryInput.validUntil = input.validUntil.toISOString();

    const entry = repo.create(entryInput);
    return this.entryToDiscount(entry);
  }

  getDiscount(id: string): Discount | null {
    this.ensureInitialized();
    const repo = this.storage.getRepository<DiscountEntry>(DISCOUNT_COLLECTION);
    const entry = repo.findById(id);
    return entry ? this.entryToDiscount(entry) : null;
  }

  getDiscountByCode(code: string): Discount | null {
    this.ensureInitialized();
    const repo = this.storage.getRepository<DiscountEntry>(DISCOUNT_COLLECTION);
    const entries = repo.findAll({ code: { eq: code } });
    const entry = entries[0];
    return entry ? this.entryToDiscount(entry) : null;
  }

  listDiscounts(filter?: { status?: DiscountStatus }): Discount[] {
    this.ensureInitialized();
    const repo = this.storage.getRepository<DiscountEntry>(DISCOUNT_COLLECTION);

    let entries: DiscountEntry[];
    if (filter?.status) {
      entries = repo.findAll({ status: { eq: filter.status } });
    } else {
      entries = repo.findAll();
    }

    return entries.map((e) => this.entryToDiscount(e));
  }

  updateDiscount(id: string, input: Partial<DiscountInput>): Discount | null {
    this.ensureInitialized();
    const repo = this.storage.getRepository<DiscountEntry, DiscountEntryInput>(DISCOUNT_COLLECTION);

    const existing = repo.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();

    // Build merged entry
    const merged: DiscountEntry = {
      ...existing,
      updatedAt: now,
    };

    if (input.name !== undefined) merged.name = input.name;
    if (input.description !== undefined) merged.description = input.description;
    if (input.code !== undefined) merged.code = input.code;
    if (input.target !== undefined) merged.target = input.target;
    if (input.value !== undefined) merged.value = input.value;
    if (input.conditions !== undefined) merged.conditions = input.conditions;
    if (input.priority !== undefined) merged.priority = input.priority;
    if (input.stacking !== undefined) merged.stacking = input.stacking;
    if (input.usageLimit !== undefined) merged.usageLimit = input.usageLimit;
    if (input.usageLimitPerCustomer !== undefined)
      merged.usageLimitPerCustomer = input.usageLimitPerCustomer;
    if (input.validFrom !== undefined) merged.validFrom = input.validFrom.toISOString();
    if (input.validUntil !== undefined) merged.validUntil = input.validUntil.toISOString();
    if (input.status !== undefined) merged.status = input.status;

    const updated = repo.update(id, merged);
    return updated ? this.entryToDiscount(updated) : null;
  }

  deleteDiscount(id: string): boolean {
    this.ensureInitialized();
    const repo = this.storage.getRepository<DiscountEntry>(DISCOUNT_COLLECTION);
    return repo.delete(id);
  }

  // ==================== Discount Evaluation ====================

  /**
   * Calculate discounts for a cart
   */
  calculateDiscounts(context: CartContext, options?: Partial<CalculationOptions>): DiscountResult {
    this.ensureInitialized();
    const discounts = this.listDiscounts({ status: "active" });
    return this.evaluator.evaluate(discounts, context, options);
  }

  // ==================== Usage Tracking ====================

  /**
   * Record discount usage
   */
  recordUsage(input: DiscountUsageInput): DiscountUsage {
    this.ensureInitialized();
    const usageRepo = this.storage.getRepository<UsageEntry, UsageEntryInput>(USAGE_COLLECTION);
    const discountRepo = this.storage.getRepository<DiscountEntry>(DISCOUNT_COLLECTION);

    // Create usage record
    const entry = usageRepo.create({
      discountId: input.discountId,
      orderId: input.orderId,
      amount: input.amount,
      usedAt: new Date().toISOString(),
      ...(input.customerId !== undefined && { customerId: input.customerId }),
    });

    // Increment usage count on discount
    const discount = discountRepo.findById(input.discountId);
    if (discount) {
      discountRepo.update(input.discountId, {
        ...discount,
        currentUsage: discount.currentUsage + 1,
      });
    }

    return this.usageEntryToUsage(entry);
  }

  /**
   * Get usage count for a customer on a specific discount
   */
  getCustomerUsage(discountId: string, customerId: string): number {
    this.ensureInitialized();
    const repo = this.storage.getRepository<UsageEntry>(USAGE_COLLECTION);
    const entries = repo.findAll({
      discountId: { eq: discountId },
      customerId: { eq: customerId },
    });
    return entries.length;
  }

  /**
   * Get all usage records for a discount
   */
  getDiscountUsage(discountId: string): DiscountUsage[] {
    this.ensureInitialized();
    const repo = this.storage.getRepository<UsageEntry>(USAGE_COLLECTION);
    const entries = repo.findAll({ discountId: { eq: discountId } });
    return entries.map((e) => this.usageEntryToUsage(e));
  }

  // ==================== Code Generation ====================

  /**
   * Generate a single promo code for a discount
   */
  generateCode(discountId: string, options: CodeGenerationOptions): string {
    this.ensureInitialized();

    const discount = this.getDiscount(discountId);
    if (!discount) {
      throw new Error(`Discount ${discountId} not found`);
    }

    const existingCodes = this.getAllCodes();
    let code: string;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      code = this.codeGenerator.generate(options);
      attempts++;
    } while (existingCodes.has(code) && attempts < maxAttempts);

    if (existingCodes.has(code)) {
      throw new Error("Could not generate unique code after max attempts");
    }

    // Store the generated code
    const repo = this.storage.getRepository<GeneratedCodeEntry, GeneratedCodeEntryInput>(
      GENERATED_CODES_COLLECTION
    );
    repo.create({
      code,
      discountId,
      createdAt: new Date().toISOString(),
    });

    return code;
  }

  /**
   * Generate batch of promo codes for a discount
   */
  generateCodeBatch(
    discountId: string,
    count: number,
    options: CodeGenerationOptions
  ): GeneratedCode[] {
    this.ensureInitialized();

    const discount = this.getDiscount(discountId);
    if (!discount) {
      throw new Error(`Discount ${discountId} not found`);
    }

    const existingCodes = this.getAllCodes();
    const codes = this.codeGenerator.generateBatch(count, options, existingCodes);

    const repo = this.storage.getRepository<GeneratedCodeEntry, GeneratedCodeEntryInput>(
      GENERATED_CODES_COLLECTION
    );
    const now = new Date().toISOString();

    const entries: GeneratedCode[] = [];
    for (const code of codes) {
      const entry = repo.create({
        code,
        discountId,
        createdAt: now,
      });
      entries.push(this.generatedCodeEntryToGeneratedCode(entry));
    }

    return entries;
  }

  /**
   * Get generated code by code string
   */
  getGeneratedCode(code: string): GeneratedCode | null {
    this.ensureInitialized();
    const repo = this.storage.getRepository<GeneratedCodeEntry>(GENERATED_CODES_COLLECTION);
    const entries = repo.findAll({ code: { eq: code } });
    const entry = entries[0];
    return entry ? this.generatedCodeEntryToGeneratedCode(entry) : null;
  }

  /**
   * Get all generated codes for a discount
   */
  getGeneratedCodesForDiscount(discountId: string): GeneratedCode[] {
    this.ensureInitialized();
    const repo = this.storage.getRepository<GeneratedCodeEntry>(GENERATED_CODES_COLLECTION);
    const entries = repo.findAll({ discountId: { eq: discountId } });
    return entries.map((e) => this.generatedCodeEntryToGeneratedCode(e));
  }

  /**
   * Mark a generated code as used
   */
  redeemGeneratedCode(code: string, customerId: string, orderId: string): GeneratedCode | null {
    this.ensureInitialized();
    const repo = this.storage.getRepository<GeneratedCodeEntry>(GENERATED_CODES_COLLECTION);
    const entries = repo.findAll({ code: { eq: code } });
    const entry = entries[0];

    if (!entry) return null;
    if (entry.usedBy) {
      throw new Error(`Code ${code} has already been redeemed`);
    }

    const updated = repo.update(entry.id, {
      ...entry,
      usedBy: customerId,
      usedAt: new Date().toISOString(),
      orderId,
    });

    return updated ? this.generatedCodeEntryToGeneratedCode(updated) : null;
  }

  // ==================== Code Validation ====================

  /**
   * Validate a promo code
   */
  validateCode(input: CodeValidationInput): CodeValidationResult {
    this.ensureInitialized();

    // First check generated codes
    const generatedCode = this.getGeneratedCode(input.code);
    if (generatedCode) {
      if (generatedCode.usedBy) {
        return {
          valid: false,
          reason: "Code has already been redeemed",
        };
      }

      const discount = this.getDiscount(generatedCode.discountId);
      if (!discount) {
        return {
          valid: false,
          reason: "Discount no longer exists",
        };
      }

      return this.validateDiscountForCode(discount, input);
    }

    // Check regular discount codes
    const discount = this.getDiscountByCode(input.code);
    if (!discount) {
      return {
        valid: false,
        reason: "Invalid code",
      };
    }

    return this.validateDiscountForCode(discount, input);
  }

  private validateDiscountForCode(
    discount: Discount,
    input: CodeValidationInput
  ): CodeValidationResult {
    const now = new Date();
    const conditionsNotMet: string[] = [];

    // Check status
    if (discount.status !== "active") {
      return {
        valid: false,
        discount,
        reason: `Discount is ${discount.status}`,
        isInactive: discount.status === "inactive",
        isExpired: discount.status === "expired",
      };
    }

    // Check validity period
    if (discount.validFrom && now < discount.validFrom) {
      return {
        valid: false,
        discount,
        reason: "Discount is not yet active",
      };
    }

    if (discount.validUntil && now > discount.validUntil) {
      return {
        valid: false,
        discount,
        reason: "Discount has expired",
        isExpired: true,
      };
    }

    // Check usage limit
    if (discount.usageLimit && discount.currentUsage >= discount.usageLimit) {
      return {
        valid: false,
        discount,
        reason: "Usage limit reached",
        usageLimitReached: true,
      };
    }

    // Check customer usage limit
    if (input.customerId && discount.usageLimitPerCustomer) {
      const customerUsage = this.getCustomerUsage(discount.id, input.customerId);
      if (customerUsage >= discount.usageLimitPerCustomer) {
        return {
          valid: false,
          discount,
          reason: "Customer usage limit reached",
          customerUsageLimitReached: true,
        };
      }
    }

    // Check conditions if context provided
    if (input.context && discount.conditions.length > 0) {
      const items: CartItem[] = [];
      if (input.context.items) {
        for (const i of input.context.items) {
          const item: CartItem = {
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: 0, // Not needed for validation
          };
          if (i.categoryId !== undefined) {
            item.categoryId = i.categoryId;
          }
          items.push(item);
        }
      }

      const cartContext: CartContext = {
        items,
        appliedCodes: [input.code],
      };
      if (input.customerId) {
        cartContext.customer = { id: input.customerId };
      }

      for (const condition of discount.conditions) {
        if (!this.conditionEvaluator.evaluate(condition, cartContext)) {
          conditionsNotMet.push(condition.type);
        }
      }

      if (conditionsNotMet.length > 0) {
        return {
          valid: false,
          discount,
          reason: "Conditions not met",
          conditionsNotMet,
        };
      }
    }

    return {
      valid: true,
      discount,
    };
  }

  private getAllCodes(): Set<string> {
    const codes = new Set<string>();

    // Get all discount codes
    const discounts = this.listDiscounts();
    for (const d of discounts) {
      if (d.code) codes.add(d.code);
    }

    // Get all generated codes
    const repo = this.storage.getRepository<GeneratedCodeEntry>(GENERATED_CODES_COLLECTION);
    const generatedCodes = repo.findAll({});
    for (const gc of generatedCodes) {
      codes.add(gc.code);
    }

    return codes;
  }

  // ==================== Helpers ====================

  private entryToDiscount(entry: DiscountEntry): Discount {
    return {
      id: entry.id,
      name: entry.name,
      target: entry.target,
      value: entry.value,
      conditions: entry.conditions,
      priority: entry.priority,
      stacking: entry.stacking,
      currentUsage: entry.currentUsage,
      status: entry.status,
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt),
      ...(entry.description !== undefined && { description: entry.description }),
      ...(entry.code !== undefined && { code: entry.code }),
      ...(entry.usageLimit !== undefined && { usageLimit: entry.usageLimit }),
      ...(entry.usageLimitPerCustomer !== undefined && {
        usageLimitPerCustomer: entry.usageLimitPerCustomer,
      }),
      ...(entry.validFrom !== undefined && { validFrom: new Date(entry.validFrom) }),
      ...(entry.validUntil !== undefined && { validUntil: new Date(entry.validUntil) }),
    };
  }

  private usageEntryToUsage(entry: UsageEntry): DiscountUsage {
    return {
      id: entry.id,
      discountId: entry.discountId,
      orderId: entry.orderId,
      amount: entry.amount,
      usedAt: new Date(entry.usedAt),
      ...(entry.customerId !== undefined && { customerId: entry.customerId }),
    };
  }

  private generatedCodeEntryToGeneratedCode(entry: GeneratedCodeEntry): GeneratedCode {
    return {
      id: entry.id,
      code: entry.code,
      discountId: entry.discountId,
      createdAt: new Date(entry.createdAt),
      ...(entry.usedBy !== undefined && { usedBy: entry.usedBy }),
      ...(entry.usedAt !== undefined && { usedAt: new Date(entry.usedAt) }),
      ...(entry.orderId !== undefined && { orderId: entry.orderId }),
    };
  }
}
