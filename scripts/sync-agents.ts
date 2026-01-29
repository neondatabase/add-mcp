#!/usr/bin/env tsx

/**
 * Syncs agent information to README.md and package.json
 *
 * Run with: npx tsx scripts/sync-agents.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { agents } from "../src/agents.js";

const rootDir = join(import.meta.dirname, "..");

// Update package.json keywords
const packageJsonPath = join(rootDir, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

const baseKeywords = ["cli", "mcp", "model-context-protocol", "ai-agents"];
const agentKeywords = Object.keys(agents);

packageJson.keywords = [...baseKeywords, ...agentKeywords];

writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
console.log("✓ Updated package.json keywords");

// Update README.md agents table
const readmePath = join(rootDir, "README.md");
let readme = readFileSync(readmePath, "utf-8");

const tableStart = "<!-- AGENTS_TABLE_START -->";
const tableEnd = "<!-- AGENTS_TABLE_END -->";

const startIndex = readme.indexOf(tableStart);
const endIndex = readme.indexOf(tableEnd);

if (startIndex !== -1 && endIndex !== -1) {
  const tableRows = Object.entries(agents).map(([key, config]) => {
    const hasLocal = config.localConfigPath ? "Yes" : "No";
    return `| ${config.displayName} | \`${key}\` | ${config.format.toUpperCase()} | ${hasLocal} |`;
  });

  const newTable = `${tableStart}
| Agent | CLI Key | Format | Local Support |
|-------|---------|--------|---------------|
${tableRows.join("\n")}
${tableEnd}`;

  readme =
    readme.slice(0, startIndex) +
    newTable +
    readme.slice(endIndex + tableEnd.length);
  writeFileSync(readmePath, readme);
  console.log("✓ Updated README.md agents table");
} else {
  console.log("⚠ README.md agents table markers not found, skipping");
}

console.log("\nSync complete!");
