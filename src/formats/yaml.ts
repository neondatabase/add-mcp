import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import yaml from "js-yaml";
import type { ConfigFile } from "../types.js";
import { deepMerge } from "./utils.js";

export function readYamlConfig(filePath: string): ConfigFile {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, "utf-8");
  const parsed = yaml.load(content);

  return (parsed as ConfigFile) || {};
}

export function writeYamlConfig(filePath: string, config: ConfigFile): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

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
