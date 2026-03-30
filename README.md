# add-mcp

Add MCP servers to your favorite coding agents with a single command.

Supports **Claude Code**, **Codex**, **Cursor**, **OpenCode**, **VSCode** and [9 more](#supported-agents).

## Install an MCP Server

```bash
npx add-mcp url | package name [options]
```

## Find MCP Servers

Search and install servers directly from the MCP registry API:

```bash
# Interactive search and selection
npx add-mcp find postgres

# Alias
npx add-mcp search github

# Non-interactive: pick best match and install to specific agent
npx add-mcp find neon -a cursor -y
```

`find` supports the same install flags as `add` (`-a`, `-g`, `--all`, `-n`, `-y`, `--gitignore`).
When a server offers both remote and stdio package options, interactive mode lets you choose one (remote is the default). With `-y`, it auto-selects remote.

If a selected remote server defines URL variables or header inputs:

- required values must be provided
- optional values can be skipped with Enter
- with `-y`, placeholders are inserted (for example `<your-header-value-here>`)

Example installing the Context7 MCP server:

```bash
npx add-mcp https://mcp.context7.com/mcp
```

### Usage Examples

```bash
# Remote MCP server (streamable HTTP)
npx add-mcp https://mcp.example.com/mcp

# Remote MCP server (SSE transport)
npx add-mcp https://mcp.example.com/sse --transport sse

# Remote MCP server with auth header
npx add-mcp https://mcp.example.com/mcp --header "Authorization: Bearer $TOKEN"

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

# Local stdio server with environment variables (repeatable)
npx add-mcp @modelcontextprotocol/server-filesystem --env "API_KEY=secret" --env "DATABASE_URL=postgres://localhost/app"

# Install for Cursor and Claude Code
npx add-mcp https://mcp.example.com/mcp -a cursor -a claude-code

# Install with custom server name
npx add-mcp @modelcontextprotocol/server-postgres --name postgres

# Install to all supported agents
npx add-mcp mcp-server-github --all

# Install to all agents, globally, without prompts
npx add-mcp mcp-server-github --all -g -y

# Add generated config files to .gitignore
npx add-mcp https://mcp.example.com/mcp -a cursor -y --gitignore
```

### Options

| Option                   | Description                                                              |
| ------------------------ | ------------------------------------------------------------------------ |
| `-g, --global`           | Install to user directory instead of project                             |
| `-a, --agent <agent>`    | Target specific agents (e.g., `cursor`, `claude-code`). Can be repeated. |
| `-t, --transport <type>` | Transport type for remote servers: `http` (default), `sse`               |
| `--type <type>`          | Alias for `--transport`                                                  |
| `--header <header>`      | HTTP header for remote servers (repeatable, `Key: Value`)                |
| `--env <env>`            | Env var for local stdio servers (repeatable, `KEY=VALUE`)                |
| `-n, --name <name>`      | Server name (auto-inferred if not provided)                              |
| `-y, --yes`              | Skip all confirmation prompts                                            |
| `--all`                  | Install to all agents                                                    |
| `--gitignore`            | Add generated config files to `.gitignore`                               |

### Additional Commands

Besides the implicit add command, `add-mcp` also supports the following commands:

| Command       | Description                                                  |
| ------------- | ------------------------------------------------------------ |
| `find`        | Search MCP registry servers and install a selected match     |
| `search`      | Alias for `find`                                             |
| `list-agents` | List all supported coding agents with scope (project/global) |

```bash
# List all supported agents
npx add-mcp list-agents

# Search registry servers and install
npx add-mcp find notion
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
- Selects detected agents (have project config in the current directory) by default
- Shows detected agents plus all other supported agents for selection

**With `-g` (global mode):**

- Detects all globally-installed agents (including Claude Desktop, Codex, Zed)
- Selects detected agents by default
- Shows detected agents plus all other supported agents for selection

**No agents detected:**

- Interactive mode: Defaults to the last selection and shows all agents for selection
- With `--yes`: Installs to all project-capable agents (project mode) or all global-capable agents (global mode)

## Transport Types

`add-mcp` supports all three transport types: HTTP, SSE, and stdio. Some agents require `type` option to be set to specify the transport type. You can use the `--type` or `--transport` option to specify the transport type:

| Transport | Flag               | Description                                           |
| --------- | ------------------ | ----------------------------------------------------- |
| **HTTP**  | `--transport http` | Streamable HTTP (default)                             |
| **SSE**   | `--transport sse`  | Server-Sent Events (deprecated by MCP but still used) |

Local servers (npm packages, commands) always use **stdio** transport.

Note that some agents like Cursor and opencode do not require the `type` information to be set.

## HTTP Headers

Use `--header` to pass custom headers for remote servers. The flag can be repeated.
Header support is available for remote installs across all supported agents.

## Environment Variables

Use `--env` to pass environment variables for local stdio servers (packages/commands). The flag can be repeated and expects `KEY=VALUE`.
If `--env` is provided for a remote URL install, it is ignored with a warning.

## Supported Agents

MCP servers can be installed to any of these agents:

| Agent                  | `--agent`            | Project Path            | Global Path                                                                                                     |
| ---------------------- | -------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| Antigravity            | `antigravity`        | -                       | `~/.gemini/antigravity/mcp_config.json`                                                                         |
| Cline VSCode Extension | `cline`              | -                       | `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` |
| Cline CLI              | `cline-cli`          | -                       | `~/.cline/data/settings/cline_mcp_settings.json`                                                                |
| Claude Code            | `claude-code`        | `.mcp.json`             | `~/.claude.json`                                                                                                |
| Claude Desktop         | `claude-desktop`     | -                       | `~/Library/Application Support/Claude/claude_desktop_config.json`                                               |
| Codex                  | `codex`              | `.codex/config.toml`    | `~/.codex/config.toml`                                                                                          |
| Cursor                 | `cursor`             | `.cursor/mcp.json`      | `~/.cursor/mcp.json`                                                                                            |
| Gemini CLI             | `gemini-cli`         | `.gemini/settings.json` | `~/.gemini/settings.json`                                                                                       |
| Goose                  | `goose`              | `.goose/config.yaml`    | `~/.config/goose/config.yaml`                                                                                   |
| GitHub Copilot CLI     | `github-copilot-cli` | `.vscode/mcp.json`      | `~/.copilot/mcp-config.json`                                                                                    |
| MCPorter               | `mcporter`           | `config/mcporter.json`  | `~/.mcporter/mcporter.json` (or existing `~/.mcporter/mcporter.jsonc`)                                          |
| OpenCode               | `opencode`           | `opencode.json`         | `~/.config/opencode/opencode.json`                                                                              |
| VS Code                | `vscode`             | `.vscode/mcp.json`      | `~/Library/Application Support/Code/User/mcp.json`                                                              |
| Zed                    | `zed`                | `.zed/settings.json`    | `~/Library/Application Support/Zed/settings.json`                                                               |

**Aliases:** `cline-vscode` → `cline`, `gemini` → `gemini-cli`, `github-copilot` → `vscode`

The CLI uses smart detection to find agents in your project directory and globally installed agents. See [Smart Detection](#smart-detection) for details.

## Configuring Registries for Find / Search

The first time you run `find` or `search`, the CLI prompts you to choose which registries to enable. Your selection is saved to `~/.config/add-mcp/config.json` (respects `XDG_CONFIG_HOME`) and reused on every subsequent search.

### Built-in Registries

| Registry                        | Base URL                                                | Description                                                                                                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Verified essentials**         | `https://mcp-registry.agent-tooling.dev/api/v1/servers` | A curated list of first-party, verified MCP servers from popular developer tools and SaaS services. Designed to surface high-quality, officially maintained servers instead of a long tail of unmaintained or third-party entries. |
| **Official Anthropic registry** | `https://registry.modelcontextprotocol.io/v0.1/servers` | The community-driven MCP server registry maintained by Anthropic. Contains the broadest catalog of MCP servers.                                                                                                                    |

### Editing or Removing Registries

Registry selections are stored in `~/.config/add-mcp/config.json` under the `findRegistries` key. You can edit this file directly to add, remove, or reorder registries:

```json
{
  "version": 1,
  "findRegistries": [
    {
      "id": "verified-essentials",
      "label": "Verified essentials",
      "serversUrl": "https://mcp-registry.agent-tooling.dev/api/v1/servers"
    },
    {
      "id": "official-anthropic-registry",
      "label": "Official Anthropic registry",
      "serversUrl": "https://registry.modelcontextprotocol.io/v0.1/servers"
    }
  ]
}
```

To reset and re-trigger the interactive selection prompt, remove the `findRegistries` key (or delete the file entirely).

### Adding a Custom Registry

Any server that implements the registry API can be added as a custom entry. The CLI sends a `GET` request to the configured `serversUrl` with the following query parameters:

| Parameter | Value                                  |
| --------- | -------------------------------------- |
| `search`  | The user's search keyword (lowercased) |
| `version` | `latest`                               |
| `limit`   | `30`                                   |

The endpoint must return JSON in this shape:

```json
{
  "servers": [
    {
      "server": {
        "name": "example-server",
        "description": "An example MCP server",
        "version": "1.0.0",
        "remotes": [
          {
            "type": "streamable-http",
            "url": "https://mcp.example.com/mcp"
          }
        ]
      }
    }
  ]
}
```

To add your own registry, append an entry to `findRegistries` in `~/.config/add-mcp/config.json`:

```json
{
  "id": "my-registry",
  "label": "My custom registry",
  "serversUrl": "https://my-registry.example.com/api/v1/servers"
}
```

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
