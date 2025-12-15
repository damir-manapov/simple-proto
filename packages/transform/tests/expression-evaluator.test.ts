import { describe, it, expect } from "vitest";
import { ExpressionEvaluator } from "../src/expression-evaluator.js";

describe("ExpressionEvaluator", () => {
  const evaluator = new ExpressionEvaluator();

  describe("field expression", () => {
    it("should get simple field value", () => {
      const record = { name: "John", age: 30 };
      expect(evaluator.evaluate({ type: "field", path: "name" }, record)).toBe("John");
      expect(evaluator.evaluate({ type: "field", path: "age" }, record)).toBe(30);
    });

    it("should get nested field value", () => {
      const record = { user: { address: { city: "NYC" } } };
      expect(evaluator.evaluate({ type: "field", path: "user.address.city" }, record)).toBe("NYC");
    });

    it("should return undefined for missing field", () => {
      const record = { name: "John" };
      expect(evaluator.evaluate({ type: "field", path: "missing" }, record)).toBeUndefined();
    });
  });

  describe("literal expression", () => {
    it("should return literal value", () => {
      expect(evaluator.evaluate({ type: "literal", value: 42 }, {})).toBe(42);
      expect(evaluator.evaluate({ type: "literal", value: "hello" }, {})).toBe("hello");
      expect(evaluator.evaluate({ type: "literal", value: null }, {})).toBeNull();
    });
  });

  describe("concat expression", () => {
    it("should concatenate values", () => {
      const record = { first: "John", last: "Doe" };
      expect(
        evaluator.evaluate(
          {
            type: "concat",
            values: [
              { type: "field", path: "first" },
              { type: "literal", value: " " },
              { type: "field", path: "last" },
            ],
          },
          record,
        ),
      ).toBe("John Doe");
    });

    it("should use separator", () => {
      const record = { a: "1", b: "2", c: "3" };
      expect(
        evaluator.evaluate(
          {
            type: "concat",
            values: [
              { type: "field", path: "a" },
              { type: "field", path: "b" },
              { type: "field", path: "c" },
            ],
            separator: "-",
          },
          record,
        ),
      ).toBe("1-2-3");
    });
  });

  describe("template expression", () => {
    it("should substitute template variables", () => {
      const record = { name: "John", orderId: "ORD-123" };
      expect(
        evaluator.evaluate(
          { type: "template", template: "Hello {{name}}, your order {{orderId}} is ready" },
          record,
        ),
      ).toBe("Hello John, your order ORD-123 is ready");
    });

    it("should handle missing variables", () => {
      const record = { name: "John" };
      expect(
        evaluator.evaluate({ type: "template", template: "Hello {{name}}, id: {{id}}" }, record),
      ).toBe("Hello John, id: ");
    });
  });

  describe("math expression", () => {
    it("should perform addition", () => {
      const record = { a: 10, b: 5 };
      expect(
        evaluator.evaluate(
          {
            type: "math",
            operator: "+",
            left: { type: "field", path: "a" },
            right: { type: "field", path: "b" },
          },
          record,
        ),
      ).toBe(15);
    });

    it("should perform subtraction", () => {
      const record = { a: 10, b: 5 };
      expect(
        evaluator.evaluate(
          {
            type: "math",
            operator: "-",
            left: { type: "field", path: "a" },
            right: { type: "field", path: "b" },
          },
          record,
        ),
      ).toBe(5);
    });

    it("should perform multiplication", () => {
      const record = { price: 10, quantity: 3 };
      expect(
        evaluator.evaluate(
          {
            type: "math",
            operator: "*",
            left: { type: "field", path: "price" },
            right: { type: "field", path: "quantity" },
          },
          record,
        ),
      ).toBe(30);
    });

    it("should perform division", () => {
      const record = { total: 100, count: 4 };
      expect(
        evaluator.evaluate(
          {
            type: "math",
            operator: "/",
            left: { type: "field", path: "total" },
            right: { type: "field", path: "count" },
          },
          record,
        ),
      ).toBe(25);
    });

    it("should handle round", () => {
      const record = { value: 3.7 };
      expect(
        evaluator.evaluate(
          { type: "math", operator: "round", left: { type: "field", path: "value" } },
          record,
        ),
      ).toBe(4);
    });

    it("should handle floor", () => {
      const record = { value: 3.7 };
      expect(
        evaluator.evaluate(
          { type: "math", operator: "floor", left: { type: "field", path: "value" } },
          record,
        ),
      ).toBe(3);
    });

    it("should handle ceil", () => {
      const record = { value: 3.2 };
      expect(
        evaluator.evaluate(
          { type: "math", operator: "ceil", left: { type: "field", path: "value" } },
          record,
        ),
      ).toBe(4);
    });
  });

  describe("coalesce expression", () => {
    it("should return first non-null value", () => {
      const record = { a: null, b: undefined, c: "found" };
      expect(
        evaluator.evaluate(
          {
            type: "coalesce",
            values: [
              { type: "field", path: "a" },
              { type: "field", path: "b" },
              { type: "field", path: "c" },
            ],
          },
          record,
        ),
      ).toBe("found");
    });

    it("should return null if all values are null", () => {
      const record = { a: null, b: null };
      expect(
        evaluator.evaluate(
          {
            type: "coalesce",
            values: [
              { type: "field", path: "a" },
              { type: "field", path: "b" },
            ],
          },
          record,
        ),
      ).toBeNull();
    });
  });

  describe("conditional expression", () => {
    it("should return then value when condition is true", () => {
      const record = { age: 25 };
      expect(
        evaluator.evaluate(
          {
            type: "conditional",
            condition: { field: "age", operator: "gte", value: 18 },
            then: { type: "literal", value: "adult" },
            else: { type: "literal", value: "minor" },
          },
          record,
        ),
      ).toBe("adult");
    });

    it("should return else value when condition is false", () => {
      const record = { age: 15 };
      expect(
        evaluator.evaluate(
          {
            type: "conditional",
            condition: { field: "age", operator: "gte", value: 18 },
            then: { type: "literal", value: "adult" },
            else: { type: "literal", value: "minor" },
          },
          record,
        ),
      ).toBe("minor");
    });
  });

  describe("array expression", () => {
    it("should get array length", () => {
      const record = { items: [1, 2, 3, 4, 5] };
      expect(
        evaluator.evaluate({ type: "array", operation: "length", path: "items" }, record),
      ).toBe(5);
    });

    it("should get first element", () => {
      const record = { items: ["a", "b", "c"] };
      expect(
        evaluator.evaluate({ type: "array", operation: "first", path: "items" }, record),
      ).toBe("a");
    });

    it("should get last element", () => {
      const record = { items: ["a", "b", "c"] };
      expect(
        evaluator.evaluate({ type: "array", operation: "last", path: "items" }, record),
      ).toBe("c");
    });

    it("should join array elements", () => {
      const record = { items: ["a", "b", "c"] };
      expect(
        evaluator.evaluate(
          { type: "array", operation: "join", path: "items", separator: "-" },
          record,
        ),
      ).toBe("a-b-c");
    });

    it("should check includes", () => {
      const record = { items: [1, 2, 3] };
      expect(
        evaluator.evaluate(
          { type: "array", operation: "includes", path: "items", value: 2 },
          record,
        ),
      ).toBe(true);
      expect(
        evaluator.evaluate(
          { type: "array", operation: "includes", path: "items", value: 5 },
          record,
        ),
      ).toBe(false);
    });
  });

  describe("string expression", () => {
    it("should convert to uppercase", () => {
      const record = { name: "John Doe" };
      expect(
        evaluator.evaluate({ type: "string", operation: "upper", path: "name" }, record),
      ).toBe("JOHN DOE");
    });

    it("should convert to lowercase", () => {
      const record = { name: "John Doe" };
      expect(
        evaluator.evaluate({ type: "string", operation: "lower", path: "name" }, record),
      ).toBe("john doe");
    });

    it("should trim whitespace", () => {
      const record = { name: "  John  " };
      expect(
        evaluator.evaluate({ type: "string", operation: "trim", path: "name" }, record),
      ).toBe("John");
    });

    it("should split string", () => {
      const record = { csv: "a,b,c" };
      expect(
        evaluator.evaluate(
          { type: "string", operation: "split", path: "csv", separator: "," },
          record,
        ),
      ).toEqual(["a", "b", "c"]);
    });

    it("should get substring", () => {
      const record = { text: "Hello World" };
      expect(
        evaluator.evaluate(
          { type: "string", operation: "substring", path: "text", start: 0, end: 5 },
          record,
        ),
      ).toBe("Hello");
    });

    it("should replace pattern", () => {
      const record = { text: "foo bar foo" };
      expect(
        evaluator.evaluate(
          { type: "string", operation: "replace", path: "text", pattern: "foo", replacement: "baz" },
          record,
        ),
      ).toBe("baz bar baz");
    });

    it("should get string length", () => {
      const record = { name: "Hello" };
      expect(
        evaluator.evaluate({ type: "string", operation: "length", path: "name" }, record),
      ).toBe(5);
    });
  });

  describe("date expression", () => {
    it("should return current date for now", () => {
      const result = evaluator.evaluate({ type: "date", operation: "now" }, {});
      expect(typeof result).toBe("string");
      expect(() => new Date(result as string)).not.toThrow();
    });

    it("should format date", () => {
      const record = { date: "2024-01-15T10:30:00Z" };
      const result = evaluator.evaluate(
        { type: "date", operation: "format", field: "date", format: "YYYY-MM-DD" },
        record,
      );
      expect(result).toBe("2024-01-15");
    });

    it("should add days to date", () => {
      const record = { date: "2024-01-15T00:00:00Z" };
      const result = evaluator.evaluate(
        { type: "date", operation: "add", field: "date", amount: 5, unit: "day" },
        record,
      );
      expect(result).toContain("2024-01-20");
    });
  });
});
