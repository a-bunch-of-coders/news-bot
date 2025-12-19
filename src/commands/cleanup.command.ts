import {
  ApplicationCommandOptionType,
  ChannelType,
  type CommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

import { type Database } from "../impl/db/abstract.js";


@Discord()
export class CleanupFeedsCommand {
  @Slash({
    name: "cleanupfeeds",
    description: "Delete all channels in this guild that have feeds registered",
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
        ephemeral: true,
      });
      return;
    }

    if (!confirm) {
      await interaction.reply({
        content: "❌ Cleanup aborted. You must pass `confirm: true`.",
        ephemeral: true,
      });
      return;
    }

    const guild = interaction.guild;
    const database: Database = interaction.client.db; // adjust if needed

    await interaction.reply({
      content: "🧹 Starting feed cleanup…",
      ephemeral: true,
    });

    const feeds = await database.guild(guild.id);
    const uniqueChannelIds = [...new Set(feeds.map(f => f.channel_id))];

    let deleted = 0;
    let skipped = 0;

    for (const channelId of uniqueChannelIds) {
  
      const channel = guild.channels.cache.get(channelId);
      if (!channel) {
        skipped++;
        continue;
      }

      if (
        channel.type !== ChannelType.GuildText &&
        channel.type !== ChannelType.GuildAnnouncement
      ) {
        skipped++;
        continue;
      }

      try {
        await channel.delete("Feed cleanup");
        await database.removeChannelFeeds(guild.id, channelId);
        deleted++;
      } catch (err) {
        console.warn(`Failed to delete channel ${channelId}:`, err);
        skipped++;
      }
    }

    await interaction.followUp({
      content: `✅ Cleanup complete.\nDeleted: ${deleted}\nSkipped: ${skipped}`,
      ephemeral: true,
    });
  }
}
