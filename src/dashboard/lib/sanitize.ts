/**
 * Input Sanitization Utilities
 * 
 * Provides functions to sanitize user input and prevent XSS attacks.
 * Used for message content, templates, and other user-generated content.
 */

const SCRIPT_TAG_PATTERN = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const DISALLOWED_TAG_PATTERN = /<\/?(iframe|object|embed|meta|link)\b[^>]*>/gi;
const JS_PROTOCOL_ATTR_PATTERN = /\b(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi;
const JS_PROTOCOL_ATTR_UNQUOTED_PATTERN = /\b(href|src)\s*=\s*javascript:[^\s>]+/gi;
const EVENT_HANDLER_ATTR_PATTERN = /\s+on\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi;

// HTML entities to escape in text content
const HTML_ENTITIES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
};

/**
 * Escape HTML entities in text
 */
export function escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Sanitize message content by removing dangerous HTML/script tags
 * while preserving safe formatting characters
 */
export function sanitizeMessageContent(content: string): string {
    if (!content || typeof content !== "string") {
        return "";
    }
    
    let sanitized = content;

    sanitized = sanitized.replace(SCRIPT_TAG_PATTERN, "");
    sanitized = sanitized.replace(DISALLOWED_TAG_PATTERN, "");
    sanitized = sanitized.replace(JS_PROTOCOL_ATTR_PATTERN, "$1=$2$2");
    sanitized = sanitized.replace(JS_PROTOCOL_ATTR_UNQUOTED_PATTERN, '$1=""');
    sanitized = sanitized.replace(EVENT_HANDLER_ATTR_PATTERN, "");
    
    // Remove null bytes
    sanitized = sanitized.replace(/\x00/g, "");
    
    // Trim excessive whitespace
    sanitized = sanitized.trim();
    
    // Limit length (Discord has 2000 char limit for messages)
    const MAX_LENGTH = 2000;
    if (sanitized.length > MAX_LENGTH) {
        sanitized = sanitized.slice(0, MAX_LENGTH);
    }
    
    return sanitized;
}

/**
 * Sanitize Discord embed data
 */
export function sanitizeEmbedData(embed: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
    if (!embed || typeof embed !== "object") {
        return null;
    }
    
    const sanitized: Record<string, unknown> = {};
    
    // Sanitize text fields
    const textFields = ["title", "description", "url", "timestamp", "footer", "image", "thumbnail"];
    const MAX_FIELD_LENGTHS: Record<string, number> = {
        title: 256,
        description: 4096,
        url: 2048,
    };
    
    for (const [key, value] of Object.entries(embed)) {
        if (typeof value === "string") {
            const maxLength = MAX_FIELD_LENGTHS[key] || 2000;
            let sanitizedValue = sanitizeMessageContent(value);
            if (sanitizedValue.length > maxLength) {
                sanitizedValue = sanitizedValue.slice(0, maxLength);
            }
            sanitized[key] = sanitizedValue;
        } else if (typeof value === "object" && value !== null) {
            // Recursively sanitize nested objects (like footer, image)
            if (textFields.includes(key)) {
                sanitized[key] = sanitizeEmbedData(value as Record<string, unknown>);
            } else {
                sanitized[key] = value;
            }
        } else {
            sanitized[key] = value;
        }
    }
    
    return sanitized;
}

/**
 * Validate Discord webhook URL format (basic check)
 */
export function isValidWebhookUrl(url: string): boolean {
    const webhookPattern = /^https:\/\/(discord\.com|discordapp\.com)\/api\/(webhooks|v\d+\/webhooks)\/[\d]+\/[\w-]+$/;
    return webhookPattern.test(url);
}

/**
 * Sanitize a trigger word/alias
 */
export function sanitizeTrigger(trigger: string): string {
    if (!trigger || typeof trigger !== "string") {
        return "";
    }
    
    // Remove control characters and whitespace
    let sanitized = trigger
        .replace(/[\x00-\x1F\x7F]/g, "")  // Control characters
        .trim();
    
    // Limit length
    const MAX_TRIGGER_LENGTH = 50;
    if (sanitized.length > MAX_TRIGGER_LENGTH) {
        sanitized = sanitized.slice(0, MAX_TRIGGER_LENGTH);
    }
    
    return sanitized;
}

/**
 * Check if content contains potential spam patterns
 */
export function containsSpamPatterns(content: string): boolean {
    const spamPatterns = [
        /(.)\1{10,}/,  // Repeated characters (e.g., "aaaaaaaaaa")
        /https?:\/\/[^\s]{500,}/,  // Extremely long URLs
        /[\u200B\u200C\u200D\uFEFF]/,  // Zero-width characters (invisible spam)
    ];
    
    return spamPatterns.some((pattern) => pattern.test(content));
}

/**
 * Sanitize API request body for message-related endpoints
 */
export function sanitizeRequestBody<T extends Record<string, unknown>>(
    body: T,
    textFields: string[]
): T {
    const sanitized = { ...body };
    
    for (const field of textFields) {
        const value = body[field];
        if (typeof value === "string") {
            (sanitized as Record<string, unknown>)[field] = sanitizeMessageContent(value);
        } else if (field === "embed" && value !== null && typeof value === "object") {
            (sanitized as Record<string, unknown>)[field] = sanitizeEmbedData(value as Record<string, unknown>);
        }
    }
    
    return sanitized;
}
