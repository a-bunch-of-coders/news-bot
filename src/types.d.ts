import type { Database } from "./abstract/db";
declare module "discordx" {
    interface Client {
        db: Database;
    }
}
declare module "discord.js" {
    interface Client {
        db: Database;
    }
}
