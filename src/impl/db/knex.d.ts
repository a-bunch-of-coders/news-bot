import type { Knex } from "knex";
import type { Feed } from "../../abstract/db";
import { Database } from "./../../abstract/db";
export declare class KnexDatabase extends Database {
    private readonly db;
    private constructor();
    static initialize(config: Knex.Config): Promise<KnexDatabase>;
    add(guildId: string, channelId: string, url: string, title?: string | null, webhookUrl?: string | null): Promise<void>;
    remove(guildId: string, url: string): Promise<boolean>;
    guild(guildId: string): Promise<Feed[]>;
    feeds(): Promise<Feed[]>;
    find(url: string): Promise<Feed | null>;
    update(id: number, lastItemDate?: string | null): Promise<void>;
    exists(guildId: string, url: string): Promise<boolean>;
    duplicate(guildId: string, channelId: string, url: string): Promise<boolean>;
}
