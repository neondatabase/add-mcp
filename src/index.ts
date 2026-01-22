#!/usr/bin/env node

import { program } from 'commander';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import { homedir } from 'os';
import type { AgentType } from './types.js';
import { agentAliases } from './types.js';
import { agents, detectInstalledAgents, getAgentTypes } from './agents.js';
import { parseSource, isRemoteSource } from './source-parser.js';
import {
  buildServerConfig,
  installServer,
  getAgentsWithLocalSupport,
} from './installer.js';

import packageJson from '../package.json' with { type: 'json' };

const version = packageJson.version;

/**
 * Shorten a path for display (replace home with ~)
 */
function shortenPath(fullPath: string): string {
  const home = homedir();
  if (fullPath.startsWith(home)) {
    return fullPath.replace(home, '~');
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
  yes?: boolean;
  list?: boolean;
  all?: boolean;
}

program
  .name('add-mcp')
  .description('Install MCP servers onto coding agents (Claude Code, Cursor, VS Code, OpenCode, Codex)')
  .version(version)
  .argument('[target]', 'MCP server URL (remote) or package name (local stdio)')
  .option('-g, --global', 'Install globally (user-level) instead of project-level')
  .option('-a, --agent <agents...>', 'Specify agents to install to')
  .option('-n, --name <name>', 'Server name (auto-inferred from target if not provided)')
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('-l, --list', 'List supported agents')
  .option('--all', 'Install to all agents without prompts (implies -y -g)')
  .action(async (target: string | undefined, options: Options) => {
    await main(target, options);
  });

program.parse();

async function main(target: string | undefined, options: Options) {
  // Handle --all flag
  if (options.all) {
    options.yes = true;
    options.global = true;
  }

  console.log();
  p.intro(chalk.bgCyan.black(' add-mcp '));

  // List supported agents
  if (options.list) {
    console.log();
    p.log.step(chalk.bold('Supported Agents'));
    
    const allTypes = getAgentTypes();
    for (const type of allTypes) {
      const agent = agents[type];
      const hasLocal = agent.localConfigPath ? chalk.dim(' (supports local)') : '';
      p.log.message(`  ${chalk.cyan(type)} - ${agent.displayName}${hasLocal}`);
    }
    
    console.log();
    p.log.info(chalk.dim('Aliases: github-copilot → vscode'));
    console.log();
    p.outro('Use -a/--agent to specify agents');
    return;
  }

  // Require target
  if (!target) {
    p.log.error('Missing required argument: target');
    console.log();
    p.log.info(chalk.dim('Usage:'));
    p.log.message(`  ${chalk.cyan('npx add-mcp')} ${chalk.yellow('<target>')} ${chalk.dim('[options]')}`);
    console.log();
    p.log.info(chalk.dim('Examples:'));
    p.log.message(`  ${chalk.cyan('npx add-mcp')} ${chalk.yellow('https://mcp.example.com/api')}`);
    p.log.message(`  ${chalk.cyan('npx add-mcp')} ${chalk.yellow('@modelcontextprotocol/server-postgres')}`);
    console.log();
    p.outro(chalk.dim('Run --help for more information'));
    process.exit(1);
  }

  const spinner = p.spinner();

  // Parse the source
  spinner.start('Parsing source...');
  const parsed = parseSource(target);
  const sourceType = isRemoteSource(parsed) ? 'remote' : 'local';
  spinner.stop(`Source: ${chalk.cyan(parsed.value)} (${sourceType})`);

  // Determine server name
  const serverName = options.name || parsed.inferredName;
  p.log.info(`Server name: ${chalk.cyan(serverName)}`);

  // Build server config
  const serverConfig = buildServerConfig(parsed);

  // Determine target agents
  let targetAgents: AgentType[];
  const allAgentTypes = getAgentTypes();

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
      p.log.error(`Invalid agents: ${invalid.join(', ')}`);
      p.log.info(`Valid agents: ${allAgentTypes.join(', ')}`);
      process.exit(1);
    }

    targetAgents = resolved;
  } else if (options.all) {
    targetAgents = allAgentTypes;
    p.log.info(`Installing to all ${targetAgents.length} agents`);
  } else {
    // Auto-detect installed agents
    spinner.start('Detecting installed agents...');
    const installedAgents = await detectInstalledAgents();
    spinner.stop(`Detected ${installedAgents.length} agent${installedAgents.length !== 1 ? 's' : ''}`);

    if (installedAgents.length === 0) {
      if (options.yes) {
        targetAgents = allAgentTypes;
        p.log.info('Installing to all agents (none detected)');
      } else {
        p.log.warn('No coding agents detected. You can still install MCP servers.');

        const allAgentChoices = allAgentTypes.map((type) => ({
          value: type,
          label: agents[type].displayName,
        }));

        const selected = await p.multiselect({
          message: 'Select agents to install to',
          options: allAgentChoices,
          required: true,
        });

        if (p.isCancel(selected)) {
          p.cancel('Installation cancelled');
          process.exit(0);
        }

        targetAgents = selected as AgentType[];
      }
    } else if (installedAgents.length === 1 || options.yes) {
      targetAgents = installedAgents;
      const agentNames = installedAgents.map((a) => chalk.cyan(agents[a].displayName)).join(', ');
      p.log.info(`Installing to: ${agentNames}`);
    } else {
      const agentChoices = installedAgents.map((a) => ({
        value: a,
        label: agents[a].displayName,
        hint: shortenPath(agents[a].configPath),
      }));

      const selected = await p.multiselect({
        message: 'Select agents to install to',
        options: agentChoices,
        required: true,
        initialValues: installedAgents,
      });

      if (p.isCancel(selected)) {
        p.cancel('Installation cancelled');
        process.exit(0);
      }

      targetAgents = selected as AgentType[];
    }
  }

  // Determine installation scope (global vs local)
  let installGlobally = options.global ?? false;

  if (options.global === undefined && !options.yes) {
    // Check if any selected agents support local config
    const localSupported = getAgentsWithLocalSupport();
    const selectedWithLocal = targetAgents.filter((a) => localSupported.includes(a));

    if (selectedWithLocal.length > 0) {
      const scope = await p.select({
        message: 'Installation scope',
        options: [
          {
            value: false,
            label: 'Project',
            hint: 'Install in current directory (committed with your project)',
          },
          {
            value: true,
            label: 'Global',
            hint: 'Install in home directory (available across all projects)',
          },
        ],
      });

      if (p.isCancel(scope)) {
        p.cancel('Installation cancelled');
        process.exit(0);
      }

      installGlobally = scope as boolean;
    } else {
      // All selected agents only support global config
      installGlobally = true;
      p.log.info('Selected agents only support global installation');
    }
  }

  // Show summary
  const summaryLines: string[] = [];
  summaryLines.push(`${chalk.cyan('Server:')} ${serverName}`);
  summaryLines.push(`${chalk.cyan('Type:')} ${sourceType}`);
  summaryLines.push(`${chalk.cyan('Scope:')} ${installGlobally ? 'Global' : 'Project'}`);
  summaryLines.push(`${chalk.cyan('Agents:')} ${targetAgents.map((a) => agents[a].displayName).join(', ')}`);

  console.log();
  p.note(summaryLines.join('\n'), 'Installation Summary');

  // Confirm installation
  if (!options.yes) {
    const confirmed = await p.confirm({
      message: 'Proceed with installation?',
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel('Installation cancelled');
      process.exit(0);
    }
  }

  // Install
  spinner.start('Installing MCP server...');

  const results = installServer(serverName, serverConfig, targetAgents, {
    local: !installGlobally,
  });

  spinner.stop('Installation complete');

  // Show results
  console.log();
  const successful = [...results.entries()].filter(([_, r]) => r.success);
  const failed = [...results.entries()].filter(([_, r]) => !r.success);

  if (successful.length > 0) {
    const resultLines: string[] = [];
    for (const [agentType, result] of successful) {
      const agent = agents[agentType];
      const shortPath = shortenPath(result.path);
      resultLines.push(`${chalk.green('✓')} ${agent.displayName}: ${chalk.dim(shortPath)}`);
    }

    p.note(
      resultLines.join('\n'),
      chalk.green(`Installed to ${successful.length} agent${successful.length !== 1 ? 's' : ''}`)
    );
  }

  if (failed.length > 0) {
    console.log();
    p.log.error(chalk.red(`Failed to install to ${failed.length} agent${failed.length !== 1 ? 's' : ''}`));
    for (const [agentType, result] of failed) {
      const agent = agents[agentType];
      p.log.message(`  ${chalk.red('✗')} ${agent.displayName}: ${chalk.dim(result.error)}`);
    }
  }

  console.log();
  p.outro(chalk.green('Done!'));
}
