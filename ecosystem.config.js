module.exports = {
    apps: [
        {
            name: "ixoye-bot",
            script: "./dist/index.js",
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
