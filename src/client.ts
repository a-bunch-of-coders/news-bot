import { IntentsBitField } from "discord.js";
import { Client } from "discordx";
import { Config } from "./impl/config";


async function buildClient(config: Config): Promise<Client> {
	const client = new Client({
		intents: [
			IntentsBitField.Flags.Guilds,
			IntentsBitField.Flags.GuildMessages,
			IntentsBitField.Flags.GuildMembers,
		],
		silent: false,
	});

	client.on("ready", async () => {
		console.log(">> Bot started");

		// to create/update/delete discord application commands
		await client.initApplicationCommands();
	});

	await client.login(config.bot.token);
	return client;
}


