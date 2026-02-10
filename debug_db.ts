
import { db } from "./src/shared/database/client";
import { guildConfig, userJoin } from "./src/shared/database/schema";
import { count } from "drizzle-orm";

async function run() {
    try {
        console.log("--- Guild Config ---");
        const configs = await db.select().from(guildConfig);
        console.log(JSON.stringify(configs, null, 2));

        console.log("\n--- User Joins Count ---");
        const joinCount = await db.select({ count: count() }).from(userJoin);
        console.log(joinCount);
    } catch (e) {
        console.error(e);
    }
}

run();
