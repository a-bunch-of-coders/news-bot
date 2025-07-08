import { Client } from "discordx";
import type { Database } from "./abstract/db";
export declare function buildClient(db: Database): Promise<Client>;
