module.exports = {
    apps: [
        {
            name: "ixoye-bot",
            script: "./dist/bot/index.js",
            interpreter: "node",
            max_memory_restart: process.env.BOT_MAX_MEMORY_RESTART || "700M",
            env: {
                NODE_ENV: "production",
            },
        },
        {
            name: "ixoye-dashboard",
            script: "npm",
            args: "run dashboard:start",
            max_memory_restart: process.env.DASHBOARD_MAX_MEMORY_RESTART || "900M",
            env: {
                NODE_ENV: "production",
            },
        },
    ],
};
