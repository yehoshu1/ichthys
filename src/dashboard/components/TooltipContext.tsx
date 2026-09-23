"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface TooltipContextType {
    tooltipsEnabled: boolean;
    setTooltipsEnabled: (enabled: boolean) => void;
}

const TooltipContext = createContext<TooltipContextType | undefined>(undefined);

const STORAGE_KEY = "ixoye-tooltips-enabled";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
    const [tooltipsEnabled, setTooltipsEnabled] = useState<boolean>(true);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Load preference from localStorage, default to true
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null) {
            setTooltipsEnabled(stored === "true");
        }
    }, []);

    const updateTooltipsEnabled = (enabled: boolean) => {
        setTooltipsEnabled(enabled);
        localStorage.setItem(STORAGE_KEY, String(enabled));
    };

    // Prevent hydration mismatch by rendering children only after mount
    if (!mounted) {
        return <>{children}</>;
    }

    return (
        <TooltipContext.Provider
            value={{
                tooltipsEnabled,
                setTooltipsEnabled: updateTooltipsEnabled,
            }}
        >
            {children}
        </TooltipContext.Provider>
    );
}

export function useTooltips() {
    const context = useContext(TooltipContext);
    if (context === undefined) {
        throw new Error("useTooltips must be used within a TooltipProvider");
    }
    return context;
}

export function useTooltipsEnabled() {
    const context = useContext(TooltipContext);
    if (context === undefined) {
        // Return default value if outside provider
        return true;
    }
    return context.tooltipsEnabled;
}
