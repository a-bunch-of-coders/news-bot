import type { Feed } from "./models";

/**
 * Abstract database interface for managing RSS feeds.
 * Concrete implementations should handle connection details and execute these operations.
 * 
 * Note: slightly outdated due to finding out about Knex.
 */
export abstract class Database {

    /**
     * Handle initialization of the database.
     * 
     * This should include any necessary setup like connecting to the database,
     * creating tables, etc. The implementation should return an instance of the concrete Database subclass.
     * 
     * @param args - Any arguments needed for initialization, such as connection details.
     * @returns A promise that resolves to an instance of the concrete Database subclass.
     */
    static initialize(...args: any[]): Promise<Database> { // eslint-disable-line @typescript-eslint/no-unused-vars
        throw new Error("Database.initialize() must be implemented by a concrete subclass.");
    }


    /**
     * Insert a new feed into the database.
     *
     * @param guildId - The Discord guild ID owning this feed.
     * @param channelId - The Discord channel ID where updates will be posted.
     * @param url - The RSS feed URL.
     * @param title - Optional title of the feed.
     * @param webhookUrl - Optional webhook URL for posting updates.
     */
    abstract add(
        guildId: number,
        channelId: number,
        url: string,
        title?: string | null,
        webhookUrl?: string | null
    ): Promise<void>;

    /**
     * Remove a feed by guild and URL.
     *
     * @param guildId - The Discord guild ID.
     * @param url - The RSS feed URL to remove.
     * @returns True if a row was deleted; false otherwise.
     */
    abstract remove(guildId: number, url: string): Promise<boolean>;

    /**
     * Retrieve all feeds for a specific guild.
     *
     * @param guildId - The Discord guild ID.
     * @returns An array of Feed objects, ordered by their database ID.
     */
    abstract guild(guildId: number): Promise<Feed[]>;

    /**
     * Retrieve all feeds in the database.
     *
     * @returns An array of all Feed objects.
     */
    abstract feeds(): Promise<Feed[]>;

    /**
     * Find a single feed by its URL.
     *
     * @param url - The RSS feed URL to look up.
     * @returns The Feed if found, or null if not present.
     */
    abstract find(url: string): Promise<Feed | null>;

    /**
     * Update the last-updated timestamp and optional last-item date for a feed.
     *
     * @param id - The database ID of the feed.
     * @param lastItemDate - The publication date of the latest item, if any.
     */
    abstract update(id: number, lastItemDate?: string | null): Promise<void>;

    /**
     * Check whether a feed exists for a given guild and URL.
     *
     * @param guildId - The Discord guild ID.
     * @param url - The RSS feed URL.
     * @returns True if at least one matching feed exists; false otherwise.
     */
    abstract exists(guildId: number, url: string): Promise<boolean>;

    /**
     * Check for a duplicate feed (same guild, channel, and URL).
     *
     * @param guildId - The Discord guild ID.
     * @param channelId - The Discord channel ID.
     * @param url - The RSS feed URL.
     * @returns True if such a feed already exists; false otherwise.
     */
    abstract duplicate(
        guildId: number,
        channelId: number,
        url: string
    ): Promise<boolean>;
}


export type { Feed, GuildSettings } from "./models"