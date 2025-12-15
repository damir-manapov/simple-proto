import type {
  Expression,
  FieldExpression,
  LiteralExpression,
  ConcatExpression,
  TemplateExpression,
  MathExpression,
  CoalesceExpression,
  ConditionalExpression,
  DateExpression,
  ArrayExpression,
  StringExpression,
  ExpressionCondition,
} from "@simple-proto/transform-types";

type DataRecord = Record<string, unknown>;

/**
 * Evaluates expressions against a record
 */
export class ExpressionEvaluator {
  /**
   * Evaluate an expression against a record
   */
  evaluate(expression: Expression, record: DataRecord): unknown {
    switch (expression.type) {
      case "field":
        return this.evaluateField(expression, record);
      case "literal":
        return this.evaluateLiteral(expression);
      case "concat":
        return this.evaluateConcat(expression, record);
      case "template":
        return this.evaluateTemplate(expression, record);
      case "math":
        return this.evaluateMath(expression, record);
      case "coalesce":
        return this.evaluateCoalesce(expression, record);
      case "conditional":
        return this.evaluateConditional(expression, record);
      case "date":
        return this.evaluateDate(expression, record);
      case "array":
        return this.evaluateArray(expression, record);
      case "string":
        return this.evaluateString(expression, record);
      default:
        throw new Error(`Unknown expression type: ${(expression as Expression).type}`);
    }
  }

  /**
   * Get a nested value from a record using dot notation
   */
  getNestedValue(record: DataRecord, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = record;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current !== "object") {
        return undefined;
      }
      current = (current as DataRecord)[part];
    }

    return current;
  }

  private evaluateField(expr: FieldExpression, record: DataRecord): unknown {
    return this.getNestedValue(record, expr.path);
  }

  private evaluateLiteral(expr: LiteralExpression): unknown {
    return expr.value;
  }

  private evaluateConcat(expr: ConcatExpression, record: DataRecord): string {
    const values = expr.values.map((v) => {
      const result = this.evaluate(v, record);
      if (result === null || result === undefined) return "";
      if (typeof result === "string") return result;
      if (typeof result === "number" || typeof result === "boolean") return String(result);
      return JSON.stringify(result);
    });
    return values.join(expr.separator ?? "");
  }

  private evaluateTemplate(expr: TemplateExpression, record: DataRecord): string {
    return expr.template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
      const value = this.getNestedValue(record, path.trim());
      if (value === null || value === undefined) return "";
      if (typeof value === "string") return value;
      if (typeof value === "number" || typeof value === "boolean") return String(value);
      return JSON.stringify(value);
    });
  }

  private evaluateMath(expr: MathExpression, record: DataRecord): number {
    const leftVal = this.evaluate(expr.left, record);
    const left = typeof leftVal === "number" ? leftVal : Number(leftVal);

    if (isNaN(left)) {
      return NaN;
    }

    // Unary operators
    if (expr.operator === "round") return Math.round(left);
    if (expr.operator === "floor") return Math.floor(left);
    if (expr.operator === "ceil") return Math.ceil(left);
    if (expr.operator === "abs") return Math.abs(left);

    // Binary operators
    if (!expr.right) {
      throw new Error(`Binary operator ${expr.operator} requires right operand`);
    }

    const rightVal = this.evaluate(expr.right, record);
    const right = typeof rightVal === "number" ? rightVal : Number(rightVal);

    if (isNaN(right)) {
      return NaN;
    }

    switch (expr.operator) {
      case "+":
        return left + right;
      case "-":
        return left - right;
      case "*":
        return left * right;
      case "/":
        return right === 0 ? NaN : left / right;
      case "%":
        return left % right;
      default: {
        const _exhaustive: never = expr.operator;
        throw new Error(`Unknown math operator: ${String(_exhaustive)}`);
      }
    }
  }

  private evaluateCoalesce(expr: CoalesceExpression, record: DataRecord): unknown {
    for (const valueExpr of expr.values) {
      const value = this.evaluate(valueExpr, record);
      if (value !== null && value !== undefined) {
        return value;
      }
    }
    return null;
  }

  private evaluateConditional(expr: ConditionalExpression, record: DataRecord): unknown {
    const conditionMet = this.evaluateCondition(expr.condition, record);
    return conditionMet ? this.evaluate(expr.then, record) : this.evaluate(expr.else, record);
  }

  evaluateCondition(condition: ExpressionCondition, record: DataRecord): boolean {
    const fieldValue = this.getNestedValue(record, condition.field);

    switch (condition.operator) {
      case "eq":
        return fieldValue === condition.value;
      case "ne":
        return fieldValue !== condition.value;
      case "gt":
        return (
          typeof fieldValue === "number" &&
          typeof condition.value === "number" &&
          fieldValue > condition.value
        );
      case "gte":
        return (
          typeof fieldValue === "number" &&
          typeof condition.value === "number" &&
          fieldValue >= condition.value
        );
      case "lt":
        return (
          typeof fieldValue === "number" &&
          typeof condition.value === "number" &&
          fieldValue < condition.value
        );
      case "lte":
        return (
          typeof fieldValue === "number" &&
          typeof condition.value === "number" &&
          fieldValue <= condition.value
        );
      case "in":
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case "notIn":
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
      case "exists":
        return fieldValue !== undefined;
      case "isNull":
        return fieldValue === null || fieldValue === undefined;
      default:
        return false;
    }
  }

  private evaluateDate(expr: DateExpression, record: DataRecord): unknown {
    const now = new Date();

    switch (expr.operation) {
      case "now":
        return now.toISOString();

      case "format": {
        const dateValue = expr.field ? this.getNestedValue(record, expr.field) : now;
        const date = dateValue instanceof Date ? dateValue : new Date(String(dateValue));
        if (isNaN(date.getTime())) return null;
        // Simple format implementation
        const format = expr.format ?? "YYYY-MM-DD";
        return this.formatDate(date, format);
      }

      case "parse": {
        const strValue = expr.field ? this.getNestedValue(record, expr.field) : null;
        if (!strValue) return null;
        const strInput = typeof strValue === "string" ? strValue : JSON.stringify(strValue);
        const parsed = new Date(strInput);
        return isNaN(parsed.getTime()) ? null : parsed.toISOString();
      }

      case "add": {
        const dateValue = expr.field ? this.getNestedValue(record, expr.field) : now;
        const date = dateValue instanceof Date ? dateValue : new Date(String(dateValue));
        if (isNaN(date.getTime())) return null;
        return this.addToDate(date, expr.amount ?? 0, expr.unit ?? "day").toISOString();
      }

      case "diff": {
        const dateValue = expr.field ? this.getNestedValue(record, expr.field) : now;
        const date1 = dateValue instanceof Date ? dateValue : new Date(String(dateValue));
        const compareValue = expr.compareTo ? this.getNestedValue(record, expr.compareTo) : now;
        const date2 = compareValue instanceof Date ? compareValue : new Date(String(compareValue));
        if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return null;
        return this.dateDiff(date1, date2, expr.unit ?? "day");
      }

      case "startOf": {
        const dateValue = expr.field ? this.getNestedValue(record, expr.field) : now;
        const date = dateValue instanceof Date ? dateValue : new Date(String(dateValue));
        if (isNaN(date.getTime())) return null;
        return this.startOf(date, expr.unit ?? "day").toISOString();
      }

      case "endOf": {
        const dateValue = expr.field ? this.getNestedValue(record, expr.field) : now;
        const date = dateValue instanceof Date ? dateValue : new Date(String(dateValue));
        if (isNaN(date.getTime())) return null;
        return this.endOf(date, expr.unit ?? "day").toISOString();
      }

      default:
        return null;
    }
  }

  private formatDate(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return format
      .replace("YYYY", String(year))
      .replace("MM", month)
      .replace("DD", day)
      .replace("HH", hours)
      .replace("mm", minutes)
      .replace("ss", seconds);
  }

  private addToDate(
    date: Date,
    amount: number,
    unit: "day" | "week" | "month" | "year" | "hour" | "minute" | "second"
  ): Date {
    const result = new Date(date);
    switch (unit) {
      case "second":
        result.setSeconds(result.getSeconds() + amount);
        break;
      case "minute":
        result.setMinutes(result.getMinutes() + amount);
        break;
      case "hour":
        result.setHours(result.getHours() + amount);
        break;
      case "day":
        result.setDate(result.getDate() + amount);
        break;
      case "week":
        result.setDate(result.getDate() + amount * 7);
        break;
      case "month":
        result.setMonth(result.getMonth() + amount);
        break;
      case "year":
        result.setFullYear(result.getFullYear() + amount);
        break;
    }
    return result;
  }

  private dateDiff(
    date1: Date,
    date2: Date,
    unit: "day" | "week" | "month" | "year" | "hour" | "minute" | "second"
  ): number {
    const diffMs = date2.getTime() - date1.getTime();
    switch (unit) {
      case "second":
        return Math.floor(diffMs / 1000);
      case "minute":
        return Math.floor(diffMs / (1000 * 60));
      case "hour":
        return Math.floor(diffMs / (1000 * 60 * 60));
      case "day":
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
      case "week":
        return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
      case "month":
        return (
          (date2.getFullYear() - date1.getFullYear()) * 12 + (date2.getMonth() - date1.getMonth())
        );
      case "year":
        return date2.getFullYear() - date1.getFullYear();
    }
  }

  private startOf(
    date: Date,
    unit: "day" | "week" | "month" | "year" | "hour" | "minute" | "second"
  ): Date {
    const result = new Date(date);
    switch (unit) {
      case "second":
        result.setMilliseconds(0);
        break;
      case "minute":
        result.setSeconds(0, 0);
        break;
      case "hour":
        result.setMinutes(0, 0, 0);
        break;
      case "day":
        result.setHours(0, 0, 0, 0);
        break;
      case "week":
        result.setHours(0, 0, 0, 0);
        result.setDate(result.getDate() - result.getDay());
        break;
      case "month":
        result.setHours(0, 0, 0, 0);
        result.setDate(1);
        break;
      case "year":
        result.setHours(0, 0, 0, 0);
        result.setMonth(0, 1);
        break;
    }
    return result;
  }

  private endOf(
    date: Date,
    unit: "day" | "week" | "month" | "year" | "hour" | "minute" | "second"
  ): Date {
    const result = new Date(date);
    switch (unit) {
      case "second":
        result.setMilliseconds(999);
        break;
      case "minute":
        result.setSeconds(59, 999);
        break;
      case "hour":
        result.setMinutes(59, 59, 999);
        break;
      case "day":
        result.setHours(23, 59, 59, 999);
        break;
      case "week":
        result.setHours(23, 59, 59, 999);
        result.setDate(result.getDate() + (6 - result.getDay()));
        break;
      case "month":
        result.setMonth(result.getMonth() + 1, 0);
        result.setHours(23, 59, 59, 999);
        break;
      case "year":
        result.setMonth(11, 31);
        result.setHours(23, 59, 59, 999);
        break;
    }
    return result;
  }

  private evaluateArray(expr: ArrayExpression, record: DataRecord): unknown {
    const value = this.getNestedValue(record, expr.path);
    if (!Array.isArray(value)) {
      if (expr.operation === "length") return 0;
      return null;
    }

    switch (expr.operation) {
      case "length":
        return value.length;
      case "first":
        return value[0] ?? null;
      case "last":
        return value[value.length - 1] ?? null;
      case "join":
        return value.join(expr.separator ?? ",");
      case "includes":
        return value.includes(expr.value);
      case "at":
        return value[expr.index ?? 0] ?? null;
      case "slice":
        return value.slice(expr.start ?? 0, expr.end);
      default:
        return null;
    }
  }

  private evaluateString(expr: StringExpression, record: DataRecord): unknown {
    const value = this.getNestedValue(record, expr.path);
    if (typeof value !== "string") {
      if (expr.operation === "length") return 0;
      return null;
    }

    switch (expr.operation) {
      case "upper":
        return value.toUpperCase();
      case "lower":
        return value.toLowerCase();
      case "trim":
        return value.trim();
      case "split":
        return value.split(expr.separator ?? ",");
      case "substring":
        return value.substring(expr.start ?? 0, expr.end);
      case "replace":
        return value.replace(new RegExp(expr.pattern ?? "", "g"), expr.replacement ?? "");
      case "length":
        return value.length;
      case "padStart":
        return value.padStart(expr.padLength ?? 0, expr.padChar ?? " ");
      case "padEnd":
        return value.padEnd(expr.padLength ?? 0, expr.padChar ?? " ");
      default:
        return null;
    }
  }
}
