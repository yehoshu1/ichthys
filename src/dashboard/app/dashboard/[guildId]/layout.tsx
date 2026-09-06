"use client";

import { useState, useEffect, useRef } from "react";

import { useSession, signOut } from "next-auth/react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
    LayoutDashboard,
    Hand,
    ShieldCheck,
    Star,
    Rocket,
    Zap,
    ScrollText,
    Settings,
    Search,
    LogOut,
    Menu,
    ChevronLeft,
    BookOpen,
    Bot,
    Loader2,
    Shield,
    Cake,
    MessageSquare,
    TerminalSquare,
    CalendarDays,
    BarChart3,
    Webhook,
    KeyRound,
    Eye,
    Clock,
    type LucideIcon,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import {
    Sheet,
    SheetContent,
    SheetTrigger,
    SheetClose,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "../../../components/ui/sheet";
import ThemeToggle from "../../../components/ThemeToggle";
import { toast } from "sonner";
import GlobalSearchModal from "../../../components/GlobalSearchModal";
import { DASHBOARD_NAV_ITEMS, DashboardNavId } from "../../../lib/search/dashboard-nav";
import type { SearchOpenMethod } from "../../../lib/search/telemetry";
import { RbacAccessProvider } from "../../../components/RbacAccessContext";
import { PageTransition } from "../../../components/PageTransition";

interface ModuleStateResponse {
    modules: Array<{
        moduleId: string;
        enabled: boolean;
    }>;
}

interface GuildInfoResponse {
    name?: string;
    iconUrl?: string | null;
    isBotMember?: boolean | null;
}

interface ModuleAccess {
    view: boolean;
    edit: boolean;
}

interface AccessResponse {
    isBypassUser: boolean;
    canManageRbac?: boolean;
    modules: Record<string, ModuleAccess>;
}

// Map from nav item IDs to RBAC module IDs (API path segment)
const NAV_TO_RBAC_MODULE: Partial<Record<DashboardNavId, string>> = {
    welcome: "welcome",
    verification: "verification",
    leveling: "leveling",
    boosts: "boosts",
    birthdays: "birthdays",
    "role-actions": "role-actions",
    aliases: "aliases",
    commands: "commands",
    moderation: "moderation",
    settings: "settings",
    webhooks: "webhooks",
    events: "events",
    polls: "polls",
    notifications: "notifications",
    overview: "analytics",
};

const navIconById: Record<DashboardNavId, LucideIcon> = {
    overview: LayoutDashboard,
    events: CalendarDays,
    polls: BarChart3,
    notifications: ScrollText,
    webhooks: Webhook,
    welcome: Hand,
    verification: ShieldCheck,
    leveling: Star,
    boosts: Rocket,
    birthdays: Cake,
    "role-actions": Zap,
    aliases: MessageSquare,
    commands: TerminalSquare,
    moderation: Shield,
    watchlist: Eye,
    tools: Clock,
    logs: ScrollText,
    settings: Settings,
    access: KeyRound,
    docs: BookOpen,
};

function mapNavItemToModuleId(item: { id: DashboardNavId; moduleSlug?: string }): string | null {
    if (item.id === "docs") return null;
    if (item.id === "overview") return "analytics";

    const slug = item.moduleSlug ?? item.id;
    return slug.replace(/-/g, "_");
}

function isNavItemEnabled(
    item: { id: DashboardNavId; moduleSlug?: string },
    moduleEnabledById: Record<string, boolean>
): boolean {
    const moduleId = mapNavItemToModuleId(item);
    if (!moduleId) return true;
    return moduleEnabledById[moduleId] ?? true;
}

function getNavHref(
    guildId: string,
    item: { id: DashboardNavId; href: string; moduleSlug?: string },
    moduleEnabledById: Record<string, boolean>
): string {
    if (isNavItemEnabled(item, moduleEnabledById)) {
        return `/dashboard/${guildId}${item.href}`;
    }

    const moduleId = mapNavItemToModuleId(item);
    return `/dashboard/${guildId}/settings${moduleId ? `?module=${moduleId}` : ""}`;
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { data: session } = useSession();
    const params = useParams();
    const pathname = usePathname();
    const router = useRouter();
    const guildId = params.guildId as string;
    const [guildName, setGuildName] = useState<string>("");
    const [guildIconUrl, setGuildIconUrl] = useState<string | null>(null);
    const [isBotMember, setIsBotMember] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchOpenMethod, setSearchOpenMethod] = useState<SearchOpenMethod>("unknown");
    const [moduleEnabledById, setModuleEnabledById] = useState<Record<string, boolean>>({});
    const [accessData, setAccessData] = useState<AccessResponse | null>(null);
    const fetchInProgress = useRef(false);

    const openSearch = (method: SearchOpenMethod): void => {
        setSearchOpenMethod(method);
        setSearchOpen(true);
    };

    const fetchGuildInfo = () => {
        if (fetchInProgress.current) return;
        fetchInProgress.current = true;
        
        setIsLoading(true);
        setFetchError(null);
        fetch(`/api/guilds/${guildId}`)
            .then(async (res) => {
                if (res.status === 404) {
                    // Bot not in server
                    console.warn("Bot not in guild, showing invite screen");
                    setIsBotMember(false);
                    return null;
                }
                if (res.status === 403) {
                    // User has no access
                    console.warn("User has no access to guild");
                    setFetchError("You don't have permission to access this server.");
                    return null;
                }
                if (res.status === 401) {
                    // Session expired
                    console.warn("Session expired, redirecting to guilds");
                    router.push("/guilds");
                    return null;
                }
                if (res.status === 429) {
                    // Rate limited
                    const retryAfter = res.headers.get('Retry-After') || '5';
                    console.warn("Rate limited, retry after:", retryAfter);
                    setFetchError(`Rate limited. Please wait ${retryAfter} seconds.`);
                    return null;
                }
                if (res.status === 503) {
                    // Service unavailable - check error message
                    const contentType = res.headers.get("content-type") || "";
                    let errorMessage = "Unable to connect to Discord. Please try again.";
                    let errorData: { error?: string } | null = null;

                    if (contentType.includes("application/json")) {
                        errorData = await res.json().catch(() => null);
                    } else {
                        const text = await res.text().catch(() => "");
                        if (text) errorMessage = text;
                    }

                    if (errorData?.error) errorMessage = errorData.error;
                    console.warn("Service unavailable:", errorData ?? errorMessage);

                    if (errorData?.error?.includes("Bot may not be in server")) {
                        // Bot not in server
                        setIsBotMember(false);
                        return null;
                    }
                    setFetchError(errorMessage);
                    return null;
                }
                if (!res.ok) {
                    const text = await res.text();
                    console.error("API Error:", res.status, text);
                    setFetchError(text || "Failed to fetch guild information");
                    return null;
                }
                return res.json() as Promise<GuildInfoResponse>;
            })
            .then(data => {
                if (!data) return; // Handled above (redirect or signout)
                if (data.name) setGuildName(data.name);
                setGuildIconUrl(data.iconUrl ?? null);
                setIsBotMember(data.isBotMember ?? null);
            })
            .catch(err => {
                console.error("Failed to fetch guild info:", err);
                setFetchError("Network error. Please check your connection.");
            })
            .finally(() => {
                setIsLoading(false);
                fetchInProgress.current = false;
            });
    };

    useEffect(() => {
        if (guildId) {
            fetchGuildInfo();
        }
    }, [guildId, router]);

    useEffect(() => {
        if (!guildId) return;

        fetch(`/api/guilds/${guildId}/modules`)
            .then(async (res) => {
                if (!res.ok) return null;
                return (await res.json()) as ModuleStateResponse;
            })
            .then((payload) => {
                if (!payload) return;
                const next: Record<string, boolean> = {};
                for (const entry of payload.modules) {
                    next[entry.moduleId] = entry.enabled;
                }
                setModuleEnabledById(next);
            })
            .catch(() => {
                // Keep navigation visible when module states cannot be fetched.
            });
    }, [guildId]);

    useEffect(() => {
        if (!guildId) return;

        fetch(`/api/guilds/${guildId}/me/access`)
            .then(async (res) => {
                if (!res.ok) return null;
                return (await res.json()) as AccessResponse;
            })
            .then((payload) => {
                if (payload) setAccessData(payload);
            })
            .catch((err: unknown) => {
                // Non-fatal: keep all nav items visible if access data cannot be fetched.
                console.warn("Failed to fetch RBAC access data:", err);
            });
    }, [guildId]);

    function isNavItemVisible(item: { id: DashboardNavId }): boolean {
        // Access Control is for users who can manage RBAC: bypass users
        // (owner/admin) and Manage-Guild users. Hidden until confirmed.
        if (item.id === "access") {
            if (accessData?.canManageRbac !== undefined) {
                return accessData.canManageRbac;
            }
            return accessData?.isBypassUser === true;
        }
        // Bypass users and unresolved access: show everything else.
        if (!accessData || accessData.isBypassUser) return true;
        // Find the RBAC module ID for this nav item (O(1) lookup).
        const rbacModuleId = NAV_TO_RBAC_MODULE[item.id];
        if (!rbacModuleId) return true; // No RBAC mapping → always visible
        return accessData.modules[rbacModuleId]?.view ?? false;
    }

    const navItems = DASHBOARD_NAV_ITEMS.filter(isNavItemVisible);

    // Show Loading State (Prevents dashboard content from rendering prematurely)
    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Show Invite Screen if bot is not in guild (and check is done)
    if (!isLoading && isBotMember === false) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground p-4">
                <div className="mx-auto flex w-full max-w-[400px] flex-col items-center justify-center space-y-6 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                        <Bot className="h-10 w-10 text-primary" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold tracking-tight">Connect Bot</h1>
                        <p className="text-muted-foreground">
                            The bot is not in <strong>{guildName || "this server"}</strong> yet.
                            Please invite it to continue.
                        </p>
                    </div>

                    <div className="flex flex-col gap-4 w-full">
                        <Button
                            size="lg"
                            className="w-full"
                            onClick={() => {
                                const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
                                // Fallback or prompt if ID is missing, but typically it should be there.
                                // Note: We need NEXT_PUBLIC_DISCORD_CLIENT_ID in .env
                                if (!clientId) {
                                    toast.error("Client ID not configured in environment variables.");
                                    return;
                                }
                                window.open(
                                    `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`,
                                    '_blank'
                                );
                            }}
                        >
                            Invite Bot to Server
                        </Button>
                        <Button variant="outline" onClick={() => router.push("/guilds")}>
                            Back to Servers
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // New: Handle Indeterminate Error State
    // If not loading and isBotMember is NULL, it means the API fetch failed (but not 404/403/401 which are handled above)
    // We should show an error instead of rendering the dashboard.
    if (!isLoading && (isBotMember === null || fetchError)) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground p-4">
                <div className="space-y-4 text-center">
                    <h2 className="text-xl font-bold">Failed to load server info</h2>
                    <p className="text-muted-foreground">
                        {fetchError || "Could not verify bot membership status."}
                    </p>
                    <div className="flex gap-2 justify-center">
                        <div className="flex flex-col gap-2">
                            <Button onClick={fetchGuildInfo}>Retry</Button>
                            <Button variant="ghost" onClick={() => router.push("/guilds")}>Back to Servers</Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            {/* Desktop Sidebar (hidden on mobile) */}
            <aside className="fixed inset-y-0 left-0 z-40 hidden md:flex w-64 flex-col border-r bg-card">
                <div className="flex h-16 items-center border-b px-6">
                    <Link href="/" className="hover:opacity-80 transition-opacity">
                        <h1 className="text-2xl font-bold">
                            <span className="text-primary">Ixoye</span> Dashboard
                        </h1>
                    </Link>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                    <nav className="space-y-1 px-4 py-6">
                        <div className="px-3 mb-2 text-xs font-semibold uppercase text-muted-foreground">
                            Menu
                        </div>
                        {navItems.map((item) => {
                            const ItemIcon = navIconById[item.id];
                            const enabled = isNavItemEnabled(item, moduleEnabledById);
                            const href = getNavHref(guildId, item, moduleEnabledById);
                            const targetHref = `/dashboard/${guildId}${item.href}`;
                            const isActive = item.href === ""
                                ? pathname === targetHref
                                : pathname.startsWith(targetHref);

                            return (
                                <Link
                                    key={item.name}
                                    href={href}
                                    className={cn(
                                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                                        isActive ? "bg-secondary text-foreground" : "text-muted-foreground",
                                        !enabled && "opacity-70"
                                    )}
                                >
                                    <ItemIcon className="h-4 w-4" />
                                    <span className="flex-1">{item.name}</span>
                                    {!enabled && (
                                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                            Off
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div className="border-t p-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2 mb-4"
                        onClick={() => router.push("/guilds")}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Back to Servers
                    </Button>

                    <div className="flex items-center gap-3 px-2">
                        {session?.user?.image ? (
                            <Image
                                src={session.user.image}
                                alt="Avatar"
                                width={36}
                                height={36}
                                className="rounded-full border"
                            />
                        ) : (
                            <div className="h-9 w-9 rounded-full bg-muted border flex items-center justify-center">
                                <span className="text-xs font-medium">{session?.user?.name?.[0]}</span>
                            </div>
                        )}
                        <div className="flex-1 overflow-hidden">
                            <div className="truncate text-sm font-medium">
                                {session?.user?.name}
                            </div>
                            <button
                                onClick={() => signOut()}
                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-0.5"
                            >
                                <LogOut className="h-3 w-3" />
                                Log out
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            {/* Added md:ml-64 for desktop offset, no offset on mobile */}
            <div className="flex flex-1 flex-col md:ml-64 min-w-0">
                {/* Header */}
                <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-4 md:px-8 backdrop-blur">
                    <div className="flex items-center gap-2 text-sm">
                        {/* Mobile Menu Trigger */}
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="md:hidden mr-2">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-64 p-0 flex flex-col">
                                <SheetHeader className="sr-only">
                                    <SheetTitle>Navigation menu</SheetTitle>
                                    <SheetDescription>
                                        Navigate between dashboard sections for this server.
                                    </SheetDescription>
                                </SheetHeader>
                                <div className="flex h-16 items-center border-b px-6">
                                    <h1 className="text-2xl font-bold">
                                        <span className="text-primary">Ixoye</span> Dashboard
                                    </h1>
                                </div>
                                <div className="flex-1 overflow-y-auto min-h-0">
                                    <nav className="space-y-1 px-4 py-6">
                                        {navItems.map((item) => {
                                            const ItemIcon = navIconById[item.id];
                                            const enabled = isNavItemEnabled(item, moduleEnabledById);
                                            const href = getNavHref(guildId, item, moduleEnabledById);
                                            const targetHref = `/dashboard/${guildId}${item.href}`;
                                            const isActive = item.href === ""
                                                ? pathname === targetHref
                                                : pathname.startsWith(targetHref);

                                            return (
                                                <SheetClose asChild key={item.name}>
                                                    <Link
                                                        href={href}
                                                        className={cn(
                                                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                                                            isActive ? "bg-secondary text-foreground" : "text-muted-foreground",
                                                            !enabled && "opacity-70"
                                                        )}
                                                    >
                                                        <ItemIcon className="h-4 w-4" />
                                                        <span className="flex-1">{item.name}</span>
                                                        {!enabled && (
                                                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                                                Off
                                                            </span>
                                                        )}
                                                    </Link>
                                                </SheetClose>
                                            );
                                        })}
                                    </nav>
                                </div>
                                <div className="border-t p-4 shrink-0">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start gap-2 mb-4"
                                        onClick={() => router.push("/guilds")}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Back to Servers
                                    </Button>
                                    <div className="flex items-center gap-3 px-2">
                                        {session?.user?.image ? (
                                            <Image
                                                src={session.user.image}
                                                alt="Avatar"
                                                width={36}
                                                height={36}
                                                className="rounded-full border"
                                            />
                                        ) : (
                                            <div className="h-9 w-9 rounded-full bg-muted border flex items-center justify-center">
                                                <span className="text-xs font-medium">{session?.user?.name?.[0]}</span>
                                            </div>
                                        )}
                                        <div className="flex-1 overflow-hidden">
                                            <div className="truncate text-sm font-medium">
                                                {session?.user?.name}
                                            </div>
                                            <button
                                                onClick={() => signOut()}
                                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-0.5"
                                            >
                                                <LogOut className="h-3 w-3" />
                                                Log out
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>

                        <div className="hidden md:flex items-center gap-2">
                            <span className="text-muted-foreground">Dashboard</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="font-medium">{guildName || guildId}</span>
                            {!isLoading && isBotMember === false && (
                                <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                                    Bot Missing
                                </span>
                            )}
                        </div>
                        {/* Mobile Title (visible when desktop breadcrumbs are hidden) */}
                        <span className="font-medium md:hidden">{guildName || "Dashboard"}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative hidden sm:block">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search settings, features, docs..."
                                aria-label="Search dashboard"
                                className="w-[180px] cursor-pointer pr-20 pl-9 md:w-[320px]"
                                readOnly
                                onClick={() => openSearch("click")}
                                onFocus={() => openSearch("focus")}
                            />
                            <span className="pointer-events-none absolute right-2.5 top-2.5 text-[11px] text-muted-foreground">
                                Ctrl/Cmd+K
                            </span>
                        </div>
                        {/* Mobile Search Icon (optional, just visual for now) */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="sm:hidden"
                            onClick={() => openSearch("mobile_button")}
                            aria-label="Open global search"
                        >
                            <Search className="h-5 w-5" />
                        </Button>
                        <ThemeToggle />
                        {guildIconUrl ? (
                            <Image
                                src={guildIconUrl}
                                alt={`${guildName || guildId} icon`}
                                width={36}
                                height={36}
                                className="h-9 w-9 rounded-full border object-cover"
                            />
                        ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full border bg-muted text-xs font-semibold uppercase text-muted-foreground">
                                {(guildName || guildId).slice(0, 1)}
                            </div>
                        )}
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto min-h-0">
                    <main className="p-4 md:p-8">
                        <div className="mx-auto max-w-6xl">
                            <RbacAccessProvider
                                isBypassUser={accessData?.isBypassUser ?? true}
                                modules={accessData?.modules ?? {}}
                            >
                                <PageTransition>
                                    {children}
                                </PageTransition>
                            </RbacAccessProvider>
                        </div>
                    </main>
                </div>
            </div>

            <GlobalSearchModal
                context={{ mode: "dashboard", guildId }}
                open={searchOpen}
                onOpenChange={(nextOpen) => {
                    setSearchOpen(nextOpen);
                    if (!nextOpen) {
                        setSearchOpenMethod("unknown");
                    }
                }}
                enableShortcut
                openMethod={searchOpenMethod}
            />
        </div>
    );
}
