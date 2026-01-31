import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import * as TOML from "@iarna/toml";
import type { ConfigFile } from "../types.js";

export function readTomlConfig(filePath: string): ConfigFile {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, "utf-8");
  const parsed = TOML.parse(content);

  return parsed as ConfigFile;
}

export function writeTomlConfig(filePath: string, config: ConfigFile): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  let existingConfig: ConfigFile = {};
  if (existsSync(filePath)) {
    existingConfig = readTomlConfig(filePath);
  }

  const mergedConfig = deepMerge(existingConfig, config);
  const content = TOML.stringify(mergedConfig as TOML.JsonMap);

  writeFileSync(filePath, content);
}

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
