# add-mcp

Add MCP servers to your favorite coding agents with a single command.

Supports **OpenCode**, **Claude Code**, **Codex**, **Cursor**, and [5 more](#supported-agents).

## Install an MCP Server

```bash
npx add-mcp https://mcp.example.com/sse
```

### Source Formats

```bash
# Remote MCP server (HTTP streamable - default)
npx add-mcp https://mcp.example.com/mcp

# Remote MCP server (SSE transport)
npx add-mcp https://mcp.example.com/sse --transport sse

# npm package (runs via npx)
npx add-mcp @modelcontextprotocol/server-postgres

# Full command with arguments
npx add-mcp "npx -y @org/mcp-server --flag value"

# Node.js script
npx add-mcp "node /path/to/server.js --port 3000"
```

### Options

| Option                   | Description                                                              |
| ------------------------ | ------------------------------------------------------------------------ |
| `-g, --global`           | Install to user directory instead of project                             |
| `-a, --agent <agent>`    | Target specific agents (e.g., `cursor`, `claude-code`). Can be repeated. |
| `-t, --transport <type>` | Transport type for remote servers: `http` (default), `sse`               |
| `--type <type>`          | Alias for `--transport`                                                  |
| `-n, --name <name>`      | Server name (auto-inferred if not provided)                              |
| `-y, --yes`              | Skip all confirmation prompts                                            |
| `--all`                  | Install to all agents                                                    |

### Examples

```bash
# Install to specific agents
npx add-mcp https://mcp.example.com/mcp -a cursor -a claude-code

# Install with SSE transport
npx add-mcp https://mcp.neon.tech/sse --transport sse

# Install with custom server name
npx add-mcp @modelcontextprotocol/server-postgres --name postgres

# Non-interactive installation (CI/CD friendly)
npx add-mcp https://mcp.example.com/mcp -g -a claude-code -y

# Install to all agents
npx add-mcp mcp-server-github --all

# Install to all agents, globally, without prompts
npx add-mcp mcp-server-github --all -g -y
```

### Installation Scope

| Scope       | Flag      | Location                | Use Case                                      |
| ----------- | --------- | ----------------------- | --------------------------------------------- |
| **Project** | (default) | `.cursor/mcp.json` etc. | Committed with your project, shared with team |
| **Global**  | `-g`      | `~/.cursor/mcp.json`    | Available across all projects                 |

### Smart Detection

The CLI automatically detects agents based on your environment:

**Default (project mode):**

- Detects project-level config files (`.cursor/`, `.vscode/`, `.mcp.json`, etc.)
- Also detects globally-installed agents that only support global config (Claude Desktop, Codex, Zed)
- Agents are routed appropriately: project-capable agents use project config, global-only agents use global config

**With `-g` (global mode):**

- Detects all globally-installed agents
- All agents use global config

**No agents detected:**

- Interactive mode: Shows error with guidance to use `--global` or run in a project
- With `--yes`: Installs to all project-capable agents

## Transport Types

MCP supports different transport mechanisms for remote servers:

| Transport | Flag               | Description                                    |
| --------- | ------------------ | ---------------------------------------------- |
| **HTTP**  | `--transport http` | Streamable HTTP (default, modern standard)     |
| **SSE**   | `--transport sse`  | Server-Sent Events (legacy, still widely used) |

Local servers (npm packages, commands) always use **stdio** transport.

## Supported Agents

MCP servers can be installed to any of these agents:

| Agent          | `--agent`        | Project Path            | Global Path                                                       |
| -------------- | ---------------- | ----------------------- | ----------------------------------------------------------------- |
| Claude Code    | `claude-code`    | `.mcp.json`             | `~/.claude.json`                                                  |
| Claude Desktop | `claude-desktop` | -                       | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Codex          | `codex`          | -                       | `~/.codex/config.toml`                                            |
| Cursor         | `cursor`         | `.cursor/mcp.json`      | `~/.cursor/mcp.json`                                              |
| Gemini CLI     | `gemini-cli`     | `.gemini/settings.json` | `~/.gemini/settings.json`                                         |
| Goose          | `goose`          | `.goose/config.yaml`    | `~/.config/goose/config.yaml`                                     |
| OpenCode       | `opencode`       | `.opencode.json`        | `~/.config/opencode/opencode.json`                                |
| VS Code        | `vscode`         | `.vscode/mcp.json`      | `~/Library/Application Support/Code/User/mcp.json`                |
| Zed            | `zed`            | -                       | `~/.config/zed/settings.json`                                     |

**Aliases:** `github-copilot` → `vscode`

The CLI uses smart detection to find agents in your project directory and globally installed agents. See [Smart Detection](#smart-detection) for details.

### Transport Support

Not all agents support all transport types:

| Agent          | stdio | http | sse |
| -------------- | ----- | ---- | --- |
| Claude Code    | ✓     | ✓    | ✓   |
| Claude Desktop | ✓     | ✓    | ✓   |
| Codex          | ✓     | ✓    | ✓   |
| Cursor         | ✓     | ✓    | ✓   |
| Gemini CLI     | ✓     | ✓    | ✓   |
| Goose          | ✓     | ✓    | ✗   |
| OpenCode       | ✓     | ✓    | ✓   |
| VS Code        | ✓     | ✓    | ✓   |
| Zed            | ✓     | ✓    | ✓   |

## What are MCP Servers?

[Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers extend your coding agent's capabilities by providing tools, resources, and context. MCP servers can:

- Connect to databases (PostgreSQL, MySQL, etc.)
- Integrate with external services (GitHub, Linear, Notion)
- Provide file system access
- Offer specialized tools for your workflow

## Troubleshooting

### Transport mismatch error

If you get an error about transport not being supported, check that the agent supports your chosen transport type. For example, Goose doesn't support SSE transport.

### Server not loading

- Verify the server URL is correct and accessible
- Check the agent's MCP configuration file for syntax errors
- Ensure the server name doesn't conflict with existing servers

### Permission errors

Ensure you have write access to the target configuration directory.

## License

Apache 2.0
