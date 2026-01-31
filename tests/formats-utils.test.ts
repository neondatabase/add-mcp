#!/usr/bin/env tsx

/**
 * Unit tests for formats utils
 *
 * Run with: npx tsx tests/formats-utils.test.ts
 */

import assert from "node:assert";
import { deepMerge, getNestedValue } from "../src/formats/index.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`✗ ${name}`);
    console.error(`  ${(err as Error).message}`);
    failed++;
  }
}

test("deepMerge merges nested objects", () => {
  const target = {
    a: { b: 1 },
    c: 2,
  };
  const source = {
    a: { d: 3 },
  };

  const result = deepMerge(target, source);

  assert.deepStrictEqual(result, {
    a: { b: 1, d: 3 },
    c: 2,
  });
});

test("deepMerge overrides primitives and arrays", () => {
  const target = {
    a: 1,
    b: [1, 2],
    c: { d: 1 },
  };
  const source = {
    a: 2,
    b: [3],
    c: { d: 2 },
  };

  const result = deepMerge(target, source);

  assert.deepStrictEqual(result, {
    a: 2,
    b: [3],
    c: { d: 2 },
  });
});

test("getNestedValue returns nested value", () => {
  const obj = {
    a: { b: { c: 1 } },
  };

  assert.strictEqual(getNestedValue(obj, "a.b.c"), 1);
});

test("getNestedValue returns undefined when missing", () => {
  const obj = {
    a: { b: { c: 1 } },
  };

  assert.strictEqual(getNestedValue(obj, "a.b.d"), undefined);
});

test("getNestedValue returns undefined when path hits non-object", () => {
  const obj = {
    a: 1,
  };

  assert.strictEqual(getNestedValue(obj, "a.b"), undefined);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
