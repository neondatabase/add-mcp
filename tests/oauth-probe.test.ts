#!/usr/bin/env tsx

import assert from "node:assert";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import type { McpServerConfig } from "../src/types.js";
import { detectOAuthForRemoteMcpServer } from "../src/oauth-probe.js";

let passed = 0;
let failed = 0;

type RouteHandler = (req: IncomingMessage, res: ServerResponse) => void;

function test(name: string, fn: () => Promise<void>) {
  return fn()
    .then(() => {
      console.log(`✓ ${name}`);
      passed++;
    })
    .catch((err) => {
      console.log(`✗ ${name}`);
      console.error(`  ${(err as Error).message}`);
      failed++;
    });
}

async function withServer(
  getRoutes: (baseUrl: string) => Record<string, RouteHandler>,
  fn: (baseUrl: string) => Promise<void>,
) {
  const server = createServer((req, res) => {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const routes = getRoutes(baseUrl);
    const route = routes[req.url ?? ""];
    if (!route) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    route(req, res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

await test("returns true when OAuth metadata chain is complete", async () => {
  await withServer(
    (baseUrl) => ({
      "/mcp": (_req, res) => {
        res.statusCode = 401;
        res.setHeader(
          "www-authenticate",
          `Bearer error="invalid_token", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
        );
        res.end(JSON.stringify({ error: "invalid_token" }));
      },
      "/.well-known/oauth-protected-resource": (_req, res) => {
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            resource: baseUrl,
            authorization_servers: [baseUrl],
          }),
        );
      },
      "/.well-known/oauth-authorization-server": (_req, res) => {
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            authorization_endpoint: `${baseUrl}/authorize`,
            token_endpoint: `${baseUrl}/token`,
            registration_endpoint: `${baseUrl}/register`,
          }),
        );
      },
    }),
    async (baseUrl) => {
      const result = await detectOAuthForRemoteMcpServer({
        url: `${baseUrl}/mcp`,
      });
      assert.strictEqual(result, true);
    },
  );
});

await test("returns false when challenge lacks resource_metadata", async () => {
  await withServer(
    () => ({
      "/mcp": (_req, res) => {
        res.statusCode = 401;
        res.setHeader("www-authenticate", 'Bearer error="invalid_token"');
        res.end(JSON.stringify({ error: "invalid_token" }));
      },
    }),
    async (baseUrl) => {
      const result = await detectOAuthForRemoteMcpServer({
        url: `${baseUrl}/mcp`,
      });
      assert.strictEqual(result, false);
    },
  );
});

await test("returns false when protected resource metadata is malformed", async () => {
  await withServer(
    (baseUrl) => ({
      "/mcp": (_req, res) => {
        res.statusCode = 401;
        res.setHeader(
          "www-authenticate",
          `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
        );
        res.end("{}");
      },
      "/.well-known/oauth-protected-resource": (_req, res) => {
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ resource: baseUrl }));
      },
    }),
    async (baseUrl) => {
      const result = await detectOAuthForRemoteMcpServer({
        url: `${baseUrl}/mcp`,
      });
      assert.strictEqual(result, false);
    },
  );
});

await test("returns false when authorization metadata misses endpoints", async () => {
  await withServer(
    (baseUrl) => ({
      "/mcp": (_req, res) => {
        res.statusCode = 401;
        res.setHeader(
          "www-authenticate",
          `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
        );
        res.end("{}");
      },
      "/.well-known/oauth-protected-resource": (_req, res) => {
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            authorization_servers: [baseUrl],
          }),
        );
      },
      "/.well-known/oauth-authorization-server": (_req, res) => {
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            authorization_endpoint: `${baseUrl}/authorize`,
            token_endpoint: `${baseUrl}/token`,
          }),
        );
      },
    }),
    async (baseUrl) => {
      const result = await detectOAuthForRemoteMcpServer({
        url: `${baseUrl}/mcp`,
      });
      assert.strictEqual(result, false);
    },
  );
});

await test("returns false on non-auth response", async () => {
  await withServer(
    () => ({
      "/mcp": (_req, res) => {
        res.statusCode = 200;
        res.end("{}");
      },
    }),
    async (baseUrl) => {
      const result = await detectOAuthForRemoteMcpServer({
        url: `${baseUrl}/mcp`,
      });
      assert.strictEqual(result, false);
    },
  );
});

await test("forwards configured headers to probe request", async () => {
  await withServer(
    () => ({
      "/mcp": (req, res) => {
        assert.strictEqual(req.headers["x-probe-token"], "abc123");
        res.statusCode = 401;
        res.setHeader("www-authenticate", 'Bearer error="invalid_token"');
        res.end("{}");
      },
    }),
    async (baseUrl) => {
      const config: McpServerConfig = {
        url: `${baseUrl}/mcp`,
        headers: { "x-probe-token": "abc123" },
      };
      const result = await detectOAuthForRemoteMcpServer(config);
      assert.strictEqual(result, false);
    },
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
