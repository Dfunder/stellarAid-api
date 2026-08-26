/**
 * Creates a shallow copy of an object composed only of the specified keys.
 *
 * @param obj - The source object
 * @param keys - Array of property keys to pick
 * @returns New object containing only selected keys
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  if (!obj || typeof obj !== 'object') {
    return {} as Pick<T, K>;
  }
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj && obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Creates a shallow copy of an object excluding the specified keys.
 *
 * @param obj - The source object
 * @param keys - Array of property keys to omit
 * @returns New object without the omitted keys
 */
export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  if (!obj || typeof obj !== 'object') {
    return {} as Omit<T, K>;
  }
  const result = { ...obj } as Omit<T, K>;
  for (const key of keys) {
    delete (result as any)[key];
  }
  return result;
}

/**
 * Removes properties with `undefined` values from an object.
 *
 * @param obj - The source object
 * @returns New object with undefined properties stripped
 */
export function cleanUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  if (!obj || typeof obj !== 'object') {
    return {};
  }
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as any)[key] = value;
    }
  }
  return result;
}

/**
 * Groups elements of an array by a key returned by the selector function.
 *
 * @param array - Array of items to group
 * @param keyFn - Selector function returning grouping key
 * @returns Object mapping keys to grouped item arrays
 */
export function groupBy<T, K extends string | number | symbol>(
  array: T[],
  keyFn: (item: T) => K,
): Record<K, T[]> {
  if (!Array.isArray(array)) {
    return {} as Record<K, T[]>;
  }
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

/**
 * Splits an array into chunks of a specified maximum size.
 *
 * @param array - Source array
 * @param size - Maximum chunk size
 * @returns Array of chunked arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  if (!Array.isArray(array) || size <= 0) {
    return [];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Creates a deep copy of a serializable object.
 *
 * @param obj - Serializable object or value
 * @returns Deep cloned copy
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as any;
  }
  const clone: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    clone[key] = deepClone((obj as any)[key]);
  }
  return clone as T;
}
