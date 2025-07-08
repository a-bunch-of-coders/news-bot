/**
 * Fetches the raw RSS feed content at the given URL, enforcing timeout,
 * status-code check, and maximum size limit, using only built-in Node.js modules.
 *
 * @param urlStr The feed URL to fetch.
 * @returns The body as a UTF-8 string.
 */
export declare function fetchSingle(urlStr: string): Promise<string>;
export declare function extractImage(entry: any): string | null;
export declare function validateImageUrl(url: string): boolean;
