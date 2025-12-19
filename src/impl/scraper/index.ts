import type { Client } from "discord.js";
import { EmbedBuilder, TextChannel, WebhookClient } from "discord.js";
import pLimit from "p-limit";
import type Parser from "rss-parser";
import { URL } from "url";

import type { Database, Feed as DbFeed } from "../db/abstract.js";
import { clean, description as parserDescription, parseFeed, title as parserTitle, truncate } from "./parser.js";
import { extractImage, fetchSingle } from "./utils.js";

// Global lock and posted articles tracking
let feedCheckLock = false;
const POSTED_ARTICLES = new Set<string>();

/**
 * Check all feeds with concurrency limit.
 */
export async function check(client: Client): Promise<void> {
    const database = client.db;
    if (feedCheckLock) {
        console.warn("Feed check already in progress, skipping this cycle");
        return;
    }
    feedCheckLock = true;
    try {
        const feeds = await database.feeds();
        console.info(`Checking ${feeds.length} feeds`);
        if (feeds.length === 0) {
            console.info("No feeds to check");
            return;
        }

        const limit = pLimit(8);
        const tasks = feeds.map(feed =>
            limit(async () => {
                try {

                    const count = await processFeed(feed, database, client);
                    return { url: feed.url, ok: true, count };
                } catch (error: any) {
                    if (error.message === "Timeout") {
                        console.warn(`Feed check timed out: ${feed.url}`);
                    }
                    return { url: feed.url, ok: false, error };
                }
            })
        );

        const results = await Promise.all(tasks);
        const success = results.filter(r => r.ok).length;
        const failed = results.filter(r => !r.ok).length;
        console.info(`Feed check complete: ${success} successful, ${failed} failed`);

        for (const result of results) {
            if (!result.ok && !result.error.message.includes("Timeout")) {
                console.error(`Failed to check ${result.url}: ${result.error}`);
            }
        }
    } finally {
        feedCheckLock = false;
    }
}

export async function guild(client: Client, guildId: string): Promise<number> {
    // don't care about the lock here, guild-specific checks can run concurrently

    const database = client.db;
    const feeds = await database.guild(guildId);
    console.info(`Checking ${feeds.length} feeds for guild ${guildId}`);
    if (feeds.length === 0) {
        console.info(`No feeds to check for guild ${guildId}`);
        return 0;
    }

    let totalNewItems = 0;
    const limit = pLimit(4);
    const tasks = feeds.map(feed =>
        limit(async () => {
            try {
                const count = await processFeed(feed, database, client);
                return count;
            } catch (error: any) {
                if (error.message === "Timeout") {
                    console.warn(`Feed check timed out: ${feed.url}`);
                } else {
                    console.error(`Failed to check ${feed.url}: ${error}`);
                }
                return 0;
            }
        })
    );

    const results = await Promise.all(tasks);
    for (const count of results) {
        totalNewItems += count;
    }

    console.info(`Guild feed check complete for ${guildId}: ${totalNewItems} new items posted`);
    return totalNewItems;
}

/**
 * Process a single feed by URL, returns new item count
 */
export async function single(client: Client, url: string): Promise<number> {
    const database = client.db;
    const feed = await database.find(url);
    if (!feed) {
        throw new Error(`Feed not found: ${url}`);
    }
    return processFeed(feed, database, client);
}

async function processFeed(feed: DbFeed, database: Database, client: Client): Promise<number> {
    console.info(`Checking feed: ${feed.url}`);

    // Fetch content with timeout
    let content: string;
    try {
        content = await fetchSingle(feed.url);
    } catch (e: any) {
        console.warn(`Failed to fetch ${feed.url}: ${e}`);
        throw e;
    }

    const parsed = await parseFeed(content);
    const total = parsed.items.length;
    if (total === 0) {
        console.info(`Feed ${feed.url} is empty`);
        return 0;
    }

    // console.info(`Feed ${feed.url} has ${total} total items`);

    let newItems = 0;
    let newestDate: Date | null = null;

    // If we've posted before, check up to 3 newest; otherwise only post the newest item once.
    const itemsToCheck = feed.last_item_date ? Math.min(3, total) : 1;

    // Helper: convert isoDate -> epoch ms safely
    const isoTime = (item: { isoDate?: string | null }): number => {
        if (!item.isoDate) return 0;
        const t = Date.parse(item.isoDate);
        return Number.isFinite(t) ? t : 0;
    };

    // Sort newest first by isoDate (fallback to bottom if missing/invalid)
    const entries = [...parsed.items].sort((a, b) => isoTime(b) - isoTime(a));


    for (const entry of entries.slice(0, itemsToCheck)) {
        const id = identifier(entry);
        if (POSTED_ARTICLES.has(id)) {
            console.info(`Skipping already posted article: ${id}`);
            continue;
        }

        // We require isoDate to do correct "newness" checks.
        // If a feed item has no isoDate, you can choose to skip it or treat it as old.
        const entryIsoStr = entry.isoDate ?? null;
        if (!entryIsoStr) {
            console.info(`Skipping item with no isoDate: ${parserTitle(entry)}`);
            continue;
        }

        const entryIso = new Date(entryIsoStr);


        const shouldPost = feed.last_item_date
            ? entryIso >= feed.last_item_date // this allows items with the same date to be posted
            : newItems === 0; // first run: post just the newest item

        if (shouldPost) {
            console.info(`Posting new item: ${parserTitle(entry)}`);
            // console.log(entry)
            try {
                await post(feed, entry, client);
                newItems++;
                POSTED_ARTICLES.add(id);

                if (!newestDate || entryIso > newestDate) {
                    newestDate = entryIso;
                }
            } catch (e) {
                console.error(`Failed to post to channel (${feed.channel_id}): ${e}`);
                break;
            }
        }
    }

    if (newItems > 0) {
        console.info(`Updating last_item_date to: ${newestDate?.toISOString()}`);
        try {
            await database.update(feed.id, newestDate?.toISOString());
        } catch (e) {
            console.error(`Failed to update database for feed ${feed.url}: ${e}`);
        }
        console.info(`Posted ${newItems} new items for feed: ${feed.url}`);
    } else {
        console.info(`No new items for feed: ${feed.url}`);
    }

    return newItems;
}


function identifier(entry: Parser.Item): string {
    const parts: string[] = [];
    const t = parserTitle(entry).trim().toLowerCase().replace(/[\n\r\t:!\?\.,;\-–—]/g, " ");
    if (t) {
        const words = t.split(/\s+/).filter(w => w.length > 2);
        if (words.length) parts.push(words.join(" "));
    }

    const link = entry.link
    if (link) {
        try {
            const u = new URL(link);
            const segs = u.pathname.split("/").filter(Boolean);
            if (segs.length) parts.push(segs.join("/"));
        } catch {
            parts.push(link);
        }
    }

    if (entry.guid) parts.push(entry.guid);
    const pd = (entry.isoDate)?.slice(0, 10);
    if (pd) parts.push(pd);

    if (!parts.length) {
        return `entry_${Date.now()}`;
    }

    const hash = Buffer.from(parts.join("|")).toString("base64");
    // console.debug(`Article identifier: ${parts.join(" | ")} -> ${hash}`);
    return hash;
}

async function post(feed: DbFeed, entry: Parser.Item, client: Client): Promise<void> {
    const webhook = feed.webhook_url
        ? new WebhookClient({ url: feed.webhook_url })
        : null;
    const channel = await client.channels.fetch(feed.channel_id.toString());



    if (!channel || !(channel instanceof TextChannel)) {
        console.error(`Failed to fetch channel ${feed.channel_id}: ${channel}`);
        throw new Error(`Invalid channel: ${feed.channel_id}`);
    }




    const img = extractImage(entry);
    const embed = new EmbedBuilder()

    const link = entry.link
    if (link) embed.setURL(link);
    const pd = entry.isoDate ? new Date(entry.isoDate) : null;
    if (pd) embed.setTimestamp(pd);

    if (img) embed.setImage(img);

    embed.setTitle(truncate(parserTitle(entry), 256))

    const desc = parserDescription(entry);
    if (desc) embed.setDescription(truncate(desc, 4096));

    const footerText = feed.title ? clean(feed.title) : new URL(feed.url).host;
    embed.setFooter({ text: footerText });

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {

            if (webhook) {
                await webhook.send({ embeds: [embed] });
            } else {
                await channel.send({ embeds: [embed] });
            }

            return;
        } catch (e: any) {
            if (attempt === 2) throw new Error(`Failed to send message after 2 attempts: ${e}`);
            console.warn(`Failed to send message (attempt ${attempt}), retrying`);
        }
    }
}

