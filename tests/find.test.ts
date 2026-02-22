#!/usr/bin/env tsx

import assert from "node:assert";
import {
  buildInstallPlanForEntry,
  buildPlaceholderValue,
  collectPromptValues,
  resolveTemplateUrl,
  searchRegistry,
} from "../src/find.js";
import type { RegistryServerEntry } from "../src/find.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`✓ ${name}`);
      passed++;
    })
    .catch((err: unknown) => {
      console.log(`✗ ${name}`);
      console.error(`  ${(err as Error).message}`);
      failed++;
    });
}

const officialServersFixture: RegistryServerEntry[] = [
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
    ],
  },
  {
    name: "com.supabase/mcp",
    title: "Supabase",
    description: "MCP server for interacting with Supabase",
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
    name: "com.stripe/mcp",
    description: "MCP server integrating with Stripe",
    version: "0.2.4",
    remotes: [{ type: "streamable-http", url: "https://mcp.stripe.com" }],
  },
  {
    name: "com.notion/mcp",
    description: "Official Notion MCP server",
    version: "1.0.1",
    remotes: [{ type: "streamable-http", url: "https://mcp.notion.com/mcp" }],
  },
  {
    name: "com.postman/postman-mcp-server",
    description: "Postman MCP server for Postman API workflows",
    version: "2.7.0",
    remotes: [{ type: "streamable-http", url: "https://mcp.postman.com/mcp" }],
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
    name: "io.github.getsentry/sentry-mcp",
    description: "MCP server for Sentry issue tracking and debugging",
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
    description: "Official GitHub MCP server",
    version: "0.31.0",
    remotes: [
      {
        type: "streamable-http",
        url: "https://api.githubcopilot.com/mcp/",
      },
    ],
  },
  {
    name: "io.github.mongodb-js/mongodb-mcp-server",
    description: "MongoDB Model Context Protocol server",
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
    description: "Official Railway MCP server",
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
    description: "Next.js development tools MCP server with stdio transport",
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

test("searchRegistry maps API response entries", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    ({
      ok: true,
      json: async () => ({
        servers: officialServersFixture.map((entry) => ({ server: entry })),
      }),
    }) as Response) as typeof fetch;

  try {
    const results = await searchRegistry("supabase");
    assert.strictEqual(results.length, officialServersFixture.length);
    assert.strictEqual(
      results.some((entry) => entry.name === "com.supabase/mcp"),
      true,
    );
    assert.strictEqual(
      results.some(
        (entry) => entry.name === "io.github.github/github-mcp-server",
      ),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("searchRegistry throws on non-ok response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    ({
      ok: false,
      status: 500,
      json: async () => ({}),
    }) as Response) as typeof fetch;

  try {
    await assert.rejects(async () => {
      await searchRegistry("supabase");
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("buildInstallPlanForEntry defaults to remote in -y for hybrid entries", async () => {
  const hybridEntry = officialServersFixture.find(
    (entry) => entry.name === "com.supabase/mcp",
  );
  assert.ok(hybridEntry);
  const plan = await buildInstallPlanForEntry(hybridEntry!, { yes: true });
  assert.ok(plan);
  assert.strictEqual(plan?.target, "https://mcp.supabase.com/mcp");
  assert.strictEqual(plan?.transport, "http");
});

test("resolveTemplateUrl replaces provided variables only", () => {
  const resolved = resolveTemplateUrl(
    "https://{tenant}.example.com/{region}/mcp",
    {
      tenant: "acme",
    },
  );
  assert.strictEqual(resolved, "https://acme.example.com/{region}/mcp");
});

test("collectPromptValues enforces required and omits empty optional", async () => {
  const calls: string[] = [];
  const responses = ["", "project-123", ""];
  let i = 0;

  const result = await collectPromptValues(
    [
      {
        key: "project_id",
        label: "Variable project_id",
        isRequired: true,
        placeholder: buildPlaceholderValue("variable"),
      },
      {
        key: "Authorization",
        label: "Header Authorization",
        isRequired: false,
        placeholder: buildPlaceholderValue("header"),
      },
    ],
    async (field) => {
      calls.push(field.key);
      const value = responses[i];
      i += 1;
      return value ?? "";
    },
  );

  assert.strictEqual(result.cancelled, false);
  assert.deepStrictEqual(result.values, { project_id: "project-123" });
  assert.deepStrictEqual(calls, ["project_id", "project_id", "Authorization"]);
});

async function runRequirementMatrixCase(
  variableRequired: boolean,
  headerRequired: boolean,
): Promise<{
  values: Record<string, string>;
  calls: string[];
}> {
  const calls: string[] = [];
  const responses: string[] = [];

  // Variable responses
  if (variableRequired) {
    responses.push("", "tenant-123");
  } else {
    responses.push("");
  }

  // Header responses
  if (headerRequired) {
    responses.push("", "Bearer token");
  } else {
    responses.push("");
  }

  let i = 0;
  const result = await collectPromptValues(
    [
      {
        key: "tenant_id",
        label: "Variable tenant_id",
        isRequired: variableRequired,
        placeholder: buildPlaceholderValue("variable"),
      },
      {
        key: "Authorization",
        label: "Header Authorization",
        isRequired: headerRequired,
        placeholder: buildPlaceholderValue("header"),
      },
    ],
    async (field) => {
      calls.push(field.key);
      const value = responses[i];
      i += 1;
      return value ?? "";
    },
  );

  assert.strictEqual(result.cancelled, false);
  return { values: result.values, calls };
}

test("matrix: variable required + header required", async () => {
  const result = await runRequirementMatrixCase(true, true);
  assert.deepStrictEqual(result.values, {
    tenant_id: "tenant-123",
    Authorization: "Bearer token",
  });
  assert.deepStrictEqual(result.calls, [
    "tenant_id",
    "tenant_id",
    "Authorization",
    "Authorization",
  ]);
});

test("matrix: variable required + header optional", async () => {
  const result = await runRequirementMatrixCase(true, false);
  assert.deepStrictEqual(result.values, {
    tenant_id: "tenant-123",
  });
  assert.deepStrictEqual(result.calls, [
    "tenant_id",
    "tenant_id",
    "Authorization",
  ]);
});

test("matrix: variable optional + header required", async () => {
  const result = await runRequirementMatrixCase(false, true);
  assert.deepStrictEqual(result.values, {
    Authorization: "Bearer token",
  });
  assert.deepStrictEqual(result.calls, [
    "tenant_id",
    "Authorization",
    "Authorization",
  ]);
});

test("matrix: variable optional + header optional", async () => {
  const result = await runRequirementMatrixCase(false, false);
  assert.deepStrictEqual(result.values, {});
  assert.deepStrictEqual(result.calls, ["tenant_id", "Authorization"]);
});

test("buildInstallPlanForEntry injects placeholders in -y mode", async () => {
  const plan = await buildInstallPlanForEntry(
    {
      name: "com.example/templated",
      description: "Templated remote",
      version: "1.0.0",
      remotes: [
        {
          type: "streamable-http",
          url: "https://api.example.com/{tenant}/mcp",
          variables: {
            tenant: { isRequired: true },
          },
          headers: [{ name: "Authorization", isRequired: true }],
        },
      ],
    },
    { yes: true },
  );

  assert.ok(plan);
  assert.strictEqual(
    plan?.target,
    "https://api.example.com/<your-variable-value-here>/mcp",
  );
  assert.deepStrictEqual(plan?.headers, {
    Authorization: "<your-header-value-here>",
  });
});

setTimeout(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}, 0);
