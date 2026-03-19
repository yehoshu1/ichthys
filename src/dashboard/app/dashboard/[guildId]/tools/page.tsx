"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Clock, Copy, Check, Calendar } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "../../../../lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getUnixSeconds(date: Date): number {
    return Math.floor(date.getTime() / 1000);
}

/** Format a Date according to the given Discord timestamp style character */
function formatDiscord(date: Date, style: string): string {
    const opts: Intl.DateTimeFormatOptions = { timeZone: "UTC" };
    switch (style) {
        case "F":
            return date.toLocaleString("en-US", {
                ...opts,
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            });
        case "f":
            return date.toLocaleString("en-US", {
                ...opts,
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            });
        case "D":
            return date.toLocaleDateString("en-US", {
                ...opts,
                year: "numeric",
                month: "long",
                day: "numeric",
            });
        case "d":
            return date.toLocaleDateString("en-US", {
                ...opts,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
            });
        case "t":
            return date.toLocaleTimeString("en-US", {
                ...opts,
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            });
        case "T":
            return date.toLocaleTimeString("en-US", {
                ...opts,
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
            });
        case "R":
            return formatDistanceToNow(date, { addSuffix: true });
        case "s":
            return date.toLocaleString("en-US", {
                ...opts,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            });
        case "S":
            return date.toLocaleString("en-US", {
                ...opts,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
            });
        default:
            return "";
    }
}

const TIMESTAMP_FORMATS = [
    { style: "F", label: "Long Date/Time" },
    { style: "f", label: "Short Date/Time" },
    { style: "D", label: "Long Date" },
    { style: "d", label: "Short Date" },
    { style: "t", label: "Short Time" },
    { style: "T", label: "Long Time" },
    { style: "R", label: "Relative" },
    { style: "s", label: "Locale Short" },
    { style: "S", label: "Locale Long" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Copy Button
// ─────────────────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success("Copied to clipboard");
        } catch {
            toast.error("Failed to copy");
        }
    }, [text]);

    return (
        <button
            onClick={handleCopy}
            className={cn(
                "p-1.5 rounded transition-colors",
                copied
                    ? "text-green-400 bg-green-400/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
            title="Copy to clipboard"
        >
            {copied ? (
                <Check className="h-4 w-4" />
            ) : (
                <Copy className="h-4 w-4" />
            )}
        </button>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Format Row
// ─────────────────────────────────────────────────────────────────────────────

function FormatRow({
    style,
    unix,
    date,
}: {
    style: string;
    unix: number;
    date: Date;
}) {
    const code = `<t:${unix}:${style}>`;
    const preview = formatDiscord(date, style);

    return (
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-2.5 border-b last:border-0 border-border/50">
            <code className="text-sm font-mono text-primary bg-primary/10 px-2 py-0.5 rounded select-all whitespace-nowrap">
                {code}
            </code>
            <span className="text-sm font-medium text-foreground truncate">
                {preview}
            </span>
            <CopyButton text={code} />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function TimestampConverterPage() {
    // Local datetime string for the <input type="datetime-local">
    const [localInput, setLocalInput] = useState<string>(() => {
        const now = new Date();
        // Format as "YYYY-MM-DDThh:mm" for datetime-local
        return format(now, "yyyy-MM-dd'T'HH:mm");
    });
    const [date, setDate] = useState<Date>(() => new Date());
    const [unix, setUnix] = useState<number>(() =>
        getUnixSeconds(new Date())
    );
    // Ticker so :R updates every second
    const [, setTick] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    function handleInputChange(value: string) {
        setLocalInput(value);
        if (!value) return;
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
            setDate(parsed);
            setUnix(getUnixSeconds(parsed));
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Clock className="h-6 w-6 text-primary" />
                    Timestamp Converter
                </h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                    Generate Discord timestamp markdown that displays in each
                    user&apos;s local timezone. Copy and paste into Discord.
                </p>
            </div>

            {/* Input Card */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <input
                                type="datetime-local"
                                value={localInput}
                                onChange={(e) =>
                                    handleInputChange(e.target.value)
                                }
                                className={cn(
                                    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                                    "ring-offset-background placeholder:text-muted-foreground",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    "disabled:cursor-not-allowed disabled:opacity-50"
                                )}
                            />
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground text-sm shrink-0">
                            <Calendar className="h-4 w-4" />
                            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                                unix: {unix}
                            </span>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Times are interpreted in your browser&apos;s local
                        timezone.
                    </p>
                </CardContent>
            </Card>

            {/* Formats Card */}
            <Card>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-[auto_auto] gap-x-2 mb-3 text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        <span>Markdown</span>
                        <span>Preview</span>
                    </div>
                    <div>
                        {TIMESTAMP_FORMATS.map(({ style }) => (
                            <FormatRow
                                key={style}
                                style={style}
                                unix={unix}
                                date={date}
                            />
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Usage hint */}
            <Card className="border-dashed">
                <CardContent className="pt-4 pb-4">
                    <div className="flex gap-3 items-start">
                        <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="text-sm text-muted-foreground space-y-1">
                            <p>
                                <span className="font-medium text-foreground">
                                    How to use:
                                </span>{" "}
                                Copy any format above and paste it directly into
                                Discord. Discord will automatically display the
                                timestamp in each viewer&apos;s local timezone.
                            </p>
                            <p>
                                <span className="font-medium text-foreground">
                                    Bot command:
                                </span>{" "}
                                You can also use{" "}
                                <code className="bg-muted px-1 rounded text-xs">
                                    /timestamp
                                </code>{" "}
                                directly in Discord for a quick conversion.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
