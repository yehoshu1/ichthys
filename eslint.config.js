const nextCoreWebVitals = require("eslint-config-next/core-web-vitals");
const nextTypescript = require("eslint-config-next/typescript");

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
    {
        ignores: ["src/dashboard/.source/**", "src/dashboard/.next/**"],
    },
    ...nextCoreWebVitals,
    ...nextTypescript,
    {
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-require-imports": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "@typescript-eslint/no-empty-object-type": "off",
            "prefer-const": "warn",
            "react/no-unescaped-entities": "warn",
            "react-hooks/set-state-in-effect": "off",
            "react-hooks/immutability": "off",
            "react-hooks/purity": "off",
        },
    },
];
