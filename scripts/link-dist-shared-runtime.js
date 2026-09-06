#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function removeIfExists(targetPath) {
    if (!fs.existsSync(targetPath)) {
        return;
    }

    const stat = fs.lstatSync(targetPath);
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
        return;
    }

    fs.unlinkSync(targetPath);
}

function main() {
    const repoRoot = process.cwd();
    const distDir = path.join(repoRoot, 'dist');
    const sharedDir = path.join(distDir, 'shared');
    const nodeModulesDir = path.join(distDir, 'node_modules');
    const scopeDir = path.join(nodeModulesDir, '@shared');
    const relativeTarget = path.relative(nodeModulesDir, sharedDir);

    if (!fs.existsSync(sharedDir)) {
        console.error(`Shared dist directory not found: ${sharedDir}`);
        process.exit(1);
    }

    ensureDir(nodeModulesDir);
    removeIfExists(scopeDir);

    fs.symlinkSync(relativeTarget, scopeDir, 'dir');
    console.log(`Linked ${scopeDir} -> ${relativeTarget}`);
}

main();
