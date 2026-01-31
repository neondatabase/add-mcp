import type { ConfigFile, ConfigFormat } from "../types.js";
import { readJsonConfig, writeJsonConfig, setNestedValue } from "./json.js";
import { readYamlConfig, writeYamlConfig } from "./yaml.js";
import { readTomlConfig, writeTomlConfig } from "./toml.js";

export { setNestedValue } from "./json.js";
export { deepMerge, getNestedValue } from "./utils.js";

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
