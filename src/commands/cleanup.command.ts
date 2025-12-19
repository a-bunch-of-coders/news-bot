import {
  ApplicationCommandOptionType,
  ChannelType,
  type CommandInteraction,
  PermissionFlagsBits,
  AuditLogEvent,
  MessageFlags,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

import { type Database } from "../impl/db/abstract.js";

@Discord()
export class CleanupFeedsCommand {
  @Slash({
    name: "cleanupfeeds",
    description: "Delete feed channels in this guild that were created by this bot",
    defaultMemberPermissions: PermissionFlagsBits.ManageChannels,
  })
  async cleanupFeeds(
    @SlashOption({
      name: "confirm",
      description: "You must explicitly confirm this destructive action",
      type: ApplicationCommandOptionType.Boolean,
      required: true,
    })
    confirm: boolean,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!confirm) {
      await interaction.reply({
        content: "❌ Cleanup aborted. You must pass `confirm: true`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Ensure the bot can actually read audit logs
    const me = interaction.guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
      await interaction.reply({
        content:
          "❌ I need the **View Audit Log** permission to safely delete only channels I created.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const guild = interaction.guild;
    const database: Database = interaction.client.db;

    await interaction.reply({
      content: "🧹 Starting feed cleanup (bot-created channels only)…",
      flags: MessageFlags.Ephemeral,
    });

    const feeds = await database.guild(guild.id);
    const uniqueChannelIds = [...new Set(feeds.map(f => f.channel_id))];

    // --- Build set of channel IDs created by THIS bot, using audit logs ---
    const botUserId = interaction.client.user?.id;
    if (!botUserId) {
      await interaction.followUp({
        content: "❌ Bot user ID unavailable; cannot verify channel creator.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const botCreatedChannelIds = new Set<string>();

    // Fetch a reasonable amount of ChannelCreate logs.
    // If you have tons of channels, bump this higher.
    const audit = await guild.fetchAuditLogs({
      type: AuditLogEvent.ChannelCreate,
      limit: 100,
    });

    for (const entry of audit.entries.values()) {
      if (entry.executorId !== botUserId) continue;

      // targetId is typically the created channel's ID for ChannelCreate events
      if (entry.targetId) botCreatedChannelIds.add(entry.targetId);
    }

    let deleted = 0;
    let skippedMissing = 0;
    let skippedNotText = 0;
    let skippedNotBotCreated = 0;
    let skippedError = 0;

    for (const channelId of uniqueChannelIds) {
      const channel = guild.channels.cache.get(channelId);
      if (!channel) {
        skippedMissing++;
        continue;
      }

      if (
        channel.type !== ChannelType.GuildText &&
        channel.type !== ChannelType.GuildAnnouncement
      ) {
        skippedNotText++;
        continue;
      }

      // SAFETY FILTER: only delete if audit log says the bot created it
      if (!botCreatedChannelIds.has(channelId)) {
        skippedNotBotCreated++;
        continue;
      }

      try {
        await channel.delete("Feed cleanup (bot-created channels only)");
        await database.removeChannelFeeds(guild.id, channelId);
        deleted++;
      } catch (err) {
        console.warn(`Failed to delete channel ${channelId}:`, err);
        skippedError++;
      }
    }

    await interaction.followUp({
      content:
        `✅ Cleanup complete (bot-created channels only).\n` +
        `Deleted: ${deleted}\n` +
        `Skipped (missing): ${skippedMissing}\n` +
        `Skipped (non-text): ${skippedNotText}\n` +
        `Skipped (not bot-created): ${skippedNotBotCreated}\n` +
        `Skipped (errors): ${skippedError}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
