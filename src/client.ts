import { IntentsBitField } from "discord.js";
import { Client } from "discordx";
import { Config } from "./config";

import { Database } from "./abstract/db";
import { CustomClient } from "./types";


export async function buildClient(config: Config, db: Database): Promise<Client> {
	const client = new Client({
		intents: [
			IntentsBitField.Flags.Guilds,
			IntentsBitField.Flags.GuildMessages,
			IntentsBitField.Flags.GuildMembers,
		],
		silent: false,
	}) as CustomClient;

	client.on("ready", async () => {
		console.log(">> Bot started");

		// to create/update/delete discord application commands
		await client.initApplicationCommands();
	});

	await client.login(config.bot.token);

	// so everywhere in the code we can use client.db
	client.db = db;

	return client;
}


