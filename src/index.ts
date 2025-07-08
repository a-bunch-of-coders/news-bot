import { Config, configSchema, ensureConfig} from "./impl/config";
import { join } from "path";

async function main() {

    // join(__dirname, "../config/config.jsonc")
    const path = join(__dirname, "../config/config.jsonc");

    const config = await ensureConfig(path);
    console.log("Configuration loaded successfully:", config);


}


(async() => {
    try {
        await main();
    } catch (error) {
        console.error("Error loading configuration:", error);
        process.exit(1);
    }

})();