export type DashboardNavId =
    | "overview"
    | "events"
    | "polls"
    | "notifications"
    | "webhooks"
    | "welcome"
    | "verification"
    | "leveling"
    | "boosts"
    | "birthdays"
    | "role-actions"
    | "aliases"
    | "commands"
    | "moderation"
    | "watchlist"
    | "tools"
    | "logs"
    | "settings"
    | "access"
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
    { id: "events", name: "Events", href: "/events", moduleSlug: "events", keywords: ["event", "rsvp", "calendar", "schedule", "meetup", "reminder", "recurring"] },
    { id: "polls", name: "Polls", href: "/polls", moduleSlug: "polls", keywords: ["poll", "vote", "survey", "time poll", "anonymous vote", "when2meet"] },
    { id: "tools", name: "Timestamp", href: "/tools", keywords: ["timestamp", "discord timestamp", "time", "converter", "unix", "timezone", "tools"] },
    { id: "notifications", name: "Logs", href: "/notifications", moduleSlug: "notifications", keywords: ["logs", "alerts", "inbox", "unread", "delivery", "preferences", "activity"] },
    { id: "welcome", name: "Welcome", href: "/welcome", moduleSlug: "welcome", keywords: ["join", "leave", "templates", "triggers", "welcome card", "welcome image", "custom welcome", "new member"] },
    { id: "verification", name: "Verification", href: "/verification", moduleSlug: "verification", keywords: ["unverified", "kick", "grace days", "verify"] },
    { id: "leveling", name: "Leveling", href: "/leveling", moduleSlug: "leveling", keywords: ["xp", "rank", "rewards", "leaderboard"] },
    { id: "boosts", name: "Boosts", href: "/boosts", moduleSlug: "boosts", keywords: ["booster", "nitro", "reward role"] },
    { id: "birthdays", name: "Birthdays", href: "/birthdays", moduleSlug: "birthdays", keywords: ["birthday", "celebration", "timezone"] },
    { id: "role-actions", name: "Role Actions", href: "/role-actions", moduleSlug: "role-actions", keywords: ["automation", "role add", "role remove"] },
    { id: "aliases", name: "Aliases", href: "/aliases", moduleSlug: "aliases", keywords: ["auto responder", "trigger", "alias"] },
    { id: "commands", name: "Commands", href: "/commands", moduleSlug: "settings-backups", keywords: ["command config", "aliases", "limits", "access"] },
    { id: "moderation", name: "Moderation", href: "/moderation", moduleSlug: "moderation", keywords: ["warn", "ban", "mute", "automod"] },
    { id: "watchlist", name: "Watchlist", href: "/watchlist", moduleSlug: "moderation", keywords: ["watchlist", "watch", "suspicious", "monitor", "flag", "tracking"] },
    { id: "settings", name: "Settings", href: "/settings", moduleSlug: "settings-backups", keywords: ["import", "export", "backup", "restore"] },
    { id: "access", name: "Access Control", href: "/settings/access", keywords: ["rbac", "roles", "permissions", "delegate", "access control"] },
    { id: "webhooks", name: "Webhooks & API", href: "/webhooks", moduleSlug: "webhooks", keywords: ["webhook", "api", "integration", "endpoint", "automation"] },
    { id: "docs", name: "Documentation", href: "/docs", keywords: ["guides", "docs", "help"] },
];
