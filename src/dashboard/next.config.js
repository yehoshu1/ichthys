/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ["discord.js"],
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
        return [
            {
                source: "/:path*",
                headers: [
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
                        key: "Referrer-Policy",
                        value: "strict-origin-when-cross-origin",
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

module.exports = nextConfig;
