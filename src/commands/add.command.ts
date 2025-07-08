// src/commands/feed.command.ts

import {
  ApplicationCommandOptionType,
  ChannelType,
  CommandInteraction,
  TextChannel,
} from "discord.js";
import {
  Discord,
  Slash,
  SlashOption,
} from "discordx";
import { URL } from "url";

import { Database } from "../abstract/db";
import { parseFeed } from "../impl/scraper/parser";
import { fetchSingle as fetchFeed } from "../impl/scraper/utils";

const FETCH_TIMEOUT_MS   = 15_000;
const MAX_FEED_SIZE      = 5_000_000;  // 5 MB
const MAX_ENTRY_COUNT    = 500;

@Discord()
export class FeedCommand {
  // `Database` should be registered with your DI container (typedi, etc.)
  constructor() {}

  @Slash({
    name:        "addfeed",
    description: "Add an RSS/Atom feed to a text channel",
  })
  async addFeed(
    @SlashOption({
      name:        "url",
      description: "The RSS/Atom feed URL",
      type:        ApplicationCommandOptionType.String,
      required:    true,
    })
    url: string,
    @SlashOption({
      name:        "channel",
      description: "Which channel to post updates in",
      type:        ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText],
      required:    false,
    })
    channelOption: TextChannel | undefined,

    interaction: CommandInteraction
  ): Promise<void> {
    // 1) URL syntax check
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      await interaction.reply({ content: "Invalid URL.", ephemeral: true });
      return;
    }

    // 2) Determine target channel
    const target = channelOption
      ?? (interaction.channel as TextChannel | null);
    if (!target) {
      await interaction.reply({
        content: "Could not resolve target text channel.",
        ephemeral: true,
      });
      return;
    }

    const guildId   = interaction.guild?.id;
    const channelId = target.id;
    if (!guildId) return;

    // 3) Check duplicate
    if (await interaction.client.db.duplicate(Number(guildId), Number(channelId), url)) {
      await interaction.reply({
        content: `This feed is already added to <#${channelId}>.`,
        ephemeral: true,
      });
      return;
    }

    // 4) Defer reply (gives us more time)
    await interaction.deferReply({ ephemeral: true });

    // 5) Fetch + size‐limit + timeout
    let content: string;
    try {
      content = await fetchFeed(url);
    } catch (err: any) {
      await interaction.editReply({
        content: `Failed to fetch/validate feed: ${err.message}`,
      });
      return;
    }

    if (content.length > MAX_FEED_SIZE) {
      await interaction.editReply({
        content: `Feed is too large (${content.length} bytes).`,
      });
      return;
    }

    // 6) Parse & entry count check
    let feed;
    try {
      feed = parseFeed(content);
    } catch (err: any) {
      await interaction.editReply({
        content: `Failed to parse feed: ${err.message}`,
      });
      return;
    }


    if (feed.root.children.length > MAX_ENTRY_COUNT) {
      await interaction.editReply({
        content: `Feed has ${feed.root.children[0].children.length} items—max is ${MAX_ENTRY_COUNT}.`,
      });
      return;
    }

    // 7) Insert into DB
    await interaction.client.db.add(
      Number(guildId),
      Number(channelId),
      url,
      feed.title ?? undefined,
      null
    );

    // 8) Success message
    const domain = parsedUrl.host;
    const kb     = (content.length / 1024).toFixed(1);
    await interaction.editReply({
      content: `✅ Added \`${domain}\` → <#${channelId}> | ${feed.root.children[0].children.length} items • ${kb} KB`,
    });
  }
}
