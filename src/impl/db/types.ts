import { Config } from "../../config";
import { KnexDatabase } from "./knex";

export type DBSetup = (config: Config) => Promise<KnexDatabase>;