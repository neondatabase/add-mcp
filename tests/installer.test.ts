#!/usr/bin/env tsx

/**
 * Unit tests for installer.ts
 *
 * Run with: npx tsx tests/installer.test.ts
 */

import assert from "node:assert";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildServerConfig,
  installServer,
  updateGitignoreWithPaths,
} from "../src/installer.js";
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

test("updateGitignoreWithPaths - creates .gitignore when missing", () => {
  const tempDir = createTempDir();
  const configPath = join(tempDir, ".cursor", "mcp.json");

  const result = updateGitignoreWithPaths([configPath], { cwd: tempDir });

  assert.deepStrictEqual(result.added, [".cursor/mcp.json"]);
  const gitignorePath = join(tempDir, ".gitignore");
  assert.strictEqual(existsSync(gitignorePath), true);
  assert.strictEqual(
    readFileSync(gitignorePath, "utf-8"),
    ".cursor/mcp.json\n",
  );
});

test("updateGitignoreWithPaths - appends only new local paths", () => {
  const tempDir = createTempDir();
  const gitignorePath = join(tempDir, ".gitignore");

  updateGitignoreWithPaths([join(tempDir, ".cursor", "mcp.json")], {
    cwd: tempDir,
  });
  const result = updateGitignoreWithPaths(
    [
      join(tempDir, ".cursor", "mcp.json"),
      join(tempDir, ".vscode", "mcp.json"),
      join(tempDir, "..", "outside.json"),
    ],
    { cwd: tempDir },
  );

  assert.deepStrictEqual(result.added, [".vscode/mcp.json"]);
  assert.strictEqual(
    readFileSync(gitignorePath, "utf-8"),
    ".cursor/mcp.json\n.vscode/mcp.json\n",
  );
});

// ============================================
// Idempotent write tests
// ============================================

test("installServerForAgent - skips when server name already exists", () => {
  const tempDir = createTempDir();
  const parsed = parseSource("mcp-server-postgres");
  const config = buildServerConfig(parsed);

  // First install
  const first = installServer("postgres", config, ["cursor"], {
    routing: new Map([["cursor" as AgentType, "local" as const]]),
    cwd: tempDir,
  });
  assert.ok(first.get("cursor")?.success);
  assert.strictEqual(first.get("cursor")?.skipped, undefined);

  // Second install — same name should be skipped
  const second = installServer("postgres", config, ["cursor"], {
    routing: new Map([["cursor" as AgentType, "local" as const]]),
    cwd: tempDir,
  });
  assert.ok(second.get("cursor")?.success);
  assert.strictEqual(second.get("cursor")?.skipped, true);
});

test("installServerForAgent - skips when URL already exists under different name", () => {
  const tempDir = createTempDir();
  const url = "https://api.fabric.microsoft.com/v1/mcp/powerbi";
  const config1 = buildServerConfig(parseSource(url));
  const config2 = buildServerConfig(parseSource(url));

  // First install under name "powerbi-remote"
  installServer("powerbi-remote", config1, ["vscode"], {
    routing: new Map([["vscode" as AgentType, "local" as const]]),
    cwd: tempDir,
  });

  // Second install of same URL under name "fabric" — should be skipped
  const result = installServer("fabric", config2, ["vscode"], {
    routing: new Map([["vscode" as AgentType, "local" as const]]),
    cwd: tempDir,
  });
  assert.strictEqual(result.get("vscode")?.skipped, true);

  // Verify only the original entry exists
  const saved = readJsonConfig(join(tempDir, ".vscode", "mcp.json"));
  const servers = saved.servers as Record<string, unknown>;
  assert.ok(servers["powerbi-remote"]);
  assert.strictEqual(servers["fabric"], undefined);
});

test("installServerForAgent - does not overwrite existing entry args", () => {
  const tempDir = createTempDir();

  // Manually create a config with custom args
  const configDir = join(tempDir, ".vscode");
  mkdirSync(configDir, { recursive: true });
  writeFileSync(
    join(configDir, "mcp.json"),
    JSON.stringify(
      {
        servers: {
          workiq: {
            command: "npx",
            args: ["-y", "@microsoft/workiq", "mcp"],
          },
        },
      },
      null,
      2,
    ),
  );

  // Try to install same server name — should be skipped
  const parsed = parseSource("@microsoft/workiq");
  const config = buildServerConfig(parsed);
  const result = installServer("workiq", config, ["vscode"], {
    routing: new Map([["vscode" as AgentType, "local" as const]]),
    cwd: tempDir,
  });
  assert.strictEqual(result.get("vscode")?.skipped, true);

  // Verify original args preserved
  const saved = readJsonConfig(join(tempDir, ".vscode", "mcp.json"));
  const servers = saved.servers as Record<string, Record<string, unknown>>;
  assert.deepStrictEqual(servers.workiq.args, [
    "-y",
    "@microsoft/workiq",
    "mcp",
  ]);
});

test("installServerForAgent - preserves existing entries when adding new ones", () => {
  const tempDir = createTempDir();
  const configDir = join(tempDir, ".vscode");
  mkdirSync(configDir, { recursive: true });

  // Write a config with an existing server
  const original = JSON.stringify(
    {
      servers: {
        existing: { command: "npx", args: ["-y", "some-server", "extra-arg"] },
      },
    },
    null,
    2,
  );
  writeFileSync(join(configDir, "mcp.json"), original);

  // Add a new server
  const parsed = parseSource("https://example.com/mcp");
  const config = buildServerConfig(parsed);
  installServer("example", config, ["vscode"], {
    routing: new Map([["vscode" as AgentType, "local" as const]]),
    cwd: tempDir,
  });

  // Existing entry values should be preserved (not overwritten)
  const saved = readJsonConfig(join(configDir, "mcp.json"));
  const servers = saved.servers as Record<string, Record<string, unknown>>;
  assert.deepStrictEqual(servers.existing.args, [
    "-y",
    "some-server",
    "extra-arg",
  ]);
  // New entry should be present
  assert.strictEqual(servers.example.url, "https://example.com/mcp");
});

// ============================================
// TOML (Codex) idempotent write tests
// ============================================

test("installServerForAgent - skips existing entry in TOML config (Codex)", () => {
  const tempDir = createTempDir();
  const parsed = parseSource("mcp-server-postgres");
  const config = buildServerConfig(parsed);

  // First install
  const first = installServer("postgres", config, ["codex"], {
    routing: new Map([["codex" as AgentType, "local" as const]]),
    cwd: tempDir,
  });
  assert.ok(first.get("codex")?.success);
  assert.strictEqual(first.get("codex")?.skipped, undefined);

  // Second install — same name should be skipped
  const second = installServer("postgres", config, ["codex"], {
    routing: new Map([["codex" as AgentType, "local" as const]]),
    cwd: tempDir,
  });
  assert.ok(second.get("codex")?.success);
  assert.strictEqual(second.get("codex")?.skipped, true);
});

test("installServerForAgent - preserves existing TOML entries when adding new ones (Codex)", () => {
  const tempDir = createTempDir();
  const configDir = join(tempDir, ".codex");
  mkdirSync(configDir, { recursive: true });

  // Write a TOML config with an existing server
  const tomlContent = [
    "[mcp_servers.existing]",
    'command = "npx"',
    'args = ["-y", "some-server", "extra-arg"]',
    "",
  ].join("\n");
  writeFileSync(join(configDir, "config.toml"), tomlContent);

  // Add a new server
  const parsed = parseSource("mcp-server-postgres");
  const config = buildServerConfig(parsed);
  installServer("postgres", config, ["codex"], {
    routing: new Map([["codex" as AgentType, "local" as const]]),
    cwd: tempDir,
  });

  // Verify existing entry is preserved
  const saved = readFileSync(join(configDir, "config.toml"), "utf-8");
  assert.ok(
    saved.includes("existing"),
    "existing entry should still be present",
  );
  assert.ok(saved.includes("extra-arg"), "existing args should be preserved");
  assert.ok(saved.includes("postgres"), "new entry should be added");
});

// Cleanup and summary
cleanup();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
