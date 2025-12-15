/**
 * Promo code generator - generates unique codes
 */

import type { CodeGenerationOptions, CodePattern } from "@simple-proto/discounts-types";

const DEFAULT_CHARSETS: Record<CodePattern, string> = {
  alphanumeric: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", // Excludes 0,O,1,I by default
  alphabetic: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  numeric: "0123456789",
  custom: "",
};

/**
 * Generates promo codes based on options
 */
export class CodeGenerator {
  /**
   * Generate a single code
   */
  generate(options: CodeGenerationOptions): string {
    const charset = this.getCharset(options);
    const coreLength = options.length;

    let code = "";
    for (let i = 0; i < coreLength; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      const char = charset[randomIndex];
      if (char !== undefined) {
        code += char;
      }
    }

    if (!options.uppercase && options.uppercase !== undefined) {
      code = code.toLowerCase();
    }

    const prefix = options.prefix ?? "";
    const suffix = options.suffix ?? "";

    return prefix + code + suffix;
  }

  /**
   * Generate multiple unique codes
   */
  generateBatch(count: number, options: CodeGenerationOptions, existingCodes: Set<string> = new Set<string>()): string[] {
    const codes: string[] = [];
    const allCodes = new Set(existingCodes);
    const maxAttempts = count * 10; // Prevent infinite loops
    let attempts = 0;

    while (codes.length < count && attempts < maxAttempts) {
      const code = this.generate(options);
      if (!allCodes.has(code)) {
        codes.push(code);
        allCodes.add(code);
      }
      attempts++;
    }

    if (codes.length < count) {
      throw new Error(
        `Could not generate ${String(count)} unique codes. Generated ${String(codes.length)}. ` +
          `Consider increasing code length or changing pattern.`
      );
    }

    return codes;
  }

  /**
   * Validate a code format (not checking if it exists or is valid for discount)
   */
  validateFormat(code: string, options: CodeGenerationOptions): boolean {
    const prefix = options.prefix ?? "";
    const suffix = options.suffix ?? "";

    if (prefix && !code.startsWith(prefix)) return false;
    if (suffix && !code.endsWith(suffix)) return false;

    const coreCode = code.slice(prefix.length, suffix ? -suffix.length : undefined);
    if (coreCode.length !== options.length) return false;

    const charset = this.getCharset(options);
    const checkCode = options.uppercase === false ? coreCode : coreCode.toUpperCase();

    for (const char of checkCode) {
      if (!charset.includes(char)) return false;
    }

    return true;
  }

  /**
   * Calculate total possible combinations for given options
   */
  calculatePossibleCombinations(options: CodeGenerationOptions): number {
    const charset = this.getCharset(options);
    return Math.pow(charset.length, options.length);
  }

  private getCharset(options: CodeGenerationOptions): string {
    let charset = options.pattern === "custom" && options.customCharset
      ? options.customCharset
      : DEFAULT_CHARSETS[options.pattern];

    if (options.excludeChars) {
      for (const char of options.excludeChars) {
        charset = charset.replace(new RegExp(char, "gi"), "");
      }
    }

    return charset;
  }
}
