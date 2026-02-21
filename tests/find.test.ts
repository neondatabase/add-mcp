#!/usr/bin/env tsx

import assert from "node:assert";
import {
  buildInstallPlanForEntry,
  buildPlaceholderValue,
  collectPromptValues,
  resolveTemplateUrl,
  searchCatalog,
} from "../src/find.js";
import type { RegistryCatalogServer } from "../src/registry-catalog.js";

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

const catalogFixture: RegistryCatalogServer[] = [
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
];

test("searchCatalog ranks stronger name match first", () => {
  const results = searchCatalog("supabase", catalogFixture);
  assert.strictEqual(results.length > 0, true);
  assert.strictEqual(results[0]?.entry.name, "com.supabase/mcp");
});

test("searchCatalog returns empty list when no matches", () => {
  const results = searchCatalog("definitely-not-a-match", catalogFixture);
  assert.strictEqual(results.length, 0);
});

test("buildInstallPlanForEntry defaults to remote in -y for hybrid entries", async () => {
  const plan = await buildInstallPlanForEntry(catalogFixture[0]!, { yes: true });
  assert.ok(plan);
  assert.strictEqual(plan?.target, "https://mcp.supabase.com/mcp");
  assert.strictEqual(plan?.transport, "http");
});

test("resolveTemplateUrl replaces provided variables only", () => {
  const resolved = resolveTemplateUrl("https://{tenant}.example.com/{region}/mcp", {
    tenant: "acme",
  });
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
