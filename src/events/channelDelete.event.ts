import { ChannelType, Events } from "discord.js";
import type { ArgsOf} from "discordx";
import { Discord, On } from "discordx";

@Discord()
export class ChannelEvents {
  @On({ event: Events.ChannelDelete })
  async onChannelDelete([channel]: ArgsOf<Events.ChannelDelete>): Promise<void> {
    // Only care about guild channels

    console.log(`[channelDelete] Channel deleted: id=${channel.id}, type=${channel.type}`);
    if (channel.type !== ChannelType.GuildText || channel.isThread()) {
      return;
    }

    const guildId = channel.guildId;
    const channelId = channel.id;

    try {
      // Remove all feeds tied to this channel
      await channel.client.db.removeChannelFeeds(guildId, channelId);

      console.log(
        `[channelDelete] Cleaned up feeds for guild=${guildId}, channel=${channelId}`
      );
    } catch (err) {
      console.error(
        `[channelDelete] Failed cleanup for guild=${guildId}, channel=${channelId}`,
        err
      );
    }
  }
}
