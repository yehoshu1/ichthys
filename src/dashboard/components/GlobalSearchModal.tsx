"use client";

import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import {
    hashSearchQuery,
    normalizeSearchQuery,
    SearchOpenMethod,
    trackSearchOpen,
    trackSearchQuery,
    trackSearchSelect,
} from "@/lib/search/telemetry";
import {
    SearchContext,
    SearchEntry,
    buildSearchIndex,
    groupSearchResults,
    querySearchEntries,
} from "@/lib/search";

const RESULTS_LIMIT = 40;
const QUERY_DEBOUNCE_MS = 80;

interface GlobalSearchModalProps {
    context: SearchContext;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    enableShortcut?: boolean;
    openMethod?: SearchOpenMethod;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedValue(value);
        }, delayMs);

        return () => window.clearTimeout(timer);
    }, [value, delayMs]);

    return debouncedValue;
}

export default function GlobalSearchModal({
    context,
    open,
    onOpenChange,
    enableShortcut = false,
    openMethod = "unknown",
}: GlobalSearchModalProps) {
    const router = useRouter();
    const [allEntries, setAllEntries] = useState<SearchEntry[]>([]);
    const [warning, setWarning] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(-1);
    const reportedQueryHashesRef = useRef(new Set<string>());
    const openTelemetrySentRef = useRef(false);
    const shortcutOpenedRef = useRef(false);
    const debouncedQuery = useDebouncedValue(query, QUERY_DEBOUNCE_MS);

    useEffect(() => {
        if (!enableShortcut) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                shortcutOpenedRef.current = true;
                onOpenChange(true);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [enableShortcut, onOpenChange]);

    useEffect(() => {
        if (!open) return;

        let cancelled = false;
        setLoading(true);
        setWarning(null);
        setQuery("");
        setActiveIndex(-1);
        reportedQueryHashesRef.current.clear();
        openTelemetrySentRef.current = false;

        void buildSearchIndex(context)
            .then((result) => {
                if (cancelled) return;
                setAllEntries(result.entries);
                setWarning(result.warning ?? null);
            })
            .finally(() => {
                if (cancelled) return;
                setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open, context.mode, context.guildId]);

    const results = useMemo(
        () => querySearchEntries(allEntries, debouncedQuery, RESULTS_LIMIT),
        [allEntries, debouncedQuery]
    );

    const groupedResults = useMemo(() => groupSearchResults(results), [results]);

    const resultIndexById = useMemo(() => {
        const map = new Map<string, number>();
        results.forEach((entry, index) => map.set(entry.id, index));
        return map;
    }, [results]);

    useEffect(() => {
        if (!open) return;
        setActiveIndex(results.length > 0 ? 0 : -1);
    }, [open, results]);

    useEffect(() => {
        if (!open || loading || openTelemetrySentRef.current) return;

        const trigger = shortcutOpenedRef.current ? "shortcut" : openMethod;
        trackSearchOpen(context, {
            trigger,
            indexSize: allEntries.length,
        });
        openTelemetrySentRef.current = true;
        shortcutOpenedRef.current = false;
    }, [open, loading, openMethod, context, allEntries.length]);

    useEffect(() => {
        if (!open || loading) return;

        const normalizedQuery = normalizeSearchQuery(debouncedQuery);
        if (normalizedQuery.length < 2) return;

        const queryHash = hashSearchQuery(normalizedQuery);
        if (reportedQueryHashesRef.current.has(queryHash)) return;

        reportedQueryHashesRef.current.add(queryHash);

        const topSources = Array.from(new Set(results.map((entry) => entry.source))).slice(0, 3);
        trackSearchQuery(context, {
            queryHash,
            queryLength: normalizedQuery.length,
            tokenCount: normalizedQuery.split(" ").length,
            resultCount: results.length,
            topSources,
        });
    }, [open, loading, debouncedQuery, context, results]);

    useEffect(() => {
        if (open) return;
        reportedQueryHashesRef.current.clear();
        openTelemetrySentRef.current = false;
        shortcutOpenedRef.current = false;
    }, [open]);

    const navigateToEntry = (entry: SearchEntry, selectionMethod: "mouse" | "keyboard"): void => {
        const normalizedQuery = normalizeSearchQuery(query);
        const selectedRank = (resultIndexById.get(entry.id) ?? 0) + 1;

        trackSearchSelect(context, {
            entry,
            rank: selectedRank,
            selectionMethod,
            resultCount: results.length,
            queryHash: normalizedQuery.length > 0 ? hashSearchQuery(normalizedQuery) : undefined,
        });

        onOpenChange(false);
        router.push(entry.href);
    };

    const handleArrowNavigation = (direction: 1 | -1): void => {
        if (results.length === 0) return;
        setActiveIndex((previousIndex) => {
            const safeIndex = previousIndex < 0 ? 0 : previousIndex;
            const nextIndex = (safeIndex + direction + results.length) % results.length;
            return nextIndex;
        });
    };

    const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            handleArrowNavigation(1);
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            handleArrowNavigation(-1);
            return;
        }

        if (event.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
            event.preventDefault();
            navigateToEntry(results[activeIndex], "keyboard");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl p-0">
                <DialogHeader className="border-b px-6 pb-4 pt-6">
                    <DialogTitle>Global Search</DialogTitle>
                    <DialogDescription>
                        Search settings, features, and docs{context.mode === "dashboard" ? " for this guild" : ""}.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 p-6">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={handleInputKeyDown}
                            className="pl-9"
                            placeholder="Search settings, features, docs..."
                            aria-label="Global search input"
                            autoFocus
                        />
                    </div>

                    {warning && (
                        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-200">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{warning}</span>
                        </div>
                    )}

                    <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-2">
                        {loading && (
                            <div className="flex items-center gap-2 rounded-md border px-3 py-3 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Building search index...
                            </div>
                        )}

                        {!loading && groupedResults.length === 0 && (
                            <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                                No results found for "{query}".
                            </div>
                        )}

                        {!loading && groupedResults.map((group) => (
                            <section key={group.source} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        {group.label}
                                    </h3>
                                    <Badge variant="secondary" className="text-[10px]">
                                        {group.items.length}
                                    </Badge>
                                </div>

                                <div className="space-y-1">
                                    {group.items.map((entry) => {
                                        const entryIndex = resultIndexById.get(entry.id) ?? -1;
                                        const isActive = entryIndex === activeIndex;

                                        return (
                                            <button
                                                key={entry.id}
                                                type="button"
                                                onClick={() => navigateToEntry(entry, "mouse")}
                                                onMouseEnter={() => setActiveIndex(entryIndex)}
                                                className={cn(
                                                    "w-full rounded-md border px-3 py-2 text-left transition-colors",
                                                    isActive
                                                        ? "border-primary bg-primary/10"
                                                        : "hover:border-primary/40 hover:bg-muted/40"
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="space-y-0.5">
                                                        <div className="text-sm font-medium">{entry.title}</div>
                                                        {entry.description && (
                                                            <p className="line-clamp-2 text-xs text-muted-foreground">
                                                                {entry.description}
                                                            </p>
                                                        )}
                                                        {entry.valuePreview && (
                                                            <p className="line-clamp-1 text-xs text-muted-foreground/90">
                                                                Value: {entry.valuePreview}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span className="text-[11px] text-muted-foreground">
                                                        {entry.href}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
