type Serializable =
  | string
  | number
  | boolean
  | null
  | undefined
  | Serializable[]
  | { [k: string]: Serializable };

/**
 * Recursively converts bigint values to numbers (when safe) or strings.
 * Use this before JSON.stringify() on any AL0 SDK result.
 *
 * @example
 * const results = await al0.getResults(pollId);
 * console.log(JSON.stringify(serialize(results)));
 */
export function serialize<T>(value: T): Serializable {
  if (typeof value === "bigint") {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(serialize);
  }
  if (value !== null && typeof value === "object") {
    const out: { [k: string]: Serializable } = {};
    for (const [k, v] of Object.entries(value as object)) {
      out[k] = serialize(v);
    }
    return out;
  }
  return value as Serializable;
}
