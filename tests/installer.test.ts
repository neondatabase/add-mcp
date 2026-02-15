#!/usr/bin/env tsx

/**
 * Unit tests for installer.ts
 *
 * Run with: npx tsx tests/installer.test.ts
 */

import assert from "node:assert";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildServerConfig, installServer } from "../src/installer.js";
import { agents } from "../src/agents.js";
import { parseSource } from "../src/source-parser.js";
import type { AgentType } from "../src/types.js";

let passed = 0;
let failed = 0;
let tempDirs: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`\u2713 ${name}`);
    passed++;
  } catch (err) {
    console.log(`\u2717 ${name}`);
    console.error(`  ${(err as Error).message}`);
    failed++;
  }
}

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "add-mcp-installer-test-"));
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
  tempDirs = [];
}

function readJsonConfig(filePath: string): Record<string, unknown> {
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}

// buildServerConfig tests - Remote
test("buildServerConfig - remote URL defaults to http", () => {
  const parsed = parseSource("https://mcp.example.com/api");
  const config = buildServerConfig(parsed);

  assert.strictEqual(config.type, "http");
  assert.strictEqual(config.url, "https://mcp.example.com/api");
  assert.strictEqual(config.command, undefined);
});

test("buildServerConfig - remote URL with headers", () => {
  const parsed = parseSource("https://mcp.example.com/api");
  const config = buildServerConfig(parsed, {
    headers: {
      Authorization: "Bearer token",
      "X-Custom": "value",
    },
  });

  assert.deepStrictEqual(config.headers, {
    Authorization: "Bearer token",
    "X-Custom": "value",
  });
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

// ============================================
// installServer with routing tests
// ============================================

test("installServer - routes agents based on routing map", () => {
  const tempDir = createTempDir();
  const parsed = parseSource("https://mcp.example.com/api");
  const config = buildServerConfig(parsed);

  const agentTypes: AgentType[] = ["cursor", "vscode"];
  const routing = new Map<AgentType, "local" | "global">();
  routing.set("cursor", "local");
  routing.set("vscode", "local");

  const results = installServer("example", config, agentTypes, {
    routing,
    cwd: tempDir,
  });

  assert.strictEqual(results.size, 2);

  // Both should succeed
  const cursorResult = results.get("cursor");
  const vscodeResult = results.get("vscode");

  assert.ok(cursorResult?.success);
  assert.ok(vscodeResult?.success);

  // Both should be in local paths
  assert.ok(cursorResult?.path.includes(tempDir));
  assert.ok(vscodeResult?.path.includes(tempDir));

  // Verify files exist
  assert.strictEqual(existsSync(join(tempDir, ".cursor", "mcp.json")), true);
  assert.strictEqual(existsSync(join(tempDir, ".vscode", "mcp.json")), true);
});

test("installServer - mixed routing (local and global simulation)", () => {
  const tempDir = createTempDir();
  const parsed = parseSource("mcp-server-postgres");
  const config = buildServerConfig(parsed);

  // Simulate mixed routing: cursor local, but route another to "global" (which won't use cwd)
  const agentTypes: AgentType[] = ["cursor"];
  const routing = new Map<AgentType, "local" | "global">();
  routing.set("cursor", "local");

  const results = installServer("postgres", config, agentTypes, {
    routing,
    cwd: tempDir,
  });

  assert.strictEqual(results.size, 1);

  const cursorResult = results.get("cursor");
  assert.ok(cursorResult?.success);
  assert.ok(cursorResult?.path.includes(tempDir));

  // Verify local config
  const configPath = join(tempDir, ".cursor", "mcp.json");
  const savedConfig = readJsonConfig(configPath);
  const mcpServers = savedConfig.mcpServers as Record<string, unknown>;
  assert.ok(mcpServers.postgres);
});

test("installServer - empty routing map defaults to global", () => {
  const tempDir = createTempDir();
  const parsed = parseSource("https://mcp.example.com/api");
  const config = buildServerConfig(parsed);

  const agentTypes: AgentType[] = ["cursor"];
  const routing = new Map<AgentType, "local" | "global">();
  // Don't set any routing - should default to global (local: false)

  const results = installServer("example", config, agentTypes, {
    routing,
    cwd: tempDir,
  });

  const cursorResult = results.get("cursor");
  assert.ok(cursorResult?.success);
  // Path should NOT be in tempDir (should be global path)
  assert.ok(!cursorResult?.path.includes(tempDir));
});

test("installServer - routing with multiple agents to different scopes", () => {
  const tempDir = createTempDir();
  const parsed = parseSource("https://mcp.example.com/api");
  const config = buildServerConfig(parsed);

  // Route cursor to local, leave vscode unspecified (will be global)
  const agentTypes: AgentType[] = ["cursor", "vscode"];
  const routing = new Map<AgentType, "local" | "global">();
  routing.set("cursor", "local");
  // vscode not in routing - should default to global

  const results = installServer("example", config, agentTypes, {
    routing,
    cwd: tempDir,
  });

  const cursorResult = results.get("cursor");
  const vscodeResult = results.get("vscode");

  assert.ok(cursorResult?.success);
  assert.ok(vscodeResult?.success);

  // Cursor should be local
  assert.ok(cursorResult?.path.includes(tempDir));

  // VSCode should be global (not in tempDir)
  assert.ok(!vscodeResult?.path.includes(tempDir));
});

test("installServer - github-copilot-cli local uses VS Code servers key", () => {
  const tempDir = createTempDir();
  const parsed = parseSource("mcp-server-postgres");
  const config = buildServerConfig(parsed);

  const results = installServer("postgres", config, ["github-copilot-cli"], {
    routing: new Map<AgentType, "local" | "global">([
      ["github-copilot-cli", "local"],
    ]),
    cwd: tempDir,
  });

  const result = results.get("github-copilot-cli");
  assert.ok(result?.success);
  const saved = readJsonConfig(join(tempDir, ".vscode", "mcp.json"));
  const servers = saved.servers as Record<string, unknown>;
  assert.ok(servers.postgres);
});

test("installServer - github-copilot-cli global uses mcpServers key and CLI schema", () => {
  const tempDir = createTempDir();
  const originalPath = agents["github-copilot-cli"].configPath;
  agents["github-copilot-cli"].configPath = join(tempDir, "mcp-config.json");

  try {
    const parsed = parseSource("https://mcp.example.com/mcp");
    const config = buildServerConfig(parsed);

    const results = installServer("example", config, ["github-copilot-cli"], {
      routing: new Map<AgentType, "local" | "global">([
        ["github-copilot-cli", "global"],
      ]),
      cwd: tempDir,
    });

    const result = results.get("github-copilot-cli");
    assert.ok(result?.success);
    const saved = readJsonConfig(join(tempDir, "mcp-config.json"));
    const mcpServers = saved.mcpServers as Record<string, unknown>;
    const server = mcpServers.example as Record<string, unknown>;
    assert.strictEqual(server.type, "http");
    assert.strictEqual(server.url, "https://mcp.example.com/mcp");
    assert.deepStrictEqual(server.tools, ["*"]);
  } finally {
    agents["github-copilot-cli"].configPath = originalPath;
  }
});

// Cleanup and summary
cleanup();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
