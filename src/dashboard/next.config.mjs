import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createMDX } from "fumadocs-mdx/next";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// `next dev src/dashboard` loads env files from `src/dashboard` by default.
// Load repo-root env files so dashboard and bot share the same local config.
const nodeEnv = process.env.NODE_ENV || "development";
const rootDir = path.resolve(__dirname, "../..");
const envCandidates = [
    `.env.${nodeEnv}.local`,
    ".env.local",
    `.env.${nodeEnv}`,
    ".env",
];

const dashboardEnvAllowlist = new Set([
    "DATABASE_URL",
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    "DISCORD_TOKEN",
    "LOG_LEVEL",
    "METRICS_TOKEN",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
    "NEXT_PUBLIC_DISCORD_CLIENT_ID",
    "NODE_ENV",
    "REDIS_URL",
]);

for (const file of envCandidates) {
    const envPath = path.join(rootDir, file);
    if (fs.existsSync(envPath)) {
        const parsed = dotenv.parse(fs.readFileSync(envPath));
        for (const [key, value] of Object.entries(parsed)) {
            if (!dashboardEnvAllowlist.has(key)) {
                continue;
            }
            if (process.env[key] === undefined) {
                process.env[key] = value;
            }
        }
    }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ["discord.js"],
    typescript: {
        ignoreBuildErrors: process.env.SKIP_NEXT_TYPECHECK === "1",
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "cdn.discordapp.com",
                pathname: "/**",
            },
            {
                protocol: "https",
                hostname: "media.discordapp.net",
                pathname: "/**",
            },
        ],
    },
    // Experimental features
    experimental: {
        // Server Actions configuration
        serverActions: {
            bodySizeLimit: "1mb",
        },
    },

    // Headers (applied to all routes)
    async headers() {
        const contentSecurityPolicy = [
            "default-src 'self'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "img-src 'self' data: https://cdn.discordapp.com https://media.discordapp.net",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "font-src 'self' data:",
            "connect-src 'self' https://discord.com https://discordapp.com https://cdn.discordapp.com",
        ].join("; ");

        return [
            {
                source: "/:path*",
                headers: [
                    {
                        key: "Content-Security-Policy",
                        value: contentSecurityPolicy,
                    },
                    {
                        key: "X-DNS-Prefetch-Control",
                        value: "on",
                    },
                    {
                        key: "Strict-Transport-Security",
                        value: "max-age=31536000; includeSubDomains; preload",
                    },
                    {
                        key: "X-Content-Type-Options",
                        value: "nosniff",
                    },
                    {
                        key: "X-Frame-Options",
                        value: "DENY",
                    },
                    {
                        key: "Referrer-Policy",
                        value: "strict-origin-when-cross-origin",
                    },
                    {
                        key: "Permissions-Policy",
                        value: "interest-cohort=()",
                    },
                    {
                        key: "Cache-Control",
                        value: "no-store",
                    },
                ],
            },
            {
                // Disable indexing for dashboard routes
                source: "/dashboard/:path*",
                headers: [
                    {
                        key: "X-Robots-Tag",
                        value: "noindex, nofollow",
                    },
                ],
            },
        ];
    },

    // Redirects
    async redirects() {
        return [
            // Redirect /dashboard to /guilds if no guild selected
            {
                source: "/dashboard",
                destination: "/guilds",
                permanent: false,
            },
        ];
    },

    // Webpack configuration
    webpack: (config, { isServer }) => {
        // Exclude native modules from client bundle
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                net: false,
                tls: false,
                crypto: false,
            };
        }
        return config;
    },
};

const withMDX = createMDX({
    configPath: path.resolve(__dirname, "source.config.ts"),
    outDir: path.resolve(__dirname, ".source"),
});

export default withMDX(nextConfig);
