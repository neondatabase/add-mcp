import type { ConfigFile, ConfigFormat } from "../types.js";
import { writeJsonConfig, setNestedValue } from "./json.js";
import { writeYamlConfig } from "./yaml.js";
import { writeTomlConfig } from "./toml.js";

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
