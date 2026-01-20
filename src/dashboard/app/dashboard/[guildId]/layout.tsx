"use client";

import { useState, useEffect } from "react";

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
    Bell,
    Search,
    LogOut,
    Menu,
    ChevronLeft,
    BookOpen,
    Bot,
    Loader2
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "../../../components/ui/sheet";
import ThemeToggle from "../../../components/ThemeToggle";

const navItems = [
    { name: "Overview", href: "", icon: LayoutDashboard },
    { name: "Welcome", href: "/welcome", icon: Hand },
    { name: "Verification", href: "/verification", icon: ShieldCheck },
    { name: "Leveling", href: "/leveling", icon: Star },
    { name: "Boosts", href: "/boosts", icon: Rocket },
    { name: "Role Actions", href: "/role-actions", icon: Zap },
    { name: "Logs", href: "/logs", icon: ScrollText },
    { name: "Settings", href: "/settings", icon: Settings },
    { name: "Documentation", href: "/docs", icon: BookOpen },
];

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
    const [isBotMember, setIsBotMember] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const fetchGuildInfo = () => {
        setIsLoading(true);
        setFetchError(null);
        fetch(`/api/guilds/${guildId}`)
            .then(async (res) => {
                if (res.status === 404 || res.status === 403) {
                    // API returned 404/403, likely because the bot isn't in the server
                    // and the user token couldn't access guild details (not a member/scope issue).
                    // Instead of redirecting, we assume the bot is not connected and show the invite screen.
                    console.warn("Guild not found/access denied. Assuming bot is not present.");
                    setIsBotMember(false);
                    // We might not have the name, so we use a fallback or keep empty
                    // The UI handles missing name gracefully?
                    return null;
                }
                if (res.status === 401) {
                    // Session exists but token is missing/invalid
                    // Redirect to guilds instead of signing out to prevent infinite loop
                    console.warn("Access token missing or invalid, redirecting to guilds");
                    router.push("/guilds");
                    return null;
                }
                if (res.status === 503) {
                    // Service unavailable - temporary issue
                    setFetchError("Unable to connect to Discord. Please try again.");
                    return null;
                }
                if (!res.ok) {
                    // Check for text payload
                    const text = await res.text();
                    console.error("API Error:", res.status, text);
                    setFetchError(text || "Failed to fetch guild information");
                    return null;
                }
                return res.json();
            })
            .then(data => {
                if (!data) return; // Handled above (redirect or signout)
                if (data.name) setGuildName(data.name);
                setIsBotMember(data.isBotMember);
            })
            .catch(err => {
                console.error("Failed to fetch guild info:", err);
                setFetchError("Network error. Please check your connection.");
            })
            .finally(() => setIsLoading(false));
    };

    useEffect(() => {
        if (guildId) {
            fetchGuildInfo();
        }
    }, [guildId, router]);

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
                                    alert("Client ID not configured in environment variables.");
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
                        <h1 className="text-xl font-bold">
                            <span className="text-primary">Ixoye</span> Dashboard
                        </h1>
                    </Link>
                </div>

                <nav className="flex-1 space-y-1 px-4 py-6">
                    <div className="px-3 mb-2 text-xs font-semibold uppercase text-muted-foreground">
                        Menu
                    </div>
                    {navItems.map((item) => {
                        const href = `/dashboard/${guildId}${item.href}`;
                        const isActive = item.href === ""
                            ? pathname === href
                            : pathname.startsWith(href);

                        return (
                            <Link
                                key={item.name}
                                href={href}
                                className={cn(
                                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                                    isActive ? "bg-secondary text-foreground" : "text-muted-foreground"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

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
                            <SheetContent side="left" className="w-64 p-0">
                                <div className="flex h-16 items-center border-b px-6">
                                    <h1 className="text-xl font-bold">
                                        <span className="text-primary">Ixoye</span> Dashboard
                                    </h1>
                                </div>
                                <nav className="space-y-1 px-4 py-6">
                                    {navItems.map((item) => {
                                        const href = `/dashboard/${guildId}${item.href}`;
                                        const isActive = item.href === ""
                                            ? pathname === href
                                            : pathname.startsWith(href);

                                        return (
                                            <SheetClose asChild key={item.name}>
                                                <Link
                                                    href={href}
                                                    className={cn(
                                                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                                                        isActive ? "bg-secondary text-foreground" : "text-muted-foreground"
                                                    )}
                                                >
                                                    <item.icon className="h-4 w-4" />
                                                    {item.name}
                                                </Link>
                                            </SheetClose>
                                        );
                                    })}
                                </nav>
                                <div className="absolute bottom-0 left-0 right-0 border-t p-4">
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
                                placeholder="Search..."
                                aria-label="Search dashboard"
                                className="w-[150px] md:w-[250px] pl-9"
                            />
                        </div>
                        {/* Mobile Search Icon (optional, just visual for now) */}
                        <Button variant="ghost" size="icon" className="sm:hidden">
                            <Search className="h-5 w-5" />
                        </Button>
                        <ThemeToggle />
                        <Button variant="ghost" size="icon">
                            <Bell className="h-5 w-5" />
                        </Button>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="mx-auto max-w-6xl">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
