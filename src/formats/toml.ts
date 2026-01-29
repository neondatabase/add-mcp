import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import * as TOML from "@iarna/toml";
import type { ConfigFile } from "../types.js";

/**
 * Read a TOML config file
 */
export function readTomlConfig(filePath: string): ConfigFile {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, "utf-8");
  const parsed = TOML.parse(content);

  return parsed as ConfigFile;
}

/**
 * Write a TOML config file
 */
export function writeTomlConfig(filePath: string, config: ConfigFile): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Read existing config and merge
  let existingConfig: ConfigFile = {};
  if (existsSync(filePath)) {
    existingConfig = readTomlConfig(filePath);
  }

  const mergedConfig = deepMerge(existingConfig, config);

  // @iarna/toml stringify expects a specific type
  const content = TOML.stringify(mergedConfig as TOML.JsonMap);

  writeFileSync(filePath, content);
}

/**
 * Deep merge two objects
 */
function deepMerge(target: ConfigFile, source: ConfigFile): ConfigFile {
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
