

import { Config } from "../../config";
import { KnexDatabase } from "./knex";


export default async function initializeDatabase(config: Config): Promise<KnexDatabase> {

  try {
    return await KnexDatabase.initialize({
      client: "sqlite3",
      connection: { filename: "./feeds.db" },
      useNullAsDefault: true,
      migrations: { directory: "./migrations" },
    });

  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error;
  }
}