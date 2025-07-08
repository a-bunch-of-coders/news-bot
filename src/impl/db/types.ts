import type { Config } from "../../config.js";
import type { KnexDatabase } from "./knex.js";

export type DBSetup = (config: Config) => Promise<KnexDatabase>;