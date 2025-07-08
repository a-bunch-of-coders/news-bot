import type { Config } from "../../config";
import { KnexDatabase } from "./knex";


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