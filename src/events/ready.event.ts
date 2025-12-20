
import { ActivityType, Events } from "discord.js";
import { type Client, Discord, On } from "discordx";

import { check } from "../impl/scraper/index.js";

@Discord()
export class ChannelEvents {
    @On({ event: Events.ClientReady })
    onClientReady([client]: [Client]): void {

        if (!client.user) {
            console.error('[clientReady] Client user is not defined!');
            return;
        }

        console.log(`[clientReady] Client is ready: ${client.user.tag}`);


        const event = () => {
            client.db.feedCount().then(count => {
                console.log(`[clientReady] Hourly event fired: ${count} feeds in the database`);
                client.user!.setActivity({
                    name: `Watching ${count} feed${count !== 1 ? 's...' : ''}`,
                    type: ActivityType.Watching
                })
            }).catch(() => {
                console.error(`[clientReady] Failed to retrieve feed count`);
            });
        }

        // fire off an event that happens once every hour.
        setInterval(event, 60 * 60 * 1000);
        event();

        const checker = () => {
            console.log('Starting periodic check...');
            check(client).then(() => {
                console.log('Periodic check completed successfully.');
            }).catch((error: unknown) => {
                console.error('Error during periodic check:', error);
            });
        }


           // Start the periodic check
    setInterval(checker, client.config.bot.check_interval_minutes * 60 * 1000); // Convert minutes to milliseconds

    }
}
