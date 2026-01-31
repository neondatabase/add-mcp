import type { ConfigFile } from "../types.js";

export function deepMerge(target: ConfigFile, source: ConfigFile): ConfigFile {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue)
    ) {
      result[key] = deepMerge(
        (targetValue && typeof targetValue === "object"
          ? targetValue
          : {}) as ConfigFile,
        sourceValue as ConfigFile,
      );
    } else {
      result[key] = sourceValue;
    }
  }

  return result;
}

export function getNestedValue(obj: ConfigFile, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as ConfigFile)[key];
    } else {
      return undefined;
    }
  }

  return current;
}
