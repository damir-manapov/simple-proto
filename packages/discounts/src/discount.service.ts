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
  DiscountResult,
  CalculationOptions,
} from "@simple-proto/discounts-types";
import { DiscountEvaluator } from "./discount-evaluator.js";

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

const DISCOUNT_COLLECTION = "discounts";
const USAGE_COLLECTION = "discount_usage";

/**
 * Service for managing discounts
 */
export class DiscountService {
  private readonly storage: IStorage;
  private readonly evaluator: DiscountEvaluator;
  private initialized = false;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.evaluator = new DiscountEvaluator();
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
    if (input.usageLimitPerCustomer !== undefined) entryInput.usageLimitPerCustomer = input.usageLimitPerCustomer;
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
    if (input.usageLimitPerCustomer !== undefined) merged.usageLimitPerCustomer = input.usageLimitPerCustomer;
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

  /**
   * Validate a promo code without applying it
   */
  validateCode(code: string, context: CartContext): { valid: boolean; reason?: string; discount?: Discount } {
    this.ensureInitialized();

    const discount = this.getDiscountByCode(code);
    if (!discount) {
      return { valid: false, reason: "Invalid code" };
    }

    const now = context.evaluationDate ?? new Date();

    if (discount.status !== "active") {
      return { valid: false, reason: "Discount is not active" };
    }

    if (discount.validFrom && now < discount.validFrom) {
      return { valid: false, reason: "Discount is not yet valid" };
    }

    if (discount.validUntil && now > discount.validUntil) {
      return { valid: false, reason: "Discount has expired" };
    }

    if (discount.usageLimit !== undefined && discount.currentUsage >= discount.usageLimit) {
      return { valid: false, reason: "Discount usage limit reached" };
    }

    // Check per-customer usage
    if (discount.usageLimitPerCustomer !== undefined && context.customer?.id) {
      const customerUsage = this.getCustomerUsage(discount.id, context.customer.id);
      if (customerUsage >= discount.usageLimitPerCustomer) {
        return { valid: false, reason: "You have already used this code the maximum number of times" };
      }
    }

    return { valid: true, discount };
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
      ...(entry.usageLimitPerCustomer !== undefined && { usageLimitPerCustomer: entry.usageLimitPerCustomer }),
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
}
