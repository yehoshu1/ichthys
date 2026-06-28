"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, AlertTriangle, AlertOctagon, Info, CheckCircle2, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface NotificationItem {
    id: string;
    eventType: string;
    severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
    source: string;
    title: string;
    body: string | null;
    occurrenceCount: number;
    occurredAt: string;
    unread: boolean;
}

interface NotificationsResponse {
    items: NotificationItem[];
    nextCursor: string | null;
}

const POLL_INTERVAL_MS = 30_000;

const severityConfig: Record<NotificationItem["severity"], { icon: React.ElementType; className: string }> = {
    INFO: { icon: Info, className: "text-sky-600" },
    WARNING: { icon: AlertTriangle, className: "text-amber-600" },
    ERROR: { icon: AlertTriangle, className: "text-rose-600" },
    CRITICAL: { icon: AlertOctagon, className: "text-red-700" },
};

export default function GuildNotificationBell({ guildId }: { guildId: string }) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);

    const unreadInList = useMemo(() => items.filter((item) => item.unread).length, [items]);

    const fetchUnreadCount = useCallback(async () => {
        try {
            const response = await fetch(`/api/guilds/${guildId}/notifications/unread-count`, {
                cache: "no-store",
            });
            if (!response.ok) {
                return;
            }
            const data = await response.json();
            setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
        } catch {
            // Ignore polling errors for badge count.
        }
    }, [guildId]);

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/guilds/${guildId}/notifications?limit=20`, {
                cache: "no-store",
            });

            if (!response.ok) {
                setError("Failed to load notifications.");
                return;
            }

            const data = await response.json() as NotificationsResponse;
            setItems(data.items ?? []);
        } catch {
            setError("Failed to load notifications.");
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    const markAllRead = useCallback(async () => {
        setUpdating(true);
        try {
            const response = await fetch(`/api/guilds/${guildId}/notifications/read`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ markAll: true }),
            });
            if (response.ok) {
                setItems((current) => current.map((item) => ({ ...item, unread: false })));
                setUnreadCount(0);
            }
        } finally {
            setUpdating(false);
        }
    }, [guildId]);

    const markOneRead = useCallback(async (notificationId: string) => {
        setItems((current) => current.map((item) => item.id === notificationId ? { ...item, unread: false } : item));

        try {
            await fetch(`/api/guilds/${guildId}/notifications/read`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notificationIds: [notificationId] }),
            });
        } finally {
            void fetchUnreadCount();
        }
    }, [fetchUnreadCount, guildId]);

    useEffect(() => {
        void fetchUnreadCount();
        const timer = setInterval(() => {
            void fetchUnreadCount();
        }, POLL_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [fetchUnreadCount]);

    useEffect(() => {
        if (!open) return;
        void fetchNotifications();
    }, [fetchNotifications, open]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open notifications" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[360px] p-0">
                <div className="border-b px-3 py-2">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">Notifications</div>
                        <div className="flex items-center gap-2">
                            {unreadInList > 0 && <Badge variant="secondary">{unreadInList} unread</Badge>}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={updating || unreadInList === 0}
                                onClick={() => void markAllRead()}
                            >
                                {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Mark all read"}
                            </Button>
                        </div>
                    </div>
                </div>

                <ScrollArea className="max-h-[420px] p-2">
                    <div className="flex flex-col gap-2">
                    {loading && (
                        <div className="flex items-center justify-center py-8 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                    )}

                    {!loading && error && (
                        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    {!loading && !error && items.length === 0 && (
                        <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                            <CheckCircle2 className="h-5 w-5" />
                            <p className="text-sm">No notifications yet.</p>
                        </div>
                    )}

                    {!loading && !error && items.length > 0 && (
                        <div className="space-y-1">
                            {items.map((item) => {
                                const config = severityConfig[item.severity] ?? severityConfig.INFO;
                                const SeverityIcon = config.icon;

                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                            if (item.unread) {
                                                void markOneRead(item.id);
                                            }
                                        }}
                                        className={cn(
                                            "w-full rounded-md border px-2.5 py-2 text-left transition-colors",
                                            item.unread ? "bg-accent/60 border-primary/20" : "bg-background hover:bg-accent/30"
                                        )}
                                    >
                                        <div className="flex items-start gap-2">
                                            <SeverityIcon className={cn("mt-0.5 h-4 w-4 shrink-0", config.className)} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-sm font-medium leading-5">{item.title}</p>
                                                    {item.unread && <span className="mt-1 h-2 w-2 rounded-full bg-primary" />}
                                                </div>
                                                {item.body && (
                                                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                                        {item.body}
                                                    </p>
                                                )}
                                                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                                                    <span>{formatDistanceToNow(new Date(item.occurredAt), { addSuffix: true })}</span>
                                                    {item.occurrenceCount > 1 && <span>repeated x{item.occurrenceCount}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}

