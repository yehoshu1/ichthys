/**
 * Zod validation schemas for dashboard API routes
 * Ensures type safety and input validation
 */

import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

const DISCORD_ID_REGEX = /^\d{17,20}$/;

function preprocessNullableDiscordId(value: unknown): unknown {
    if (value === null || value === undefined) {
        return value;
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed === "" ? null : trimmed;
    }

    return value;
}

// ==========================================
// Common Schemas (for routes that expect these names)
// ==========================================

/** Discord snowflake ID (17-20 digits) - alias for routes using this name */
export const discordIdSchema = z.string().trim().regex(DISCORD_ID_REGEX, "Invalid Discord ID format");

/** Nullable Discord ID - alias for routes using this name */
export const nullableDiscordIdSchema = z.preprocess(
    preprocessNullableDiscordId,
    discordIdSchema.nullable().optional()
);

/** Optional text field */
export const optionalTextSchema = z.string().max(2000).nullable().optional();

/** Optional embed field */
export const optionalEmbedSchema = z.record(z.string(), z.unknown()).nullable().optional();

// ==========================================
// Request Parsing Helper
// ==========================================

export interface ParsedBodySuccess<T> {
    success: true;
    data: T;
}

export interface ParsedBodyFailure {
    success: false;
    response: NextResponse;
}

export type ParsedBodyResult<T> = ParsedBodySuccess<T> | ParsedBodyFailure;

/**
 * Parse and validate JSON request body
 * @param req - NextRequest object
 * @param schema - Zod schema to validate against
 * @returns ParsedBodyResult with data or error response
 */
export async function parseJsonBody<T>(
    req: NextRequest,
    schema: z.ZodSchema<T>
): Promise<ParsedBodyResult<T>> {
    try {
        const body = await req.json();
        const result = schema.safeParse(body);

        if (!result.success) {
            const errors = result.error.issues.map(e => ({
                path: e.path.join('.'),
                message: e.message,
            }));
            return {
                success: false,
                response: NextResponse.json(
                    { error: "Invalid input", details: errors },
                    { status: 400 }
                ),
            };
        }

        return { success: true, data: result.data };
    } catch (error) {
        return {
            success: false,
            response: NextResponse.json(
                { error: "Invalid JSON body" },
                { status: 400 }
            ),
        };
    }
}

/**
 * Parse query parameters from URL
 * @param req - NextRequest object
 * @param schema - Zod schema to validate against
 * @returns Parsed query params or null if invalid
 */
export function parseQueryParams<T>(
    req: NextRequest,
    schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; errors: z.ZodError } {
    const { searchParams } = new URL(req.url);
    const params: Record<string, any> = {};

    searchParams.forEach((value, key) => {
        // Try to parse numbers
        if (/^\d+$/.test(value)) {
            params[key] = parseInt(value, 10);
        } else if (value === 'true') {
            params[key] = true;
        } else if (value === 'false') {
            params[key] = false;
        } else {
            params[key] = value;
        }
    });

    const result = schema.safeParse(params);

    if (!result.success) {
        return { success: false, errors: result.error };
    }

    return { success: true, data: result.data };
}

// ==========================================
// Common Schemas
// ==========================================

/** Discord snowflake ID (17-20 digits) */
export const snowflake = discordIdSchema;

/** Optional Discord snowflake */
export const optionalSnowflake = snowflake.nullable().optional();

/** Array of Discord snowflakes */
export const discordIdArraySchema = z.array(discordIdSchema);

export function isDiscordId(value: string): boolean {
    return DISCORD_ID_REGEX.test(value);
}

export function normalizeDiscordId(input: unknown): string | null {
    if (typeof input !== "string") return null;
    const value = input.trim();
    return isDiscordId(value) ? value : null;
}

export function normalizeDiscordIdList(inputs: Iterable<unknown>): string[] {
    const unique = new Set<string>();

    for (const input of inputs) {
        const id = normalizeDiscordId(input);
        if (!id) continue;
        unique.add(id);
    }

    return [...unique];
}

export function parseDiscordIdCsv(value: string[] | string | null | undefined): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
        return normalizeDiscordIdList(value);
    }
    return normalizeDiscordIdList(value.split(","));
}

export function serializeDiscordIdList(values: Iterable<unknown>): string[] | null {
    const normalized = normalizeDiscordIdList(values);
    return normalized.length > 0 ? normalized : null;
}

/** UUID string */
export const uuid = z.string().uuid("Invalid UUID format");

/** Hex color code (#RRGGBB) */
export const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color format").nullable().optional();

/** Message content (max 2000 chars for Discord) */
export const messageContent = z.string().max(2000, "Message too long (max 2000 characters)").nullable().optional();

/** Embed data structure */
export const embedData = z.record(z.string(), z.unknown()).nullable().optional();

/** Positive integer */
export const positiveInt = z.number().int().min(1);

/** Non-negative integer */
export const nonNegativeInt = z.number().int().min(0);

// ==========================================
// Guild Params
// ==========================================

export const guildIdParamSchema = z.object({
    guildId: snowflake,
});

// ==========================================
// Welcome System Schemas
// ==========================================

export const welcomeConfigSchema = z.object({
    welcomeEnabled: z.boolean().default(false),
    autoRoleId: optionalSnowflake,
    joinMessageChannelId: optionalSnowflake,
    joinMessage: messageContent,
    joinMessageEmbed: embedData,
    leaveMessageChannelId: optionalSnowflake,
    leaveMessage: messageContent,
    leaveMessageEmbed: embedData,
});

export const messageTemplateSchema = z.object({
    id: uuid.optional(),
    name: z.string().min(1, "Name is required").max(100, "Name too long"),
    content: z.string().min(1, "Content is required").max(2000, "Content too long"),
    embedEnabled: z.boolean().default(false),
    embedTitle: z.string().max(256, "Title too long").nullable().optional(),
    embedDescription: z.string().max(4096, "Description too long").nullable().optional(),
    embedColor: hexColor,
    embedThumbnail: z.boolean().default(false),
    embedData: embedData,
});

export const welcomeTriggerSchema = z.object({
    id: uuid.optional(),
    roleId: snowflake,
    templateId: uuid,
    channelId: optionalSnowflake,
    enabled: z.boolean().default(true),
});

// ==========================================
// Verification System Schemas
// ==========================================

export const verificationConfigSchema = z.object({
    verificationEnabled: z.boolean().default(false),
    unverifiedRoleId: optionalSnowflake,
    verificationRoleId: optionalSnowflake,
    verificationGraceDays: z.number().int().min(1).max(365).default(30),
    verificationKickDmEnabled: z.boolean().default(true),
    verificationMessage: messageContent,
});

export const verificationRuleSchema = z.object({
    id: uuid.optional(),
    name: z.string().max(100).nullable().optional(),
    roleId: snowflake,
    notifyChannelId: optionalSnowflake,
    message: z.string().min(1).max(2000),
    messageEmbed: embedData,
    enabled: z.boolean().default(true),
});

export const verificationRoleMessageSchema = z.object({
    id: uuid.optional(),
    roleId: snowflake,
    notifyChannelId: z.string().nullable().optional(),
    message: z.string().min(1).max(2000),
    messageEmbed: embedData,
    welcomeMessage: z.string().nullable().optional(),
    enabled: z.boolean().default(true),
});

// ==========================================
// Leveling System Schemas
// ==========================================

export const levelingConfigSchema = z.object({
    levelingEnabled: z.boolean().default(false),
    textXpMin: z.number().int().min(1).max(100).default(15),
    textXpMax: z.number().int().min(1).max(100).default(25),
    textXpCooldown: z.number().int().min(1).max(3600).default(60),
    voiceXpPerMinute: z.number().int().min(1).max(100).default(10),
    levelUpNotifEnabled: z.boolean().default(true),
    levelUpChannelId: optionalSnowflake,
    levelUpMessage: messageContent,
    levelUpMessageEmbed: embedData,
});

export const levelRewardSchema = z.object({
    id: uuid.optional(),
    roleId: snowflake,
    level: z.number().int().min(1).max(1000),
});

// ==========================================
// Boost Management Schemas
// ==========================================

export const boostConfigSchema = z.object({
    boostEnabled: z.boolean().default(false),
    boostAnnouncementChannelId: optionalSnowflake,
    boostRoleId: optionalSnowflake,
    boostRoleName: z.string().max(100).nullable().optional(),
    boostRoleColorPrimary: hexColor,
    boostRoleColorSecondary: hexColor,
    boostClaimRequired: z.boolean().default(true),
    boostWelcomeMessage: z.string().max(2000).nullable().optional(),
    boostWelcomeMessageEmbed: embedData,
    boostReBoostMessage: z.string().max(2000).nullable().optional(),
    boostReBoostMessageEmbed: embedData,
    boostRoleRemovalDays: z.number().int().min(0).max(365).default(30),
    boostRoleRemovalDmEnabled: z.boolean().default(true),
});

// ==========================================
// Role Actions Schemas
// ==========================================

export const roleActionSchema = z.object({
    id: uuid.optional(),
    roleId: snowflake,
    triggerType: z.enum(["ADD", "REMOVE"]).default("ADD"),
    actionType: z.enum(["DM", "KICK", "LOG", "MSG"]),
    actionGroup: z.string().max(50).nullable().optional(),
    actionDelay: z.number().int().min(0).max(10080).default(0), // Max 1 week (10080 minutes)
    dmMessage: messageContent,
    dmMessageEmbed: embedData,
    channelId: optionalSnowflake,
    kickReason: z.string().max(512).nullable().optional(),
    logChannelId: optionalSnowflake,
    enabled: z.boolean().default(true),
});

// ==========================================
// Pagination Schemas
// ==========================================

export const paginationSchema = z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(50),
});

// ==========================================
// Utility Functions
// ==========================================

/**
 * Parse and clamp a limit value from query parameter
 * @param value - The raw value (usually from searchParams.get())
 * @param defaultValue - Default value if not provided or invalid
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Clamped integer value
 */
export function clampLimit(
    value: string | null,
    defaultValue: number = 10,
    min: number = 1,
    max: number = 100
): number {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) return defaultValue;
    return Math.min(Math.max(parsed, min), max);
}

/**
 * Parse a comma-separated list of Discord IDs
 * @param idsString - Comma-separated string of IDs
 * @param maxIds - Maximum number of IDs to parse (default: 25)
 * @returns Object with success flag and parsed IDs or error response
 */
export function parseDiscordIds(
    idsString: string | null,
    maxIds: number = 25
): { success: true; ids: string[] } | { success: false; response: NextResponse } {
    if (!idsString) {
        return { success: true, ids: [] };
    }

    const ids = parseDiscordIdCsv(idsString);

    if (ids.length > maxIds) {
        return {
            success: false,
            response: NextResponse.json(
                { error: `Too many IDs provided (max ${maxIds})` },
                { status: 400 }
            ),
        };
    }

    return { success: true, ids };
}

// ==========================================
// Type Exports
// ==========================================

export type WelcomeConfigInput = z.infer<typeof welcomeConfigSchema>;
export type MessageTemplateInput = z.infer<typeof messageTemplateSchema>;
export type WelcomeTriggerInput = z.infer<typeof welcomeTriggerSchema>;
export type VerificationConfigInput = z.infer<typeof verificationConfigSchema>;
export type VerificationRuleInput = z.infer<typeof verificationRuleSchema>;
export type LevelingConfigInput = z.infer<typeof levelingConfigSchema>;
export type LevelRewardInput = z.infer<typeof levelRewardSchema>;
export type BoostConfigInput = z.infer<typeof boostConfigSchema>;
export type RoleActionInput = z.infer<typeof roleActionSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
