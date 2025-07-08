import type { Client } from "discord.js";
import type { Database } from "../../abstract/db";
/**
 * Check all feeds with concurrency limit.
 */
export declare function check(database: Database, client: Client): Promise<void>;
/**
 * Process a single feed by URL, returns new item count
 */
export declare function single(database: Database, client: Client, url: string): Promise<number>;
