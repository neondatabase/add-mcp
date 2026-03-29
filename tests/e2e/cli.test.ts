#!/usr/bin/env tsx

import assert from "node:assert";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

let passed = 0;
let failed = 0;
let tempDirs: string[] = [];

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

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "add-mcp-cli-test-"));
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

const testFileDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testFileDir, "..", "..");
const indexPath = join(repoRoot, "src", "index.ts");
const tsxBin = join(repoRoot, "node_modules", ".bin", "tsx");

function runCli(args: string[], cwd: string, homeDir: string) {
  return spawnSync(tsxBin, [indexPath, ...args], {
    cwd,
    encoding: "utf-8",
    env: {
      ...process.env,
      HOME: homeDir,
      XDG_CONFIG_HOME: join(homeDir, ".config"),
      CODEX_HOME: join(homeDir, ".codex"),
      NO_COLOR: "1",
    },
  });
}

test("E2E CLI: --gitignore adds local config path", () => {
  const projectDir = createTempDir();
  const homeDir = createTempDir();

  const result = runCli(
    ["https://mcp.example.com/mcp", "-a", "cursor", "-y", "--gitignore"],
    projectDir,
    homeDir,
  );

  if (result.status !== 0) {
    throw new Error(
      `CLI failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  }

  const gitignorePath = join(projectDir, ".gitignore");
  assert.strictEqual(existsSync(gitignorePath), true);
  assert.strictEqual(
    readFileSync(gitignorePath, "utf-8"),
    ".cursor/mcp.json\n",
  );
});

test("E2E CLI: --gitignore with --global warns and does not write project .gitignore", () => {
  const projectDir = createTempDir();
  const homeDir = createTempDir();

  const result = runCli(
    ["https://mcp.example.com/mcp", "-a", "cursor", "-g", "-y", "--gitignore"],
    projectDir,
    homeDir,
  );

  if (result.status !== 0) {
    throw new Error(
      `CLI failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  }

  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  assert.match(
    combinedOutput,
    /--gitignore is only supported for project-scoped installations; ignoring\./,
  );
  assert.strictEqual(existsSync(join(projectDir, ".gitignore")), false);
  assert.strictEqual(existsSync(join(homeDir, ".cursor", "mcp.json")), true);
});

test("E2E CLI: Goose HTTP install with headers", () => {
  const projectDir = createTempDir();
  const homeDir = createTempDir();

  const result = runCli(
    [
      "https://mcp.example.com/mcp",
      "-a",
      "goose",
      "-y",
      "--name",
      "example",
      "--header",
      "Authorization: Bearer token",
      "--header",
      "x-read-only: true",
    ],
    projectDir,
    homeDir,
  );

  if (result.status !== 0) {
    throw new Error(
      `CLI failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  }

  const gooseConfigPath = join(homeDir, ".config", "goose", "config.yaml");
  assert.strictEqual(existsSync(gooseConfigPath), true);

  const saved = yaml.load(readFileSync(gooseConfigPath, "utf-8")) as Record<
    string,
    unknown
  >;
  const extensions = saved.extensions as Record<string, unknown>;
  const server = extensions.example as Record<string, unknown>;

  assert.strictEqual(server.type, "streamable_http");
  assert.strictEqual(server.uri, "https://mcp.example.com/mcp");
  assert.deepStrictEqual(server.headers, {
    Authorization: "Bearer token",
    "x-read-only": "true",
  });
});

test("E2E CLI: remote server to claude-desktop errors with custom message", () => {
  const projectDir = createTempDir();
  const homeDir = createTempDir();

  const result = runCli(
    ["https://mcp.example.com/mcp", "-a", "claude-desktop", "-y"],
    projectDir,
    homeDir,
  );

  assert.notStrictEqual(result.status, 0, "CLI should exit with non-zero");

  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(
    output,
    /don't support http transport/,
    "should report unsupported transport",
  );
  assert.match(
    output,
    /Settings.*Connectors/,
    "should include the custom unsupportedTransportMessage",
  );
});

test("E2E CLI: --all skips claude-desktop for remote server with custom message", () => {
  const projectDir = createTempDir();
  const homeDir = createTempDir();

  const result = runCli(
    ["https://mcp.example.com/mcp", "--all", "-y"],
    projectDir,
    homeDir,
  );

  assert.strictEqual(result.status, 0, "CLI should succeed");

  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(
    output,
    /Skipping agents.*Claude Desktop/,
    "should warn about skipping Claude Desktop",
  );
  assert.match(
    output,
    /Settings.*Connectors/,
    "should include the custom unsupportedTransportMessage",
  );
});

test("E2E CLI: stdio server to claude-desktop succeeds", () => {
  const projectDir = createTempDir();
  const homeDir = createTempDir();

  const result = runCli(
    [
      "@modelcontextprotocol/server-filesystem",
      "-a",
      "claude-desktop",
      "-y",
      "--name",
      "filesystem",
    ],
    projectDir,
    homeDir,
  );

  if (result.status !== 0) {
    throw new Error(
      `CLI failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  }

  const configPath = join(
    homeDir,
    "Library",
    "Application Support",
    "Claude",
    "claude_desktop_config.json",
  );
  assert.strictEqual(existsSync(configPath), true);

  const saved = JSON.parse(readFileSync(configPath, "utf-8"));
  const servers = saved.mcpServers as Record<string, unknown>;
  assert.ok(servers.filesystem, "filesystem server should be configured");

  const server = servers.filesystem as Record<string, unknown>;
  assert.strictEqual(server.command, "npx");
});

test("E2E CLI: --on-conflict skip preserves existing server entry", () => {
  const projectDir = createTempDir();
  const homeDir = createTempDir();

  const first = runCli(
    [
      "https://mcp.old.com/mcp",
      "-a",
      "cursor",
      "-y",
      "--name",
      "example",
      "--on-conflict",
      "overwrite",
    ],
    projectDir,
    homeDir,
  );
  if (first.status !== 0) {
    throw new Error(
      `Initial CLI failed.\nSTDOUT:\n${first.stdout}\nSTDERR:\n${first.stderr}`,
    );
  }

  const second = runCli(
    [
      "https://mcp.new.com/mcp",
      "-a",
      "cursor",
      "-y",
      "--name",
      "example",
      "--on-conflict",
      "skip",
    ],
    projectDir,
    homeDir,
  );
  if (second.status !== 0) {
    throw new Error(
      `Second CLI failed.\nSTDOUT:\n${second.stdout}\nSTDERR:\n${second.stderr}`,
    );
  }

  const saved = JSON.parse(
    readFileSync(join(projectDir, ".cursor", "mcp.json"), "utf-8"),
  ) as Record<string, unknown>;
  const servers = saved.mcpServers as Record<string, unknown>;
  const server = servers.example as Record<string, unknown>;
  assert.strictEqual(server.url, "https://mcp.old.com/mcp");
});

test("E2E CLI: invalid --on-conflict value exits with error", () => {
  const projectDir = createTempDir();
  const homeDir = createTempDir();

  const result = runCli(
    [
      "https://mcp.example.com/mcp",
      "-a",
      "cursor",
      "-y",
      "--on-conflict",
      "invalid",
    ],
    projectDir,
    homeDir,
  );

  assert.notStrictEqual(result.status, 0, "CLI should fail");
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /Invalid --on-conflict value/);
});

test("E2E CLI: warns when URL already exists under different name", () => {
  const projectDir = createTempDir();
  const homeDir = createTempDir();

  const first = runCli(
    [
      "https://mcp.example.com/mcp",
      "-a",
      "cursor",
      "-y",
      "--name",
      "first-url",
    ],
    projectDir,
    homeDir,
  );
  if (first.status !== 0) {
    throw new Error(
      `Initial CLI failed.\nSTDOUT:\n${first.stdout}\nSTDERR:\n${first.stderr}`,
    );
  }

  const second = runCli(
    [
      "https://mcp.example.com/mcp",
      "-a",
      "cursor",
      "-y",
      "--name",
      "second-url",
    ],
    projectDir,
    homeDir,
  );
  if (second.status !== 0) {
    throw new Error(
      `Second CLI failed.\nSTDOUT:\n${second.stdout}\nSTDERR:\n${second.stderr}`,
    );
  }

  const output = `${second.stdout}\n${second.stderr}`;
  assert.match(output, /same URL\/package name already exists/i);
  assert.match(output, /first-url/);
});

cleanup();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
