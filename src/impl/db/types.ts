import type { Config } from "../../config";
import type { KnexDatabase } from "./knex";

export type DBSetup = (config: Config) => Promise<KnexDatabase>;