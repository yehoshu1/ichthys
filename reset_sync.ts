
import { db } from "./src/shared/database/client";
import { guildConfig } from "./src/shared/database/schema";
import { sql } from "drizzle-orm";

async function resetSync() {
    try {
        console.log("Resetting lastMemberSync to NULL for all guilds...");
        await db.update(guildConfig).set({ lastMemberSync: null });
        console.log("Done.");
    } catch (e) {
        console.error(e);
    }
}
resetSync();
