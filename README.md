# add-mcp

Add MCP servers to your favorite coding agents with a single command.

Supports **OpenCode**, **Claude Code**, **Codex**, **Cursor**, and [5 more](#supported-agents).

## Install an MCP Server

```bash
npx add-mcp https://mcp.example.com/sse
```

### Usage Examples

```bash
# Remote MCP server (streamable HTTP)
npx add-mcp https://mcp.example.com/mcp

# Remote MCP server (SSE transport)
npx add-mcp https://mcp.example.com/sse --transport sse

# npm package (runs via npx)
npx add-mcp @modelcontextprotocol/server-postgres

# Non-interactive installation to all detected agents in the project directory
npx add-mcp https://mcp.example.com/mcp -y

# Non-interactive installation to the global Claude Code config
npx add-mcp https://mcp.example.com/mcp -g -a claude-code -y

# Full command with arguments
npx add-mcp "npx -y @org/mcp-server --flag value"

# Node.js script
npx add-mcp "node /path/to/server.js --port 3000"

# Install for Cursor and Claude Code
npx add-mcp https://mcp.example.com/mcp -a cursor -a claude-code

# Install with custom server name
npx add-mcp @modelcontextprotocol/server-postgres --name postgres

# Install to all supported agents
npx add-mcp mcp-server-github --all

# Install to all agents, globally, without prompts
npx add-mcp mcp-server-github --all -g -y
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

### Additional Commands

Besides the implicit add command, `add-mcp` also supports the following commands:

| Command       | Description                                                  |
| ------------- | ------------------------------------------------------------ |
| `list-agents` | List all supported coding agents with scope (project/global) |

```bash
# List all supported agents
npx add-mcp list-agents
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
- Only shows agents that have project config in the current directory
- Installs to project-level config files

**With `-g` (global mode):**

- Detects all globally-installed agents (including Claude Desktop, Codex, Zed)
- All agents use global config

**No agents detected:**

- Interactive mode: Shows error with guidance to use `--global` or run in a project
- With `--yes`: Installs to all project-capable agents

## Transport Types

`add-mcp` supports all three transport types: HTTP, SSE, and stdio. Some agents require `type` option to be set to specify the transport type. You can use the `--type` or `--transport` option to specify the transport type:

| Transport | Flag               | Description                                           |
| --------- | ------------------ | ----------------------------------------------------- |
| **HTTP**  | `--transport http` | Streamable HTTP (default)                             |
| **SSE**   | `--transport sse`  | Server-Sent Events (deprecated by MCP but still used) |

Local servers (npm packages, commands) always use **stdio** transport.

## Supported Agents

MCP servers can be installed to any of these agents:

| Agent          | `--agent`        | Project Path            | Global Path                                                       |
| -------------- | ---------------- | ----------------------- | ----------------------------------------------------------------- |
| Claude Code    | `claude-code`    | `.mcp.json`             | `~/.claude.json`                                                  |
| Claude Desktop | `claude-desktop` | -                       | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Codex          | `codex`          | `.codex/config.toml`    | `~/.codex/config.toml`                                            |
| Cursor         | `cursor`         | `.cursor/mcp.json`      | `~/.cursor/mcp.json`                                              |
| Gemini CLI     | `gemini-cli`     | `.gemini/settings.json` | `~/.gemini/settings.json`                                         |
| Goose          | `goose`          | `.goose/config.yaml`    | `~/.config/goose/config.yaml`                                     |
| OpenCode       | `opencode`       | `.opencode.json`        | `~/.config/opencode/opencode.json`                                |
| VS Code        | `vscode`         | `.vscode/mcp.json`      | `~/Library/Application Support/Code/User/mcp.json`                |
| Zed            | `zed`            | `.zed/settings.json`    | `~/Library/Application Support/Zed/settings.json`                 |

**Aliases:** `github-copilot` → `vscode`

The CLI uses smart detection to find agents in your project directory and globally installed agents. See [Smart Detection](#smart-detection) for details.

## What are MCP Servers?

[Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers extend your coding agent's capabilities by providing tools, resources, and context. MCP servers can:

- Integrate with external services (Notion, Linear, GitHub, etc.)
- Connect to databases (PostgreSQL, MySQL, etc.)
- Provide file system access
- Offer specialized tools for your workflow

## Troubleshooting

### Server not loading

- Verify the server URL is correct and accessible
- Check the agent's MCP configuration file for syntax errors
- Ensure the server name doesn't conflict with existing servers

### Permission errors

Ensure you have write access to the target configuration directory.

## License

Apache 2.0
