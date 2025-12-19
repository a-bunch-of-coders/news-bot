// src/commands/opinionated.command.ts

import type {
  CommandInteraction,
  TextChannel,
} from "discord.js";
import {
  ApplicationCommandOptionType,
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import {
  Discord,
  Slash,
  SlashChoice,
  SlashOption,
} from "discordx";

import { loadCollection, type OpinionatedCollection } from "../impl/opinionated.js";



@Discord()
export class OpinionatedCommand {

  @Slash({
    name: "opinionated",
    description: "Add a curated collection of RSS feeds to a channel",
  })
  async opinionated(
    @SlashOption({
      name: "topic",
      description: "Which curated collection to add",
      type: ApplicationCommandOptionType.String,
      required: true,
      // If you want choices, you can populate them at startup; discord doesn't support dynamic choices per-request.
      // For now, keep it a free string like your Rust.
    })
    topic: string,

    @SlashOption({
      name: "channel",
      description: "Which channel to post updates in (defaults to current channel)",
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText],
      required: false,
    })
    channelOption: TextChannel | undefined,

    interaction: CommandInteraction,
  ): Promise<void> {
    const guildId = interaction.guild?.id;
    if (!guildId) return;


    // Channel resolve (match Rust: option OR current channel id)
    const target = channelOption ?? (interaction.channel as TextChannel | null);
    if (!target) {
      await interaction.reply({
        content: "Could not resolve target text channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const channelId = target.id;


    // check "Create webhooks" permission 
    const botMember = await interaction.guild.members.fetchMe();
    if (!botMember.permissionsIn(channelId).has(PermissionFlagsBits.ManageWebhooks)) {
      await interaction.reply({
        content: "I need the 'Manage Webhooks' permission in the target channel to add feeds.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // check if webhook exists, otherwise make one
    const webhooks = await target.fetchWebhooks();
    let webhook = webhooks.find(wh => wh.owner?.id === interaction.client.user.id);
    webhook ??= await target.createWebhook({
        name: "RSS Feed Bot",
        reason: "Needed for posting RSS feed updates",
      });

    // Load collection
    let collection: OpinionatedCollection;
    try {
      collection = await loadCollection(topic);
    } catch {
      await interaction.reply({
        content: `Topic '${topic}' not found in curated collections.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Defer like Rust
    await interaction.deferReply({ flags: MessageFlags.Ephemeral, });

    let addedCount = 0;
    let skippedCount = 0;
    const failedFeeds: string[] = [];

    // NOTE: this mirrors your Rust logic:
    // - db.exists checks guild-wide existence for url (not channel-specific)
    // - db.add stores (guild, channel, url, name, None)
    for (const feed of collection.feeds) {
      try {
        if (await interaction.client.db.exists(guildId, feed.url)) {
          skippedCount++;
          continue;
        }

        await interaction.client.db.add(
          guildId,
          channelId,
          feed.url,
          feed.name,
          webhook.url,
        );

        addedCount++;
      } catch (err: any) {
        const msg = String(err?.message ?? err ?? "unknown error");
        const pretty =
          msg.includes("UNIQUE constraint") ? "already exists" : msg;
        failedFeeds.push(`• ${feed.name} (${pretty})`);
      }
    }

    // Summary formatting matches Rust closely
    let summary =
      `Added ${addedCount} feeds from '${collection.topic}' collection to <#${channelId}>\n` +
      `• ${addedCount} added\n` +
      `• ${skippedCount} skipped (already in server)`;

    if (failedFeeds.length > 0) {
      summary += `\n• ${failedFeeds.length} failed:`;
      for (const line of failedFeeds.slice(0, 5)) summary += `\n  ${line}`;
      if (failedFeeds.length > 5) {
        summary += `\n  ... and ${failedFeeds.length - 5} more`;
      }
    }

    await interaction.editReply({ content: summary });
  }
}
