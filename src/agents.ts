import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";
import type { AgentConfig, AgentType, McpServerConfig } from "./types.js";

const home = homedir();

/**
 * Platform-specific base directories
 */
function getPlatformPaths() {
  const platform = process.platform;

  if (platform === "win32") {
    const appData = process.env.APPDATA || join(home, "AppData", "Roaming");
    return {
      appSupport: appData,
      vscodePath: join(appData, "Code", "User"),
    };
  } else if (platform === "darwin") {
    return {
      appSupport: join(home, "Library", "Application Support"),
      vscodePath: join(home, "Library", "Application Support", "Code", "User"),
    };
  } else {
    // Linux
    const configDir = process.env.XDG_CONFIG_HOME || join(home, ".config");
    return {
      appSupport: configDir,
      vscodePath: join(configDir, "Code", "User"),
    };
  }
}

const { appSupport, vscodePath } = getPlatformPaths();

/**
 * Transform config for Goose (YAML with different structure)
 * Goose supports stdio and streamable-http (called "streamable_http" in their config)
 */
function transformGooseConfig(
  serverName: string,
  config: McpServerConfig,
): unknown {
  if (config.url) {
    // Remote server via streamable HTTP
    return {
      name: serverName,
      type: "streamable_http",
      url: config.url,
      enabled: true,
      timeout: 300,
    };
  }

  return {
    name: serverName,
    cmd: config.command,
    args: config.args || [],
    enabled: true,
    envs: config.env || {},
    type: "stdio",
    timeout: 300,
  };
}

/**
 * Transform config for Zed (different structure)
 */
function transformZedConfig(
  _serverName: string,
  config: McpServerConfig,
): unknown {
  if (config.url) {
    // Zed remote server config
    return {
      source: "custom",
      type: config.type || "http",
      url: config.url,
      headers: config.headers || {},
    };
  }

  return {
    source: "custom",
    command: config.command,
    args: config.args || [],
    env: config.env || {},
  };
}

/**
 * Transform config for OpenCode (different structure)
 */
function transformOpenCodeConfig(
  _serverName: string,
  config: McpServerConfig,
): unknown {
  if (config.url) {
    return {
      type: "remote",
      url: config.url,
      enabled: true,
      headers: config.headers,
    };
  }

  return {
    type: "local",
    command: config.command,
    args: config.args || [],
    enabled: true,
    environment: config.env || {},
  };
}

/**
 * Transform config for Codex (TOML format, slightly different structure)
 */
function transformCodexConfig(
  _serverName: string,
  config: McpServerConfig,
): unknown {
  if (config.url) {
    return {
      type: config.type || "http",
      url: config.url,
      headers: config.headers,
    };
  }

  return {
    command: config.command,
    args: config.args || [],
    env: config.env,
  };
}

/**
 * Agent configurations
 */
export const agents: Record<AgentType, AgentConfig> = {
  "claude-code": {
    name: "claude-code",
    displayName: "Claude Code",
    configPath: join(home, ".claude.json"),
    localConfigPath: ".mcp.json",
    projectDetectPaths: [".mcp.json", ".claude"],
    configKey: "mcpServers",
    format: "json",
    supportedTransports: ["stdio", "http", "sse"],
    detectGlobalInstall: async () => {
      return existsSync(join(home, ".claude"));
    },
  },

  "claude-desktop": {
    name: "claude-desktop",
    displayName: "Claude Desktop",
    configPath: join(appSupport, "Claude", "claude_desktop_config.json"),
    projectDetectPaths: [], // Global only - no project support
    configKey: "mcpServers",
    format: "json",
    supportedTransports: ["stdio", "http", "sse"],
    detectGlobalInstall: async () => {
      return existsSync(join(appSupport, "Claude"));
    },
  },

  codex: {
    name: "codex",
    displayName: "Codex",
    configPath: join(
      process.env.CODEX_HOME || join(home, ".codex"),
      "config.toml",
    ),
    projectDetectPaths: [], // Global only - no project support
    configKey: "mcp_servers",
    format: "toml",
    supportedTransports: ["stdio", "http", "sse"],
    detectGlobalInstall: async () => {
      return existsSync(join(home, ".codex"));
    },
    transformConfig: transformCodexConfig,
  },

  cursor: {
    name: "cursor",
    displayName: "Cursor",
    configPath: join(home, ".cursor", "mcp.json"),
    localConfigPath: ".cursor/mcp.json",
    projectDetectPaths: [".cursor"],
    configKey: "mcpServers",
    format: "json",
    supportedTransports: ["stdio", "http", "sse"],
    detectGlobalInstall: async () => {
      return existsSync(join(home, ".cursor"));
    },
  },

  "gemini-cli": {
    name: "gemini-cli",
    displayName: "Gemini CLI",
    configPath: join(home, ".gemini", "settings.json"),
    localConfigPath: ".gemini/settings.json",
    projectDetectPaths: [".gemini"],
    configKey: "mcpServers",
    format: "json",
    supportedTransports: ["stdio", "http", "sse"],
    detectGlobalInstall: async () => {
      return existsSync(join(home, ".gemini"));
    },
  },

  goose: {
    name: "goose",
    displayName: "Goose",
    configPath: join(home, ".config", "goose", "config.yaml"),
    localConfigPath: ".goose/config.yaml",
    projectDetectPaths: [".goose"],
    configKey: "extensions",
    format: "yaml",
    supportedTransports: ["stdio", "http"], // Goose does not support SSE
    detectGlobalInstall: async () => {
      return existsSync(join(home, ".config", "goose"));
    },
    transformConfig: transformGooseConfig,
  },

  opencode: {
    name: "opencode",
    displayName: "OpenCode",
    configPath: join(home, ".config", "opencode", "opencode.json"),
    localConfigPath: ".opencode.json",
    projectDetectPaths: [".opencode.json", ".opencode"],
    configKey: "mcp",
    format: "json",
    supportedTransports: ["stdio", "http", "sse"],
    detectGlobalInstall: async () => {
      return existsSync(join(home, ".config", "opencode"));
    },
    transformConfig: transformOpenCodeConfig,
  },

  vscode: {
    name: "vscode",
    displayName: "VS Code",
    configPath: join(vscodePath, "mcp.json"),
    localConfigPath: ".vscode/mcp.json",
    projectDetectPaths: [".vscode"],
    configKey: "mcpServers",
    format: "json",
    supportedTransports: ["stdio", "http", "sse"],
    detectGlobalInstall: async () => {
      return existsSync(vscodePath);
    },
  },

  zed: {
    name: "zed",
    displayName: "Zed",
    configPath:
      process.platform === "win32"
        ? join(
            process.env.APPDATA || join(home, "AppData", "Roaming"),
            "Zed",
            "settings.json",
          )
        : join(home, ".config", "zed", "settings.json"),
    projectDetectPaths: [], // Global only - no project support
    configKey: "context_servers",
    format: "json",
    supportedTransports: ["stdio", "http", "sse"],
    detectGlobalInstall: async () => {
      return (
        existsSync(join(home, ".config", "zed")) ||
        existsSync(join(process.env.APPDATA || "", "Zed"))
      );
    },
    transformConfig: transformZedConfig,
  },
};

/**
 * Get all agent types
 */
export function getAgentTypes(): AgentType[] {
  return Object.keys(agents) as AgentType[];
}

/**
 * Get agent config by type
 */
export function getAgentConfig(type: AgentType): AgentConfig {
  return agents[type];
}

/**
 * Check if an agent supports project-level (local) config
 */
export function supportsProjectConfig(agentType: AgentType): boolean {
  return agents[agentType].localConfigPath !== undefined;
}

/**
 * Get agents that support project-level config
 */
export function getProjectCapableAgents(): AgentType[] {
  return (Object.keys(agents) as AgentType[]).filter((type) =>
    supportsProjectConfig(type),
  );
}

/**
 * Get agents that only support global config
 */
export function getGlobalOnlyAgents(): AgentType[] {
  return (Object.keys(agents) as AgentType[]).filter(
    (type) => !supportsProjectConfig(type),
  );
}

/**
 * Detect agents based on project-level files in the given directory
 * Only checks agents that support project config
 */
export function detectProjectAgents(cwd?: string): AgentType[] {
  const dir = cwd || process.cwd();
  const detected: AgentType[] = [];

  for (const [type, config] of Object.entries(agents)) {
    // Skip global-only agents
    if (!config.localConfigPath) continue;

    for (const detectPath of config.projectDetectPaths) {
      if (existsSync(join(dir, detectPath))) {
        detected.push(type as AgentType);
        break;
      }
    }
  }

  return detected;
}

/**
 * Detect which agents are installed globally
 * Only checks global-only agents (agents without project support)
 */
export async function detectGlobalOnlyAgents(): Promise<AgentType[]> {
  const detected: AgentType[] = [];

  for (const [type, config] of Object.entries(agents)) {
    // Only check global-only agents
    if (config.localConfigPath) continue;

    if (await config.detectGlobalInstall()) {
      detected.push(type as AgentType);
    }
  }

  return detected;
}

/**
 * Detect all globally installed agents (for use with -g flag)
 */
export async function detectAllGlobalAgents(): Promise<AgentType[]> {
  const detected: AgentType[] = [];

  for (const [type, config] of Object.entries(agents)) {
    if (await config.detectGlobalInstall()) {
      detected.push(type as AgentType);
    }
  }

  return detected;
}

/**
 * Check if an agent supports a specific transport type
 */
export function isTransportSupported(
  agentType: AgentType,
  transport: "stdio" | "sse" | "http",
): boolean {
  return agents[agentType].supportedTransports.includes(transport);
}
