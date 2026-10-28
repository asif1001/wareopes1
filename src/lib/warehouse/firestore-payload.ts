/**
 * Firestore rejects documents that contain `undefined` values or non-finite
 * numbers (NaN / Infinity). The warehouse layout model deliberately uses
 * `undefined` for "not set" (for example `sub.locations` or `uploadedBy`), so
 * every write has to be sanitised first. Without this guard the whole save is
 * refused and the page silently falls back to browser storage.
 */

export class InvalidWarehousePayload extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidWarehousePayload";
  }
}

const MAX_REPORTED_FIELDS = 3;

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

/**
 * Copy a payload into the shape Firestore accepts:
 * - `undefined` object fields are dropped and `undefined` array entries removed
 * - valid `Date` values are kept (Firestore stores them as timestamps)
 * - non-finite numbers are reported instead of being written as broken data
 */
export function prepareForFirestore<T>(value: T, label = "payload"): T {
  const invalidNumbers: string[] = [];

  const walk = (input: unknown, path: string): unknown => {
    if (input === undefined || input === null) return input;
    if (typeof input === "number") {
      if (!Number.isFinite(input)) invalidNumbers.push(path);
      return input;
    }
    if (input instanceof Date) return isValidDate(input) ? input : null;
    if (Array.isArray(input)) {
      return input
        .map((entry, index) => walk(entry, `${path}[${index}]`))
        .filter((entry) => entry !== undefined);
    }
    if (typeof input === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(
        input as Record<string, unknown>,
      )) {
        if (entry === undefined) continue;
        result[key] = walk(entry, `${path}.${key}`);
      }
      return result;
    }
    return input;
  };

  const prepared = walk(value, label) as T;

  if (invalidNumbers.length) {
    const shown = invalidNumbers.slice(0, MAX_REPORTED_FIELDS).join(", ");
    const rest =
      invalidNumbers.length > MAX_REPORTED_FIELDS
        ? ` (+${invalidNumbers.length - MAX_REPORTED_FIELDS} more)`
        : "";
    throw new InvalidWarehousePayload(
      `The ${label} has an invalid number in ${shown}${rest}. Correct the value and save again.`,
    );
  }

  return prepared;
}
