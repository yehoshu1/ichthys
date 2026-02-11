import { describe, it, expect } from "vitest";
import {
    escapeHtml,
    sanitizeMessageContent,
    sanitizeEmbedData,
    sanitizeTrigger,
    containsSpamPatterns,
} from "../sanitize";

describe("sanitize", () => {
    describe("escapeHtml", () => {
        it("should escape HTML special characters", () => {
            expect(escapeHtml("<script>alert('xss')</script>"))
                .toBe("&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;");
        });

        it("should escape ampersands", () => {
            expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
        });

        it("should escape quotes", () => {
            expect(escapeHtml('"quoted"')).toBe("&quot;quoted&quot;");
        });
    });

    describe("sanitizeMessageContent", () => {
        it("should remove script tags", () => {
            const input = "Hello <script>alert('xss')</script> World";
            expect(sanitizeMessageContent(input)).toBe("Hello  World");
        });

        it("should remove iframe tags", () => {
            const input = "<iframe src='evil.com'></iframe>Content";
            expect(sanitizeMessageContent(input)).toBe("Content");
        });

        it("should remove javascript: protocol", () => {
            const input = "Click <a href='javascript:alert(1)'>here</a>";
            expect(sanitizeMessageContent(input)).toBe("Click <a href=''>here</a>");
        });

        it("should remove event handlers", () => {
            const input = "<div onclick='alert(1)'>Click</div>";
            expect(sanitizeMessageContent(input)).toBe("<div>Click</div>");
        });

        it("should handle null/undefined input", () => {
            expect(sanitizeMessageContent("")).toBe("");
            expect(sanitizeMessageContent(null as unknown as string)).toBe("");
            expect(sanitizeMessageContent(undefined as unknown as string)).toBe("");
        });

        it("should trim content to max length", () => {
            const longContent = "a".repeat(3000);
            const result = sanitizeMessageContent(longContent);
            expect(result.length).toBe(2000);
        });
    });

    describe("sanitizeEmbedData", () => {
        it("should sanitize embed text fields", () => {
            const embed = {
                title: "<script>alert(1)</script>Title",
                description: "<iframe>Description</iframe>",
                url: "https://example.com",
            };
            const result = sanitizeEmbedData(embed);
            expect(result?.title).toBe("Title");
            expect(result?.description).toBe("Description");
            expect(result?.url).toBe("https://example.com");
        });

        it("should handle nested objects", () => {
            const embed = {
                title: "Title",
                footer: {
                    text: "<script>alert(1)</script>Footer",
                },
            };
            const result = sanitizeEmbedData(embed);
            expect((result?.footer as Record<string, unknown>)?.text).toBe("Footer");
        });

        it("should return null for null/undefined input", () => {
            expect(sanitizeEmbedData(null)).toBeNull();
            expect(sanitizeEmbedData(undefined)).toBeNull();
        });
    });

    describe("sanitizeTrigger", () => {
        it("should remove control characters", () => {
            expect(sanitizeTrigger("test\x00\x01word")).toBe("testword");
        });

        it("should trim whitespace", () => {
            expect(sanitizeTrigger("  test  ")).toBe("test");
        });

        it("should limit length to 50 characters", () => {
            const longTrigger = "a".repeat(100);
            expect(sanitizeTrigger(longTrigger).length).toBe(50);
        });

        it("should handle empty input", () => {
            expect(sanitizeTrigger("")).toBe("");
            expect(sanitizeTrigger(null as unknown as string)).toBe("");
        });
    });

    describe("containsSpamPatterns", () => {
        it("should detect repeated characters", () => {
            expect(containsSpamPatterns("aaaaaaaaaaaaaa")).toBe(true);
            expect(containsSpamPatterns("hello world")).toBe(false);
        });

        it("should detect extremely long URLs", () => {
            const longUrl = "https://example.com/" + "a".repeat(600);
            expect(containsSpamPatterns(longUrl)).toBe(true);
        });

        it("should detect zero-width characters", () => {
            expect(containsSpamPatterns("test\u200Bword")).toBe(true);
            expect(containsSpamPatterns("test\u200Cword")).toBe(true);
            expect(containsSpamPatterns("test\u200Dword")).toBe(true);
        });

        it("should return false for normal content", () => {
            expect(containsSpamPatterns("Hello world! This is normal text.")).toBe(false);
        });
    });
});
