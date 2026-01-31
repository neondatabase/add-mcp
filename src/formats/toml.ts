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

  const mergedConfig = deepMerge(existingConfig, config);
  const content = TOML.stringify(mergedConfig as TOML.JsonMap);

  writeFileSync(filePath, content);
}
