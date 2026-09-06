"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "./ui/button";
import GlobalSearchModal from "./GlobalSearchModal";
import { SearchOpenMethod } from "@/lib/search/telemetry";

export default function DocsSearchTrigger() {
    const [open, setOpen] = useState(false);
    const [openMethod, setOpenMethod] = useState<SearchOpenMethod>("unknown");

    return (
        <>
            <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                    setOpenMethod("docs_button");
                    setOpen(true);
                }}
                aria-label="Open global search"
            >
                <Search className="h-4 w-4" />
                Search
                <span className="text-xs text-muted-foreground">Ctrl/Cmd+K</span>
            </Button>

            <GlobalSearchModal
                context={{ mode: "docs" }}
                open={open}
                onOpenChange={(nextOpen) => {
                    setOpen(nextOpen);
                    if (!nextOpen) {
                        setOpenMethod("unknown");
                    }
                }}
                enableShortcut
                openMethod={openMethod}
            />
        </>
    );
}
