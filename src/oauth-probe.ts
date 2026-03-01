import type { McpServerConfig } from "./types.js";

const REQUEST_TIMEOUT_MS = 5000;

function extractResourceMetadata(
  wwwAuthenticateHeader: string | null,
): string | null {
  if (!wwwAuthenticateHeader) return null;
  const match = wwwAuthenticateHeader.match(/resource_metadata="([^"]+)"/i);
  return match?.[1] ?? null;
}

function withTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  controller.signal.addEventListener("abort", () => clearTimeout(timeout), {
    once: true,
  });
  return controller.signal;
}

function buildProbeHeaders(
  serverHeaders?: Record<string, string>,
): Record<string, string> {
  return {
    accept: "application/json, text/event-stream",
    ...(serverHeaders ?? {}),
  };
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(url, {
    signal: withTimeoutSignal(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  const data = (await response.json()) as unknown;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

function resolveAuthorizationServerMetadataUrl(
  resourceMetadata: Record<string, unknown>,
): string | null {
  const servers = resourceMetadata.authorization_servers;
  if (!Array.isArray(servers) || servers.length === 0) {
    return null;
  }
  const firstServer = servers[0];
  if (typeof firstServer !== "string" || firstServer.length === 0) {
    return null;
  }

  const serverUrl = new URL(firstServer);
  return new URL(
    "/.well-known/oauth-authorization-server",
    serverUrl,
  ).toString();
}

function hasRequiredAuthorizationServerFields(
  authorizationMetadata: Record<string, unknown>,
): boolean {
  const required = [
    "authorization_endpoint",
    "token_endpoint",
    "registration_endpoint",
  ];
  return required.every(
    (field) =>
      typeof authorizationMetadata[field] === "string" &&
      (authorizationMetadata[field] as string).length > 0,
  );
}

export async function detectOAuthForRemoteMcpServer(
  config: McpServerConfig,
): Promise<boolean> {
  if (!config.url) return false;

  try {
    const response = await fetch(config.url, {
      method: "GET",
      headers: buildProbeHeaders(config.headers),
      signal: withTimeoutSignal(REQUEST_TIMEOUT_MS),
    });

    if (![401, 403].includes(response.status)) {
      return false;
    }

    const resourceMetadataUrl = extractResourceMetadata(
      response.headers.get("www-authenticate"),
    );
    if (!resourceMetadataUrl) {
      return false;
    }

    const resourceMetadata = await fetchJson(resourceMetadataUrl);
    if (!resourceMetadata) {
      return false;
    }

    const authServerMetadataUrl =
      resolveAuthorizationServerMetadataUrl(resourceMetadata);
    if (!authServerMetadataUrl) {
      return false;
    }

    const authServerMetadata = await fetchJson(authServerMetadataUrl);
    if (!authServerMetadata) {
      return false;
    }

    return hasRequiredAuthorizationServerFields(authServerMetadata);
  } catch {
    return false;
  }
}
