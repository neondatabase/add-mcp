import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import * as jsonc from "jsonc-parser";
import type { ConfigFile } from "../types.js";

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
