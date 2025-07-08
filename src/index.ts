import './types'
import { join } from 'path';

import { buildClient } from './client';
import { ensureConfig } from './config';
import { initSqliteDB as initDB } from './impl/db';

async function main() {

	// join(__dirname, "../config/config.jsonc")
	const path = join(__dirname, '../config/config.jsonc');

	const config = await ensureConfig(path);
	console.log('Configuration loaded successfully:', config);


	const db = await initDB(config);
	console.log('Database initialized successfully:');


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