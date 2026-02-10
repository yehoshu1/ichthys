import { NextRequest, NextResponse } from "next/server";
import { db, messageAlias } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import logger from "@/lib/logger";
import {
    discordIdArraySchema,
    normalizeDiscordIdList,
    serializeDiscordIdList,
} from "@/lib/validation";
import { sanitizeMessageContent, sanitizeTrigger, sanitizeEmbedData } from "@/lib/sanitize";

const aliasEmbedSchema = z.union([
    z.record(z.string(), z.unknown()),
    z.string(),
]).nullable().optional();

const createAliasSchema = z.object({
    trigger: z.string().min(1).max(50),
    response: z.string().min(1).max(2000),
    responseEmbed: aliasEmbedSchema,
    enabled: z.boolean().default(true),
    caseSensitive: z.boolean().default(false),
    deleteTrigger: z.boolean().default(false),
    requirePrefix: z.string().max(5).nullable().optional(),
    allowedChannels: discordIdArraySchema.optional(),
    allowedRoles: discordIdArraySchema.optional(),
    cooldownSeconds: z.number().min(0).max(3600).default(5),
});

const updateAliasSchema = z.object({
    id: z.string(),
    trigger: z.string().min(1).max(50).optional(),
    response: z.string().min(1).max(2000).optional(),
    responseEmbed: aliasEmbedSchema,
    enabled: z.boolean().optional(),
    caseSensitive: z.boolean().optional(),
    deleteTrigger: z.boolean().optional(),
    requirePrefix: z.string().max(5).nullable().optional(),
    allowedChannels: discordIdArraySchema.optional(),
    allowedRoles: discordIdArraySchema.optional(),
    cooldownSeconds: z.number().min(0).max(3600).optional(),
});

function normalizeEmbedInput(
    value: z.infer<typeof aliasEmbedSchema>
): Record<string, unknown> | null | undefined {
    if (value === undefined) {
        return undefined;
    }

    if (value === null) {
        return null;
    }

    if (typeof value === "string") {
        if (!value.trim()) {
            return null;
        }

        const parsed = JSON.parse(value);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("Invalid embed JSON");
        }

        if (Object.keys(parsed).length === 0) {
            throw new Error("Embed cannot be empty");
        }

        return parsed as Record<string, unknown>;
    }

    if (Object.keys(value).length === 0) {
        throw new Error("Embed cannot be empty");
    }

    return value;
}

/**
 * GET /api/guilds/[guildId]/aliases
 * Get all message aliases for a guild
 */
export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const aliases = await db
            .select()
            .from(messageAlias)
            .where(eq(messageAlias.guildId, guildId))
            .orderBy(messageAlias.trigger);

        return NextResponse.json(aliases);
    } catch (error) {
        logger.error("Error fetching aliases", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/**
 * POST /api/guilds/[guildId]/aliases
 * Create a new message alias
 */
export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const body = await req.json();
        const parsed = createAliasSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid request body", details: parsed.error.format() },
                { status: 400 }
            );
        }

        const data = parsed.data;

        // Sanitize inputs
        const sanitizedTrigger = sanitizeTrigger(data.trigger);
        const sanitizedResponse = sanitizeMessageContent(data.response);
        
        if (!sanitizedTrigger || !sanitizedResponse) {
            return NextResponse.json(
                { error: "Trigger and response cannot be empty after sanitization" },
                { status: 400 }
            );
        }

        // Check if trigger already exists
        const existing = await db
            .select({ id: messageAlias.id })
            .from(messageAlias)
            .where(and(
                eq(messageAlias.guildId, guildId),
                eq(messageAlias.trigger, sanitizedTrigger)
            ))
            .limit(1);

        if (existing.length > 0) {
            return NextResponse.json(
                { error: "An alias with this trigger already exists" },
                { status: 409 }
            );
        }

        let normalizedEmbed: Record<string, unknown> | null;
        try {
            normalizedEmbed = sanitizeEmbedData(normalizeEmbedInput(data.responseEmbed) ?? null);
        } catch {
            return NextResponse.json(
                { error: "Invalid embed JSON" },
                { status: 400 }
            );
        }

        const allowedChannels = normalizeDiscordIdList(data.allowedChannels ?? []);
        const allowedRoles = normalizeDiscordIdList(data.allowedRoles ?? []);

        const [alias] = await db
            .insert(messageAlias)
            .values({
                guildId,
                trigger: sanitizedTrigger,
                response: sanitizedResponse,
                responseEmbed: normalizedEmbed,
                enabled: data.enabled,
                caseSensitive: data.caseSensitive,
                deleteTrigger: data.deleteTrigger,
                requirePrefix: data.requirePrefix ?? "!",
                allowedChannels: serializeDiscordIdList(allowedChannels),
                allowedRoles: serializeDiscordIdList(allowedRoles),
                cooldownSeconds: data.cooldownSeconds,
                createdBy: auth.userId,
                usageCount: 0,
            })
            .returning();

        return NextResponse.json(alias, { status: 201 });
    } catch (error) {
        logger.error("Error creating alias", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/**
 * PATCH /api/guilds/[guildId]/aliases
 * Update an existing message alias
 */
export async function PATCH(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const body = await req.json();
        const parsed = updateAliasSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid request body", details: parsed.error.format() },
                { status: 400 }
            );
        }

        const data = parsed.data;
        const { id, ...updateData } = data;

        // Sanitize inputs
        const sanitizedTrigger = updateData.trigger ? sanitizeTrigger(updateData.trigger) : undefined;
        const sanitizedResponse = updateData.response ? sanitizeMessageContent(updateData.response) : undefined;

        // Verify the alias belongs to this guild
        const [existing] = await db
            .select({ id: messageAlias.id, trigger: messageAlias.trigger })
            .from(messageAlias)
            .where(and(
                eq(messageAlias.id, id),
                eq(messageAlias.guildId, guildId)
            ))
            .limit(1);

        if (!existing) {
            return NextResponse.json(
                { error: "Alias not found" },
                { status: 404 }
            );
        }

        // Check for trigger uniqueness if updating trigger
        if (sanitizedTrigger && sanitizedTrigger !== existing.trigger) {
            const duplicate = await db
                .select({ id: messageAlias.id })
                .from(messageAlias)
                .where(and(
                    eq(messageAlias.guildId, guildId),
                    eq(messageAlias.trigger, sanitizedTrigger)
                ))
                .limit(1);

            if (duplicate.length > 0) {
                return NextResponse.json(
                    { error: "An alias with this trigger already exists" },
                    { status: 409 }
                );
            }
        }

        let normalizedEmbed: Record<string, unknown> | null | undefined;
        try {
            normalizedEmbed = sanitizeEmbedData(normalizeEmbedInput(updateData.responseEmbed) ?? null);
        } catch {
            return NextResponse.json(
                { error: "Invalid embed JSON" },
                { status: 400 }
            );
        }

        const normalizedAllowedChannels = updateData.allowedChannels !== undefined
            ? normalizeDiscordIdList(updateData.allowedChannels)
            : undefined;
        const normalizedAllowedRoles = updateData.allowedRoles !== undefined
            ? normalizeDiscordIdList(updateData.allowedRoles)
            : undefined;

        const [updated] = await db
            .update(messageAlias)
            .set({
                ...(sanitizedTrigger && { trigger: sanitizedTrigger }),
                ...(sanitizedResponse && { response: sanitizedResponse }),
                ...(normalizedEmbed !== undefined && { responseEmbed: normalizedEmbed }),
                ...(updateData.enabled !== undefined && { enabled: updateData.enabled }),
                ...(updateData.caseSensitive !== undefined && { caseSensitive: updateData.caseSensitive }),
                ...(updateData.deleteTrigger !== undefined && { deleteTrigger: updateData.deleteTrigger }),
                ...(updateData.requirePrefix !== undefined && { requirePrefix: updateData.requirePrefix }),
                ...(normalizedAllowedChannels !== undefined && { allowedChannels: serializeDiscordIdList(normalizedAllowedChannels) }),
                ...(normalizedAllowedRoles !== undefined && { allowedRoles: serializeDiscordIdList(normalizedAllowedRoles) }),
                ...(updateData.cooldownSeconds !== undefined && { cooldownSeconds: updateData.cooldownSeconds }),
                updatedAt: new Date(),
            })
            .where(and(
                eq(messageAlias.id, id),
                eq(messageAlias.guildId, guildId)
            ))
            .returning();

        return NextResponse.json(updated);
    } catch (error) {
        logger.error("Error updating alias", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/**
 * DELETE /api/guilds/[guildId]/aliases
 * Delete a message alias
 */
export async function DELETE(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Alias ID is required" },
                { status: 400 }
            );
        }

        const result = await db
            .delete(messageAlias)
            .where(and(
                eq(messageAlias.id, id),
                eq(messageAlias.guildId, guildId)
            ))
            .returning({ id: messageAlias.id });

        if (result.length === 0) {
            return NextResponse.json(
                { error: "Alias not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("Error deleting alias", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
