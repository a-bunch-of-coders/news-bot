import { dirname, importx, isESM } from "@discordx/importer";
import { IntentsBitField } from "discord.js";
import { Client } from "discordx";

import type { Database } from "./impl/db/abstract.js";


// basic.
function isTypeScriptRuntime(): boolean {
	const entry = process.argv[1] ?? "";
	return entry.endsWith(".ts");
}

export async function buildClient(db: Database): Promise<Client> {




	const client = new Client({
		intents: [
			IntentsBitField.Flags.Guilds,
			IntentsBitField.Flags.GuildMessages,
			IntentsBitField.Flags.GuildMembers,
		],
		silent: false,
	});

	client.on("ready", () => {
		console.log(">> Bot started");

		// to create/update/delete discord application commands
		client.initApplicationCommands().catch((error: unknown) => {
			console.error(">> Failed to initialize application commands:", error);
		}).finally(() => {
			console.log(">> Application commands initialized");
		});


	});
	client.on("interactionCreate", (interaction) => {
		client.executeInteraction(interaction);
	});

	// imports 
	const folder = isESM() ? dirname(import.meta.url) : __dirname;
	const extension = isTypeScriptRuntime() ? "{js,ts}" : "js";
	const cmdsFull = `${folder}/commands/**/*.${extension}`;

	await importx(cmdsFull);
	console.log(`>> Importing commands from ${cmdsFull}`);


	const eventsFull = `${folder}/events/**/*.${extension}`;
	await importx(eventsFull);
	console.log(`>> Importing events from ${eventsFull}`);


	// so everywhere in the code we can use client.db
	client.db = db;

	return client;
}



