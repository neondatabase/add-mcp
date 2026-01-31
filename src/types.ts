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

export const agentAliases: Record<string, AgentType> = {
  "github-copilot": "vscode",
};

export type ConfigFormat = "json" | "yaml" | "toml";

export interface AgentConfig {
  /** Internal name */
  name: string;
  /** Display name for UI */
  displayName: string;
  /** Global config file path */
  configPath: string;
  /** Local (project-level) config file path, if supported */
  localConfigPath?: string;
  /** Paths to check for project-level detection (relative to cwd) */
  projectDetectPaths: string[];
  /** Key in config file where MCP servers are stored (supports dot notation) */
  configKey: string;
  /** Config file format */
  format: ConfigFormat;
  /** Supported transport types for this agent */
  supportedTransports: ("stdio" | "sse" | "http")[];
  /** Function to detect if agent is installed globally */
  detectGlobalInstall: () => Promise<boolean>;
  /** Optional function to transform server config to agent-specific format */
  transformConfig?: (serverName: string, config: McpServerConfig) => unknown;
}

export type SourceType = "remote" | "package" | "command";

export interface ParsedSource {
  type: SourceType;
  /** For remote: the URL; for package: package name; for command: full command */
  value: string;
  /** Inferred server name */
  inferredName: string;
}

export type TransportType = "sse" | "http";

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

export interface ConfigFile {
  [key: string]: unknown;
}
