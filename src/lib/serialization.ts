/**
 * Recursively converts Prisma Decimal and Date objects into standard JSON-serializable types.
 * Decimal values are converted to standard JS numbers, and Dates to ISO strings.
 */
export function serializeData<T>(obj: T): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // If it's a Decimal object (from Prisma / decimal.js)
  if (
    typeof obj === "object" &&
    ((obj as any).constructor?.name === "Decimal" || (obj as any).d && (obj as any).s && (obj as any).e !== undefined)
  ) {
    return Number((obj as any).toString());
  }

  // If it's a Date
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // If it's an Array
  if (Array.isArray(obj)) {
    return obj.map((item) => serializeData(item));
  }

  // If it's a plain object
  if (typeof obj === "object") {
    const serialized: any = {};
    for (const key of Object.keys(obj)) {
      serialized[key] = serializeData((obj as any)[key]);
    }
    return serialized;
  }

  return obj;
}
