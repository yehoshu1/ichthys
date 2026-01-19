import { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

export const authOptions: NextAuthOptions = {
    providers: [
        DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID!,
            clientSecret: process.env.DISCORD_CLIENT_SECRET!,
            authorization: { params: { scope: "identify guilds" } },
        }),
    ],
    session: {
        strategy: "jwt",
    },
    // Debug logging to verify env vars are loaded
    logger: {
        error(code, ...message) {
            console.error(code, ...message);
        },
        warn(code, ...message) {
            console.warn(code, ...message);
        },
        debug(code, ...message) {
            console.log(code, ...message);
        },
    },
    callbacks: {
        async signIn() {
            return true;
        },
        async session({ session, token }) {
            console.log("[AUTH] Session callback - token.accessToken:", token.accessToken ? "EXISTS" : "MISSING");
            if (session.user) {
                (session.user as any).id = token.sub;
            }
            (session as any).accessToken = token.accessToken;
            console.log("[AUTH] Session callback - session.accessToken:", (session as any).accessToken ? "EXISTS" : "MISSING");
            return session;
        },
        async jwt({ token, account, user, profile }) {
            const fs = require('fs');
            // Log when a sign-in event happens (account is only present on sign-in)
            if (account) {
                try {
                    fs.appendFileSync('debug_auth.txt', `[${new Date().toISOString()}] SIGN-IN: Account keys: ${Object.keys(account).join(', ')}\n`);
                    fs.appendFileSync('debug_auth.txt', `[${new Date().toISOString()}] SIGN-IN: Access Token: ${!!account.access_token}\n`);
                } catch (e) { console.error("Log error", e) }
                token.accessToken = account.access_token;
            }

            try {
                fs.appendFileSync('debug_auth.txt', `[${new Date().toISOString()}] JWT: Token accessToken: ${!!token.accessToken}\n`);
            } catch (e) { console.error("Log error", e) }
            return token;
        },
    },

    secret: process.env.NEXTAUTH_SECRET,
};
