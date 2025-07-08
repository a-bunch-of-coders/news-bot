import { PathLike } from "fs";
import * as fs from "fs/promises";
import {jsonc} from "jsonc";
import { z } from "zod";



export const configSchema = z.object({
  bot: z
    .object({
      token: z.string().default(""),
      check_interval_minutes: z.number().int().min(1).default(1),
    })
    .default({}), 

  database: z
    .object({
      url: z.string().default("sqlite:rss.db"),
    })
    .default({}), 
});

export type Config = z.infer<typeof configSchema>;

export function validateConfig(config: unknown): Config {
  const result = configSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid configuration: ${result.error.message}`);
  }
  return result.data;
}

function generateConfig(configPath: PathLike): Config {
  const defaultConfig: Config = configSchema.parse({});
  try {
    fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
  } catch (error) {
    let msg = `Failed to write default configuration to ${configPath}`;
    if (error instanceof Error) msg += `: ${error.message}`;

    throw new Error(msg);
  }
  console.log(`Default configuration generated at ${configPath}`);
  return defaultConfig;
}

export async function ensureConfig(configPath: PathLike): Promise<Config> {
  // Check if the config file exists
  try {
    await fs.access(configPath);
  } catch (error) {
    // If the file does not exist, generate a default config
    console.warn(`Configuration file not found at ${configPath}. Generating default configuration.`);
    return generateConfig(configPath);
  }


  // convert path to string
  if (configPath instanceof URL) {
    configPath = configPath.pathname;
  }

  if (typeof configPath !== "string") {
    throw new Error("Config path must be a string or URL");
  }

  console.log(`Loading wqwrqwqwfqewfconfiguration from ${configPath}`);
  // Load the config file
  const configFile = await jsonc.read(configPath);

  // Validate the config
  return validateConfig(configFile);
}
