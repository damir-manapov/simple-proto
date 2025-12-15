import type { IStorage, Entry, EntryInput } from "@simple-proto/storage-types";
import type {
  TransformStep,
  FilterStepConfig,
  MapStepConfig,
  AggregateStepConfig,
  JoinStepConfig,
  LookupStepConfig,
  UnionStepConfig,
  DeduplicateStepConfig,
  SortStepConfig,
  LimitStepConfig,
  PivotStepConfig,
  UnpivotStepConfig,
  FlattenStepConfig,
  StepResult,
  FilterCondition,
  AggregateFunction,
} from "@simple-proto/transform-types";
import { ExpressionEvaluator } from "./expression-evaluator.js";

type DataRecord = Entry & Record<string, unknown>;
type DataRecordInput = EntryInput & Record<string, unknown>;

/**
 * Executes individual transform steps
 */
export class StepExecutor {
  private expressionEvaluator: ExpressionEvaluator;

  constructor(private storage: IStorage) {
    this.expressionEvaluator = new ExpressionEvaluator();
  }

  /**
   * Execute a single transform step synchronously
   */
  execute(step: TransformStep): StepResult {
    const startedAt = new Date();
    try {
      const result = this.executeStep(step);
      const completedAt = new Date();
      return {
        stepId: step.id,
        stepType: step.type,
        status: "completed",
        inputRows: result.inputRows,
        outputRows: result.outputRows,
        startedAt,
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        outputCollection: result.outputCollection,
      };
    } catch (error) {
      const completedAt = new Date();
      return {
        stepId: step.id,
        stepType: step.type,
        status: "failed",
        inputRows: 0,
        outputRows: 0,
        startedAt,
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private executeStep(
    step: TransformStep,
  ): { inputRows: number; outputRows: number; outputCollection: string } {
    switch (step.type) {
      case "filter":
        return this.executeFilter(step.config as FilterStepConfig);
      case "map":
        return this.executeMap(step.config as MapStepConfig);
      case "aggregate":
        return this.executeAggregate(step.config as AggregateStepConfig);
      case "join":
        return this.executeJoin(step.config as JoinStepConfig);
      case "lookup":
        return this.executeLookup(step.config as LookupStepConfig);
      case "union":
        return this.executeUnion(step.config as UnionStepConfig);
      case "deduplicate":
        return this.executeDeduplicate(step.config as DeduplicateStepConfig);
      case "sort":
        return this.executeSort(step.config as SortStepConfig);
      case "limit":
        return this.executeLimit(step.config as LimitStepConfig);
      case "pivot":
        return this.executePivot(step.config as PivotStepConfig);
      case "unpivot":
        return this.executeUnpivot(step.config as UnpivotStepConfig);
      case "flatten":
        return this.executeFlatten(step.config as FlattenStepConfig);
      default: {
        const _exhaustive: never = step.type;
        throw new Error(`Unknown step type: ${String(_exhaustive)}`);
      }
    }
  }

  private getRecords(collection: string): DataRecord[] {
    const repo = this.storage.getRepository<DataRecord, DataRecordInput>(collection);
    return repo.findAll();
  }

  private createRecord(collection: string, record: DataRecordInput): void {
    const repo = this.storage.getRepository<DataRecord, DataRecordInput>(collection);
    repo.create(record);
  }

  private clearAndCreate(collection: string): void {
    if (this.storage.hasCollection(collection)) {
      const repo = this.storage.getRepository<DataRecord, DataRecordInput>(collection);
      repo.clear();
    } else {
      this.storage.registerCollection({ name: collection, schema: {} });
    }
  }

  // ==================== Filter ====================
  private executeFilter(
    config: FilterStepConfig,
  ): { inputRows: number; outputRows: number; outputCollection: string } {
    const records = this.getRecords(config.source);
    const inputRows = records.length;

    const filtered = records.filter((record) =>
      this.matchesConditions(record, config.conditions, config.conditionLogic),
    );

    this.clearAndCreate(config.output);
    for (const record of filtered) {
      this.createRecord(config.output, record);
    }

    return { inputRows, outputRows: filtered.length, outputCollection: config.output };
  }

  private matchesConditions(
    record: DataRecord,
    conditions: FilterCondition[],
    logic: "and" | "or" = "and",
  ): boolean {
    if (conditions.length === 0) return true;

    const results = conditions.map((cond) => this.matchesCondition(record, cond));

    return logic === "and" ? results.every(Boolean) : results.some(Boolean);
  }

  private matchesCondition(record: DataRecord, condition: FilterCondition): boolean {
    const value = this.expressionEvaluator.getNestedValue(record, condition.field);

    switch (condition.operator) {
      case "eq":
        return value === condition.value;
      case "ne":
        return value !== condition.value;
      case "gt":
        return (
          typeof value === "number" &&
          typeof condition.value === "number" &&
          value > condition.value
        );
      case "gte":
        return (
          typeof value === "number" &&
          typeof condition.value === "number" &&
          value >= condition.value
        );
      case "lt":
        return (
          typeof value === "number" &&
          typeof condition.value === "number" &&
          value < condition.value
        );
      case "lte":
        return (
          typeof value === "number" &&
          typeof condition.value === "number" &&
          value <= condition.value
        );
      case "in":
        return Array.isArray(condition.value) && condition.value.includes(value);
      case "notIn":
        return Array.isArray(condition.value) && !condition.value.includes(value);
      case "contains":
        return (
          typeof value === "string" &&
          typeof condition.value === "string" &&
          value.includes(condition.value)
        );
      case "startsWith":
        return (
          typeof value === "string" &&
          typeof condition.value === "string" &&
          value.startsWith(condition.value)
        );
      case "endsWith":
        return (
          typeof value === "string" &&
          typeof condition.value === "string" &&
          value.endsWith(condition.value)
        );
      case "exists":
        return value !== undefined;
      case "isNull":
        return value === null || value === undefined;
      case "regex":
        return (
          typeof value === "string" &&
          typeof condition.value === "string" &&
          new RegExp(condition.value).test(value)
        );
      default:
        return false;
    }
  }

  // ==================== Map ====================
  private executeMap(
    config: MapStepConfig,
  ): { inputRows: number; outputRows: number; outputCollection: string } {
    const records = this.getRecords(config.source);
    const inputRows = records.length;

    const mapped = records.map((record) => {
      const result: DataRecordInput = config.includeOriginal
        ? { ...record }
        : { id: record.id };

      for (const mapping of config.mappings) {
        result[mapping.target] = this.expressionEvaluator.evaluate(mapping.expression, record);
      }

      return result;
    });

    this.clearAndCreate(config.output);
    for (const record of mapped) {
      this.createRecord(config.output, record);
    }

    return { inputRows, outputRows: mapped.length, outputCollection: config.output };
  }

  // ==================== Aggregate ====================
  private executeAggregate(
    config: AggregateStepConfig,
  ): { inputRows: number; outputRows: number; outputCollection: string } {
    const records = this.getRecords(config.source);
    const inputRows = records.length;

    // Group records
    const groups = new Map<string, DataRecord[]>();

    for (const record of records) {
      const key =
        config.groupBy.length === 0
          ? "__all__"
          : config.groupBy
              .map((field) => JSON.stringify(this.expressionEvaluator.getNestedValue(record, field)))
              .join("|");

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)?.push(record);
    }

    // Compute aggregations
    const results: DataRecordInput[] = [];

    for (const [, groupRecords] of groups) {
      const result: DataRecordInput = {};

      // Add group by fields
      if (groupRecords.length > 0 && config.groupBy.length > 0) {
        const firstRecord = groupRecords[0];
        if (firstRecord) {
          for (const field of config.groupBy) {
            result[field] = this.expressionEvaluator.getNestedValue(firstRecord, field);
          }
        }
      }

      // Compute aggregations
      for (const agg of config.aggregations) {
        result[agg.as] = this.computeAggregation(groupRecords, agg.field, agg.function);
      }

      // Apply having conditions
      if (config.having && config.having.length > 0) {
        const matchesHaving = config.having.every((cond) =>
          this.expressionEvaluator.evaluateCondition(cond, result as DataRecord),
        );
        if (!matchesHaving) continue;
      }

      results.push(result);
    }

    this.clearAndCreate(config.output);
    for (const record of results) {
      this.createRecord(config.output, record);
    }

    return { inputRows, outputRows: results.length, outputCollection: config.output };
  }

  private computeAggregation(
    records: DataRecord[],
    field: string,
    func: AggregateFunction,
  ): unknown {
    if (func === "count") {
      return records.length;
    }

    const values = records
      .map((r) => (field === "*" ? r : this.expressionEvaluator.getNestedValue(r, field)))
      .filter((v) => v !== null && v !== undefined);

    if (func === "countDistinct") {
      return new Set(values.map((v) => JSON.stringify(v))).size;
    }

    if (func === "collect") {
      return values;
    }

    if (func === "first") {
      return values[0] ?? null;
    }

    if (func === "last") {
      return values[values.length - 1] ?? null;
    }

    // Numeric aggregations
    const numbers = values.filter((v): v is number => typeof v === "number");
    if (numbers.length === 0) return null;

    switch (func) {
      case "sum":
        return numbers.reduce((a, b) => a + b, 0);
      case "avg":
        return numbers.reduce((a, b) => a + b, 0) / numbers.length;
      case "min":
        return Math.min(...numbers);
      case "max":
        return Math.max(...numbers);
      default:
        return null;
    }
  }

  // ==================== Join ====================
  private executeJoin(
    config: JoinStepConfig,
  ): { inputRows: number; outputRows: number; outputCollection: string } {
    const leftRecords = this.getRecords(config.left);
    const rightRecords = this.getRecords(config.right);
    const inputRows = leftRecords.length + rightRecords.length;

    // Build index on right side for efficiency
    const rightIndex = new Map<string, DataRecord[]>();
    for (const record of rightRecords) {
      const key = config.on
        .map((cond) =>
          JSON.stringify(this.expressionEvaluator.getNestedValue(record, cond.rightField)),
        )
        .join("|");
      if (!rightIndex.has(key)) {
        rightIndex.set(key, []);
      }
      rightIndex.get(key)?.push(record);
    }

    const results: DataRecordInput[] = [];
    const matchedRight = new Set<DataRecord>();

    for (const leftRecord of leftRecords) {
      const key = config.on
        .map((cond) =>
          JSON.stringify(this.expressionEvaluator.getNestedValue(leftRecord, cond.leftField)),
        )
        .join("|");

      const matches = rightIndex.get(key) ?? [];

      if (matches.length > 0) {
        for (const rightRecord of matches) {
          matchedRight.add(rightRecord);
          results.push(this.mergeRecords(leftRecord, rightRecord, config));
        }
      } else if (config.type === "left" || config.type === "full") {
        results.push(this.mergeRecords(leftRecord, null, config));
      }
    }

    // Add unmatched right records for right/full joins
    if (config.type === "right" || config.type === "full") {
      for (const rightRecord of rightRecords) {
        if (!matchedRight.has(rightRecord)) {
          results.push(this.mergeRecords(null, rightRecord, config));
        }
      }
    }

    this.clearAndCreate(config.output);
    for (const record of results) {
      this.createRecord(config.output, record);
    }

    return { inputRows, outputRows: results.length, outputCollection: config.output };
  }

  private mergeRecords(
    left: DataRecord | null,
    right: DataRecord | null,
    config: JoinStepConfig,
  ): DataRecordInput {
    const result: DataRecordInput = {};
    const leftPrefix = config.prefix?.left ?? "";
    const rightPrefix = config.prefix?.right ?? "";

    if (left) {
      const selectLeft = config.select?.left;
      const fields: string[] =
        selectLeft === "*" || !selectLeft
          ? Object.keys(left).filter((f) => f !== "id") // Exclude id field
          : selectLeft;
      for (const field of fields) {
        result[leftPrefix + field] = left[field];
      }
      // Include original id with prefix if needed
      if (leftPrefix) {
        result[leftPrefix + "id"] = left.id;
      } else {
        result["left_id"] = left.id;
      }
    }

    if (right) {
      const selectRight = config.select?.right;
      const fields: string[] =
        selectRight === "*" || !selectRight
          ? Object.keys(right).filter((f) => f !== "id") // Exclude id field
          : selectRight;
      for (const field of fields) {
        result[rightPrefix + field] = right[field];
      }
      // Include original id with prefix if needed
      if (rightPrefix) {
        result[rightPrefix + "id"] = right.id;
      } else {
        result["right_id"] = right.id;
      }
    }

    return result;
  }

  // ==================== Lookup ====================
  private executeLookup(
    config: LookupStepConfig,
  ): { inputRows: number; outputRows: number; outputCollection: string } {
    const sourceRecords = this.getRecords(config.source);
    const lookupRecords = this.getRecords(config.from);
    const inputRows = sourceRecords.length;

    // Build index on lookup collection
    const lookupIndex = new Map<string, DataRecord[]>();
    for (const record of lookupRecords) {
      const key = this.expressionEvaluator.getNestedValue(record, config.foreignField);
      const keyStr = JSON.stringify(key);
      if (!lookupIndex.has(keyStr)) {
        lookupIndex.set(keyStr, []);
      }
      lookupIndex.get(keyStr)?.push(record);
    }

    const results = sourceRecords.map((record): DataRecordInput => {
      const localValue = this.expressionEvaluator.getNestedValue(record, config.localField);
      const matches = lookupIndex.get(JSON.stringify(localValue)) ?? [];

      return {
        ...record,
        [config.as]: config.multiple ? matches : (matches[0] ?? null),
      };
    });

    this.clearAndCreate(config.output);
    for (const record of results) {
      this.createRecord(config.output, record);
    }

    return { inputRows, outputRows: results.length, outputCollection: config.output };
  }

  // ==================== Union ====================
  private executeUnion(
    config: UnionStepConfig,
  ): { inputRows: number; outputRows: number; outputCollection: string } {
    let allRecords: DataRecord[] = [];
    let inputRows = 0;

    for (const source of config.sources) {
      const records = this.getRecords(source);
      inputRows += records.length;
      allRecords = allRecords.concat(records);
    }

    if (config.mode === "distinct" && config.distinctKeys) {
      const seen = new Set<string>();
      allRecords = allRecords.filter((record) => {
        const key = (config.distinctKeys ?? [])
          .map((field) =>
            JSON.stringify(this.expressionEvaluator.getNestedValue(record, field)),
          )
          .join("|");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    this.clearAndCreate(config.output);
    for (const record of allRecords) {
      this.createRecord(config.output, record);
    }

    return { inputRows, outputRows: allRecords.length, outputCollection: config.output };
  }

  // ==================== Deduplicate ====================
  private executeDeduplicate(
    config: DeduplicateStepConfig,
  ): { inputRows: number; outputRows: number; outputCollection: string } {
    let records = this.getRecords(config.source);
    const inputRows = records.length;

    // Sort if orderBy specified
    if (config.orderBy) {
      records = this.sortRecords(records, [config.orderBy]);
    }

    // Deduplicate
    const seen = new Map<string, DataRecord>();
    for (const record of records) {
      const key = config.keys
        .map((field) =>
          JSON.stringify(this.expressionEvaluator.getNestedValue(record, field)),
        )
        .join("|");

      if (config.keep === "first" && !seen.has(key)) {
        seen.set(key, record);
      } else if (config.keep === "last") {
        seen.set(key, record);
      }
    }

    const results = Array.from(seen.values());

    this.clearAndCreate(config.output);
    for (const record of results) {
      this.createRecord(config.output, record);
    }

    return { inputRows, outputRows: results.length, outputCollection: config.output };
  }

  // ==================== Sort ====================
  private executeSort(
    config: SortStepConfig,
  ): { inputRows: number; outputRows: number; outputCollection: string } {
    const records = this.getRecords(config.source);
    const inputRows = records.length;

    const sorted = this.sortRecords(records, config.orderBy);

    this.clearAndCreate(config.output);
    for (const record of sorted) {
      this.createRecord(config.output, record);
    }

    return { inputRows, outputRows: sorted.length, outputCollection: config.output };
  }

  private sortRecords(
    records: DataRecord[],
    orderBy: { field: string; direction: "asc" | "desc"; nulls?: "first" | "last" }[],
  ): DataRecord[] {
    return [...records].sort((a, b) => {
      for (const sort of orderBy) {
        const aVal = this.expressionEvaluator.getNestedValue(a, sort.field);
        const bVal = this.expressionEvaluator.getNestedValue(b, sort.field);

        // Handle nulls
        const aIsNull = aVal === null || aVal === undefined;
        const bIsNull = bVal === null || bVal === undefined;

        if (aIsNull && bIsNull) continue;
        if (aIsNull) return sort.nulls === "first" ? -1 : 1;
        if (bIsNull) return sort.nulls === "first" ? 1 : -1;

        // Compare values
        let comparison = 0;
        if (typeof aVal === "number" && typeof bVal === "number") {
          comparison = aVal - bVal;
        } else {
          const aStr = typeof aVal === "string" ? aVal : JSON.stringify(aVal);
          const bStr = typeof bVal === "string" ? bVal : JSON.stringify(bVal);
          comparison = aStr.localeCompare(bStr);
        }

        if (comparison !== 0) {
          return sort.direction === "desc" ? -comparison : comparison;
        }
      }
      return 0;
    });
  }

  // ==================== Limit ====================
  private executeLimit(
    config: LimitStepConfig,
  ): { inputRows: number; outputRows: number; outputCollection: string } {
    const records = this.getRecords(config.source);
    const inputRows = records.length;

    const offset = config.offset ?? 0;
    const limited = records.slice(offset, offset + config.limit);

    this.clearAndCreate(config.output);
    for (const record of limited) {
      this.createRecord(config.output, record);
    }

    return { inputRows, outputRows: limited.length, outputCollection: config.output };
  }

  // ==================== Pivot ====================
  private executePivot(
    config: PivotStepConfig,
  ): { inputRows: number; outputRows: number; outputCollection: string } {
    const records = this.getRecords(config.source);
    const inputRows = records.length;

    // Group by groupBy fields
    const groups = new Map<string, Map<string, unknown[]>>();

    for (const record of records) {
      const groupKey =
        config.groupBy.length === 0
          ? "__all__"
          : config.groupBy
              .map((f) => JSON.stringify(this.expressionEvaluator.getNestedValue(record, f)))
              .join("|");

      if (!groups.has(groupKey)) {
        groups.set(groupKey, new Map());
      }

      const rawPivotValue = this.expressionEvaluator.getNestedValue(record, config.pivotField);
      const pivotValue =
        rawPivotValue === null || rawPivotValue === undefined
          ? "null"
          : typeof rawPivotValue === "string"
            ? rawPivotValue
            : JSON.stringify(rawPivotValue);
      const value = this.expressionEvaluator.getNestedValue(record, config.valueField);

      const pivotGroup = groups.get(groupKey);
      if (pivotGroup) {
        if (!pivotGroup.has(pivotValue)) {
          pivotGroup.set(pivotValue, []);
        }
        pivotGroup.get(pivotValue)?.push(value);
      }
    }

    const results: DataRecordInput[] = [];

    for (const [groupKey, pivotValues] of groups) {
      const result: DataRecordInput = {};

      // Add group by fields from first matching record
      if (config.groupBy.length > 0 && groupKey !== "__all__") {
        const firstRecord = records.find((r) => {
          const key = config.groupBy
            .map((f) => JSON.stringify(this.expressionEvaluator.getNestedValue(r, f)))
            .join("|");
          return key === groupKey;
        });
        if (firstRecord) {
          for (const field of config.groupBy) {
            result[field] = this.expressionEvaluator.getNestedValue(firstRecord, field);
          }
        }
      }

      // Add pivoted values
      for (const [pivotKey, values] of pivotValues) {
        result[pivotKey] = this.computeAggregation(
          values.map((v) => ({ id: "", value: v }) as DataRecord),
          "value",
          config.aggregation,
        );
      }

      results.push(result);
    }

    this.clearAndCreate(config.output);
    for (const record of results) {
      this.createRecord(config.output, record);
    }

    return { inputRows, outputRows: results.length, outputCollection: config.output };
  }

  // ==================== Unpivot ====================
  private executeUnpivot(
    config: UnpivotStepConfig,
  ): { inputRows: number; outputRows: number; outputCollection: string } {
    const records = this.getRecords(config.source);
    const inputRows = records.length;

    const results: DataRecordInput[] = [];

    for (const record of records) {
      for (const field of config.unpivotFields) {
        const result: DataRecordInput = {};

        // Copy id fields
        for (const idField of config.idFields) {
          result[idField] = this.expressionEvaluator.getNestedValue(record, idField);
        }

        result[config.nameField] = field;
        result[config.valueField] = this.expressionEvaluator.getNestedValue(record, field);

        results.push(result);
      }
    }

    this.clearAndCreate(config.output);
    for (const record of results) {
      this.createRecord(config.output, record);
    }

    return { inputRows, outputRows: results.length, outputCollection: config.output };
  }

  // ==================== Flatten ====================
  private executeFlatten(
    config: FlattenStepConfig,
  ): { inputRows: number; outputRows: number; outputCollection: string } {
    const records = this.getRecords(config.source);
    const inputRows = records.length;

    const results: DataRecordInput[] = [];
    const outputField = config.as ?? config.field;

    for (const record of records) {
      const arrayValue = this.expressionEvaluator.getNestedValue(record, config.field);

      if (!Array.isArray(arrayValue) || arrayValue.length === 0) {
        if (config.preserveEmpty) {
          const result = { ...record };
          result[outputField] = null;
          results.push(result);
        }
        continue;
      }

      for (const item of arrayValue) {
        const result = { ...record };
        result[outputField] = item;
        results.push(result);
      }
    }

    this.clearAndCreate(config.output);
    for (const record of results) {
      this.createRecord(config.output, record);
    }

    return { inputRows, outputRows: results.length, outputCollection: config.output };
  }
}
