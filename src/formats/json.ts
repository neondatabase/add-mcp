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

/** Preserves comments and formatting when possible. Skips entries that already exist by name. */
export function writeJsonConfig(
  filePath: string,
  config: ConfigFile,
  configKey: string,
): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  let content = "";
  let existingConfig: ConfigFile = {};

  if (existsSync(filePath)) {
    content = readFileSync(filePath, "utf-8");
    existingConfig = jsonc.parse(content) as ConfigFile;
  }

  // Determine which entries are truly new (not already present by name)
  const existingServers = (getNestedValue(existingConfig, configKey) ||
    {}) as ConfigFile;
  const newServers = (getNestedValue(config, configKey) || {}) as ConfigFile;

  const entriesToAdd: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(newServers)) {
    if (!(name in existingServers)) {
      entriesToAdd[name] = value;
    }
  }

  if (Object.keys(entriesToAdd).length === 0) {
    return; // Nothing new to add
  }

  if (content) {
    try {
      const fmt = detectIndent(content);
      const keyPath = configKey.split(".");

      // Add each new entry individually to preserve existing formatting
      for (const [name, value] of Object.entries(entriesToAdd)) {
        const edits = jsonc.modify(content, [...keyPath, name], value, {
          formattingOptions: fmt,
        });
        content = jsonc.applyEdits(content, edits);
      }

      writeFileSync(filePath, content);
      return;
    } catch {
      // jsonc-parser failed, fall back to JSON.stringify
    }
  }

  const mergedConfig = deepMerge(existingConfig, config);
  writeFileSync(filePath, JSON.stringify(mergedConfig, null, 2));
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
