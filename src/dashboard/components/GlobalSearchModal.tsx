"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "./ui/command";
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

    return (
        <CommandDialog 
            open={open} 
            onOpenChange={onOpenChange}
            commandProps={{ shouldFilter: false }}
        >
            <CommandInput
                placeholder="Search settings, features, docs..."
                value={query}
                onValueChange={setQuery}
            />
            {warning && (
                <div className="mx-4 mt-4 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-200">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{warning}</span>
                </div>
            )}
            <CommandList>
                {loading && (
                    <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Building search index...
                    </div>
                )}
                {!loading && groupedResults.length === 0 && (
                    <CommandEmpty>No results found for "{query}".</CommandEmpty>
                )}
                {!loading &&
                    groupedResults.map((group) => (
                        <CommandGroup key={group.source} heading={`${group.label} (${group.items.length})`}>
                            {group.items.map((entry) => (
                                <CommandItem
                                    key={entry.id}
                                    value={entry.id}
                                    onSelect={() => navigateToEntry(entry, "keyboard")}
                                    className="flex flex-col items-start gap-1 py-3"
                                >
                                    <div className="flex w-full items-start justify-between gap-2">
                                        <div className="font-medium">{entry.title}</div>
                                        <span className="text-[10px] text-muted-foreground">{entry.href}</span>
                                    </div>
                                    {entry.description && (
                                        <div className="line-clamp-2 text-xs text-muted-foreground">
                                            {entry.description}
                                        </div>
                                    )}
                                    {entry.valuePreview && (
                                        <div className="line-clamp-1 text-xs text-muted-foreground/90">
                                            Value: {entry.valuePreview}
                                        </div>
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    ))}
            </CommandList>
        </CommandDialog>
    );
}
