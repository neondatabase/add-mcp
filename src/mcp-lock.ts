import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, join } from "path";
import { homedir } from "os";

const AGENTS_DIR = ".agents";
const LOCK_FILE = ".mcp-lock.json";
const CURRENT_VERSION = 1;

export interface McpLockFile {
  version: number;
  lastSelectedAgents?: string[];
}

export function getMcpLockPath(): string {
  return join(homedir(), AGENTS_DIR, LOCK_FILE);
}

export async function readMcpLock(): Promise<McpLockFile> {
  const lockPath = getMcpLockPath();

  try {
    const content = await readFile(lockPath, "utf-8");
    const parsed = JSON.parse(content) as McpLockFile;

    if (typeof parsed.version !== "number") {
      return createEmptyLockFile();
    }

    if (parsed.version < CURRENT_VERSION) {
      return createEmptyLockFile();
    }

    return parsed;
  } catch {
    return createEmptyLockFile();
  }
}

export async function writeMcpLock(lock: McpLockFile): Promise<void> {
  const lockPath = getMcpLockPath();

  await mkdir(dirname(lockPath), { recursive: true });

  const content = JSON.stringify(lock, null, 2);
  await writeFile(lockPath, content, "utf-8");
}

export async function getLastSelectedAgents(): Promise<string[] | undefined> {
  const lock = await readMcpLock();
  return lock.lastSelectedAgents;
}

export async function saveSelectedAgents(agents: string[]): Promise<void> {
  const lock = await readMcpLock();
  lock.lastSelectedAgents = agents;
  await writeMcpLock(lock);
}

function createEmptyLockFile(): McpLockFile {
  return {
    version: CURRENT_VERSION,
  };
}
