# add-mcp

Install MCP servers onto coding agents with a single command.

```bash
npx add-mcp <target>
```

Supports Opencode, Claude Code, Codex, Cursor, and [more](https://github.com/neondatabase/add-mcp/blob/main/README.md#supported-agents).

## Features

- Install MCP servers to multiple AI coding agents at once
- Supports both remote (HTTP/SSE) and local (stdio) MCP servers
- Handles different config formats (JSON, YAML, TOML)
- Supports project-level and global installation

## Usage

### Remote MCP Server (HTTP)

```bash
# Install a remote MCP server
npx add-mcp https://mcp.example.com/api

# With custom name
npx add-mcp https://mcp.example.com/api --name my-server
```

### Local MCP Server (Package)

```bash
# Install from npm package
npx add-mcp @modelcontextprotocol/server-postgres

# Install with custom name
npx add-mcp mcp-server-github --name github
```

### Local MCP Server (Command)

```bash
# Install with full command
npx add-mcp "npx -y @org/mcp-server --flag value"

# Node.js script
npx add-mcp "node /path/to/server.js --port 3000"
```

## Options

```
Usage: add-mcp [options] [target]

Arguments:
  target                   MCP server URL (remote) or package name (local stdio)

Options:
  -V, --version            output the version number
  -g, --global             Install globally (user-level) instead of project-level
  -a, --agent <agents...>  Specify agents to install to
  -n, --name <name>        Server name (auto-inferred from target if not provided)
  -y, --yes                Skip confirmation prompts
  -l, --list               List supported agents
  --all                    Install to all agents without prompts (implies -y -g)
  -h, --help               display help for command
```

## Supported Agents

<!-- AGENTS_TABLE_START -->
| Agent | CLI Key | Format | Local Support |
|-------|---------|--------|---------------|
| Claude Code | `claude-code` | JSON | Yes |
| Claude Desktop | `claude-desktop` | JSON | No |
| Codex | `codex` | TOML | No |
| Cursor | `cursor` | JSON | Yes |
| Gemini CLI | `gemini-cli` | JSON | Yes |
| Goose | `goose` | YAML | No |
| OpenCode | `opencode` | JSON | Yes |
| VS Code | `vscode` | JSON | Yes |
| Zed | `zed` | JSON | No |
<!-- AGENTS_TABLE_END -->

**Aliases:** `github-copilot` → `vscode`

## Examples

### Install to specific agents

```bash
# Install to Cursor and Claude Code only
npx add-mcp https://mcp.example.com/api -a cursor claude-code

# Install to VS Code (using alias)
npx add-mcp mcp-server -a github-copilot
```

### Project vs Global installation

```bash
# Project-level (creates .cursor/mcp.json, .mcp.json, etc.)
npx add-mcp mcp-server

# Global (installs to ~/.cursor/mcp.json, ~/.claude.json, etc.)
npx add-mcp mcp-server --global
```

### Non-interactive mode

```bash
# Skip all prompts, install globally to all detected agents
npx add-mcp https://mcp.example.com/api -y -g

# Install to all agents without any prompts
npx add-mcp mcp-server --all
```

## Config File Locations

| Agent | Global | Local |
|-------|--------|-------|
| Claude Code | `~/.claude.json` | `.mcp.json` |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` | - |
| Codex | `~/.codex/config.toml` | - |
| Cursor | `~/.cursor/mcp.json` | `.cursor/mcp.json` |
| Gemini CLI | `~/.gemini/settings.json` | `.gemini/settings.json` |
| Goose | `~/.config/goose/config.yaml` | - |
| OpenCode | `~/.config/opencode/opencode.json` | `.opencode.json` |
| VS Code | `~/Library/Application Support/Code/User/mcp.json` | `.vscode/mcp.json` |
| Zed | `~/.config/zed/settings.json` | - |

