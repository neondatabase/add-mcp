#!/usr/bin/env node

import { program } from "commander";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { homedir } from "os";
import type { AgentType, TransportType } from "./types.js";
import { agentAliases } from "./types.js";
import {
  agents,
  getAgentTypes,
  isTransportSupported,
  detectProjectAgents,
  detectAllGlobalAgents,
  supportsProjectConfig,
  getProjectCapableAgents,
  buildAgentSelectionChoices,
  selectAgentsInteractive,
} from "./agents.js";
import { getLastSelectedAgents } from "./mcp-lock.js";
import { parseSource, isRemoteSource } from "./source-parser.js";
import { buildServerConfig, installServer } from "./installer.js";

import packageJson from "../package.json" with { type: "json" };

const version = packageJson.version;

// ANSI color codes
const RESET = "\x1b[0m";
const DIM = "\x1b[38;5;102m";
const TEXT = "\x1b[38;5;145m";

// ASCII art logo for ADD-MCP
const LOGO_LINES = [
  " █████╗ ██████╗ ██████╗       ███╗   ███╗ ██████╗██████╗ ",
  "██╔══██╗██╔══██╗██╔══██╗      ████╗ ████║██╔════╝██╔══██╗",
  "███████║██║  ██║██║  ██║█████╗██╔████╔██║██║     ██████╔╝",
  "██╔══██║██║  ██║██║  ██║╚════╝██║╚██╔╝██║██║     ██╔═══╝ ",
  "██║  ██║██████╔╝██████╔╝      ██║ ╚═╝ ██║╚██████╗██║     ",
  "╚═╝  ╚═╝╚═════╝ ╚═════╝       ╚═╝     ╚═╝ ╚═════╝╚═╝     ",
];

// Gradient grays for logo
const GRAYS = [
  "\x1b[38;5;250m",
  "\x1b[38;5;248m",
  "\x1b[38;5;245m",
  "\x1b[38;5;243m",
  "\x1b[38;5;240m",
  "\x1b[38;5;238m",
];

function showLogo(): void {
  console.log();
  LOGO_LINES.forEach((line, i) => {
    console.log(`${GRAYS[i]}${line}${RESET}`);
  });
}

function showBanner(): void {
  showLogo();
  console.log();
  console.log(`${DIM}Add MCP servers to your favorite coding agents${RESET}`);
  console.log();
  console.log(
    `  ${DIM}$${RESET} ${TEXT}npx add-mcp ${DIM}<url>${RESET}              ${DIM}Install remote MCP server${RESET}`,
  );
  console.log(
    `  ${DIM}$${RESET} ${TEXT}npx add-mcp ${DIM}<package>${RESET}          ${DIM}Install npm package${RESET}`,
  );
  console.log(
    `  ${DIM}$${RESET} ${TEXT}npx add-mcp ${DIM}<url> ${TEXT}-g${RESET}            ${DIM}Install globally${RESET}`,
  );
  console.log(
    `  ${DIM}$${RESET} ${TEXT}npx add-mcp ${DIM}<url> ${TEXT}-a cursor${RESET}    ${DIM}Install to specific agent${RESET}`,
  );
  console.log();
  console.log(
    `${DIM}Supports:${RESET} Claude Code, Cursor, VS Code, OpenCode, and more`,
  );
  console.log();
  console.log(
    `${DIM}Learn more at${RESET} ${TEXT}https://github.com/neondatabase/add-mcp${RESET}`,
  );
  console.log();
}

/**
 * Shorten a path for display (replace home with ~)
 */
function shortenPath(fullPath: string): string {
  const home = homedir();
  if (fullPath.startsWith(home)) {
    return fullPath.replace(home, "~");
  }
  return fullPath;
}

/**
 * Resolve agent aliases to canonical types
 */
function resolveAgentType(input: string): AgentType | null {
  const lower = input.toLowerCase();

  // Check if it's a direct agent type
  if (lower in agents) {
    return lower as AgentType;
  }

  // Check aliases
  if (lower in agentAliases) {
    return agentAliases[lower]!;
  }

  return null;
}

interface Options {
  global?: boolean;
  agent?: string[];
  name?: string;
  transport?: string;
  type?: string;
  header?: string[];
  yes?: boolean;
  all?: boolean;
}

/**
 * Collect multiple values for repeatable options
 */
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

interface ParsedHeadersResult {
  headers: Record<string, string>;
  invalid: string[];
}

function parseHeaders(values: string[]): ParsedHeadersResult {
  const headers: Record<string, string> = {};
  const invalid: string[] = [];

  for (const entry of values) {
    const separatorIndex = entry.indexOf(":");
    if (separatorIndex <= 0) {
      invalid.push(entry);
      continue;
    }

    const key = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim();

    if (!key || !value) {
      invalid.push(entry);
      continue;
    }

    headers[key] = value;
  }

  return { headers, invalid };
}

program
  .name("add-mcp")
  .description(
    "Install MCP servers onto coding agents (Claude Code, Cursor, VS Code, OpenCode, Codex)",
  )
  .version(version)
  .argument("[target]", "MCP server URL (remote) or package name (local stdio)")
  .option(
    "-g, --global",
    "Install globally (user-level) instead of project-level",
  )
  .option("-a, --agent <agent>", "Specify agents to install to", collect, [])
  .option(
    "-n, --name <name>",
    "Server name (auto-inferred from target if not provided)",
  )
  .option(
    "-t, --transport <type>",
    "Transport type for remote servers (http, sse)",
  )
  .option("--type <type>", "Alias for --transport")
  .option(
    "--header <header>",
    "HTTP header for remote servers (repeatable, 'Key: Value')",
    collect,
    [],
  )
  .option("-y, --yes", "Skip confirmation prompts")
  .option("--all", "Install to all agents")
  .action(async (target: string | undefined, options: Options) => {
    await main(target, options);
  });

program
  .command("list-agents")
  .description("List all supported coding agents")
  .action(() => {
    listAgents();
  });

program.parse();

function listAgents(): void {
  showLogo();
  console.log();
  console.log(`${DIM}Supported agents:${RESET}`);
  console.log();

  const allAgentTypes = getAgentTypes();

  for (const agentType of allAgentTypes) {
    const agent = agents[agentType];
    const hasProjectSupport = supportsProjectConfig(agentType);
    const scope = hasProjectSupport ? "project, global" : "global";

    console.log(
      `  ${TEXT}${agent.displayName}${RESET} ${DIM}(${scope})${RESET}`,
    );
  }

  console.log();
}

async function main(target: string | undefined, options: Options) {
  // --all just selects all agents, doesn't imply --yes or --global
  // Use --yes to skip prompts, --global to install globally

  // Always show the logo
  showLogo();

  // Show full banner (with help) when no target is provided
  if (!target) {
    console.log();
    console.log(`${DIM}Add MCP servers to your favorite coding agents${RESET}`);
    console.log();
    console.log(
      `  ${DIM}$${RESET} ${TEXT}npx add-mcp ${DIM}<url>${RESET}              ${DIM}Install remote MCP server${RESET}`,
    );
    console.log(
      `  ${DIM}$${RESET} ${TEXT}npx add-mcp ${DIM}<package>${RESET}          ${DIM}Install npm package${RESET}`,
    );
    console.log(
      `  ${DIM}$${RESET} ${TEXT}npx add-mcp ${DIM}<url> ${TEXT}-g${RESET}            ${DIM}Install globally${RESET}`,
    );
    console.log(
      `  ${DIM}$${RESET} ${TEXT}npx add-mcp ${DIM}<url> ${TEXT}-a cursor${RESET}    ${DIM}Install to specific agent${RESET}`,
    );
    console.log();
    console.log(
      `${DIM}Supports:${RESET} Claude Code, Cursor, VS Code, OpenCode, and more`,
    );
    console.log();
    console.log(
      `${DIM}Learn more at${RESET} ${TEXT}https://github.com/neondatabase/add-mcp${RESET}`,
    );
    console.log();
    process.exit(0);
  }

  console.log();

  const spinner = p.spinner();

  // Parse the source
  spinner.start("Parsing source...");
  const parsed = parseSource(target);
  const isRemote = isRemoteSource(parsed);
  const sourceType = isRemote ? "remote" : "local";
  spinner.stop(`Source: ${chalk.cyan(parsed.value)} (${sourceType})`);

  const headerValues = options.header ?? [];
  const headerResult = parseHeaders(headerValues);
  if (headerResult.invalid.length > 0) {
    p.log.error(
      `Invalid --header value(s): ${headerResult.invalid.join(", ")}. Use "Key: Value" format.`,
    );
    process.exit(1);
  }

  const headerKeys = Object.keys(headerResult.headers);
  const hasHeaderValues = headerKeys.length > 0;
  if (hasHeaderValues && !isRemote) {
    p.log.warn("--header is only used for remote URLs, ignoring");
  }

  // Determine server name
  const serverName = options.name || parsed.inferredName;
  p.log.info(`Server name: ${chalk.cyan(serverName)}`);

  // Handle transport option (--transport or --type)
  const transportValue = options.transport || options.type;
  let resolvedTransport: TransportType | undefined;

  if (transportValue) {
    const validTransports = ["http", "sse"];
    if (!validTransports.includes(transportValue)) {
      p.log.error(
        `Invalid transport: ${transportValue}. Valid options: ${validTransports.join(", ")}`,
      );
      process.exit(1);
    }
    resolvedTransport = transportValue as TransportType;
    if (!isRemoteSource(parsed)) {
      p.log.warn("--transport is only used for remote URLs, ignoring");
    }
  }

  // Build server config
  const serverConfig = buildServerConfig(parsed, {
    transport: resolvedTransport,
    headers: isRemote && hasHeaderValues ? headerResult.headers : undefined,
  });

  // Determine target agents
  let targetAgents: AgentType[];
  const allAgentTypes = getAgentTypes();
  const hasExplicitAgentFlags =
    (options.agent && options.agent.length > 0) || options.all === true;
  let selectedViaPrompt = false;

  // Track which agents should use local vs global config
  // This will be populated based on detection and user choices
  let agentRouting: Map<AgentType, "local" | "global"> = new Map();

  if (options.agent && options.agent.length > 0) {
    // Resolve specified agents (handling aliases)
    const resolved: AgentType[] = [];
    const invalid: string[] = [];

    for (const input of options.agent) {
      const agentType = resolveAgentType(input);
      if (agentType) {
        resolved.push(agentType);
      } else {
        invalid.push(input);
      }
    }

    if (invalid.length > 0) {
      p.log.error(`Invalid agents: ${invalid.join(", ")}`);
      p.log.info(`Valid agents: ${allAgentTypes.join(", ")}`);
      process.exit(1);
    }

    targetAgents = resolved;
  } else if (options.all) {
    targetAgents = allAgentTypes;
    p.log.info(`Installing to all ${targetAgents.length} agents`);
  } else {
    // Smart detection based on scope
    spinner.start("Detecting agents...");

    let detectedAgents: AgentType[];

    if (options.global) {
      // Global mode: detect all globally installed agents
      detectedAgents = await detectAllGlobalAgents();
      for (const agent of detectedAgents) {
        agentRouting.set(agent, "global");
      }
    } else {
      // Default (project) mode: only detect project agents
      const projectAgents = detectProjectAgents();
      detectedAgents = projectAgents;

      // Set routing for detected agents
      for (const agent of projectAgents) {
        agentRouting.set(agent, "local");
      }
    }

    spinner.stop(
      `Detected ${detectedAgents.length} agent${detectedAgents.length !== 1 ? "s" : ""}`,
    );

    if (detectedAgents.length === 0) {
      if (options.yes) {
        if (options.global) {
          targetAgents = allAgentTypes;
          for (const agent of targetAgents) {
            agentRouting.set(agent, "global");
          }
          p.log.info(
            `Installing to ${targetAgents.length} agents globally (none detected)`,
          );
        } else {
          // No agents detected + --yes: install to all project-capable agents
          targetAgents = getProjectCapableAgents();
          for (const agent of targetAgents) {
            agentRouting.set(agent, "local");
          }
          p.log.info(
            `Installing to ${targetAgents.length} project-capable agents (none detected)`,
          );
        }
      } else {
        const availableAgents = options.global
          ? allAgentTypes
          : getProjectCapableAgents();

        p.log.warn(
          options.global
            ? "No coding agents detected."
            : "No agents detected in this project.",
        );

        const selected = await selectAgentsInteractive(availableAgents, {
          global: options.global,
        });

        if (p.isCancel(selected)) {
          p.cancel("Installation cancelled");
          process.exit(0);
        }

        selectedViaPrompt = true;
        targetAgents = selected as AgentType[];
        for (const agent of targetAgents) {
          agentRouting.set(agent, options.global ? "global" : "local");
        }
      }
    } else if (options.yes) {
      targetAgents = detectedAgents;
      const agentNames = detectedAgents
        .map((a) => chalk.cyan(agents[a].displayName))
        .join(", ");
      p.log.info(`Installing to: ${agentNames}`);
    } else {
      const availableAgents = options.global
        ? allAgentTypes
        : getProjectCapableAgents();
      let lastSelected: string[] | undefined;
      try {
        lastSelected = await getLastSelectedAgents();
      } catch {
        // Ignore lock read errors
      }
      const { choices: agentChoices, initialValues } =
        buildAgentSelectionChoices({
          availableAgents,
          detectedAgents,
          agentRouting,
          lastSelected,
        });

      const selected = await p.multiselect({
        message: "Select agents to install to",
        options: agentChoices,
        required: true,
        initialValues,
      });

      if (p.isCancel(selected)) {
        p.cancel("Installation cancelled");
        process.exit(0);
      }

      selectedViaPrompt = true;
      targetAgents = selected as AgentType[];
      for (const agent of targetAgents) {
        agentRouting.set(agent, options.global ? "global" : "local");
      }
    }
  }

  // Validate transport compatibility with selected agents
  const requiredTransport: "stdio" | "sse" | "http" = isRemoteSource(parsed)
    ? (resolvedTransport ?? "http")
    : "stdio";

  const unsupportedAgents = targetAgents.filter(
    (a) => !isTransportSupported(a, requiredTransport),
  );

  if (unsupportedAgents.length > 0) {
    const unsupportedNames = unsupportedAgents
      .map((a) => agents[a].displayName)
      .join(", ");

    if (options.all) {
      // --all flag: warn but continue with supported agents
      p.log.warn(
        `Skipping agents that don't support ${requiredTransport} transport: ${unsupportedNames}`,
      );
      targetAgents = targetAgents.filter((a) =>
        isTransportSupported(a, requiredTransport),
      );

      if (targetAgents.length === 0) {
        p.log.error("No agents support this transport type");
        process.exit(1);
      }
    } else {
      // Explicit agent selection: error
      p.log.error(
        `The following agents don't support ${requiredTransport} transport: ${unsupportedNames}`,
      );
      process.exit(1);
    }
  }

  const hasHeadersForRemote = isRemote && hasHeaderValues;
  if (hasHeadersForRemote) {
    const unsupportedHeaderAgents = targetAgents.filter(
      (a) => !agents[a].supportsHeaders,
    );

    if (unsupportedHeaderAgents.length > 0) {
      const unsupportedNames = unsupportedHeaderAgents
        .map((a) => agents[a].displayName)
        .join(", ");
      const hasExplicitAgentSelection =
        hasExplicitAgentFlags || selectedViaPrompt;

      if (hasExplicitAgentSelection) {
        p.log.error(
          `The following agents don't support HTTP headers: ${unsupportedNames}`,
        );
        process.exit(1);
      }

      const supportedAgents = targetAgents.filter(
        (a) => agents[a].supportsHeaders,
      );

      if (supportedAgents.length === 0) {
        p.log.error("No selected agents support HTTP headers");
        process.exit(1);
      }

      p.log.warn(
        `Skipping agents that don't support HTTP headers: ${unsupportedNames}`,
      );
      targetAgents = supportedAgents;
    }
  }

  // Determine installation scope (global vs local)
  // If we already have routing from smart detection, use that
  // Otherwise, determine scope and build routing

  const hasSmartRouting = agentRouting.size > 0;

  if (options.global) {
    // Explicit global flag - route all agents to global
    for (const agent of targetAgents) {
      agentRouting.set(agent, "global");
    }
  } else if (!hasSmartRouting) {
    // No smart routing yet - need to determine scope
    // This happens when user specifies --agent or --all without --global

    // Check if any selected agents support local config
    const selectedWithLocal = targetAgents.filter((a) =>
      supportsProjectConfig(a),
    );
    const globalOnlySelected = targetAgents.filter(
      (a) => !supportsProjectConfig(a),
    );

    // Global-only agents always go to global
    for (const agent of globalOnlySelected) {
      agentRouting.set(agent, "global");
    }

    if (selectedWithLocal.length > 0) {
      let installLocally = true; // Default to local/project

      if (!options.yes) {
        const scope = await p.select({
          message: "Installation scope",
          options: [
            {
              value: true,
              label: "Project",
              hint: "Install in current directory (committed with your project)",
            },
            {
              value: false,
              label: "Global",
              hint: "Install in home directory (available across all projects)",
            },
          ],
        });

        if (p.isCancel(scope)) {
          p.cancel("Installation cancelled");
          process.exit(0);
        }

        installLocally = scope as boolean;
      }

      // Route project-capable agents based on user choice
      for (const agent of selectedWithLocal) {
        agentRouting.set(agent, installLocally ? "local" : "global");
      }
    } else {
      // All selected agents only support global config
      p.log.info("Selected agents only support global installation");
    }
  }

  // Show summary
  const summaryLines: string[] = [];
  summaryLines.push(`${chalk.cyan("Server:")} ${serverName}`);
  summaryLines.push(`${chalk.cyan("Type:")} ${sourceType}`);

  // Determine scope display
  const localAgents = targetAgents.filter(
    (a) => agentRouting.get(a) === "local",
  );
  const globalAgents = targetAgents.filter(
    (a) => agentRouting.get(a) === "global",
  );

  if (localAgents.length > 0 && globalAgents.length > 0) {
    // Mixed routing
    summaryLines.push(`${chalk.cyan("Scope:")} Mixed (project + global)`);
    summaryLines.push(
      `${chalk.cyan("  Project:")} ${localAgents.map((a) => agents[a].displayName).join(", ")}`,
    );
    summaryLines.push(
      `${chalk.cyan("  Global:")} ${globalAgents.map((a) => agents[a].displayName).join(", ")}`,
    );
  } else if (localAgents.length > 0) {
    summaryLines.push(`${chalk.cyan("Scope:")} Project`);
    summaryLines.push(
      `${chalk.cyan("Agents:")} ${localAgents.map((a) => agents[a].displayName).join(", ")}`,
    );
  } else {
    summaryLines.push(`${chalk.cyan("Scope:")} Global`);
    summaryLines.push(
      `${chalk.cyan("Agents:")} ${globalAgents.map((a) => agents[a].displayName).join(", ")}`,
    );
  }

  console.log();
  p.note(summaryLines.join("\n"), "Installation Summary");

  // Confirm installation
  if (!options.yes) {
    const confirmed = await p.confirm({
      message: "Proceed with installation?",
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Installation cancelled");
      process.exit(0);
    }
  }

  // Install
  spinner.start("Installing MCP server...");

  const results = installServer(serverName, serverConfig, targetAgents, {
    routing: agentRouting,
  });

  spinner.stop("Installation complete");

  // Show results
  console.log();
  const successful = [...results.entries()].filter(([_, r]) => r.success);
  const failed = [...results.entries()].filter(([_, r]) => !r.success);

  if (successful.length > 0) {
    const resultLines: string[] = [];
    for (const [agentType, result] of successful) {
      const agent = agents[agentType];
      const shortPath = shortenPath(result.path);
      resultLines.push(
        `${chalk.green("✓")} ${agent.displayName}: ${chalk.dim(shortPath)}`,
      );
    }

    p.note(
      resultLines.join("\n"),
      chalk.green(
        `Installed to ${successful.length} agent${successful.length !== 1 ? "s" : ""}`,
      ),
    );
  }

  if (failed.length > 0) {
    console.log();
    p.log.error(
      chalk.red(
        `Failed to install to ${failed.length} agent${failed.length !== 1 ? "s" : ""}`,
      ),
    );
    for (const [agentType, result] of failed) {
      const agent = agents[agentType];
      p.log.message(
        `  ${chalk.red("✗")} ${agent.displayName}: ${chalk.dim(result.error)}`,
      );
    }
  }

  console.log();
  p.outro(chalk.green("Done!"));
}
