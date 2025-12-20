// src/commands/feedspot/rssParser.ts
import * as cheerio from "cheerio";

import { FEEDSPOT_BASE } from "./constants.js";
import type { ParsedFeedRow } from "./types.js";

function absUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function cleanInlineText($: cheerio.CheerioAPI, el: cheerio.Element): string {
  const node = $(el).clone();

  // Remove edit controls + "MORE" control + common junk
  node.find("a, i, svg, button, .feed_desc_mrbtnew").remove();

  return node.text().replace(/\s+/g, " ").trim();
}

function pickImgUrl(img: cheerio.Cheerio<any>, base: string): string | undefined {
  const raw =
    img.attr("src")?.trim() ||
    img.attr("data-src")?.trim() ||
    img.attr("data-original")?.trim() ||
    img.attr("data-lazy-src")?.trim();

  if (!raw) return undefined;
  return absUrl(raw, base);
}

export function extractRssFeedsFromFeedspotHtml(html: string): ParsedFeedRow[] {
  const $ = cheerio.load(html);
  const out: ParsedFeedRow[] = [];

  $("p.trow.trow-wrap").each((_, el) => {
    const row = $(el);

    const h3 = row.prevAll("h3.feed_heading").first();
    const title = h3.find("a.tlink").first().text().trim() || "(untitled)";

    // Image thumbnail
    const img = row.find("span.img-wrapper img").first();
    const image = img.length ? pickImgUrl(img, FEEDSPOT_BASE) : undefined;

    // Description
    const descEl = row.find("span.feed_desc").first().get(0);
    const description = descEl ? cleanInlineText($, descEl) : undefined;

    let rssHref: string | undefined;
    let websiteHref: string | undefined;

    row.find("strong").each((_, s) => {
      const label = $(s).text().trim().toLowerCase();

      if (label === "rss feed") {
        const a = $(s).nextAll("a").first();
        const href = a.attr("href")?.trim();
        if (href) rssHref = absUrl(href, FEEDSPOT_BASE);
      }

      if (label === "website") {
        const a = $(s).nextAll("a").first();
        const href = a.attr("href")?.trim();
        if (href) websiteHref = href;
      }
    });

    if (!rssHref) {
      const followA = row
        .find("a")
        .filter((_, a) => $(a).text().trim().toLowerCase() === "follow rss")
        .first();

      const hrefA = followA.attr("href")?.trim();
      if (hrefA) rssHref = absUrl(hrefA, FEEDSPOT_BASE);

      if (!rssHref) {
        const followBtn = row
          .find("button")
          .filter((_, b) => $(b).text().trim().toLowerCase() === "follow rss")
          .first();

        const dataHref =
          followBtn.attr("data-href")?.trim() ||
          followBtn.attr("data-url")?.trim() ||
          followBtn.attr("data-link")?.trim() ||
          followBtn.attr("data-rss")?.trim();

        if (dataHref) rssHref = absUrl(dataHref, FEEDSPOT_BASE);
      }
    }

    if (rssHref) {
      out.push({
        title,
        rss: rssHref,
        website: websiteHref,
        description: description && description.length > 0 ? description : undefined,
        image,
      });
    }
  });

  const seen = new Set<string>();
  return out.filter((x) => (seen.has(x.rss) ? false : (seen.add(x.rss), true)));
}
