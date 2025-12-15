// ==================== Expression Types ====================

/**
 * Expression for computing field values
 */
export type Expression =
  | FieldExpression
  | LiteralExpression
  | ConcatExpression
  | TemplateExpression
  | MathExpression
  | CoalesceExpression
  | ConditionalExpression
  | DateExpression
  | ArrayExpression
  | StringExpression;

export interface FieldExpression {
  type: "field";
  path: string; // Dot notation: "user.address.city"
}

export interface LiteralExpression {
  type: "literal";
  value: unknown;
}

export interface ConcatExpression {
  type: "concat";
  values: Expression[];
  separator?: string;
}

export interface TemplateExpression {
  type: "template";
  template: string; // "Hello {{name}}, your order {{orderId}} is ready"
}

export interface MathExpression {
  type: "math";
  operator: "+" | "-" | "*" | "/" | "%" | "round" | "floor" | "ceil" | "abs";
  left: Expression;
  right?: Expression; // Optional for unary operators like round, floor, ceil, abs
}

export interface CoalesceExpression {
  type: "coalesce";
  values: Expression[]; // Return first non-null value
}

export interface ConditionalExpression {
  type: "conditional";
  condition: ExpressionCondition;
  then: Expression;
  else: Expression;
}

export interface ExpressionCondition {
  field: string;
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "notIn" | "exists" | "isNull";
  value?: unknown;
}

export interface DateExpression {
  type: "date";
  operation: "now" | "format" | "add" | "diff" | "parse" | "startOf" | "endOf";
  field?: string; // Source date field
  format?: string; // For format/parse: "YYYY-MM-DD"
  amount?: number; // For add: number of units
  unit?: "day" | "week" | "month" | "year" | "hour" | "minute" | "second";
  compareTo?: string; // For diff: field to compare to
}

export interface ArrayExpression {
  type: "array";
  operation: "length" | "first" | "last" | "join" | "includes" | "at" | "slice";
  path: string;
  separator?: string; // For join
  value?: unknown; // For includes
  index?: number; // For at
  start?: number; // For slice
  end?: number; // For slice
}

export interface StringExpression {
  type: "string";
  operation:
    | "upper"
    | "lower"
    | "trim"
    | "split"
    | "substring"
    | "replace"
    | "length"
    | "padStart"
    | "padEnd";
  path: string;
  separator?: string; // For split
  start?: number; // For substring
  end?: number; // For substring
  pattern?: string; // For replace
  replacement?: string; // For replace
  padLength?: number; // For padStart/padEnd
  padChar?: string; // For padStart/padEnd
}

// ==================== Field Mapping ====================

export interface FieldMapping {
  target: string; // Output field name
  expression: Expression;
}
