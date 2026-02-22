import * as p from "@clack/prompts";
import type { TransportType } from "./types.js";

export type RegistryRemoteTransport = "streamable-http" | "sse";

export interface RegistryVariableDefinition {
  description?: string;
  isRequired?: boolean;
  isSecret?: boolean;
  default?: string;
  choices?: string[];
}

export interface RegistryHeaderDefinition {
  name: string;
  description?: string;
  isRequired?: boolean;
  isSecret?: boolean;
}

export interface RegistryRemoteDefinition {
  type: RegistryRemoteTransport;
  url: string;
  variables?: Record<string, RegistryVariableDefinition>;
  headers?: RegistryHeaderDefinition[];
}

export interface RegistryPackageDefinition {
  registryType: "npm" | "oci" | "nuget" | "mcpb";
  identifier: string;
  version?: string;
  transport: {
    type: "stdio";
  };
}

export interface RegistryServerEntry {
  name: string;
  title?: string;
  description: string;
  version: string;
  remotes?: RegistryRemoteDefinition[];
  packages?: RegistryPackageDefinition[];
}

export interface FindCommandOptions {
  yes?: boolean;
}

export interface FindInstallPlan {
  target: string;
  serverName: string;
  transport?: TransportType;
  headers?: Record<string, string>;
}

export interface PromptField {
  key: string;
  label: string;
  isRequired: boolean;
  placeholder: string;
}

export function buildPlaceholderValue(kind: "header" | "variable"): string {
  return kind === "header"
    ? "<your-header-value-here>"
    : "<your-variable-value-here>";
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 0);
}

export function resolveTemplateUrl(
  templateUrl: string,
  values: Record<string, string>,
): string {
  return templateUrl.replace(/\{([^}]+)\}/g, (fullMatch, rawName: string) => {
    const key = String(rawName);
    const replacement = values[key];
    return replacement && replacement.length > 0 ? replacement : fullMatch;
  });
}

interface RegistryServerListResponse {
  servers?: RegistryServerListItem[];
}

function getRegistryApiBase(): string {
  return process.env.MCP_REGISTRY_API_URL || "https://registry.modelcontextprotocol.io";
}

interface RegistryServerListItem {
  server?: {
    name?: string;
    title?: string;
    description?: string;
    version?: string;
    remotes?: RegistryRemoteDefinition[];
    packages?: RegistryPackageDefinition[];
  };
}

function toEntry(item: RegistryServerListItem): RegistryServerEntry | null {
  const server = item?.server;
  if (!server?.name || !server?.description || !server?.version) {
    return null;
  }

  return {
    name: server.name,
    title: server.title,
    description: server.description,
    version: server.version,
    remotes: server.remotes,
    packages: server.packages,
  };
}

export async function searchRegistry(query: string): Promise<RegistryServerEntry[]> {
  const trimmedQuery = normalize(query);
  if (!trimmedQuery) return [];

  const params = new URLSearchParams({
    search: trimmedQuery,
    version: "latest",
    limit: "30",
  });
  const url = `${getRegistryApiBase()}/v0.1/servers?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Registry API request failed (${response.status})`);
  }

  const payload = (await response.json()) as RegistryServerListResponse;
  const entries: RegistryServerEntry[] = [];
  for (const item of payload.servers ?? []) {
    const entry = toEntry(item);
    if (!entry) continue;
    entries.push(entry);
  }
  return entries;
}

function toServerName(entryName: string): string {
  const parts = entryName.split("/");
  return parts[parts.length - 1] || entryName;
}

function remoteToTransport(type: RegistryRemoteDefinition["type"]): TransportType {
  return type === "sse" ? "sse" : "http";
}

function pickRemote(entry: RegistryServerEntry): RegistryRemoteDefinition | null {
  const remotes = entry.remotes ?? [];
  if (remotes.length === 0) return null;
  const streamable = remotes.find((remote) => remote.type === "streamable-http");
  return streamable ?? remotes[0] ?? null;
}

function pickPackage(entry: RegistryServerEntry): RegistryPackageDefinition | null {
  const packages = entry.packages ?? [];
  if (packages.length === 0) return null;
  const npm = packages.find((pkg) => pkg.registryType === "npm");
  return npm ?? packages[0] ?? null;
}

function formatPackageTarget(pkg: RegistryPackageDefinition): string {
  if (pkg.registryType === "npm" && pkg.version) {
    return `${pkg.identifier}@${pkg.version}`;
  }
  return pkg.identifier;
}

async function promptValue(field: PromptField): Promise<string | symbol> {
  return p.text({
    message: `${field.label} ${field.isRequired ? "(required)" : "(optional)"}`,
    placeholder: field.placeholder,
  });
}

export async function collectPromptValues(
  fields: PromptField[],
  ask: (field: PromptField) => Promise<string | symbol>,
): Promise<{ values: Record<string, string>; cancelled: boolean }> {
  const values: Record<string, string> = {};

  for (const field of fields) {
    // Keep asking until required values are provided.
    while (true) {
      const raw = await ask(field);
      if (p.isCancel(raw)) {
        return { values, cancelled: true };
      }

      const value = String(raw).trim();
      if (value.length === 0) {
        if (field.isRequired) {
          p.log.warn(`${field.key} is required`);
          continue;
        }
        break;
      }

      values[field.key] = value;
      break;
    }
  }

  return { values, cancelled: false };
}

function variableFields(
  variables: Record<string, RegistryVariableDefinition> | undefined,
): PromptField[] {
  if (!variables) return [];
  return Object.entries(variables).map(([key, definition]) => ({
    key,
    label: `Variable ${key}`,
    isRequired: definition.isRequired === true,
    placeholder: buildPlaceholderValue("variable"),
  }));
}

function headerFields(headers: RegistryHeaderDefinition[] | undefined): PromptField[] {
  if (!headers) return [];
  return headers.map((header) => ({
    key: header.name,
    label: `Header ${header.name}`,
    isRequired: header.isRequired === true,
    placeholder: buildPlaceholderValue("header"),
  }));
}

function resolveNonInteractiveRemote(
  remote: RegistryRemoteDefinition,
): { url: string; headers?: Record<string, string> } {
  const variableValues: Record<string, string> = {};
  for (const key of Object.keys(remote.variables ?? {})) {
    variableValues[key] = buildPlaceholderValue("variable");
  }

  const headerValues: Record<string, string> = {};
  for (const header of remote.headers ?? []) {
    headerValues[header.name] = buildPlaceholderValue("header");
  }

  return {
    url: resolveTemplateUrl(remote.url, variableValues),
    headers: Object.keys(headerValues).length > 0 ? headerValues : undefined,
  };
}

async function resolveInteractiveRemote(
  remote: RegistryRemoteDefinition,
): Promise<{ url: string; headers?: Record<string, string> } | null> {
  const variableResult = await collectPromptValues(variableFields(remote.variables), promptValue);
  if (variableResult.cancelled) return null;

  const headerResult = await collectPromptValues(headerFields(remote.headers), promptValue);
  if (headerResult.cancelled) return null;

  return {
    url: resolveTemplateUrl(remote.url, variableResult.values),
    headers:
      Object.keys(headerResult.values).length > 0 ? headerResult.values : undefined,
  };
}

export async function buildInstallPlanForEntry(
  entry: RegistryServerEntry,
  options: FindCommandOptions,
): Promise<FindInstallPlan | null> {
  const remote = pickRemote(entry);
  const pkg = pickPackage(entry);
  const hasRemote = remote !== null;
  const hasPackage = pkg !== null;

  if (!hasRemote && !hasPackage) {
    return null;
  }

  let mode: "remote" | "package";
  if (hasRemote && hasPackage) {
    if (options.yes) {
      mode = "remote";
    } else {
      const selected = await p.select({
        message: `Install mode for ${entry.name}`,
        initialValue: "remote",
        options: [
          { value: "remote", label: "Remote", hint: "Recommended default" },
          { value: "package", label: "Stdio package", hint: "Local stdio package" },
        ],
      });
      if (p.isCancel(selected)) return null;
      mode = selected as "remote" | "package";
    }
  } else {
    mode = hasRemote ? "remote" : "package";
  }

  if (mode === "package" && pkg) {
    return {
      target: formatPackageTarget(pkg),
      serverName: toServerName(entry.name),
    };
  }

  if (!remote) return null;
  const resolved = options.yes
    ? resolveNonInteractiveRemote(remote)
    : await resolveInteractiveRemote(remote);
  if (!resolved) return null;

  return {
    target: resolved.url,
    serverName: toServerName(entry.name),
    transport: remoteToTransport(remote.type),
    headers: resolved.headers,
  };
}

export async function runFind(
  query: string,
  options: FindCommandOptions,
): Promise<FindInstallPlan | null> {
  let entries: RegistryServerEntry[];
  try {
    entries = await searchRegistry(query);
  } catch (error) {
    p.log.error(
      `Failed to query MCP registry: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    return null;
  }

  if (entries.length === 0) {
    p.log.warn(`No MCP servers found for "${query}"`);
    return null;
  }

  const entry: RegistryServerEntry | null = options.yes
    ? entries[0] ?? null
    : await (async () => {
        const selected = await p.select({
          message: `Find MCP servers for "${query}"`,
          options: entries.slice(0, 15).map((entryOption) => ({
            value: entryOption.name,
            label: entryOption.title ?? entryOption.name,
            hint: entryOption.description,
          })),
        });
        if (p.isCancel(selected)) return null;
        return entries.find((result) => result.name === selected) ?? null;
      })();

  if (!entry) {
    return null;
  }

  return buildInstallPlanForEntry(entry, options);
}
