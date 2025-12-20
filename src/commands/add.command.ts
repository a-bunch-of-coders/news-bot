// src/commands/feed.command.ts

import type {
  CommandInteraction,
  TextChannel
} from "discord.js";
import {
  ApplicationCommandOptionType,
  ChannelType,
  MessageFlags,
  PermissionFlagsBits
} from "discord.js";
import {
  Discord,
  Slash,
  SlashOption,
} from "discordx";

import { addFeedCore } from "../impl/internal_commands/add.js";


@Discord()
export class FeedCommand {
  // `Database` should be registered with your DI container (typedi, etc.)

  @Slash({
    name: "addfeed",
    description: "Add an RSS/Atom feed to a text channel",
    defaultMemberPermissions: PermissionFlagsBits.ManageChannels,
  })
  async addFeed(
    @SlashOption({
      name: "url",
      description: "The RSS/Atom feed URL",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    url: string,
    @SlashOption({
      name: "channel",
      description: "Which channel to post updates in",
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText],
      required: false,
    })
    channelOption: TextChannel | undefined,

    interaction: CommandInteraction
  ): Promise<void> {

        // Keep your existing “resolve target” behavior
    const target = channelOption ?? (interaction.channel as TextChannel | null);
    if (!target) {
      await interaction.reply({
        content: "Could not resolve target text channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }


    await addFeedCore(interaction, url, target);
  }
}
