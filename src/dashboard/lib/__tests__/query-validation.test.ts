import { describe, it, expect } from "vitest";
import {
    paginationQuerySchema,
    dateRangeQuerySchema,
    parseQueryParams,
    calculateOffset,
    createPaginationMeta,
    sanitizeSearchQuery,
    parseArrayParam,
    parseDiscordIdParam,
    parseDiscordIdsParam,
} from "../query-validation";

describe("query-validation", () => {
    describe("paginationQuerySchema", () => {
        it("should validate valid pagination params", () => {
            const result = paginationQuerySchema.parse({ page: 2, limit: 25 });
            expect(result).toEqual({ page: 2, limit: 25 });
        });

        it("should apply defaults", () => {
            const result = paginationQuerySchema.parse({});
            expect(result).toEqual({ page: 1, limit: 50 });
        });

        it("should reject invalid page numbers", () => {
            expect(() => paginationQuerySchema.parse({ page: 0 })).toThrow();
            expect(() => paginationQuerySchema.parse({ page: -1 })).toThrow();
        });

        it("should reject limit over 100", () => {
            expect(() => paginationQuerySchema.parse({ limit: 101 })).toThrow();
        });
    });

    describe("dateRangeQuerySchema", () => {
        it("should validate valid date range", () => {
            const start = new Date("2024-01-01");
            const end = new Date("2024-12-31");
            const result = dateRangeQuerySchema.parse({ startDate: start, endDate: end });
            expect(result.startDate).toEqual(start);
            expect(result.endDate).toEqual(end);
        });

        it("should reject endDate before startDate", () => {
            const start = new Date("2024-12-31");
            const end = new Date("2024-01-01");
            expect(() => dateRangeQuerySchema.parse({ startDate: start, endDate: end })).toThrow();
        });
    });

    describe("parseQueryParams", () => {
        it("should parse and validate query params", () => {
            const searchParams = new URLSearchParams("page=2&limit=25");
            const result = parseQueryParams(searchParams, paginationQuerySchema);
            
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual({ page: 2, limit: 25 });
            }
        });

        it("should return error for invalid params", () => {
            const searchParams = new URLSearchParams("page=invalid");
            const result = parseQueryParams(searchParams, paginationQuerySchema);
            
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.response.status).toBe(400);
            }
        });
    });

    describe("calculateOffset", () => {
        it("should calculate correct offset", () => {
            expect(calculateOffset(1, 10)).toBe(0);
            expect(calculateOffset(2, 10)).toBe(10);
            expect(calculateOffset(5, 25)).toBe(100);
        });
    });

    describe("createPaginationMeta", () => {
        it("should create correct pagination metadata", () => {
            const meta = createPaginationMeta({ page: 2, limit: 10, total: 45, itemCount: 10 });
            
            expect(meta.page).toBe(2);
            expect(meta.limit).toBe(10);
            expect(meta.total).toBe(45);
            expect(meta.totalPages).toBe(5);
            expect(meta.hasMore).toBe(true);
            expect(meta.hasPrevious).toBe(true);
        });

        it("should detect last page", () => {
            const meta = createPaginationMeta({ page: 5, limit: 10, total: 45, itemCount: 5 });
            expect(meta.hasMore).toBe(false);
        });

        it("should detect first page", () => {
            const meta = createPaginationMeta({ page: 1, limit: 10, total: 45, itemCount: 10 });
            expect(meta.hasPrevious).toBe(false);
        });
    });

    describe("sanitizeSearchQuery", () => {
        it("should remove HTML tags", () => {
            expect(sanitizeSearchQuery("<script>alert(1)</script>search")).toBe("scriptalert(1)/scriptsearch");
        });

        it("should trim whitespace", () => {
            expect(sanitizeSearchQuery("  search term  ")).toBe("search term");
        });

        it("should limit length to 100 characters", () => {
            const longQuery = "a".repeat(150);
            expect(sanitizeSearchQuery(longQuery).length).toBe(100);
        });
    });

    describe("parseArrayParam", () => {
        it("should parse comma-separated values", () => {
            const result = parseArrayParam("a,b,c");
            expect(result).toEqual(["a", "b", "c"]);
        });

        it("should handle empty values", () => {
            expect(parseArrayParam("")).toEqual([]);
            expect(parseArrayParam(null)).toEqual([]);
        });

        it("should respect maxItems", () => {
            const result = parseArrayParam("1,2,3,4,5", { maxItems: 3 });
            expect(result).toEqual(["1", "2", "3"]);
        });

        it("should trim whitespace", () => {
            const result = parseArrayParam("  a  ,  b  ,  c  ");
            expect(result).toEqual(["a", "b", "c"]);
        });
    });

    describe("parseDiscordIdParam", () => {
        it("should validate valid Discord IDs", () => {
            expect(parseDiscordIdParam("123456789012345678")).toBe("123456789012345678");
            expect(parseDiscordIdParam("12345678901234567890")).toBe("12345678901234567890");
        });

        it("should reject invalid IDs", () => {
            expect(parseDiscordIdParam("123")).toBeNull();
            expect(parseDiscordIdParam("not-an-id")).toBeNull();
            expect(parseDiscordIdParam("123456789012345678901")).toBeNull(); // Too long
        });

        it("should handle null/empty", () => {
            expect(parseDiscordIdParam(null)).toBeNull();
            expect(parseDiscordIdParam("")).toBeNull();
        });
    });

    describe("parseDiscordIdsParam", () => {
        it("should parse valid Discord IDs", () => {
            const result = parseDiscordIdsParam("123456789012345678,123456789012345679");
            expect(result).toEqual(["123456789012345678", "123456789012345679"]);
        });

        it("should filter invalid IDs", () => {
            const result = parseDiscordIdsParam("123456789012345678,invalid,123456789012345679");
            expect(result).toEqual(["123456789012345678", "123456789012345679"]);
        });

        it("should respect maxItems", () => {
            const ids = Array(30).fill("123456789012345678").join(",");
            const result = parseDiscordIdsParam(ids);
            expect(result.length).toBe(25);
        });
    });
});
