import { Discord, Slash, SlashOption } from "discordx";
import { CommandInteraction, ApplicationCommandOptionType } from "discord.js";
import { check, single } from "../impl/scraper/index.js";

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
        ephemeral: true,
      });
      return;
    }

    // Defer reply for async operations
    await interaction.deferReply({ ephemeral: true });

    let content: string;
    try {
      if (url) {
        const newItems = await single(interaction.client, url);
        content = newItems > 0
          ? ` Synced feed and found ${newItems} new items`
          : " Synced feed, no new items found";
      } else {
        await check(interaction.client);
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
