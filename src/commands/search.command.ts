// src/commands/feedspot/feedspot.command.ts

import type {
  ButtonInteraction,
  CommandInteraction,
  ModalSubmitInteraction,
  SelectMenuInteraction,
} from "discord.js";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  ButtonComponent,
  Discord,
  ModalComponent,
  SelectMenuComponent,
  Slash,
  SlashOption,
} from "discordx";

import { cacheBump, cacheCleanup, cacheGet, cacheSet } from "./feedspot/cache.js";
import {
  FEEDSPOT_COOKIE,
  FEEDSPOT_ORIGIN,
  FEEDSPOT_UA,
  FETCH_TIMEOUT_MS,
  RSS_PER_PAGE,
  SEARCH_RESULTS_PER_PAGE,
} from "./feedspot/constants.js";
import { feedspotSearch } from "./feedspot/feedspotApi.js";
import { fetchTextWithTimeout } from "./feedspot/http.js";
import { extractRssFeedsFromFeedspotHtml } from "./feedspot/rssParser.js";
import type { RssViewState, SearchViewState, ViewKind } from "./feedspot/types.js";
import { buildRssPage } from "./feedspot/view/rssView.js";
import { buildSearchPage } from "./feedspot/view/searchView.js";
import { clamp, makeViewId } from "./feedspot/view/viewId.js";

/**
 * Command entry + DiscordX interaction handlers.
 *
 * This file should stay small:
 * - all HTTP/search/parsing lives in feedspotApi/http/rssParser
 * - state caching lives in cache.ts
 * - embed/component rendering lives in view/*
 */
@Discord()
export class FeedspotCommand {
  @Slash({
    name: "feedspot",
    description: "Search Feedspot and browse RSS feeds via an interactive view",
  })
  async feedspot(
    @SlashOption({
      name: "query",
      description: "Search term (e.g. stock, ai, cybersecurity)",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    query: string,
    interaction: CommandInteraction
  ): Promise<void> {
    cacheCleanup();

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let results;
    try {
      results = await feedspotSearch(query);
    } catch (err: any) {
      await interaction.editReply(`❌ Feedspot search failed: ${err?.message ?? String(err)}`);
      return;
    }

    if (!results.length) {
      await interaction.editReply(`No results for \`${query}\`.`);
      return;
    }

    const viewId = makeViewId(interaction);

    const state: SearchViewState = {
      kind: "search",
      userId: interaction.user.id,
      query,
      results,
      page: 0,
    };

    cacheSet(viewId, state);

    const { embed, components } = buildSearchPage(viewId, state);
    await interaction.editReply({ embeds: [embed], components });
  }

  /* -------------------------
     Buttons (search + rss)
  ------------------------- */

  @ButtonComponent({ id: /^feedspot_(prev|next|jump)_[a-z0-9_-]+_[0-9]+$/i })
  async handleButton(interaction: ButtonInteraction): Promise<void> {
    const [_, action, viewId, pageStr] = interaction.customId.split("_");
    if (!action || !viewId || pageStr === undefined) return;

    const state = cacheGet(viewId);
    if (!state) {
      await interaction.reply({
        content: "This view expired. Run `/feedspot` again.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // scope to original user (important for ephemeral “views”)
    if (interaction.user.id !== state.userId) {
      await interaction.reply({
        content: "This menu isn’t for you. Run `/feedspot` yourself.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const currentPage = parseInt(pageStr, 10);
    if (Number.isNaN(currentPage)) return;

    // Jump opens modal
    if (action === "jump") {
      const totalPages =
        state.kind === "search"
          ? Math.ceil(state.results.length / SEARCH_RESULTS_PER_PAGE)
          : Math.ceil(state.feeds.length / RSS_PER_PAGE);

      const modal = new ModalBuilder()
        .setCustomId(`feedspot_jump_${viewId}_${state.kind}`)
        .setTitle("Jump to Page")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("page")
              .setLabel(`Enter a page number (1–${totalPages})`)
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(4)
          )
        );

      await interaction.showModal(modal);
      return;
    }

    // Prev/Next
    let newPage = currentPage;
    if (action === "prev") newPage = Math.max(currentPage - 1, 0);

    if (action === "next") {
      const totalPages =
        state.kind === "search"
          ? Math.ceil(state.results.length / SEARCH_RESULTS_PER_PAGE)
          : Math.ceil(state.feeds.length / RSS_PER_PAGE);
      newPage = Math.min(currentPage + 1, totalPages - 1);
    }

    if (state.kind === "search") {
      const totalPages = Math.ceil(state.results.length / SEARCH_RESULTS_PER_PAGE);
      const nextState: SearchViewState = {
        ...state,
        page: clamp(newPage, 0, Math.max(0, totalPages - 1)),
      };
      cacheBump(viewId, nextState);

      const { embed, components } = buildSearchPage(viewId, nextState);
      await interaction.update({ embeds: [embed], components });
      return;
    }

    // rss
    const totalPages = Math.ceil(state.feeds.length / RSS_PER_PAGE);
    const nextState: RssViewState = {
      ...state,
      page: clamp(newPage, 0, Math.max(0, totalPages - 1)),
    };
    cacheBump(viewId, nextState);

    const { embed, components } = buildRssPage(viewId, nextState);
    await interaction.update({ embeds: [embed], components });
  }

  /* -------------------------
     Select menus
  ------------------------- */

  @SelectMenuComponent({ id: /^feedspot_pick_[a-z0-9_-]+$/i })
  async handlePickResult(interaction: SelectMenuInteraction): Promise<void> {
    const viewId = interaction.customId.replace("feedspot_pick_", "");
    const state = cacheGet(viewId);

    if (!state || state.kind !== "search") {
      await interaction.reply({
        content: "This view expired. Run `/feedspot` again.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.user.id !== state.userId) {
      await interaction.reply({
        content: "This menu isn’t for you. Run `/feedspot` yourself.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const pickedStr = interaction.values?.[0];
    const pickedIndex = pickedStr ? parseInt(pickedStr, 10) : NaN;
    if (Number.isNaN(pickedIndex) || pickedIndex < 0 || pickedIndex >= state.results.length) {
      await interaction.reply({ content: "Invalid selection.", flags: MessageFlags.Ephemeral });
      return;
    }

    const picked = state.results[pickedIndex]!;

    await interaction.deferUpdate(); // acknowledge quickly
    await interaction.editReply({ content: "Fetching RSS feeds…", embeds: [], components: [] });

    let html: string;
    try {
      html = await fetchTextWithTimeout(
        picked.link,
        {
          method: "GET",
          headers: {
            accept: "text/html,*/*",
            referer: `${FEEDSPOT_ORIGIN}/`,
            "user-agent": FEEDSPOT_UA,
            ...(FEEDSPOT_COOKIE ? { cookie: FEEDSPOT_COOKIE } : {}),
          },
        },
        FETCH_TIMEOUT_MS
      );
    } catch (err: any) {
      await interaction.editReply({
        content: `❌ Failed to fetch page: ${err?.message ?? String(err)}`,
        embeds: [],
        components: [],
      });
      return;
    }

    const feeds = extractRssFeedsFromFeedspotHtml(html);

    if (!feeds.length) {
      await interaction.editReply({
        content: `No RSS feeds found on:\n**${picked.name}**\n${picked.link}`,
        embeds: [],
        components: [],
      });
      return;
    }

    const rssState: RssViewState = {
      kind: "rss",
      userId: state.userId,
      query: state.query,
      pickedName: picked.name,
      pickedLink: picked.link,
      feeds,
      page: 0,
    };

    cacheBump(viewId, rssState);

    const { embed, components } = buildRssPage(viewId, rssState);
    await interaction.editReply({ content: "", embeds: [embed], components });
  }

  /* -------------------------
     Jump modal (search or rss)
  ------------------------- */

  @ModalComponent({ id: /^feedspot_jump_[a-z0-9_-]+_(search|rss)$/ })
  async handleJumpModal(interaction: ModalSubmitInteraction): Promise<void> {
    const parts = interaction.customId.split("_");
    // feedspot_jump_<viewId>_<kind>
    const viewId = parts[2];
    const kind = parts[3] as ViewKind | undefined;
    if (!viewId || !kind) return;

    const state = cacheGet(viewId);
    if (!state) {
      // Modal submit supports ephemeral replies
      await interaction.reply({
        content: "This view expired. Run `/feedspot` again.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.user.id !== state.userId) {
      await interaction.reply({
        content: "This menu isn’t for you. Run `/feedspot` yourself.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const totalPages =
      state.kind === "search"
        ? Math.ceil(state.results.length / SEARCH_RESULTS_PER_PAGE)
        : Math.ceil(state.feeds.length / RSS_PER_PAGE);

    const input = interaction.fields.getTextInputValue("page");
    const parsed = parseInt(input, 10);

    if (Number.isNaN(parsed) || parsed < 1 || parsed > totalPages) {
      await interaction.reply({
        content: `Invalid page. Enter 1–${totalPages}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const page = parsed - 1;

    // We want to update the original ephemeral message, so use deferUpdate + editReply.
    await interaction.deferUpdate();

    if (state.kind === "search") {
      const nextState: SearchViewState = { ...state, page };
      cacheBump(viewId, nextState);
      const { embed, components } = buildSearchPage(viewId, nextState);
      await interaction.editReply({ embeds: [embed], components });
      return;
    }

    const nextState: RssViewState = { ...state, page };
    cacheBump(viewId, nextState);
    const { embed, components } = buildRssPage(viewId, nextState);
    await interaction.editReply({ embeds: [embed], components });
  }
}
