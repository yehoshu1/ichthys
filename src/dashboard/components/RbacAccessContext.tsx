"use client";

import React, { createContext, useContext } from "react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Lock } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ModuleAccess {
    view: boolean;
    edit: boolean;
}

export interface RbacAccessContextValue {
    /** True when the user is an owner / admin / manage-guild and skips RBAC. */
    isBypassUser: boolean;
    /**
     * Per-module access map keyed by RBAC module ID (the API path segment,
     * e.g. "welcome", "role-actions", "analytics").
     */
    modules: Record<string, ModuleAccess>;
    /**
     * Returns the access object for the given module, defaulting to full access
     * when the context has not been loaded yet (safe fallback).
     */
    getAccess: (moduleId: string) => ModuleAccess;
}

const DEFAULT_FULL_ACCESS: ModuleAccess = { view: true, edit: true };

// ─── Context ───────────────────────────────────────────────────────────────────

const RbacAccessContext = createContext<RbacAccessContextValue>({
    isBypassUser: true,
    modules: {},
    getAccess: () => DEFAULT_FULL_ACCESS,
});

// ─── Provider ──────────────────────────────────────────────────────────────────

interface RbacAccessProviderProps {
    isBypassUser: boolean;
    modules: Record<string, ModuleAccess>;
    children: React.ReactNode;
}

export function RbacAccessProvider({ isBypassUser, modules, children }: RbacAccessProviderProps) {
    function getAccess(moduleId: string): ModuleAccess {
        if (isBypassUser) return DEFAULT_FULL_ACCESS;
        return modules[moduleId] ?? { view: false, edit: false };
    }

    return (
        <RbacAccessContext.Provider value={{ isBypassUser, modules, getAccess }}>
            {children}
        </RbacAccessContext.Provider>
    );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useRbacAccess(moduleId?: string) {
    const ctx = useContext(RbacAccessContext);
    if (moduleId) {
        return { ...ctx, access: ctx.getAccess(moduleId) };
    }
    return { ...ctx, access: DEFAULT_FULL_ACCESS };
}

// ─── Read-Only Banner ──────────────────────────────────────────────────────────

/**
 * Renders an informational banner when the user has view-only access to a
 * module.  Hides itself when the user has edit access.
 */
export function ReadOnlyBanner({ moduleId }: { moduleId: string }) {
    const { access } = useRbacAccess(moduleId);
    if (access.edit) return null;

    return (
        <Alert className="mb-4">
            <Lock className="h-4 w-4" />
            <AlertTitle>Read-only access</AlertTitle>
            <AlertDescription>
                You have view-only access to this module. Contact your server owner to request edit
                permissions.
            </AlertDescription>
        </Alert>
    );
}
