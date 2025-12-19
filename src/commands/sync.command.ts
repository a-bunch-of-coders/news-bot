import { ApplicationCommandOptionType, MessageFlags, type CommandInteraction } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

import { guild, single } from "../impl/scraper/index.js";

@Discord()
export abstract class SyncFeedCommand {

  @Slash({
    name: "syncfeeds",
    description: "Synchronize one or all RSS feeds",
  })
  async syncFeeds(
    @SlashOption({
      name: "url",
      description: "Specific feed URL to sync",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    url: string | undefined,
    interaction: CommandInteraction
  ): Promise<void> {
    // Ensure command is used in a guild
    const guildId = interaction.guild?.id;
    if (!guildId) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Defer reply for async operations
    await interaction.deferReply({ flags: MessageFlags.Ephemeral, });

    let content: string;
    try {
      if (url) {
        const newItems = await single(interaction.client, url);
        content = newItems > 0
          ? ` Synced feed and found ${newItems} new items`
          : " Synced feed, no new items found";
      } else {
        await guild(interaction.client, guildId);
        content = " Successfully synced all feeds";
      }
    } catch (err: any) {
      content = url
        ? ` Failed to sync feed: ${err.message}`
        : ` Failed to sync feeds: ${err.message}`;
    }

    await interaction.editReply({ content });
  }
}
