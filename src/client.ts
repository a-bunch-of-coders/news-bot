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

	client.on("ready", async () => {
		console.log(">> Bot started");

		// to create/update/delete discord application commands
		await client.initApplicationCommands();


	});
	client.on("interactionCreate", (interaction) => {
		client.executeInteraction(interaction);
	});
	const folder = isESM() ? dirname(import.meta.url) : __dirname;
	const extension = isTypeScriptRuntime() ? "{js,ts}" : "js";
    const full = `${folder}/commands/**/*.${extension}`;

	await importx(full);
	console.log(`>> Importing commands from ${full}`);

	// so everywhere in the code we can use client.db
	client.db = db;

	return client;
}



