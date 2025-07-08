import { ensureConfig } from './config';
import { buildClient } from './client';


import { initPostgresDB } from './impl/db';

import { join } from 'path';

async function main() {

	// join(__dirname, "../config/config.jsonc")
	const path = join(__dirname, '../config/config.jsonc');

	const config = await ensureConfig(path);
	console.log('Configuration loaded successfully:', config);


	const db = await initPostgresDB(config);
	console.log('Database initialized successfully:', db);


	const client = await buildClient(config, db);
	console.log('Discord client built successfully:', client.user?.tag || 'No user logged in');


}


(async () => {
	try {
		await main();
	}
	catch (error) {
		console.error('Error loading configuration:', error);
		process.exit(1);
	}

})();