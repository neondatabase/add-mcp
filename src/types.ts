/**
 * Supported agent types
 */
export type AgentType =
  | "claude-code"
  | "claude-desktop"
  | "codex"
  | "cursor"
  | "gemini-cli"
  | "goose"
  | "opencode"
  | "vscode"
  | "zed";

/**
 * Aliases that map to canonical agent types
 */
export const agentAliases: Record<string, AgentType> = {
  "github-copilot": "vscode",
};

/**
 * Config file format types
 */
export type ConfigFormat = "json" | "yaml" | "toml";

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Internal name */
  name: string;
  /** Display name for UI */
  displayName: string;
  /** Global config file path */
  configPath: string;
  /** Local (project-level) config file path, if supported */
  localConfigPath?: string;
  /** Key in config file where MCP servers are stored (supports dot notation) */
  configKey: string;
  /** Config file format */
  format: ConfigFormat;
  /** Supported transport types for this agent */
  supportedTransports: ("stdio" | "sse" | "http")[];
  /** Function to detect if agent is installed */
  detectInstalled: () => Promise<boolean>;
  /** Optional function to transform server config to agent-specific format */
  transformConfig?: (serverName: string, config: McpServerConfig) => unknown;
}

/**
 * Parsed source input types
 */
export type SourceType = "remote" | "package" | "command";

/**
 * Parsed source result
 */
export interface ParsedSource {
  type: SourceType;
  /** For remote: the URL; for package: package name; for command: full command */
  value: string;
  /** Inferred server name */
  inferredName: string;
}

/**
 * Transport types for MCP servers
 * - stdio: Local process communication via stdin/stdout
 * - sse: Server-Sent Events transport (HTTP GET for events + POST for messages)
 * - http: Streamable HTTP transport (modern standard, single HTTP endpoint)
 */
export type TransportType = "sse" | "http";

/**
 * MCP server configuration (standard format)
 */
export interface McpServerConfig {
  /** For remote servers */
  type?: TransportType;
  url?: string;
  headers?: Record<string, string>;
  /** For local stdio servers */
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * Generic config file content
 */
export interface ConfigFile {
  [key: string]: unknown;
}
