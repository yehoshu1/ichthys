/**
 * Type stub for @/.source — the fumadocs-mdx generated directory.
 *
 * This directory is created at build time by the fumadocs-mdx Next.js plugin
 * (see src/dashboard/next.config.mjs → createMDX → outDir: ".source").
 *
 * The real types are generated during `next build` / `next dev`. This stub
 * satisfies `tsc --noEmit` in CI where the build hasn't run yet.
 */
declare module "@/.source" {
    import type { StaticSource } from "fumadocs-core/source";

    export const docs: {
        toFumadocsSource(): StaticSource;
    };
}
