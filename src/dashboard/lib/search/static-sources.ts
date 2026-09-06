import { modules, setupSections, slashCommands } from "@/lib/docs-content";
import { DASHBOARD_NAV_ITEMS, DashboardNavItem } from "./dashboard-nav";
import { toCommandAnchor, toSearchSlug } from "./slug";
import { SearchContext, SearchEntry } from "./types";

function getDashboardHref(item: DashboardNavItem, guildId: string): string {
    return `/dashboard/${guildId}${item.href}`;
}

function getDocsFallbackHref(item: DashboardNavItem): string {
    if (item.id === "docs" || item.id === "overview") return "/docs";
    if (item.id === "commands") return "/docs/commands";
    if (item.moduleSlug) return `/docs/modules/${item.moduleSlug}`;
    return "/docs";
}

function getFeatureHref(item: DashboardNavItem, context: SearchContext): string {
    if (context.mode === "dashboard" && context.guildId) {
        return getDashboardHref(item, context.guildId);
    }
    return getDocsFallbackHref(item);
}

function createFeatureEntries(context: SearchContext): SearchEntry[] {
    return DASHBOARD_NAV_ITEMS.map((item, index) => ({
        id: `feature:${item.id}`,
        source: "feature",
        title: item.name,
        description: `Open ${item.name}`,
        href: getFeatureHref(item, context),
        keywords: [item.name, ...item.keywords],
        priority: 100 - index,
    }));
}

function createDocsEntries(): SearchEntry[] {
    const baseEntries: SearchEntry[] = [
        {
            id: "docs:overview",
            source: "docs",
            title: "Docs Overview",
            description: "User documentation home",
            href: "/docs",
            keywords: ["docs", "overview", "guides"],
            priority: 82,
        },
        {
            id: "docs:setup",
            source: "docs",
            title: "Getting Started",
            description: "User setup sequence and onboarding checklist",
            href: "/docs/getting-started",
            keywords: ["setup", "getting started", "onboarding"],
            priority: 81,
        },
        {
            id: "docs:commands",
            source: "docs",
            title: "Bot Commands Docs",
            description: "Command catalog with options and examples",
            href: "/docs/commands",
            keywords: ["commands", "slash commands", "reference"],
            priority: 80,
        },
        {
            id: "docs:modules",
            source: "docs",
            title: "Feature Guides",
            description: "Module-by-module documentation",
            href: "/docs/modules",
            keywords: ["modules", "features", "guides"],
            priority: 79,
        },
    ];

    const moduleEntries: SearchEntry[] = modules.map((moduleDoc, index) => ({
        id: `docs:module:${moduleDoc.slug}`,
        source: "docs",
        title: moduleDoc.title,
        description: moduleDoc.summary,
        href: `/docs/modules/${moduleDoc.slug}`,
        keywords: [
            moduleDoc.slug,
            moduleDoc.title,
            ...moduleDoc.commandRefs,
            ...moduleDoc.tables,
            ...moduleDoc.runtimeRefs,
        ],
        priority: 70 - index,
    }));

    const commandEntries: SearchEntry[] = slashCommands.map((commandDoc, index) => ({
        id: `docs:command:${toSearchSlug(commandDoc.command)}`,
        source: "docs",
        title: commandDoc.command,
        description: commandDoc.description,
        href: `/docs/commands#${toCommandAnchor(commandDoc.command)}`,
        keywords: [
            commandDoc.command,
            commandDoc.permission,
            commandDoc.category,
            ...commandDoc.examples,
            ...commandDoc.options.map((option) => option.name),
        ],
        priority: 60 - Math.floor(index / 5),
    }));

    const setupEntries: SearchEntry[] = setupSections.map((section, index) => ({
        id: `docs:setup:${index}`,
        source: "docs",
        title: section.title,
        description: section.bullets?.[0] ?? section.commands?.[0] ?? "Setup guidance",
        href: "/docs/getting-started",
        keywords: [
            section.title,
            ...(section.bullets ?? []),
            ...(section.commands ?? []),
        ],
        priority: 50 - index,
    }));

    return [...baseEntries, ...moduleEntries, ...commandEntries, ...setupEntries];
}

export function buildStaticSearchEntries(context: SearchContext): SearchEntry[] {
    return [...createFeatureEntries(context), ...createDocsEntries()];
}
