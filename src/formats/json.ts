import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import * as jsonc from "jsonc-parser";
import type { ConfigFile } from "../types.js";
import { deepMerge, getNestedValue } from "./utils.js";

function detectIndent(text: string): {
  tabSize: number;
  insertSpaces: boolean;
} {
  let result: { tabSize: number; insertSpaces: boolean } | null = null;

  jsonc.visit(text, {
    onObjectProperty: (
      _property,
      offset,
      _length,
      startLine,
      startCharacter,
    ) => {
      if (result === null && startLine > 0 && startCharacter > 0) {
        const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
        const whitespace = text.slice(lineStart, offset);
        result = {
          tabSize: startCharacter,
          insertSpaces: !whitespace.includes("\t"),
        };
      }
    },
  });

  return result || { tabSize: 2, insertSpaces: true };
}

export function readJsonConfig(filePath: string): ConfigFile {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, "utf-8");
  const parsed = jsonc.parse(content);
  return parsed as ConfigFile;
}

/** Preserves comments and formatting when possible */
export function writeJsonConfig(
  filePath: string,
  config: ConfigFile,
  configKey: string,
): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  let originalContent = "";
  let existingConfig: ConfigFile = {};

  if (existsSync(filePath)) {
    originalContent = readFileSync(filePath, "utf-8");
    existingConfig = jsonc.parse(originalContent) as ConfigFile;
  }

  const mergedConfig = deepMerge(existingConfig, config);

  if (originalContent) {
    try {
      const configKeyPath = configKey.split(".");
      const newValue = getNestedValue(mergedConfig, configKey);
      const edits = jsonc.modify(originalContent, configKeyPath, newValue, {
        formattingOptions: detectIndent(originalContent),
      });
      const updatedContent = jsonc.applyEdits(originalContent, edits);
      writeFileSync(filePath, updatedContent);
      return;
    } catch {
      // jsonc-parser failed, fall back to JSON.stringify
    }
  }

  writeFileSync(filePath, JSON.stringify(mergedConfig, null, 2));
}

/**
 * Replace exactly one nested JSON entry while preserving surrounding file content.
 * Example path: "mcpServers.my-server"
 */
export function writeJsonConfigAtPath(
  filePath: string,
  keyPath: string,
  value: unknown,
): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const pathParts = keyPath.split(".");
  let originalContent = "";
  let fallbackConfig: ConfigFile = {};

  if (existsSync(filePath)) {
    originalContent = readFileSync(filePath, "utf-8");
    fallbackConfig = jsonc.parse(originalContent) as ConfigFile;
  }

  if (originalContent) {
    try {
      const edits = jsonc.modify(originalContent, pathParts, value, {
        formattingOptions: detectIndent(originalContent),
      });
      const updatedContent = jsonc.applyEdits(originalContent, edits);
      writeFileSync(filePath, updatedContent);
      return;
    } catch {
      // jsonc-parser failed, fall back to JSON.stringify
    }
  }

  setNestedValue(fallbackConfig, keyPath, value);
  writeFileSync(filePath, JSON.stringify(fallbackConfig, null, 2));
}

export function writeJsonConfigExact(
  filePath: string,
  config: ConfigFile,
): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filePath, JSON.stringify(config, null, 2));
}

export function setNestedValue(
  obj: ConfigFile,
  path: string,
  value: unknown,
): void {
  const keys = path.split(".");
  const lastKey = keys.pop();

  if (!lastKey) return;

  let current = obj;
  for (const key of keys) {
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key] as ConfigFile;
  }

  current[lastKey] = value;
}
