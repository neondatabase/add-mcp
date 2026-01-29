import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import type {
  AgentType,
  AgentConfig,
  McpServerConfig,
  ParsedSource,
  ConfigFile,
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

export interface InstallResult {
  success: boolean;
  path: string;
  error?: string;
}

/**
 * Build MCP server config from parsed source
 */
export function buildServerConfig(parsed: ParsedSource): McpServerConfig {
  if (parsed.type === "remote") {
    return {
      type: "http",
      url: parsed.value,
    };
  }

  if (parsed.type === "command") {
    // Parse command into executable and args
    const parts = parsed.value.split(" ");
    const command = parts[0]!;
    const args = parts.slice(1);

    return {
      command,
      args,
    };
  }

  // Package name - convert to npx command
  return {
    command: "npx",
    args: ["-y", parsed.value],
  };
}

/**
 * Get the config file path for an agent
 */
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

/**
 * Check if an MCP server is already installed for an agent
 */
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

  // Navigate to the servers object
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

/**
 * Install an MCP server config for an agent
 */
export function installServerForAgent(
  serverName: string,
  serverConfig: McpServerConfig,
  agentType: AgentType,
  options: InstallOptions = {},
): InstallResult {
  const agent = agents[agentType];
  const configPath = getConfigPath(agent, options);

  try {
    // Ensure directory exists
    const dir = dirname(configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Transform config if agent requires it
    const transformedConfig = agent.transformConfig
      ? agent.transformConfig(serverName, serverConfig)
      : serverConfig;

    // Build the config object
    const config = buildConfigWithKey(
      agent.configKey,
      serverName,
      transformedConfig,
    );

    // Write the config
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

/**
 * Install an MCP server to multiple agents
 */
export function installServer(
  serverName: string,
  serverConfig: McpServerConfig,
  agentTypes: AgentType[],
  options: InstallOptions = {},
): Map<AgentType, InstallResult> {
  const results = new Map<AgentType, InstallResult>();

  for (const agentType of agentTypes) {
    const result = installServerForAgent(
      serverName,
      serverConfig,
      agentType,
      options,
    );
    results.set(agentType, result);
  }

  return results;
}

/**
 * Check which agents support local (project-level) config
 */
export function getAgentsWithLocalSupport(): AgentType[] {
  return (Object.entries(agents) as [AgentType, AgentConfig][])
    .filter(([_, config]) => config.localConfigPath !== undefined)
    .map(([type, _]) => type);
}
