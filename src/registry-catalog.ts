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

export interface RegistryCatalogServer {
  name: string;
  title?: string;
  description: string;
  version: string;
  remotes?: RegistryRemoteDefinition[];
  packages?: RegistryPackageDefinition[];
}

/**
 * Curated official/popular catalog in the MCP registry remote server shape.
 */
export const REGISTRY_CATALOG: RegistryCatalogServer[] = [
  {
    name: "app.linear/linear",
    description: "MCP server for Linear project management and issue tracking",
    version: "1.0.0",
    remotes: [
      { type: "streamable-http", url: "https://mcp.linear.app/mcp" },
      { type: "sse", url: "https://mcp.linear.app/sse" },
    ],
  },
  {
    name: "com.atlassian/atlassian-mcp-server",
    title: "Atlassian Rovo MCP Server",
    description: "Atlassian Rovo MCP Server",
    version: "1.1.1",
    remotes: [
      { type: "streamable-http", url: "https://mcp.atlassian.com/v1/mcp" },
      { type: "sse", url: "https://mcp.atlassian.com/v1/sse" },
    ],
  },
  {
    name: "com.cloudflare.mcp/mcp",
    description: "Cloudflare MCP servers",
    version: "1.0.0",
    remotes: [
      { type: "streamable-http", url: "https://docs.mcp.cloudflare.com/mcp" },
      {
        type: "streamable-http",
        url: "https://observability.mcp.cloudflare.com/mcp",
        headers: [
          {
            name: "Authentication",
            description:
              "Optional Cloudflare Bearer token if not using OAuth.",
            isSecret: true,
          },
        ],
      },
    ],
  },
  {
    name: "com.neon/mcp-server-neon",
    title: "Neon MCP Server",
    description:
      "Official Neon MCP server for managing Neon Postgres with OAuth or API key auth.",
    version: "1.0.0",
    remotes: [
      {
        type: "streamable-http",
        url: "https://mcp.neon.tech/mcp",
        headers: [
          {
            name: "Authorization",
            description:
              "Optional API key auth header, for example: Bearer <NEON_API_KEY>.",
            isSecret: true,
          },
          {
            name: "x-read-only",
            description:
              "Optional read-only override. Use true to restrict available tools.",
          },
        ],
      },
    ],
  },
  {
    name: "com.microsoft/microsoft-learn-mcp",
    title: "Microsoft Learn MCP",
    description:
      "Official Microsoft Learn MCP Server – real-time docs and code samples.",
    version: "1.0.0",
    remotes: [{ type: "streamable-http", url: "https://learn.microsoft.com/api/mcp" }],
  },
  {
    name: "com.notion/mcp",
    description: "Official Notion MCP server",
    version: "1.0.1",
    remotes: [
      { type: "streamable-http", url: "https://mcp.notion.com/mcp" },
      { type: "sse", url: "https://mcp.notion.com/sse" },
    ],
  },
  {
    name: "com.postman/postman-mcp-server",
    description: "Postman MCP server for Postman API workflows.",
    version: "2.7.0",
    remotes: [
      {
        type: "streamable-http",
        url: "https://mcp.postman.com/mcp",
        headers: [
          {
            name: "Authorization",
            description:
              "Bearer token with a valid Postman API key for authentication.",
            isRequired: true,
            isSecret: true,
          },
        ],
      },
    ],
    packages: [
      {
        registryType: "npm",
        identifier: "@postman/postman-mcp-server",
        version: "2.7.0",
        transport: { type: "stdio" },
      },
    ],
  },
  {
    name: "com.stripe/mcp",
    description: "MCP server integrating with Stripe.",
    version: "0.2.4",
    remotes: [{ type: "streamable-http", url: "https://mcp.stripe.com" }],
  },
  {
    name: "com.supabase/mcp",
    title: "Supabase",
    description: "MCP server for interacting with the Supabase platform.",
    version: "0.6.3",
    remotes: [{ type: "streamable-http", url: "https://mcp.supabase.com/mcp" }],
    packages: [
      {
        registryType: "npm",
        identifier: "@supabase/mcp-server-supabase",
        version: "0.6.3",
        transport: { type: "stdio" },
      },
    ],
  },
  {
    name: "com.vercel/vercel-mcp",
    description: "An MCP server for Vercel",
    version: "0.0.3",
    remotes: [{ type: "streamable-http", url: "https://mcp.vercel.com" }],
  },
  {
    name: "io.github.getsentry/sentry-mcp",
    description: "MCP server for Sentry issue tracking and debugging.",
    version: "0.25.0",
    packages: [
      {
        registryType: "npm",
        identifier: "@sentry/mcp-server",
        version: "0.25.0",
        transport: { type: "stdio" },
      },
    ],
  },
  {
    name: "io.github.github/github-mcp-server",
    title: "GitHub",
    description: "Official GitHub MCP server.",
    version: "0.31.0",
    remotes: [
      {
        type: "streamable-http",
        url: "https://api.githubcopilot.com/mcp/",
        headers: [
          {
            name: "Authorization",
            description: "Authorization header with token (PAT or App token).",
            isSecret: true,
          },
        ],
      },
    ],
  },
  {
    name: "io.github.mongodb-js/mongodb-mcp-server",
    description: "MongoDB Model Context Protocol server.",
    version: "1.6.0",
    packages: [
      {
        registryType: "npm",
        identifier: "mongodb-mcp-server",
        version: "1.6.0",
        transport: { type: "stdio" },
      },
    ],
  },
  {
    name: "io.github.railwayapp/mcp-server",
    description: "Official Railway MCP server.",
    version: "0.1.5",
    packages: [
      {
        registryType: "npm",
        identifier: "@railway/mcp-server",
        version: "0.1.5",
        transport: { type: "stdio" },
      },
    ],
  },
  {
    name: "io.github.vercel/next-devtools-mcp",
    description: "Next.js development tools MCP server with stdio transport.",
    version: "0.3.6",
    packages: [
      {
        registryType: "npm",
        identifier: "next-devtools-mcp",
        version: "0.3.6",
        transport: { type: "stdio" },
      },
    ],
  },
];
