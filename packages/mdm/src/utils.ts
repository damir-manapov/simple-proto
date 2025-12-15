/**
 * String matching utilities for MDM
 * Implements Levenshtein distance and Soundex algorithms
 */

/**
 * Calculate Levenshtein distance between two strings
 * @returns The number of single-character edits needed to transform a into b
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  // Initialize first row and column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    const row = matrix[0];
    if (row) {
      row[j] = j;
    }
  }

  // Fill the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
      const prevRow = matrix[i - 1];
      const currRow = matrix[i];
      if (prevRow && currRow) {
        const deletion = (prevRow[j] ?? 0) + 1;
        const insertion = (currRow[j - 1] ?? 0) + 1;
        const substitution = (prevRow[j - 1] ?? 0) + cost;
        currRow[j] = Math.min(deletion, insertion, substitution);
      }
    }
  }

  const lastRow = matrix[b.length];
  return lastRow?.[a.length] ?? 0;
}

/**
 * Calculate similarity score based on Levenshtein distance
 * @returns Score between 0.0 and 1.0
 */
export function levenshteinSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  const distance = levenshteinDistance(a, b);
  return 1.0 - distance / maxLen;
}

/**
 * Calculate Soundex phonetic code for a string
 * @returns 4-character Soundex code
 */
export function soundex(str: string): string {
  if (!str || str.length === 0) return "0000";

  const s = str.toUpperCase().replace(/[^A-Z]/g, "");
  if (s.length === 0) return "0000";

  // Soundex codes for letters
  const codes: Record<string, string> = {
    B: "1",
    F: "1",
    P: "1",
    V: "1",
    C: "2",
    G: "2",
    J: "2",
    K: "2",
    Q: "2",
    S: "2",
    X: "2",
    Z: "2",
    D: "3",
    T: "3",
    L: "4",
    M: "5",
    N: "5",
    R: "6",
  };

  const firstChar = s[0];
  if (!firstChar) return "0000";

  let result = firstChar;
  let lastCode = codes[firstChar] ?? "";

  for (let i = 1; i < s.length && result.length < 4; i++) {
    const char = s[i];
    if (!char) continue;
    const code = codes[char] ?? "";
    // Skip vowels and same consecutive codes
    if (code && code !== lastCode) {
      result += code;
    }
    if (code) {
      lastCode = code;
    }
  }

  // Pad with zeros
  return (result + "0000").slice(0, 4);
}

/**
 * Check if two strings have matching Soundex codes
 */
export function soundexMatch(a: string, b: string): boolean {
  return soundex(a) === soundex(b);
}

/**
 * Calculate Soundex similarity (1.0 if match, 0.0 otherwise)
 * For partial matching, compare individual Soundex digits
 */
export function soundexSimilarity(a: string, b: string): number {
  const codeA = soundex(a);
  const codeB = soundex(b);

  if (codeA === codeB) return 1.0;

  // Partial match: count matching characters
  let matches = 0;
  for (let i = 0; i < 4; i++) {
    if (codeA[i] === codeB[i]) matches++;
  }

  return matches / 4;
}

/**
 * Normalize a string for comparison (lowercase, trim, collapse whitespace)
 */
export function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Get a value from an object by path (e.g., "address.city")
 */
export function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Set a value in an object by path, creating nested objects as needed
 */
export function setValueByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!part) continue;
    current[part] ??= {};
    const next = current[part];
    if (typeof next === "object" && next !== null) {
      current = next as Record<string, unknown>;
    }
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart) {
    current[lastPart] = value;
  }
}
