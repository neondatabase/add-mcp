#!/usr/bin/env tsx

/**
 * Unit tests for mcp-lock.ts - persistence for last selected agents.
 *
 * Run with: npx tsx tests/mcp-lock.test.ts
 */

import assert from "node:assert";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  getLastSelectedAgents,
  getMcpLockPath,
  readMcpLock,
  saveSelectedAgents,
} from "../src/mcp-lock.js";

let passed = 0;
let failed = 0;
let tempDirs: string[] = [];
const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`\u2713 ${name}`);
    passed++;
  } catch (err) {
    console.log(`\u2717 ${name}`);
    console.error(`  ${(err as Error).message}`);
    failed++;
  }
}

function setupTempHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "add-mcp-lock-test-"));
  process.env.HOME = dir;
  process.env.USERPROFILE = dir;
  tempDirs.push(dir);
  return dir;
}

function cleanup() {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
  if (originalHome !== undefined) {
    process.env.HOME = originalHome;
  } else {
    delete process.env.HOME;
  }
  if (originalUserProfile !== undefined) {
    process.env.USERPROFILE = originalUserProfile;
  } else {
    delete process.env.USERPROFILE;
  }
}

async function run() {
  await test("readMcpLock returns empty lock for missing file", async () => {
    setupTempHome();
    const lock = await readMcpLock();
    assert.strictEqual(lock.version, 1);
    assert.strictEqual(lock.lastSelectedAgents, undefined);
  });

  await test("saveSelectedAgents persists last selection", async () => {
    setupTempHome();
    await saveSelectedAgents(["cursor", "vscode"]);
    const stored = await getLastSelectedAgents();
    assert.deepStrictEqual(stored, ["cursor", "vscode"]);
  });

  await test("readMcpLock resets when version is missing", async () => {
    setupTempHome();
    const lockPath = getMcpLockPath();
    mkdirSync(dirname(lockPath), { recursive: true });
    writeFileSync(lockPath, JSON.stringify({ lastSelectedAgents: ["zed"] }));
    const lock = await readMcpLock();
    assert.strictEqual(lock.version, 1);
    assert.strictEqual(lock.lastSelectedAgents, undefined);
  });

  cleanup();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

await run();
