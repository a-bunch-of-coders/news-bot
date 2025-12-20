// src/commands/feed/addFeedCore.ts
import type { ButtonInteraction, CommandInteraction, TextChannel } from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { URL } from "url";

import { parseFeed } from "../../impl/scraper/parser.js";
import { fetchSingle as fetchFeed } from "../../impl/scraper/utils.js";

const MAX_FEED_SIZE = 5_000_000; // 5 MB
const MAX_ENTRY_COUNT = 500;

type AddFeedInteraction = CommandInteraction | ButtonInteraction;

export async function addFeedCore(
  interaction: AddFeedInteraction,
  url: string,
  target: TextChannel
): Promise<void> {
  // 1) URL syntax check
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    await interaction.reply({ content: "Invalid URL.", flags: MessageFlags.Ephemeral });
    return;
  }

  const guildId = interaction.guild?.id;
  if (!guildId) {
    await interaction.reply({ content: "This can only be used in a server.", flags: MessageFlags.Ephemeral });
    return;
  }

  // 2) Permission checks (channel + bot)
  if (!target.permissionsFor(interaction.client.user)?.has(PermissionFlagsBits.ManageWebhooks)) {
    await interaction.reply({
      content: "I need the 'Manage Webhooks' permission in the target channel to post feed updates.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 3) Defer (both slash + button support this)
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  // 4) Check duplicate
  if (await interaction.client.db.duplicate(guildId, url)) {
    const existing = await interaction.client.db.feed(guildId, url);
    await interaction.editReply({
      content: `This feed is already added to <#${existing!.channel_id}>.`,
    });
    return;
  }

  // 5) Fetch + size limit
  let content: string;
  try {
    content = await fetchFeed(url);
  } catch (err: any) {
    await interaction.editReply({
      content: `Failed to fetch/validate feed: ${err?.message ?? String(err)}`,
    });
    return;
  }

  if (content.length > MAX_FEED_SIZE) {
    await interaction.editReply({
      content: `Feed is too large (${content.length} bytes).`,
    });
    return;
  }

  // 6) Parse + entry count check
  let feed;
  try {
    feed = await parseFeed(content);
  } catch (err: any) {
    await interaction.editReply({
      content: `Failed to parse feed: ${err?.message ?? String(err)}`,
    });
    return;
  }

  if (feed.items.length > MAX_ENTRY_COUNT) {
    await interaction.editReply({
      content: `Feed has ${feed.items.length} items—max is ${MAX_ENTRY_COUNT}.`,
    });
    return;
  }

  // 7) Ensure webhook exists (created by this bot)
  const webhooks = await target.fetchWebhooks();
  const botWebhooks = webhooks.filter((wh) => wh.owner?.id === interaction.client.user.id);

  let webhook = botWebhooks.first();
  webhook ??= await target.createWebhook({
    name: "RSS Feed Bot",
    reason: "Webhook for posting RSS feed updates",
  });

  // 8) Insert into DB
  await interaction.client.db.add(
    guildId,
    target.id,
    url,
    feed.title ?? undefined,
    webhook.url
  );

  // 9) Success
  const domain = parsedUrl.host;
  const kb = (content.length / 1024).toFixed(1);
  await interaction.editReply({
    content: `✅ Added \`${domain}\` → <#${target.id}> | ${feed.items.length} items • ${kb} KB`,
  });
}
