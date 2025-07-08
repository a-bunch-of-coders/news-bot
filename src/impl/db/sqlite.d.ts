import type { Config } from "../../config";
import { KnexDatabase } from "./knex";
export default function initializeDatabase(config: Config): Promise<KnexDatabase>;
