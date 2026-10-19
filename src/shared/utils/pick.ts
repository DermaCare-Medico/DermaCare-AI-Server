
/**
 * Picks only the specified fields from an object.
 * Why use it?
 * Prevents unwanted fields from being passed into update operations
 * and avoids repeating the same field-selection logic across modules.
 *
 * Example:
 * pick(req.body, ["name", "email"])
 * If req.body also contains "role" or "isVerified",
 * those fields will be excluded from the returned object.
 *
 * Note: This is a field-selection utility, not a replacement
 * for validation or authorization.
 */
export function pick<T extends object, K extends keyof T>(
  source: T,
  allowedFields: readonly K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      result[field] = source[field];
    }
  }

  return result;
}
