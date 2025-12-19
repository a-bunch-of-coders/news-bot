import type { AutocompleteInteraction, CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

// Adjust to your actual Feed type if needed
interface Feed {
  url: string;
  name?: string | null;
}

// discordx will route autocomplete interactions to this method
const autocomplete = async (interaction: AutocompleteInteraction): Promise<void> => {
  if (!interaction.inGuild()) {
    await interaction.respond([]);
    return;
  }

  const focused = interaction.options.getFocused(true);
  if (focused.name !== "url") {
    await interaction.respond([]);
    return;
  }

  const guildId = interaction.guildId;
  const channelId = interaction.channelId;
  const query = String(focused.value ?? "")
    .toLowerCase()
    .trim();

  try {
    const feeds: Feed[] = await interaction.client.db.channel(guildId, channelId);

    const results = feeds
      .filter((f) => {
        if (!query) return true;
        const u = f.url.toLowerCase();
        const n = (f.name ?? "").toLowerCase();
        return u.includes(query) || n.includes(query);
      })
      .slice(0, 25)
      .map((f) => ({
        // label shown to user (keep <= 100 chars to be safe)
        name: truncate(f.name ? `${f.name} — ${f.url}` : f.url, 100),
        // what gets passed back as the option value
        value: f.url,
      }));

    await interaction.respond(results);
  } catch (err) {
    console.error("Autocomplete error:", err);
    await interaction.respond([]);
  }
};

@Discord()
export class RemoveFeedCommand {
  @Slash({
    name: "removefeed",
    description: "Remove an RSS feed URL from this channel",
  })
  async removeFeed(
    @SlashOption({
      name: "url",
      description: "Select a feed to remove",
      type: ApplicationCommandOptionType.String,
      required: true,
      autocomplete: autocomplete,
    })
    url: string,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    const guildId = interaction.guildId;
    const channelId = interaction.channelId;

    await interaction.deferReply({ ephemeral: true });

    try {
      // Strongly recommend this is channel-scoped (guildId + channelId + url)
      const removed = await interaction.client.db.remove(guildId, channelId, url);

      await interaction.editReply({
        content: removed ? `✅ Removed RSS feed from <#${channelId}>:\n${url}` : "RSS feed not found for this channel.",
      });
    } catch (err) {
      console.error("Error removing feed:", err);
      await interaction.editReply({
        content: "An error occurred while removing the feed.",
      });
    }
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
