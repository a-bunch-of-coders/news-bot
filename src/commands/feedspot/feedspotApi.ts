// src/commands/feedspot/feedspotApi.ts
import {
  FEEDSPOT_COOKIE,
  FEEDSPOT_CT_URL,
  FEEDSPOT_ORIGIN,
  FEEDSPOT_UA,
  FETCH_TIMEOUT_MS,
  SEARCH_MAX_RESULTS,
} from "./constants.js";
import { fetchJsonWithTimeout } from "./http.js";
import type { FeedspotSearchItem, FeedspotSearchResponse } from "./types.js";

export async function feedspotSearch(query: string): Promise<FeedspotSearchItem[]> {
  const body = new URLSearchParams({
    mgr: "10025",
    q: query,
    url: FEEDSPOT_ORIGIN,
    search_type: "type",
  }).toString();

  const payload = await fetchJsonWithTimeout<FeedspotSearchResponse>(
    FEEDSPOT_CT_URL,
    {
      method: "POST",
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "content-type": "application/x-www-form-urlencoded",
        origin: FEEDSPOT_ORIGIN,
        pragma: "no-cache",
        referer: `${FEEDSPOT_ORIGIN}/`,
        dnt: "1",

        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",

        "user-agent": FEEDSPOT_UA,

        cookie: FEEDSPOT_COOKIE,
      },
      body,
    },
    FETCH_TIMEOUT_MS
  );

  if (payload.status !== 1) throw new Error(payload.msg || "Feedspot search failed");
  return (payload.data ?? []).slice(0, SEARCH_MAX_RESULTS);
}
