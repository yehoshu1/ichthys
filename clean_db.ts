
import { db } from "./src/shared/database/client";
import { userJoin } from "./src/shared/database/schema";
import { sql } from "drizzle-orm";

async function clean() {
    try {
        console.log("Cleaning user_join table...");
        await db.delete(userJoin);
        console.log("Done.");
    } catch (e) {
        console.error(e);
    }
}
clean();
