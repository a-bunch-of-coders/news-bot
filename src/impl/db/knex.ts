import type { Knex} from "knex";
import {default as knex} from "knex";

import { Database, type Feed } from "./abstract.js";

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

    /**
     * By default, knex returns strings, not Dates.
     * 
     * 
     * @param raw 
     * @returns 
     */
    private formatFeed = (raw: Feed): Feed => {
        return {
            ...raw,
            last_updated: new Date(raw.last_updated),
            last_item_date: raw.last_item_date ? new Date(raw.last_item_date) : null,
        }
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

    async remove(guildId: string, channelId: string, url: string): Promise<boolean> {
        const count = await this.db("feeds")
            .where({ guild_id: guildId, channel_id: channelId, url })
            .delete();
        return count > 0;
    }

    async removeChannelFeeds(guildId: string, channelId: string): Promise<number> {
        const count = await this.db("feeds")
            .where({ guild_id: guildId, channel_id: channelId })
            .delete();
        return count;
    }

    async guild(guildId: string): Promise<Feed[]> {
        const raw = await this.db<Feed>("feeds")
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

        return raw.map(this.formatFeed);
    }

    async channel(guildId: string, channelId: string): Promise<Feed[]> {
        const raw = await this.db<Feed>("feeds")
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
            .where({ guild_id: guildId, channel_id: channelId })
            .orderBy("id"); 

        return raw.map(this.formatFeed);
    }

    async feeds(): Promise<Feed[]> {
        const raw = await this.db<Feed>("feeds").select(
            "id",
            "guild_id",
            "channel_id",
            "url",
            "title",
            "webhook_url",
            "last_updated",
            "last_item_date"
        );

        return raw.map(this.formatFeed);
    }

    async feed(guildId: string, url: string): Promise<Feed | null> {
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
            .where({ guild_id: guildId, url })
            .first();
        return row ? this.formatFeed(row) : null;
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
        return row ? this.formatFeed(row) : null;
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
        // channelId: string,
        url: string
    ): Promise<boolean> {
        const row = await this.db("feeds")
            .where({ guild_id: guildId, url })
            .count<{ count: string }>("id as count")
            .first();

        const cnt = row ? parseInt(row.count, 10) : 0;
        return cnt > 0;
    }

}