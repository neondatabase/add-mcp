import type { ConfigFile, ConfigFormat } from "../types.js";
import {
  writeJsonConfig,
  writeJsonConfigExact,
  readJsonConfig,
  setNestedValue,
} from "./json.js";
import {
  writeYamlConfig,
  writeYamlConfigExact,
  readYamlConfig,
} from "./yaml.js";
import {
  writeTomlConfig,
  writeTomlConfigExact,
  readTomlConfig,
} from "./toml.js";

export { setNestedValue } from "./json.js";
export { deepMerge, getNestedValue } from "./utils.js";

export function writeConfig(
  filePath: string,
  config: ConfigFile,
  format: ConfigFormat,
  configKey: string,
): void {
  switch (format) {
    case "json":
      writeJsonConfig(filePath, config, configKey);
      break;
    case "yaml":
      writeYamlConfig(filePath, config);
      break;
    case "toml":
      writeTomlConfig(filePath, config);
      break;
    default:
      throw new Error(`Unsupported config format: ${format}`);
  }
}

export function writeConfigExact(
  filePath: string,
  config: ConfigFile,
  format: ConfigFormat,
): void {
  switch (format) {
    case "json":
      writeJsonConfigExact(filePath, config);
      break;
    case "yaml":
      writeYamlConfigExact(filePath, config);
      break;
    case "toml":
      writeTomlConfigExact(filePath, config);
      break;
    default:
      throw new Error(`Unsupported config format: ${format}`);
  }
}

export function readConfig(filePath: string, format: ConfigFormat): ConfigFile {
  switch (format) {
    case "json":
      return readJsonConfig(filePath);
    case "yaml":
      return readYamlConfig(filePath);
    case "toml":
      return readTomlConfig(filePath);
    default:
      throw new Error(`Unsupported config format: ${format}`);
  }
}

export function buildConfigWithKey(
  configKey: string,
  serverName: string,
  serverConfig: unknown,
): ConfigFile {
  const config: ConfigFile = {};
  const servers: ConfigFile = {};
  servers[serverName] = serverConfig;
  setNestedValue(config, configKey, servers);
  return config;
}
