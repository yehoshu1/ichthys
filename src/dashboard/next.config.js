/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ["discord.js"], // Just in case we import shared code that needs transpiling
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
};

module.exports = nextConfig;
