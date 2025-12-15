import type { FieldReference, ConstantValue, ValueSource } from "@simple-proto/workflow-types";

/**
 * Gets a nested value from an object using a dot-notation path
 * Supports array indexing like "items[0].name"
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  if (obj == null) return undefined;

  // Split path by dots and brackets
  const parts = path.split(/\.|\[|\]/).filter(Boolean);

  let current: unknown = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Sets a nested value in an object using a dot-notation path
 * Creates intermediate objects/arrays as needed
 */
export function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(/\.|\[|\]/).filter(Boolean);

  if (parts.length === 0) return;

  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === undefined) continue;

    const nextPart = parts[i + 1];
    const isNextArrayIndex = nextPart !== undefined && /^\d+$/.test(nextPart);

    current[part] ??= isNextArrayIndex ? [] : {};

    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart !== undefined) {
    current[lastPart] = value;
  }
}

/**
 * Creates a field reference
 */
export function field(path: string): FieldReference {
  return { type: "field", path };
}

/**
 * Creates a constant value
 */
export function constant(value: unknown): ConstantValue {
  return { type: "constant", value };
}

/**
 * Resolves a value source to its actual value
 */
export function resolveValue(source: ValueSource, context: Record<string, unknown>): unknown {
  if (source.type === "constant") {
    return source.value;
  }
  return getNestedValue(context, source.path);
}

/**
 * Resolves all value sources in a record
 */
export function resolveRecord(
  record: Record<string, ValueSource>,
  context: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, source] of Object.entries(record)) {
    result[key] = resolveValue(source, context);
  }
  return result;
}

/**
 * Generates a unique ID
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Safely converts any value to a string for logging/display
 */
export function toSafeString(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return "[Object]";
  }
}
