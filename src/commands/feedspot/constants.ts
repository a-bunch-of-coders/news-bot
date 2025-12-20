// src/commands/feedspot/constants.ts
export const FEEDSPOT_CT_URL = "https://www.feedspot.com/ctblog.php";
export const FEEDSPOT_ORIGIN = "https://rss.feedspot.com";
export const FEEDSPOT_BASE = "https://bloggers.feedspot.com";

export const FETCH_TIMEOUT_MS = 15_000;

export const SEARCH_RESULTS_PER_PAGE = 10;
export const RSS_PER_PAGE = 1;
export const SEARCH_MAX_RESULTS = 50;

export const VIEW_TTL_MS = 10 * 60_000; // 10 minutes

export const FEEDSPOT_COOKIE = "blog=true; PHPSESSID=sgf44invoeievotlvla617fi21";

// Keep your realistic UA in one place
export const FEEDSPOT_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
