import { Discord, Slash, SlashOption } from "discordx";
import { CommandInteraction, ApplicationCommandOptionType } from "discord.js";

@Discord()
export class RemoveFeedCommand {

  @Slash({
    name: "removefeed",
    description: "Remove an RSS feed URL from this guild",
  })
  async removeFeed(
    @SlashOption({
      name: "url",
      description: "RSS feed URL to remove",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    url: string,
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

    // Defer reply for async DB operation
    await interaction.deferReply({ ephemeral: true });

    try {
      const removed = await interaction.client.db.remove(guildId, url);
      const content = removed
        ? `✅ Successfully removed RSS feed: ${url}`
        : "RSS feed not found.";
      await interaction.editReply({ content });
    } catch (err: any) {
      console.error("Error removing feed:", err);
      await interaction.editReply({
        content: "An error occurred while removing the feed.",
      });
    }
  }
}
