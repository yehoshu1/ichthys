module.exports = {
    apps: [
        {
            name: "ixoye-bot",
            script: "./dist/bot/index.js",
            interpreter: "node",
            env: {
                NODE_ENV: "production",
            },
        },
        {
            name: "ixoye-dashboard",
            script: "npm",
            args: "run dashboard:start",
            env: {
                NODE_ENV: "production",
            },
        },
    ],
};
