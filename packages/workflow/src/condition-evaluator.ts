import type {
  Condition,
  CompareCondition,
  ExistsCondition,
  AndCondition,
  OrCondition,
  NotCondition,
  FilterField,
  ValueSource,
} from "@simple-proto/workflow-types";
import type { IStorage, Entry } from "@simple-proto/storage-types";
import { getNestedValue } from "./utils.js";

/**
 * Resolves a ValueSource to its actual value
 */
function resolveValue(source: ValueSource, context: Record<string, unknown>): unknown {
  if (source.type === "constant") {
    return source.value;
  }
  return getNestedValue(context, source.path);
}

/**
 * Evaluates workflow conditions against execution context
 */
export class ConditionEvaluator {
  constructor(private readonly storage: IStorage) {}

  /**
   * Evaluate a condition against the context
   */
  async evaluate(condition: Condition, context: Record<string, unknown>): Promise<boolean> {
    switch (condition.type) {
      case "compare":
        return this.evaluateCompare(condition, context);
      case "exists":
        return this.evaluateExists(condition, context);
      case "and":
        return this.evaluateAnd(condition, context);
      case "or":
        return this.evaluateOr(condition, context);
      case "not":
        return this.evaluateNot(condition, context);
    }
  }

  private evaluateCompare(condition: CompareCondition, context: Record<string, unknown>): boolean {
    const leftValue = resolveValue(condition.left, context);
    const rightValue = resolveValue(condition.right, context);

    switch (condition.operator) {
      case "==":
        return leftValue === rightValue;
      case "!=":
        return leftValue !== rightValue;
      case ">":
        return this.compareNumbers(leftValue, rightValue, (a, b) => a > b);
      case ">=":
        return this.compareNumbers(leftValue, rightValue, (a, b) => a >= b);
      case "<":
        return this.compareNumbers(leftValue, rightValue, (a, b) => a < b);
      case "<=":
        return this.compareNumbers(leftValue, rightValue, (a, b) => a <= b);
      case "contains":
        return String(leftValue).includes(String(rightValue));
      case "startsWith":
        return String(leftValue).startsWith(String(rightValue));
      case "endsWith":
        return String(leftValue).endsWith(String(rightValue));
      case "matches":
        return new RegExp(String(rightValue)).test(String(leftValue));
    }
  }

  private compareNumbers(
    left: unknown,
    right: unknown,
    comparator: (a: number, b: number) => boolean
  ): boolean {
    const leftNum = typeof left === "number" ? left : Number(left);
    const rightNum = typeof right === "number" ? right : Number(right);
    if (isNaN(leftNum) || isNaN(rightNum)) {
      return false;
    }
    return comparator(leftNum, rightNum);
  }

  private evaluateExists(
    condition: ExistsCondition,
    context: Record<string, unknown>
  ): boolean {
    if (!this.storage.hasCollection(condition.collection)) {
      return false;
    }

    const repo = this.storage.getRepository(condition.collection);
    const allEntries = repo.findAll();

    // Apply filter manually since we need to resolve value sources
    const matches = allEntries.filter((entry) =>
      this.matchesFilter(entry, condition.filter, context)
    );

    return matches.length > 0;
  }

  private matchesFilter(
    entry: Entry,
    filter: FilterField,
    context: Record<string, unknown>
  ): boolean {
    const entryValue = getNestedValue(entry, filter.field);
    const filterValue = resolveValue(filter.value, context);

    switch (filter.operator) {
      case "==":
        return entryValue === filterValue;
      case "!=":
        return entryValue !== filterValue;
      case ">":
        return this.compareNumbers(entryValue, filterValue, (a, b) => a > b);
      case ">=":
        return this.compareNumbers(entryValue, filterValue, (a, b) => a >= b);
      case "<":
        return this.compareNumbers(entryValue, filterValue, (a, b) => a < b);
      case "<=":
        return this.compareNumbers(entryValue, filterValue, (a, b) => a <= b);
      case "contains":
        return String(entryValue).includes(String(filterValue));
      default:
        return false;
    }
  }

  private async evaluateAnd(
    condition: AndCondition,
    context: Record<string, unknown>
  ): Promise<boolean> {
    for (const c of condition.conditions) {
      if (!(await this.evaluate(c, context))) {
        return false;
      }
    }
    return true;
  }

  private async evaluateOr(
    condition: OrCondition,
    context: Record<string, unknown>
  ): Promise<boolean> {
    for (const c of condition.conditions) {
      if (await this.evaluate(c, context)) {
        return true;
      }
    }
    return false;
  }

  private async evaluateNot(
    condition: NotCondition,
    context: Record<string, unknown>
  ): Promise<boolean> {
    return !(await this.evaluate(condition.condition, context));
  }
}
