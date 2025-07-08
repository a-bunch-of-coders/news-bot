import { importx } from "@discordx/importer";
import { IntentsBitField } from "discord.js";
import { Client } from "discordx";
import type { Database } from "./abstract/db";
import type { Config } from "./config";


export async function buildClient( db: Database): Promise<Client> {
	const client = new Client({
		intents: [
			IntentsBitField.Flags.Guilds,
			IntentsBitField.Flags.GuildMessages,
			IntentsBitField.Flags.GuildMembers,
		],
		silent: false,
	}) ;

	client.on("ready", async () => {
		console.log(">> Bot started");

		// to create/update/delete discord application commands
		await client.initApplicationCommands();


	});
	client.on("interactionCreate", (interaction) => {
		client.executeInteraction(interaction);
	});

	console.log(`>> Importing commands from ${__dirname}/commands/**/*.{js,ts}`);

	await importx(`${__dirname}/commands/**/*.{js,ts}`);


	// so everywhere in the code we can use client.db
	client.db = db;

	return client;
}



