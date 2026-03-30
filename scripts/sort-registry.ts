#!/usr/bin/env tsx

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const REGISTRY_PATH = path.resolve(process.cwd(), "registry.json");

type RegistryLikeEntry = {
  title?: unknown;
  name?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractSortableEntry(value: unknown): RegistryLikeEntry {
  if (!isRecord(value)) {
    throw new Error("Entry must be an object");
  }
  if ("server" in value) {
    const wrapped = value.server;
    if (!isRecord(wrapped)) {
      throw new Error("Wrapped entry 'server' must be an object");
    }
    return wrapped;
  }
  return value;
}

function getSortFields(value: unknown): { title: string; name: string } {
  const entry = extractSortableEntry(value);
  if (typeof entry.title !== "string" || entry.title.trim().length === 0) {
    throw new Error("Every registry entry must include a non-empty 'title'");
  }
  return {
    title: entry.title,
    name: typeof entry.name === "string" ? entry.name : "",
  };
}

function compareEntries(a: unknown, b: unknown): number {
  const aFields = getSortFields(a);
  const bFields = getSortFields(b);
  const titleDiff = aFields.title.localeCompare(bFields.title, undefined, {
    sensitivity: "base",
  });
  if (titleDiff !== 0) return titleDiff;
  return aFields.name.localeCompare(bFields.name, undefined, {
    sensitivity: "base",
  });
}

function sortedCopy(values: unknown[]): unknown[] {
  return [...values].sort(compareEntries);
}

async function main(): Promise<void> {
  const raw = await readFile(REGISTRY_PATH, "utf8");
  const parsed: unknown = JSON.parse(raw);

  if (Array.isArray(parsed)) {
    const sorted = sortedCopy(parsed);
    await writeFile(REGISTRY_PATH, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
    console.log(`Sorted ${sorted.length} registry entries by title`);
    return;
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.servers)) {
    throw new Error(
      "registry.json must be either an array of entries or an object with a 'servers' array",
    );
  }

  const sortedServers = sortedCopy(parsed.servers);
  const output = {
    ...parsed,
    servers: sortedServers,
  };
  await writeFile(REGISTRY_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Sorted ${sortedServers.length} registry entries by title`);
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Failed to sort registry.json";
  console.error(message);
  process.exit(1);
});
