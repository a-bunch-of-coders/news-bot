// src/commands/feedspot/view/searchView.ts
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";

import { SEARCH_RESULTS_PER_PAGE } from "../constants.js";
import type { SearchViewState } from "../types.js";
import { clamp, shortHost } from "./viewId.js";

export function buildSearchPage(
  viewId: string,
  state: SearchViewState
): { embed: EmbedBuilder; components: ActionRowBuilder<any>[] } {
  const totalPages = Math.ceil(state.results.length / SEARCH_RESULTS_PER_PAGE);
  const page = clamp(state.page, 0, Math.max(0, totalPages - 1));

  const start = page * SEARCH_RESULTS_PER_PAGE;
  const end = Math.min(start + SEARCH_RESULTS_PER_PAGE, state.results.length);
  const slice = state.results.slice(start, end);

  const description = slice
    .map((r, i) => {
      const idx = start + i + 1;
      return `**${idx}.** [${r.name}](${r.link}) \n\`${shortHost(r.link)}\``;
    })
    .join("\n\n");

  const embed = new EmbedBuilder()
    .setTitle(`Feedspot results for: ${state.query}`)
    .setDescription(description)
    .setColor(0x7289da)
    .setFooter({ text: `Page ${page + 1} of ${totalPages} • ${state.results.length} results` });

  const components: ActionRowBuilder<any>[] = [];

  if (totalPages > 1) {
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`feedspot_prev_${viewId}_${page}`)
          .setEmoji("◀️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId(`feedspot_jump_${viewId}_${page}`)
          .setLabel(`${page + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`feedspot_next_${viewId}_${page}`)
          .setEmoji("▶️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1)
      )
    );
  }

  const pickOptions: StringSelectMenuOptionBuilder[] = slice.map((r, i) => {
    const absoluteIndex = start + i;
    return new StringSelectMenuOptionBuilder()
      .setLabel(`${absoluteIndex + 1}. ${r.name}`.slice(0, 100))
      .setDescription(shortHost(r.link).slice(0, 100))
      .setValue(String(absoluteIndex));
  });

  const picker = new StringSelectMenuBuilder()
    .setCustomId(`feedspot_pick_${viewId}`)
    .setPlaceholder("Select a result to view RSS feeds…")
    .addOptions(pickOptions);

  components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(picker));
  return { embed, components };
}
