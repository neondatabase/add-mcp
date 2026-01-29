import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import yaml from "js-yaml";
import type { ConfigFile } from "../types.js";

/**
 * Read a YAML config file
 */
export function readYamlConfig(filePath: string): ConfigFile {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, "utf-8");
  const parsed = yaml.load(content);

  return (parsed as ConfigFile) || {};
}

/**
 * Write a YAML config file
 */
export function writeYamlConfig(filePath: string, config: ConfigFile): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Read existing config and merge
  let existingConfig: ConfigFile = {};
  if (existsSync(filePath)) {
    existingConfig = readYamlConfig(filePath);
  }

  const mergedConfig = deepMerge(existingConfig, config);

  const content = yaml.dump(mergedConfig, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
  });

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
