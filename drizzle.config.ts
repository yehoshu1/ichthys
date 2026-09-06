import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error(
        'DATABASE_URL environment variable is required.\n' +
        'Set it in your .env file or pass it directly:\n' +
        '  DATABASE_URL=postgresql://user:pass@host:5432/dbname'
    );
}

export default defineConfig({
    schema: './src/shared/database/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        url: databaseUrl,
    },
});
