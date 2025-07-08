import { CommandInteraction, TextChannel } from "discord.js";
export declare class FeedCommand {
    constructor();
    addFeed(url: string, channelOption: TextChannel | undefined, interaction: CommandInteraction): Promise<void>;
}
