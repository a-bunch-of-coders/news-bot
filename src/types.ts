import type { Database } from "./abstract/db";


// not the best fix, but oh well.
declare module "discordx" {
    export interface Client {
        db: Database;
    }
}


declare module "discord.js" {
    export interface Client {
        db: Database;
    }
}