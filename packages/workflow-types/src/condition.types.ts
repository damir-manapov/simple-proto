/**
 * Condition types for workflow evaluation
 */

/**
 * Reference to a field in the context
 */
export interface FieldReference {
  type: "field";
  path: string;
}

/**
 * Constant value
 */
export interface ConstantValue {
  type: "constant";
  value: unknown;
}

/**
 * Value source - either a field reference or constant
 */
export type ValueSource = FieldReference | ConstantValue;

/**
 * Comparison operators
 */
export type CompareOperator =
  | "=="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "contains"
  | "startsWith"
  | "endsWith"
  | "matches";

/**
 * Compare two values
 */
export interface CompareCondition {
  type: "compare";
  left: ValueSource;
  operator: CompareOperator;
  right: ValueSource;
}

/**
 * Filter field for entity existence checks
 */
export interface FilterField {
  field: string;
  operator: "==" | "!=" | ">" | "<" | ">=" | "<=" | "contains";
  value: ValueSource;
}

/**
 * Check if an entity exists in a collection
 */
export interface ExistsCondition {
  type: "exists";
  collection: string;
  filter: FilterField;
}

/**
 * Logical AND of multiple conditions
 */
export interface AndCondition {
  type: "and";
  conditions: Condition[];
}

/**
 * Logical OR of multiple conditions
 */
export interface OrCondition {
  type: "or";
  conditions: Condition[];
}

/**
 * Logical NOT of a condition
 */
export interface NotCondition {
  type: "not";
  condition: Condition;
}

/**
 * All possible condition types
 */
export type Condition =
  | CompareCondition
  | ExistsCondition
  | AndCondition
  | OrCondition
  | NotCondition;
