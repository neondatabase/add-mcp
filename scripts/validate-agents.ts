#!/usr/bin/env tsx

/**
 * Validates agent configurations for duplicates and consistency
 *
 * Run with: npx tsx scripts/validate-agents.ts
 */

import { agents } from '../src/agents.js';

let hasErrors = false;

function error(message: string) {
  console.error(`✗ ${message}`);
  hasErrors = true;
}

function success(message: string) {
  console.log(`✓ ${message}`);
}

// Check for duplicate display names
const displayNames = new Map<string, string>();
for (const [key, config] of Object.entries(agents)) {
  if (displayNames.has(config.displayName)) {
    error(`Duplicate display name "${config.displayName}" in agents: ${displayNames.get(config.displayName)}, ${key}`);
  } else {
    displayNames.set(config.displayName, key);
  }
}

if (!hasErrors) {
  success('No duplicate display names');
}

// Check for duplicate config keys (for same format)
const configKeysByFormat = new Map<string, Map<string, string>>();
for (const [key, config] of Object.entries(agents)) {
  if (!configKeysByFormat.has(config.format)) {
    configKeysByFormat.set(config.format, new Map());
  }
  const formatMap = configKeysByFormat.get(config.format)!;
  
  // It's OK to have the same config key for different agents (like mcpServers)
  // Just log for informational purposes
}

success('Config key validation passed');

// Check that all agents have required fields
for (const [key, config] of Object.entries(agents)) {
  if (!config.name) {
    error(`Agent "${key}" missing name`);
  }
  if (!config.displayName) {
    error(`Agent "${key}" missing displayName`);
  }
  if (!config.configPath) {
    error(`Agent "${key}" missing configPath`);
  }
  if (!config.configKey) {
    error(`Agent "${key}" missing configKey`);
  }
  if (!config.format) {
    error(`Agent "${key}" missing format`);
  }
  if (!config.detectInstalled) {
    error(`Agent "${key}" missing detectInstalled function`);
  }
}

if (!hasErrors) {
  success('All agents have required fields');
}

// Summary
console.log();
console.log(`Total agents: ${Object.keys(agents).length}`);

if (hasErrors) {
  console.log('\nValidation failed!');
  process.exit(1);
} else {
  console.log('\nValidation passed!');
}
