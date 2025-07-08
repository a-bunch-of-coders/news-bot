import type { Config } from "../../config.js";
import { KnexDatabase } from "./knex.js";


export default async function initializeDatabase(config: Config): Promise<KnexDatabase> {
  
    try {
        return await KnexDatabase.initialize({
            client: "pg",
            connection: config.database.url,
            migrations: { 
                extension: 'ts',
                directory: "./migrations/knex" }
        });
    } catch (error) {
        console.error("Failed to initialize database:", error);
        throw error;
    }
}