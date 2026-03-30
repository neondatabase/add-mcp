# Changelog

## [1.7.0] - 2026-03-29

- add `find` / `search` command to search MCP registries and install servers interactively
- first-run prompt to select which registries to enable (Verified essentials and Official Anthropic registry)
- registry config stored in `~/.config/add-mcp/config.json` (respects `XDG_CONFIG_HOME`), editable to add custom registries
- automatic migration from legacy `~/.agents/.mcp-lock.json` location

## [1.6.0] - 2026-03-29

- add repeatable `--env KEY=VALUE` support for local stdio installs (package and command sources)
- validate `--env` format, preserve values after the first `=`, and warn when `--env` is used with remote URL installs
- add unit and e2e coverage for env propagation across agent-specific config mappings (`env`, `envs`, `environment`)

## [1.5.1] - 2026-03-01

- update Antigravity to support remote MCP servers via `serverUrl` config

## [1.5.0] - 2026-02-28

- Add support for Antigravity

## [1.4.0] - 2026-02-28

- Add support for MCPorter

## [1.3.0] - 2026-02-26

- Add support for Cline VSCode Extension and Cline CLI

## [1.2.2] - 2026-02-21

- fix Goose remote HTTP/SSE header support and simplify header capability handling
- fix Claude Desktop config to only support stdio (remote servers must be added through the Claude Desktop UI)

## [1.2.1] - 2026-02-17

fix Codex remote HTTP header key mapping

## [1.2.0] - 2026-02-16

add `--gitignore` option to append generated project MCP config paths to `.gitignore`

## [1.1.0] - 2026-02-14

add `github-copilot-cli` (Copilot CLI) support with project installs written to `.vscode/mcp.json` (same as VS Code) and global installs written to `~/.copilot/mcp-config.json` (`mcpServers`)

## [1.0.1] - 2026-02-14

fix OpenCode config detection and MCP command generation

## [1.0.0] - 2026-02-09

v1 release 🎉
