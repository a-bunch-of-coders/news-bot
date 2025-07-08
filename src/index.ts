import { dirname, join } from 'path';

import { buildClient } from './client.js';
import { ensureConfig } from './config.js';
import { initSqliteDB as initDB } from './impl/db/index.js';
import { check } from './impl/scraper/index.js';

async function main() {

	// join(__dirname, "../config/config.jsonc")
	const path = join(import.meta.dirname, '../config/config.jsonc');
    // console.log('Loading configuration from:', path);

	const config = await ensureConfig(path);
	console.log('Configuration loaded successfully.');


	const db = await initDB(config);
	console.log('Database initialized successfully.');


	const client = await buildClient(db);
	console.log('Discord client built successfully:', client.user?.tag || 'No user logged in');


    // Start the periodic check
    setInterval(async () => {
        try {
            console.log('Starting periodic check...');
            await check(db, client);
            console.log('Periodic check completed successfully.');
        } catch (error) {
            console.error('Error during periodic check:', error);
        }
    }, config.bot.check_interval_minutes * 60 * 1000); // Convert minutes to milliseconds

    await client.login(config.bot.token);

    // start immediately
    await check(db, client);


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