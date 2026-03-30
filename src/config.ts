import { readFile, writeFile, mkdir, rm } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";

const CONFIG_DIR = "add-mcp";
const CONFIG_FILE = "config.json";
const CURRENT_VERSION = 1;

const LEGACY_AGENTS_DIR = ".agents";
const LEGACY_LOCK_FILE = ".mcp-lock.json";

export interface FindRegistryConfigEntry {
  id: string;
  label: string;
  serversUrl: string;
}

export interface AddMcpConfig {
  version: number;
  lastSelectedAgents?: string[];
  findRegistries?: FindRegistryConfigEntry[];
}

function getXdgConfigHome(): string {
  return process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
}

export function getConfigPath(): string {
  return join(getXdgConfigHome(), CONFIG_DIR, CONFIG_FILE);
}

function getLegacyConfigPath(): string {
  return join(homedir(), LEGACY_AGENTS_DIR, LEGACY_LOCK_FILE);
}

export async function readConfig(): Promise<AddMcpConfig> {
  const configPath = getConfigPath();

  try {
    const content = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(content) as AddMcpConfig;

    if (typeof parsed.version !== "number") {
      return createEmptyConfig();
    }

    if (parsed.version < CURRENT_VERSION) {
      return createEmptyConfig();
    }

    return parsed;
  } catch {
    // New config not found — try migrating from legacy location
  }

  const legacyPath = getLegacyConfigPath();
  try {
    const content = await readFile(legacyPath, "utf-8");
    const parsed = JSON.parse(content) as AddMcpConfig;

    if (
      typeof parsed.version !== "number" ||
      parsed.version < CURRENT_VERSION
    ) {
      return createEmptyConfig();
    }

    await writeConfig(parsed);
    await cleanupLegacyConfig();
    return parsed;
  } catch {
    return createEmptyConfig();
  }
}

export async function writeConfig(config: AddMcpConfig): Promise<void> {
  const configPath = getConfigPath();

  await mkdir(dirname(configPath), { recursive: true });

  const content = JSON.stringify(config, null, 2);
  await writeFile(configPath, content, "utf-8");
}

async function cleanupLegacyConfig(): Promise<void> {
  const legacyPath = getLegacyConfigPath();
  try {
    await rm(legacyPath, { force: true });
  } catch {
    // Best-effort cleanup; ignore errors
  }
}

export async function getLastSelectedAgents(): Promise<string[] | undefined> {
  const config = await readConfig();
  return config.lastSelectedAgents;
}

export async function saveSelectedAgents(agents: string[]): Promise<void> {
  const config = await readConfig();
  config.lastSelectedAgents = agents;
  await writeConfig(config);
}

export async function getFindRegistries(): Promise<FindRegistryConfigEntry[]> {
  const config = await readConfig();
  return config.findRegistries ?? [];
}

export async function saveFindRegistries(
  registries: FindRegistryConfigEntry[],
): Promise<void> {
  const config = await readConfig();
  config.findRegistries = registries;
  await writeConfig(config);
}

function createEmptyConfig(): AddMcpConfig {
  return {
    version: CURRENT_VERSION,
  };
}
