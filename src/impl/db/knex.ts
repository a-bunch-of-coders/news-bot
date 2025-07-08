// src/database/KnexDatabase.ts
import type { Knex} from "knex";
import {default as knex} from "knex";

import type { Feed } from "../../abstract/db";
import { Database } from "./../../abstract/db";

export class KnexDatabase extends Database {
    private readonly db: Knex;

    private constructor(db: Knex) {
        super();
        this.db = db;
    }

    static async initialize(config: Knex.Config): Promise<KnexDatabase> {
        const db = knex(config);
        await db.migrate.latest();
        return new KnexDatabase(db);
    }

    async add(
        guildId: string,
        channelId: string,
        url: string,
        title?: string | null,
        webhookUrl?: string | null
    ): Promise<void> {

        await this.db<Feed>("feeds").insert({
            guild_id: guildId,
            channel_id: channelId,
            url,
            title: title ?? null,
            webhook_url: webhookUrl ?? null,
            last_updated: this.db.fn.now(),
        });
    }

    async remove(guildId: string, url: string): Promise<boolean> {
        const count = await this.db("feeds")
            .where({ guild_id: guildId, url })
            .delete();
        return count > 0;
    }

    async guild(guildId: string): Promise<Feed[]> {
        return this.db<Feed>("feeds")
            .select(
                "id",
                "guild_id",
                "channel_id",
                "url",
                "title",
                "webhook_url",
                "last_updated",
                "last_item_date"
            )
            .where({ guild_id: guildId })
            .orderBy("id");
    }

    async feeds(): Promise<Feed[]> {
        return this.db<Feed>("feeds").select(
            "id",
            "guild_id",
            "channel_id",
            "url",
            "title",
            "webhook_url",
            "last_updated",
            "last_item_date"
        );
    }

    async find(url: string): Promise<Feed | null> {
        const row = await this.db<Feed>("feeds")
            .select(
                "id",
                "guild_id",
                "channel_id",
                "url",
                "title",
                "webhook_url",
                "last_updated",
                "last_item_date"
            )
            .where({ url })
            .first();
        return row ?? null;
    }

    async update(id: number, lastItemDate?: string | null): Promise<void> {
        await this.db("feeds")
            .where({ id })
            .update({
                last_updated: this.db.fn.now(),
                last_item_date: lastItemDate ?? null,
            });
    }

    async exists(guildId: string, url: string): Promise<boolean> {
        const row = await this.db("feeds")
            .where({ guild_id: guildId, url })
            .count<{ count: string }>("id as count")
            .first();

        // row is either `{ count: string }` or undefined
        const cnt = row ? parseInt(row.count, 10) : 0;
        return cnt > 0;
    }

    async duplicate(
        guildId: string,
        channelId: string,
        url: string
    ): Promise<boolean> {
        const row = await this.db("feeds")
            .where({ guild_id: guildId, channel_id: channelId, url })
            .count<{ count: string }>("id as count")
            .first();

        const cnt = row ? parseInt(row.count, 10) : 0;
        return cnt > 0;
    }

}