import type { ParsedSource, SourceType } from "./types.js";

/**
 * Check if input is a URL
 */
function isUrl(input: string): boolean {
  return input.startsWith("http://") || input.startsWith("https://");
}

/**
 * Check if input looks like a command (has spaces or starts with known executables)
 */
function isCommand(input: string): boolean {
  // Has spaces (like "npx -y @org/package" or "node server.js --port 3000")
  if (input.includes(" ")) {
    return true;
  }
  // Starts with known executables
  if (
    input.startsWith("npx ") ||
    input.startsWith("node ") ||
    input.startsWith("python ")
  ) {
    return true;
  }
  return false;
}

/**
 * Check if input looks like a package name
 * Package names can be:
 * - Simple: "package-name"
 * - Scoped: "@org/package-name"
 * - With version: "package@1.0.0" or "@org/package@1.0.0"
 */
function isPackageName(input: string): boolean {
  // Scoped package: @org/name or @org/name@version
  if (input.startsWith("@") && input.includes("/")) {
    return true;
  }
  // Simple package name (no slashes, no spaces, valid npm name chars)
  if (/^[a-z0-9][\w.-]*(@[\w.-]+)?$/i.test(input)) {
    return true;
  }
  return false;
}

/**
 * Infer server name from input
 */
function inferName(input: string, type: SourceType): string {
  if (type === "remote") {
    try {
      const url = new URL(input);
      // Use hostname, replacing dots with dashes
      // e.g., "mcp.example.com" -> "mcp-example-com"
      return url.hostname.replace(/\./g, "-");
    } catch {
      // Fallback for malformed URLs
      return "mcp-server";
    }
  }

  if (type === "command") {
    // Extract package name from command
    const parts = input.split(" ");

    // Skip executable (npx, node, python, etc.)
    let startIndex = 0;
    if (parts[0] === "npx" || parts[0] === "node" || parts[0] === "python") {
      startIndex = 1;
    }

    // Skip flags like -y, --yes
    for (let i = startIndex; i < parts.length; i++) {
      const part = parts[i];
      if (part && !part.startsWith("-")) {
        // Found the package/script name
        return extractPackageName(part);
      }
    }
    return "mcp-server";
  }

  // Package name
  return extractPackageName(input);
}

/**
 * Extract a clean name from a package identifier
 * "@modelcontextprotocol/server-postgres" -> "server-postgres"
 * "mcp-server-github@1.0.0" -> "mcp-server-github"
 */
function extractPackageName(input: string): string {
  let name = input;

  // Remove version suffix
  const atIndex = name.lastIndexOf("@");
  if (atIndex > 0 && !name.startsWith("@")) {
    name = name.slice(0, atIndex);
  } else if (name.startsWith("@") && name.indexOf("@", 1) > 0) {
    // Scoped package with version: @org/pkg@version
    const secondAt = name.indexOf("@", 1);
    name = name.slice(0, secondAt);
  }

  // For scoped packages, extract just the package name part
  if (name.startsWith("@") && name.includes("/")) {
    const parts = name.split("/");
    name = parts[1] || name;
  }

  // Remove common prefixes for cleaner names
  name = name.replace(/^mcp-server-/, "");
  name = name.replace(/^server-/, "");
  name = name.replace(/-mcp$/, "");

  return name || "mcp-server";
}

/**
 * Parse source input and determine its type
 */
export function parseSource(input: string): ParsedSource {
  const trimmed = input.trim();

  if (isUrl(trimmed)) {
    return {
      type: "remote",
      value: trimmed,
      inferredName: inferName(trimmed, "remote"),
    };
  }

  if (isCommand(trimmed)) {
    return {
      type: "command",
      value: trimmed,
      inferredName: inferName(trimmed, "command"),
    };
  }

  if (isPackageName(trimmed)) {
    return {
      type: "package",
      value: trimmed,
      inferredName: inferName(trimmed, "package"),
    };
  }

  // Default to treating it as a package name
  return {
    type: "package",
    value: trimmed,
    inferredName: inferName(trimmed, "package"),
  };
}

/**
 * Check if the source type is a remote URL
 */
export function isRemoteSource(parsed: ParsedSource): boolean {
  return parsed.type === "remote";
}

/**
 * Check if the source type is a local server (package or command)
 */
export function isLocalSource(parsed: ParsedSource): boolean {
  return parsed.type === "package" || parsed.type === "command";
}
