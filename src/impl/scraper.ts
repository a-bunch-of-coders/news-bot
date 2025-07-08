import { Database, Feed as DbFeed } from "../abstract/db";
import { Client, TextChannel, EmbedBuilder } from "discord.js";
import { fetchSingle } from "./util";
import { parseFeed, title as parserTitle, description as parserDescription, truncate, clean } from "./util/parser";
import pLimit from "p-limit";
import { URL } from "url";

// Global lock and posted articles tracking
let feedCheckLock = false;
const POSTED_ARTICLES = new Set<string>();

/**
 * Check all feeds with concurrency limit.
 */
export async function check(database: Database, client: Client): Promise<void> {
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
          const count = await Promise.race([
            processFeed(feed, database, client),
            new Promise<number>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 45_000))
          ]);
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

/**
 * Process a single feed by URL, returns new item count
 */
export async function single(database: Database, client: Client, url: string): Promise<number> {
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
    content = await Promise.race([
      fetchSingle(feed.url),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error("Timeout fetching feed")), 15_000))
    ]);
  } catch (e: any) {
    console.warn(`Failed to fetch ${feed.url}: ${e}`);
    throw e;
  }

  const parsed = await parseFeed(content);
  const total = parsed.entries.length;
  if (total === 0) {
    console.info(`Feed ${feed.url} is empty`);
    return 0;
  }

  console.info(`Feed ${feed.url} has ${total} total items`);

  let newItems = 0;
  let newestDate: string | null = null;
  const itemsToCheck = feed.lastItemDate ? Math.min(3, total) : 1;

  // Sort descending by publish/update date
  const entries = [...parsed.entries].sort((a, b) => {
    const da = (a.published || a.updated)?.getTime() ?? 0;
    const db = (b.published || b.updated)?.getTime() ?? 0;
    return db - da;
  });

  for (const entry of entries.slice(0, itemsToCheck)) {
    const id = identifier(entry);
    if (POSTED_ARTICLES.has(id)) {
      console.info(`Skipping already posted article: ${id}`);
      continue;
    }

    const shouldPost = feed.lastItemDate
      ? ((entry.published || entry.updated)?.toISOString() ?? "") > feed.lastItemDate
      : newItems === 0;

    if (shouldPost) {
      console.info(`Posting new item: ${parserTitle(entry)}`);
      try {
        await post(feed, entry, client);
        newItems++;
        POSTED_ARTICLES.add(id);

        const d = (entry.published || entry.updated)?.toISOString() ?? null;
        if (d && (!newestDate || d > newestDate)) {
          newestDate = d;
        }
      } catch (e) {
        console.error(`Failed to post to channel: ${e}`);
        break;
      }
    }
  }

  if (newItems > 0) {
    console.info(`Updating lastItemDate to: ${newestDate}`);
    try {
      await database.update(feed.id, newestDate);
    } catch (e) {
      console.error(`Failed to update database for feed ${feed.url}: ${e}`);
    }
    console.info(`Posted ${newItems} new items for feed: ${feed.url}`);
  } else {
    console.info(`No new items for feed: ${feed.url}`);
  }

  return newItems;
}

function identifier(entry: any): string {
  const parts: string[] = [];
  const t = parserTitle(entry)?.trim().toLowerCase().replace(/[\n\r\t:!\?\.,;\-–—]/g, " ");
  if (t) {
    const words = t.split(/\s+/).filter(w => w.length > 2);
    if (words.length) parts.push(words.join(" "));
  }

  const link = entry.links?.[0]?.href;
  if (link) {
    try {
      const u = new URL(link);
      const segs = u.pathname.split("/").filter(Boolean);
      if (segs.length) parts.push(segs.join("/"));
    } catch {
      parts.push(link);
    }
  }

  if (entry.id) parts.push(entry.id);
  const pd = (entry.published || entry.updated)?.toISOString().slice(0, 10);
  if (pd) parts.push(pd);

  if (!parts.length) {
    return `entry_${Date.now()}`;
  }

  const hash = Buffer.from(parts.join("|")).toString("base64");
  console.debug(`Article identifier: ${parts.join(" | ")} -> ${hash}`);
  return hash;
}

async function post(feed: DbFeed, entry: any, client: Client): Promise<void> {
  const channel = await client.channels.fetch(feed.channelId.toString());
  if (!channel || !(channel instanceof TextChannel)) {
    throw new Error(`Invalid channel: ${feed.channelId}`);
  }

  const embed = new EmbedBuilder()
    .setTitle(truncate(parserTitle(entry), 256))
    .setDescription(parserDescription(entry));

  const link = entry.links?.[0]?.href;
  if (link) embed.setURL(link);
  const pd = entry.published || entry.updated;
  if (pd) embed.setTimestamp(pd);
  const img = extractImage(entry);
  if (img) embed.setImage(img);

  const footerText = feed.title ? clean(feed.title) : new URL(feed.url).host;
  embed.setFooter({ text: footerText });

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await channel.send({ embeds: [embed] });
      return;
    } catch (e: any) {
      if (attempt === 2) throw new Error(`Failed to send message after 2 attempts: ${e}`);
      console.warn(`Failed to send message (attempt ${attempt}), retrying`);
    }
  }
}

