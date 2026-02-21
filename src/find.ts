import * as p from "@clack/prompts";
import type { TransportType } from "./types.js";
import type {
  RegistryCatalogServer,
  RegistryHeaderDefinition,
  RegistryPackageDefinition,
  RegistryRemoteDefinition,
  RegistryVariableDefinition,
} from "./registry-catalog.js";
import { REGISTRY_CATALOG } from "./registry-catalog.js";

export interface FindCommandOptions {
  yes?: boolean;
}

export interface FindInstallPlan {
  target: string;
  serverName: string;
  transport?: TransportType;
  headers?: Record<string, string>;
}

export interface SearchResult {
  entry: RegistryCatalogServer;
  score: number;
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

function scoreEntry(entry: RegistryCatalogServer, query: string): number {
  const q = normalize(query);
  if (!q) return 0;

  const name = normalize(entry.name);
  const title = normalize(entry.title ?? "");
  const description = normalize(entry.description);
  const haystack = `${name} ${title} ${description}`;

  let score = 0;
  if (name === q) score += 200;
  if (name.includes(q)) score += 120;
  if (title.includes(q)) score += 80;
  if (description.includes(q)) score += 50;

  const queryTokens = tokenize(q);
  const haystackTokens = new Set(tokenize(haystack));
  for (const token of queryTokens) {
    if (haystackTokens.has(token)) {
      score += 20;
    } else if (token.length >= 3 && haystack.includes(token)) {
      score += 8;
    }
  }

  return score;
}

export function searchCatalog(
  query: string,
  catalog: RegistryCatalogServer[] = REGISTRY_CATALOG,
): SearchResult[] {
  return catalog
    .map((entry) => ({ entry, score: scoreEntry(entry, query) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.name.localeCompare(b.entry.name);
    });
}

function toServerName(entryName: string): string {
  const parts = entryName.split("/");
  return parts[parts.length - 1] || entryName;
}

function remoteToTransport(type: RegistryRemoteDefinition["type"]): TransportType {
  return type === "sse" ? "sse" : "http";
}

function pickRemote(entry: RegistryCatalogServer): RegistryRemoteDefinition | null {
  const remotes = entry.remotes ?? [];
  if (remotes.length === 0) return null;
  const streamable = remotes.find((remote) => remote.type === "streamable-http");
  return streamable ?? remotes[0] ?? null;
}

function pickPackage(entry: RegistryCatalogServer): RegistryPackageDefinition | null {
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
  entry: RegistryCatalogServer,
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
  const results = searchCatalog(query);
  if (results.length === 0) {
    p.log.warn(`No MCP servers found for "${query}"`);
    return null;
  }

  const entry = options.yes
    ? results[0]?.entry
    : await (async () => {
        const selected = await p.select({
          message: `Find MCP servers for "${query}"`,
          options: results.slice(0, 15).map((result) => ({
            value: result.entry.name,
            label: result.entry.title ?? result.entry.name,
            hint: result.entry.description,
          })),
        });
        if (p.isCancel(selected)) return null;
        return results.find((result) => result.entry.name === selected)?.entry ?? null;
      })();

  if (!entry) {
    return null;
  }

  return buildInstallPlanForEntry(entry, options);
}
