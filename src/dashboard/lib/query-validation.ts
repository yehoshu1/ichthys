/**
 * Query Parameter Validation Utilities
 * 
 * Standardized validation for query parameters across API routes
 */

import { z } from "zod";
import { NextResponse } from "next/server";

// Common query parameter schemas
export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const dateRangeQuerySchema = z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
}).refine((data) => {
    if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
    }
    return true;
}, {
    message: "startDate must be before or equal to endDate",
});

export const searchQuerySchema = z.object({
    query: z.string().min(1).max(100).optional(),
});

export const sortQuerySchema = z.object({
    sortBy: z.string().max(50).optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Combined common query schema
export const commonQuerySchema = paginationQuerySchema
    .merge(dateRangeQuerySchema)
    .merge(searchQuerySchema)
    .merge(sortQuerySchema);

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type SortQuery = z.infer<typeof sortQuerySchema>;
export type CommonQuery = z.infer<typeof commonQuerySchema>;

/**
 * Parse and validate query parameters from URL
 */
export function parseQueryParams<T>(
    searchParams: URLSearchParams,
    schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; response: NextResponse } {
    const params: Record<string, unknown> = {};

    searchParams.forEach((value, key) => {
        // Try to parse as number first
        const numValue = Number(value);
        if (!isNaN(numValue) && value.trim() !== "" && !value.includes(" ")) {
            params[key] = numValue;
        } else if (value === "true") {
            params[key] = true;
        } else if (value === "false") {
            params[key] = false;
        } else {
            params[key] = value;
        }
    });

    const result = schema.safeParse(params);

    if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
        }));

        return {
            success: false,
            response: NextResponse.json(
                { error: "Invalid query parameters", details: errors },
                { status: 400 }
            ),
        };
    }

    return { success: true, data: result.data };
}

/**
 * Calculate offset from page and limit
 */
export function calculateOffset(page: number, limit: number): number {
    return (page - 1) * limit;
}

/**
 * Create pagination response metadata
 */
export function createPaginationMeta(params: {
    page: number;
    limit: number;
    total: number;
    itemCount: number;
}) {
    const { page, limit, total, itemCount } = params;
    const offset = calculateOffset(page, limit);
    const totalPages = Math.ceil(total / limit);

    return {
        page,
        limit,
        total,
        itemCount,
        totalPages,
        hasMore: offset + itemCount < total,
        hasPrevious: page > 1,
    };
}

/**
 * Sanitize search query string
 */
export function sanitizeSearchQuery(query: string): string {
    return query
        .trim()
        .slice(0, 100)
        .replace(/[<>]/g, ""); // Remove potential HTML tags
}

/**
 * Parse array parameter from query string
 * e.g., ?ids=1,2,3 becomes ["1", "2", "3"]
 */
export function parseArrayParam(
    value: string | null,
    options: { maxItems?: number; separator?: string } = {}
): string[] {
    const { maxItems = 25, separator = "," } = options;

    if (!value || value.trim() === "") {
        return [];
    }

    const items = value
        .split(separator)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

    return items.slice(0, maxItems);
}

/**
 * Validate Discord snowflake IDs in query params
 */
export function parseDiscordIdParam(value: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!/^\d{17,20}$/.test(trimmed)) return null;
    return trimmed;
}

/**
 * Parse multiple Discord IDs from query param
 */
export function parseDiscordIdsParam(
    value: string | null,
    maxItems = 25
): string[] {
    if (!value) return [];
    const ids = parseArrayParam(value, { maxItems, separator: "," });
    return ids.filter((id) => /^\d{17,20}$/.test(id));
}
