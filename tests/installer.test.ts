#!/usr/bin/env tsx

/**
 * Unit tests for installer.ts
 *
 * Run with: npx tsx tests/installer.test.ts
 */

import assert from "node:assert";
import { buildServerConfig } from "../src/installer.js";
import { parseSource } from "../src/source-parser.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`✗ ${name}`);
    console.error(`  ${(err as Error).message}`);
    failed++;
  }
}

// buildServerConfig tests - Remote
test("buildServerConfig - remote URL defaults to http", () => {
  const parsed = parseSource("https://mcp.example.com/api");
  const config = buildServerConfig(parsed);

  assert.strictEqual(config.type, "http");
  assert.strictEqual(config.url, "https://mcp.example.com/api");
  assert.strictEqual(config.command, undefined);
});

test("buildServerConfig - remote URL with path", () => {
  const parsed = parseSource("https://api.company.com/mcp/v1");
  const config = buildServerConfig(parsed);

  assert.strictEqual(config.type, "http");
  assert.strictEqual(config.url, "https://api.company.com/mcp/v1");
});

test("buildServerConfig - remote URL with transport sse", () => {
  const parsed = parseSource("https://mcp.example.com/sse");
  const config = buildServerConfig(parsed, { transport: "sse" });

  assert.strictEqual(config.type, "sse");
  assert.strictEqual(config.url, "https://mcp.example.com/sse");
});

test("buildServerConfig - remote URL with transport http", () => {
  const parsed = parseSource("https://mcp.example.com/mcp");
  const config = buildServerConfig(parsed, { transport: "http" });

  assert.strictEqual(config.type, "http");
  assert.strictEqual(config.url, "https://mcp.example.com/mcp");
});

// buildServerConfig tests - Package
test("buildServerConfig - simple package", () => {
  const parsed = parseSource("mcp-server-postgres");
  const config = buildServerConfig(parsed);

  assert.strictEqual(config.command, "npx");
  assert.deepStrictEqual(config.args, ["-y", "mcp-server-postgres"]);
  assert.strictEqual(config.url, undefined);
});

test("buildServerConfig - scoped package", () => {
  const parsed = parseSource("@modelcontextprotocol/server-postgres");
  const config = buildServerConfig(parsed);

  assert.strictEqual(config.command, "npx");
  assert.deepStrictEqual(config.args, [
    "-y",
    "@modelcontextprotocol/server-postgres",
  ]);
});

test("buildServerConfig - package with version", () => {
  const parsed = parseSource("mcp-server@1.0.0");
  const config = buildServerConfig(parsed);

  assert.strictEqual(config.command, "npx");
  assert.deepStrictEqual(config.args, ["-y", "mcp-server@1.0.0"]);
});

// buildServerConfig tests - Command
test("buildServerConfig - npx command", () => {
  const parsed = parseSource("npx -y @org/mcp-server");
  const config = buildServerConfig(parsed);

  assert.strictEqual(config.command, "npx");
  assert.deepStrictEqual(config.args, ["-y", "@org/mcp-server"]);
});

test("buildServerConfig - node command", () => {
  const parsed = parseSource("node /path/to/server.js --port 3000");
  const config = buildServerConfig(parsed);

  assert.strictEqual(config.command, "node");
  assert.deepStrictEqual(config.args, ["/path/to/server.js", "--port", "3000"]);
});

test("buildServerConfig - python command", () => {
  const parsed = parseSource("python -m mcp_server");
  const config = buildServerConfig(parsed);

  assert.strictEqual(config.command, "python");
  assert.deepStrictEqual(config.args, ["-m", "mcp_server"]);
});

test("buildServerConfig - command with multiple args", () => {
  const parsed = parseSource(
    "npx -y mcp-server --db postgres://localhost --verbose",
  );
  const config = buildServerConfig(parsed);

  assert.strictEqual(config.command, "npx");
  assert.deepStrictEqual(config.args, [
    "-y",
    "mcp-server",
    "--db",
    "postgres://localhost",
    "--verbose",
  ]);
});

// Summary
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
