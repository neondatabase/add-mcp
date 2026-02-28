import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import * as TOML from "@iarna/toml";
import type { ConfigFile } from "../types.js";
import { deepMerge } from "./utils.js";

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

  // Only add new top-level keys; don't overwrite existing ones
  const safeConfig: ConfigFile = {};
  for (const [key, value] of Object.entries(config)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existingConfig[key] &&
      typeof existingConfig[key] === "object"
    ) {
      // Merge sub-keys but skip existing entries
      const existingSub = existingConfig[key] as ConfigFile;
      const newSub = value as ConfigFile;
      const merged: ConfigFile = {};
      for (const [subKey, subValue] of Object.entries(newSub)) {
        if (!(subKey in existingSub)) {
          merged[subKey] = subValue;
        }
      }
      if (Object.keys(merged).length > 0) {
        safeConfig[key] = merged;
      }
    } else if (!(key in existingConfig)) {
      safeConfig[key] = value;
    }
  }

  if (Object.keys(safeConfig).length === 0) {
    return; // Nothing new to add
  }

  const mergedConfig = deepMerge(existingConfig, safeConfig);
  const content = TOML.stringify(mergedConfig as TOML.JsonMap);

  writeFileSync(filePath, content);
}
