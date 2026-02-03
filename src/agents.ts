import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";
import type { AgentConfig, AgentType, McpServerConfig } from "./types.js";

const home = homedir();

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

function transformGooseConfig(
  serverName: string,
  config: McpServerConfig,
): unknown {
  if (config.url) {
    const gooseType = config.type === "sse" ? "sse" : "streamable_http";
    return {
      name: serverName,
      type: gooseType,
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

function transformZedConfig(
  _serverName: string,
  config: McpServerConfig,
): unknown {
  if (config.url) {
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
    supportsHeaders: true,
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
    supportsHeaders: true,
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
    localConfigPath: ".codex/config.toml",
    projectDetectPaths: [".codex"],
    configKey: "mcp_servers",
    format: "toml",
    supportedTransports: ["stdio", "http", "sse"],
    supportsHeaders: true,
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
    supportsHeaders: true,
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
    supportsHeaders: true,
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
    supportedTransports: ["stdio", "http", "sse"],
    supportsHeaders: false,
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
    supportsHeaders: true,
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
    configKey: "servers",
    format: "json",
    supportedTransports: ["stdio", "http", "sse"],
    supportsHeaders: true,
    detectGlobalInstall: async () => {
      return existsSync(vscodePath);
    },
  },

  zed: {
    name: "zed",
    displayName: "Zed",
    configPath:
      process.platform === "darwin" || process.platform === "win32"
        ? join(appSupport, "Zed", "settings.json")
        : join(appSupport, "zed", "settings.json"),
    localConfigPath: ".zed/settings.json",
    projectDetectPaths: [".zed"],
    configKey: "context_servers",
    format: "json",
    supportedTransports: ["stdio", "http", "sse"],
    supportsHeaders: true,
    detectGlobalInstall: async () => {
      const configDir =
        process.platform === "darwin" || process.platform === "win32"
          ? join(appSupport, "Zed")
          : join(appSupport, "zed");
      return existsSync(configDir);
    },
    transformConfig: transformZedConfig,
  },
};

export function getAgentTypes(): AgentType[] {
  return Object.keys(agents) as AgentType[];
}

export function supportsProjectConfig(agentType: AgentType): boolean {
  return agents[agentType].localConfigPath !== undefined;
}

export function getProjectCapableAgents(): AgentType[] {
  return (Object.keys(agents) as AgentType[]).filter((type) =>
    supportsProjectConfig(type),
  );
}

export function getGlobalOnlyAgents(): AgentType[] {
  return (Object.keys(agents) as AgentType[]).filter(
    (type) => !supportsProjectConfig(type),
  );
}

export function detectProjectAgents(cwd?: string): AgentType[] {
  const dir = cwd || process.cwd();
  const detected: AgentType[] = [];

  for (const [type, config] of Object.entries(agents)) {
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

export async function detectAllGlobalAgents(): Promise<AgentType[]> {
  const detected: AgentType[] = [];

  for (const [type, config] of Object.entries(agents)) {
    if (await config.detectGlobalInstall()) {
      detected.push(type as AgentType);
    }
  }

  return detected;
}

export function isTransportSupported(
  agentType: AgentType,
  transport: "stdio" | "sse" | "http",
): boolean {
  return agents[agentType].supportedTransports.includes(transport);
}
