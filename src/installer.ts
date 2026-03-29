import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname, isAbsolute, relative, sep } from "path";
import type {
  AgentType,
  AgentConfig,
  McpServerConfig,
  ParsedSource,
  TransportType,
  ConfigFile,
} from "./types.js";
import { agents } from "./agents.js";
import {
  writeConfig,
  writeConfigExact,
  buildConfigWithKey,
  getNestedValue,
  setNestedValue,
  readConfig,
} from "./formats/index.js";
import { writeJsonConfigAtPath } from "./formats/json.js";

export interface InstallOptions {
  /** Install to local (project-level) config instead of global */
  local?: boolean;
  /** Current working directory for local installs */
  cwd?: string;
}

export interface InstallServerOptions {
  /** Per-agent routing map (local vs global) */
  routing?: Map<AgentType, "local" | "global">;
  /** Current working directory for local installs */
  cwd?: string;
  /** How to handle conflicts when server name already exists */
  onConflict?: "overwrite" | "skip" | "merge";
}

export interface InstallResult {
  success: boolean;
  path: string;
  error?: string;
  skipped?: boolean;
  warnings?: string[];
}

export interface BuildServerConfigOptions {
  /** Transport type for remote servers (default: http) */
  transport?: TransportType;
  /** HTTP headers for remote servers */
  headers?: Record<string, string>;
}

export interface UpdateGitignoreOptions {
  /** Current working directory where .gitignore lives */
  cwd?: string;
}

export interface UpdateGitignoreResult {
  path: string;
  added: string[];
}

export function buildServerConfig(
  parsed: ParsedSource,
  options: BuildServerConfigOptions = {},
): McpServerConfig {
  if (parsed.type === "remote") {
    const config: McpServerConfig = {
      type: options.transport ?? "http",
      url: parsed.value,
    };

    if (options.headers && Object.keys(options.headers).length > 0) {
      config.headers = options.headers;
    }

    return config;
  }

  if (parsed.type === "command") {
    const parts = parsed.value.split(" ");
    const command = parts[0]!;
    const args = parts.slice(1);

    return {
      command,
      args,
    };
  }

  return {
    command: "npx",
    args: ["-y", parsed.value],
  };
}

export function updateGitignoreWithPaths(
  paths: string[],
  options: UpdateGitignoreOptions = {},
): UpdateGitignoreResult {
  const cwd = options.cwd || process.cwd();
  const gitignorePath = join(cwd, ".gitignore");
  const existingContent = existsSync(gitignorePath)
    ? readFileSync(gitignorePath, "utf-8")
    : "";

  const existingEntries = new Set(
    existingContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
  );

  const entriesToAdd: string[] = [];

  for (const filePath of paths) {
    const relativePath = isAbsolute(filePath)
      ? relative(cwd, filePath)
      : filePath;
    if (
      !relativePath ||
      relativePath.startsWith("..") ||
      isAbsolute(relativePath)
    ) {
      continue;
    }

    const normalizedPath = relativePath.split(sep).join("/");
    const cleanPath = normalizedPath.startsWith("./")
      ? normalizedPath.slice(2)
      : normalizedPath;

    if (
      !cleanPath ||
      cleanPath === ".gitignore" ||
      existingEntries.has(cleanPath)
    ) {
      continue;
    }

    existingEntries.add(cleanPath);
    entriesToAdd.push(cleanPath);
  }

  if (entriesToAdd.length > 0) {
    let nextContent = existingContent;
    if (nextContent.length > 0 && !nextContent.endsWith("\n")) {
      nextContent += "\n";
    }
    nextContent += `${entriesToAdd.join("\n")}\n`;
    writeFileSync(gitignorePath, nextContent, "utf-8");
  }

  return {
    path: gitignorePath,
    added: entriesToAdd,
  };
}

function getConfigPath(
  agent: AgentConfig,
  options: InstallOptions = {},
): string {
  if (options.local && agent.localConfigPath) {
    const cwd = options.cwd || process.cwd();
    return join(cwd, agent.localConfigPath);
  }
  return agent.configPath;
}

function getConfigKey(
  agent: AgentConfig,
  options: InstallOptions = {},
): string {
  if (options.local && agent.localConfigKey) {
    return agent.localConfigKey;
  }

  return agent.configKey;
}

function getServerEntries(config: ConfigFile, configKey: string): ConfigFile {
  const servers = getNestedValue(config, configKey);
  if (!servers || typeof servers !== "object" || Array.isArray(servers)) {
    return {};
  }
  return { ...(servers as ConfigFile) };
}

function mergeMissingKeys(existing: unknown, incoming: unknown): unknown {
  if (
    !existing ||
    typeof existing !== "object" ||
    Array.isArray(existing) ||
    !incoming ||
    typeof incoming !== "object" ||
    Array.isArray(incoming)
  ) {
    return existing;
  }

  const existingRecord = existing as Record<string, unknown>;
  const incomingRecord = incoming as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...existingRecord };

  for (const [key, incomingValue] of Object.entries(incomingRecord)) {
    if (!(key in existingRecord)) {
      merged[key] = incomingValue;
      continue;
    }

    merged[key] = mergeMissingKeys(existingRecord[key], incomingValue);
  }

  return merged;
}

function normalizeEntryIdentity(config: unknown): string | undefined {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return undefined;
  }
  const entry = config as Record<string, unknown>;

  const url = typeof entry.url === "string" ? entry.url : undefined;
  const uri = typeof entry.uri === "string" ? entry.uri : undefined;
  if (url || uri) {
    return `remote:${url ?? uri}`;
  }

  const command =
    typeof entry.command === "string"
      ? entry.command
      : typeof entry.cmd === "string"
        ? entry.cmd
        : undefined;
  if (command) {
    const args = Array.isArray(entry.args)
      ? entry.args.filter((value): value is string => typeof value === "string")
      : [];
    return `stdio:${command}\u0000${args.join("\u0000")}`;
  }

  if (Array.isArray(entry.command)) {
    const commandParts = entry.command.filter(
      (value): value is string => typeof value === "string",
    );
    return `stdio:${commandParts.join("\u0000")}`;
  }

  return undefined;
}

function duplicateIdentityWarning(
  duplicateNames: string[],
): string | undefined {
  if (duplicateNames.length === 0) {
    return undefined;
  }
  return `Warning: A server with the same URL/package name already exists under a different name (${duplicateNames.join(", ")}). Inspect to avoid duplicate entries.`;
}

export function installServerForAgent(
  serverName: string,
  serverConfig: McpServerConfig,
  agentType: AgentType,
  options: InstallOptions = {},
): InstallResult {
  const agent = agents[agentType];
  const configPath = getConfigPath(agent, options);

  try {
    const dir = dirname(configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const transformedConfig = agent.transformConfig
      ? agent.transformConfig(serverName, serverConfig, {
          local: Boolean(options.local),
        })
      : serverConfig;

    const configKey = getConfigKey(agent, options);
    const config = buildConfigWithKey(configKey, serverName, transformedConfig);

    writeConfig(configPath, config, agent.format, configKey);

    return {
      success: true,
      path: configPath,
    };
  } catch (error) {
    return {
      success: false,
      path: configPath,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function installServer(
  serverName: string,
  serverConfig: McpServerConfig,
  agentTypes: AgentType[],
  options: InstallServerOptions = {},
): Map<AgentType, InstallResult> {
  const results = new Map<AgentType, InstallResult>();
  const conflictPolicy = options.onConflict ?? "overwrite";

  for (const agentType of agentTypes) {
    const routing = options.routing?.get(agentType);
    const installOptions: InstallOptions = {
      local: routing === "local",
      cwd: options.cwd,
    };

    const agent = agents[agentType];
    const configPath = getConfigPath(agent, installOptions);

    try {
      const dir = dirname(configPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const transformedConfig = agent.transformConfig
        ? agent.transformConfig(serverName, serverConfig, {
            local: Boolean(installOptions.local),
          })
        : serverConfig;

      const configKey = getConfigKey(agent, installOptions);
      const existingConfig = readConfig(configPath, agent.format);
      const servers = getServerEntries(existingConfig, configKey);
      const existingEntry = servers[serverName];

      const incomingIdentity = normalizeEntryIdentity(transformedConfig);
      const duplicateNames: string[] = [];
      if (incomingIdentity) {
        for (const [name, entry] of Object.entries(servers)) {
          if (name === serverName) {
            continue;
          }
          if (normalizeEntryIdentity(entry) === incomingIdentity) {
            duplicateNames.push(name);
          }
        }
      }

      if (existingEntry !== undefined) {
        if (conflictPolicy === "skip") {
          const warning = duplicateIdentityWarning(duplicateNames);
          results.set(agentType, {
            success: true,
            path: configPath,
            skipped: true,
            warnings: warning ? [warning] : undefined,
          });
          continue;
        }

        if (conflictPolicy === "merge") {
          servers[serverName] = mergeMissingKeys(
            existingEntry,
            transformedConfig,
          );
        } else {
          servers[serverName] = transformedConfig;
        }
      } else {
        servers[serverName] = transformedConfig;
      }

      setNestedValue(existingConfig, configKey, servers);

      if (existingEntry !== undefined && conflictPolicy === "overwrite") {
        if (agent.format === "json") {
          writeJsonConfigAtPath(
            configPath,
            `${configKey}.${serverName}`,
            servers[serverName],
          );
        } else {
          writeConfigExact(configPath, existingConfig, agent.format);
        }
      } else {
        const nextConfig = buildConfigWithKey(
          configKey,
          serverName,
          servers[serverName],
        );
        writeConfig(configPath, nextConfig, agent.format, configKey);
      }

      const warning = duplicateIdentityWarning(duplicateNames);
      results.set(agentType, {
        success: true,
        path: configPath,
        warnings: warning ? [warning] : undefined,
      });
    } catch (error) {
      results.set(agentType, {
        success: false,
        path: configPath,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}
