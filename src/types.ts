import type { Client } from "discordx";
import { Database } from "./abstract/db";


export type CustomClient = Client & {
    db: Database;
};