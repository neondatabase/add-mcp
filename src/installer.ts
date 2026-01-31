import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import type {
  AgentType,
  AgentConfig,
  McpServerConfig,
  ParsedSource,
  ConfigFile,
  TransportType,
} from "./types.js";
import { agents } from "./agents.js";
import {
  readConfig,
  writeConfig,
  buildConfigWithKey,
} from "./formats/index.js";

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
}

export interface InstallResult {
  success: boolean;
  path: string;
  error?: string;
}

export interface BuildServerConfigOptions {
  /** Transport type for remote servers (default: http) */
  transport?: TransportType;
}

export function buildServerConfig(
  parsed: ParsedSource,
  options: BuildServerConfigOptions = {},
): McpServerConfig {
  if (parsed.type === "remote") {
    return {
      type: options.transport ?? "http",
      url: parsed.value,
    };
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

export function getConfigPath(
  agent: AgentConfig,
  options: InstallOptions = {},
): string {
  if (options.local && agent.localConfigPath) {
    const cwd = options.cwd || process.cwd();
    return join(cwd, agent.localConfigPath);
  }
  return agent.configPath;
}

export function isServerInstalled(
  serverName: string,
  agentType: AgentType,
  options: InstallOptions = {},
): boolean {
  const agent = agents[agentType];
  const configPath = getConfigPath(agent, options);

  if (!existsSync(configPath)) {
    return false;
  }

  const config = readConfig(configPath, agent.format);
  const serversKey = agent.configKey;

  const keys = serversKey.split(".");
  let current: unknown = config;

  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as ConfigFile)[key];
    } else {
      return false;
    }
  }

  if (current && typeof current === "object") {
    return serverName in (current as ConfigFile);
  }

  return false;
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
      ? agent.transformConfig(serverName, serverConfig)
      : serverConfig;

    const config = buildConfigWithKey(
      agent.configKey,
      serverName,
      transformedConfig,
    );

    writeConfig(configPath, config, agent.format, agent.configKey);

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

  for (const agentType of agentTypes) {
    const routing = options.routing?.get(agentType);
    const installOptions: InstallOptions = {
      local: routing === "local",
      cwd: options.cwd,
    };

    const result = installServerForAgent(
      serverName,
      serverConfig,
      agentType,
      installOptions,
    );
    results.set(agentType, result);
  }

  return results;
}

export function getAgentsWithLocalSupport(): AgentType[] {
  return (Object.entries(agents) as [AgentType, AgentConfig][])
    .filter(([_, config]) => config.localConfigPath !== undefined)
    .map(([type, _]) => type);
}
