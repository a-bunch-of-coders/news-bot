

import type { Config } from "../../config";
import { KnexDatabase } from "./knex";


export default async function initializeDatabase(config: Config): Promise<KnexDatabase> {

  let rawUrl = config.database.url;
  if (!rawUrl.startsWith("sqlite:")) {
    throw new Error("Database URL must start with 'sqlite:' for SQLite configuration.");
  }
  // Remove 'sqlite:' prefix to get the actual file path
  rawUrl = rawUrl.slice(7).trim();
  console.log("Using SQLite database file:", rawUrl);
  try {
    return await KnexDatabase.initialize({
      client: "sqlite3",
      connection: { filename: `./${rawUrl}` }, // Use the parsed file path
      useNullAsDefault: true,
      migrations: { 
        extension: 'ts',
        directory: "./migrations/knex" },
    });

  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error;
  }
}