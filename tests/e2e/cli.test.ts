#!/usr/bin/env tsx

import assert from "node:assert";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
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

function seedFindRegistries(homeDir: string) {
  const configPath = join(homeDir, ".config", "add-mcp", "config.json");
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        version: 1,
        findRegistries: [
          {
            id: "verified-essentials",
            label: "Verified essentials",
            serversUrl: "http://localhost:3000/api/v1/servers",
          },
          {
            id: "official-anthropic-registry",
            label: "Official Anthropic registry",
            serversUrl: "https://registry.modelcontextprotocol.io/v0.1/servers",
          },
        ],
      },
      null,
      2,
    ),
    "utf-8",
  );
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

test("E2E CLI: find -y without registry config asks to configure registries", () => {
  const projectDir = createTempDir();
  const homeDir = createTempDir();

  const result = runCli(
    ["find", "postman", "-a", "cursor", "-y"],
    projectDir,
    homeDir,
  );
  assert.strictEqual(result.status, 0, "CLI should exit gracefully");

  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /Find requires configuring one or more registries/);
  assert.match(
    output,
    /Re-run without --yes to configure registries for find\/search/,
  );
});

test("E2E CLI: find -y picks best match and installs remote with placeholders", () => {
  const projectDir = createTempDir();
  const homeDir = createTempDir();
  seedFindRegistries(homeDir);

  const result = runCli(
    ["find", "postman", "-a", "cursor", "-y"],
    projectDir,
    homeDir,
  );

  if (result.status !== 0) {
    throw new Error(
      `CLI failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  }

  const configPath = join(projectDir, ".cursor", "mcp.json");
  assert.strictEqual(existsSync(configPath), true);

  const savedConfig = JSON.parse(readFileSync(configPath, "utf-8")) as {
    mcpServers?: Record<
      string,
      { url?: string; headers?: Record<string, string> }
    >;
  };
  const postmanConfig = Object.values(savedConfig.mcpServers ?? {}).find(
    (server) => server.url === "https://mcp.postman.com/mcp",
  );
  assert.ok(postmanConfig);
  assert.strictEqual(postmanConfig?.url, "https://mcp.postman.com/mcp");
  assert.deepStrictEqual(postmanConfig?.headers, {
    Authorization: "<your-header-value-here>",
  });
});

test("E2E CLI: mcporter default install writes project config", () => {
  const projectDir = createTempDir();
  const homeDir = createTempDir();

  const result = runCli(
    ["https://mcp.example.com/mcp", "-a", "mcporter", "-y"],
    projectDir,
    homeDir,
  );

  if (result.status !== 0) {
    throw new Error(
      `CLI failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  }

  assert.strictEqual(
    existsSync(join(projectDir, "config", "mcporter.json")),
    true,
  );
});

test("E2E CLI: mcporter global install writes home config", () => {
  const projectDir = createTempDir();
  const homeDir = createTempDir();

  const result = runCli(
    ["https://mcp.example.com/mcp", "-a", "mcporter", "-g", "-y"],
    projectDir,
    homeDir,
  );

  if (result.status !== 0) {
    throw new Error(
      `CLI failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  }

  assert.strictEqual(
    existsSync(join(homeDir, ".mcporter", "mcporter.json")),
    true,
  );
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

test("E2E CLI: remote server to antigravity succeeds with serverUrl config", () => {
  const projectDir = createTempDir();
  const homeDir = createTempDir();

  const result = runCli(
    [
      "https://mcp.example.com/mcp",
      "-a",
      "antigravity",
      "-y",
      "--name",
      "remote",
      "--header",
      "Authorization: Bearer token",
    ],
    projectDir,
    homeDir,
  );

  if (result.status !== 0) {
    throw new Error(
      `CLI failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  }

  const configPath = join(homeDir, ".gemini", "antigravity", "mcp_config.json");
  assert.strictEqual(existsSync(configPath), true);

  const saved = JSON.parse(readFileSync(configPath, "utf-8"));
  const servers = saved.mcpServers as Record<string, unknown>;
  const server = servers.remote as Record<string, unknown>;
  assert.strictEqual(server.serverUrl, "https://mcp.example.com/mcp");
  assert.deepStrictEqual(server.headers, {
    Authorization: "Bearer token",
  });
});

test("E2E CLI: --all includes antigravity for remote server", () => {
  const projectDir = createTempDir();
  const homeDir = createTempDir();

  const result = runCli(
    ["https://mcp.example.com/mcp", "--all", "-y"],
    projectDir,
    homeDir,
  );

  assert.strictEqual(result.status, 0, "CLI should succeed");

  const configPath = join(homeDir, ".gemini", "antigravity", "mcp_config.json");
  assert.strictEqual(existsSync(configPath), true);

  const saved = JSON.parse(readFileSync(configPath, "utf-8"));
  const servers = saved.mcpServers as Record<string, unknown>;
  const antigravityRemoteServer = Object.values(servers).find((value) => {
    const server = value as Record<string, unknown>;
    return server.serverUrl === "https://mcp.example.com/mcp";
  });
  assert.ok(
    antigravityRemoteServer,
    "remote antigravity server should exist in mcpServers",
  );
});

test("E2E CLI: stdio server to antigravity succeeds", () => {
  const projectDir = createTempDir();
  const homeDir = createTempDir();

  const result = runCli(
    [
      "@modelcontextprotocol/server-filesystem",
      "-a",
      "antigravity",
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

  const configPath = join(homeDir, ".gemini", "antigravity", "mcp_config.json");
  assert.strictEqual(existsSync(configPath), true);

  const saved = JSON.parse(readFileSync(configPath, "utf-8"));
  const servers = saved.mcpServers as Record<string, unknown>;
  assert.ok(servers.filesystem, "filesystem server should be configured");

  const server = servers.filesystem as Record<string, unknown>;
  assert.strictEqual(server.command, "npx");
});

test("E2E CLI: local stdio install supports repeated --env", () => {
  const projectDir = createTempDir();
  const homeDir = createTempDir();

  const result = runCli(
    [
      "@modelcontextprotocol/server-filesystem",
      "-a",
      "cursor",
      "-y",
      "--name",
      "filesystem",
      "--env",
      "API_KEY=secret",
      "--env",
      "NESTED=value=with=equals",
    ],
    projectDir,
    homeDir,
  );

  if (result.status !== 0) {
    throw new Error(
      `CLI failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  }

  const configPath = join(projectDir, ".cursor", "mcp.json");
  assert.strictEqual(existsSync(configPath), true);

  const saved = JSON.parse(readFileSync(configPath, "utf-8"));
  const servers = saved.mcpServers as Record<string, unknown>;
  const server = servers.filesystem as Record<string, unknown>;

  assert.strictEqual(server.command, "npx");
  assert.deepStrictEqual(server.env, {
    API_KEY: "secret",
    NESTED: "value=with=equals",
  });
});

test("E2E CLI: invalid --env format exits with error", () => {
  const projectDir = createTempDir();
  const homeDir = createTempDir();

  const result = runCli(
    [
      "@modelcontextprotocol/server-filesystem",
      "-a",
      "cursor",
      "-y",
      "--env",
      "INVALID_ENV",
    ],
    projectDir,
    homeDir,
  );

  assert.notStrictEqual(result.status, 0, "CLI should exit with non-zero");

  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /Invalid --env value\(s\)/);
  assert.match(output, /Use "KEY=VALUE" format\./);
});

test("E2E CLI: remote install with --env warns and succeeds", () => {
  const projectDir = createTempDir();
  const homeDir = createTempDir();

  const result = runCli(
    [
      "https://mcp.example.com/mcp",
      "-a",
      "cursor",
      "-y",
      "--env",
      "API_KEY=secret",
    ],
    projectDir,
    homeDir,
  );

  if (result.status !== 0) {
    throw new Error(
      `CLI failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  }

  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(
    output,
    /--env is only used for local\/package\/command installs, ignoring/,
  );

  const configPath = join(projectDir, ".cursor", "mcp.json");
  assert.strictEqual(existsSync(configPath), true);
});
cleanup();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
