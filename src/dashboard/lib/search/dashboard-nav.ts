export type DashboardNavId =
    | "overview"
    | "welcome"
    | "verification"
    | "leveling"
    | "boosts"
    | "birthdays"
    | "reaction-roles"
    | "role-actions"
    | "aliases"
    | "commands"
    | "moderation"
    | "logs"
    | "settings"
    | "docs";

export interface DashboardNavItem {
    id: DashboardNavId;
    name: string;
    href: string;
    moduleSlug?: string;
    keywords: string[];
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
    { id: "overview", name: "Overview", href: "", moduleSlug: "analytics", keywords: ["home", "summary", "analytics"] },
    { id: "welcome", name: "Welcome", href: "/welcome", moduleSlug: "welcome", keywords: ["join", "leave", "templates", "triggers"] },
    { id: "verification", name: "Verification", href: "/verification", moduleSlug: "verification", keywords: ["unverified", "kick", "grace days", "verify"] },
    { id: "leveling", name: "Leveling", href: "/leveling", moduleSlug: "leveling", keywords: ["xp", "rank", "rewards", "leaderboard"] },
    { id: "boosts", name: "Boosts", href: "/boosts", moduleSlug: "boosts", keywords: ["booster", "nitro", "reward role"] },
    { id: "birthdays", name: "Birthdays", href: "/birthdays", moduleSlug: "birthdays", keywords: ["birthday", "celebration", "timezone"] },
    { id: "reaction-roles", name: "Reaction Roles", href: "/reaction-roles", moduleSlug: "reaction-roles", keywords: ["emoji", "self role", "message reactions"] },
    { id: "role-actions", name: "Role Actions", href: "/role-actions", moduleSlug: "role-actions", keywords: ["automation", "role add", "role remove"] },
    { id: "aliases", name: "Aliases", href: "/aliases", moduleSlug: "aliases", keywords: ["auto responder", "trigger", "alias"] },
    { id: "commands", name: "Commands", href: "/commands", moduleSlug: "settings-backups", keywords: ["command config", "aliases", "limits", "access"] },
    { id: "moderation", name: "Moderation", href: "/moderation", moduleSlug: "moderation", keywords: ["warn", "ban", "mute", "automod"] },
    { id: "logs", name: "Logs", href: "/logs", moduleSlug: "logs", keywords: ["audit", "history", "action log"] },
    { id: "settings", name: "Settings", href: "/settings", moduleSlug: "settings-backups", keywords: ["import", "export", "backup", "restore"] },
    { id: "docs", name: "Documentation", href: "/docs", keywords: ["guides", "docs", "help"] },
];
