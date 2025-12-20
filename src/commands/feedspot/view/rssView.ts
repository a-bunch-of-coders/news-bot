// src/commands/feedspot/view/rssView.ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

import type { RssViewState } from "../types.js";
import { clamp } from "./viewId.js";

export function buildRssPage(
  viewId: string,
  state: RssViewState
): { embed: EmbedBuilder; components: ActionRowBuilder<any>[] } {
  const total = state.feeds.length;

  // Handle empty results defensively
  if (total === 0) {
    const embed = new EmbedBuilder()
      .setTitle(state.pickedName)
      .setURL(state.pickedLink)
      .setDescription("No RSS feeds found.")
      .setColor(0x2ecc71);

    return { embed, components: [] };
  }

  // Now each "page" corresponds to a single feed index
  const page = clamp(state.page, 0, total - 1);
  const feed = state.feeds[page];

  const lines: string[] = [];
  lines.push(`**RSS:** ${feed.rss}`);
  if (feed.website) lines.push(`**Site:** ${feed.website}`);

 

  const header = lines.join("\n");

  const desc =
    (feed.description && feed?.description.trim().length > 0
      ? feed.description.trim()
      : "_(No description provided.)_");

  const embed = new EmbedBuilder()
    .setTitle(feed.title || state.pickedName)
    .setURL(state.pickedLink)
    .setColor(0x2ecc71)
    .addFields({ name: "Links", value: header })
    .setDescription(desc)
    .setFooter({ text: `Feed ${page + 1} of ${total}` });


  if (feed.image) {
    embed.setThumbnail(feed.image);
  }

  const components: ActionRowBuilder<any>[] = [];

  if (total > 1) {
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`feedspot_prev_${viewId}_${page}`)
          .setEmoji("◀️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId(`feedspot_jump_${viewId}_${page}`)
          .setLabel(`${page + 1}/${total}`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`feedspot_next_${viewId}_${page}`)
          .setEmoji("▶️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= total - 1)
      )
    );
  }

  // NEW: add-feed row (separate row keeps layout clean)
components.push(
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`feedspot_add_${viewId}_${page}`)
      .setLabel("Add this feed")
      .setEmoji("➕")
      .setStyle(ButtonStyle.Success)
  ));

  return { embed, components };
}
