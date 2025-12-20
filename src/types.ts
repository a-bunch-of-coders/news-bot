import { Config } from "./config.js";
import type { Database } from "./impl/db/abstract.js";


// not the best fix, but oh well.
declare module "discordx" {
    export interface Client {
        db: Database;
        config: Config;
    }
}


declare module "discord.js" {
    export interface Client {
        db: Database;
    }
}