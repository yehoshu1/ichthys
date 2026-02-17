import { NextRequest, NextResponse } from "next/server";
import { db, birthdayConfig } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireGuildManageAccess, requireGuildManageRolesAccess } from "@/lib/guild-auth";
import { nullableDiscordIdSchema, optionalEmbedSchema } from "@/lib/validation";
import logger from "@/lib/logger";
import { emitDashboardSettingsChanged } from "@/lib/notification-events";

const birthdayConfigSchema = z.object({
    enabled: z.boolean().optional(),
    channelId: nullableDiscordIdSchema,
    roleId: nullableDiscordIdSchema,
    messageTemplate: z.string().max(2000).optional(),
    messageEmbed: optionalEmbedSchema,
    hourOfDay: z.number().int().min(0).max(23).optional(),
    showAge: z.boolean().optional(),
    mentionRoleId: z.string().nullable().optional(), // "everyone", "here", role ID, or null
    autoRemoveRole: z.boolean().optional(),
}).passthrough();

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const config = await db.query.birthdayConfig.findFirst({
            where: eq(birthdayConfig.guildId, guildId),
        });

        if (!config) {
            return NextResponse.json({
                enabled: false,
                channelId: null,
                roleId: null,
                messageTemplate: "🎉 **Happy Birthday {user.mention}!** 🎂 They are now {age} years old!",
                messageEmbed: null,
                hourOfDay: 9,
                showAge: true,
                mentionRoleId: null,
                autoRemoveRole: true,
            });
        }

        return NextResponse.json(config);
    } catch (error) {
        logger.error("Error fetching birthday config", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageRolesAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const body = await req.json();
        const parsed = birthdayConfigSchema.safeParse(body);
        
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid request body", details: parsed.error.format() }, { status: 400 });
        }

        const data = parsed.data;

        await db.insert(birthdayConfig).values({
            guildId,
            enabled: data.enabled ?? false,
            channelId: data.channelId || null,
            roleId: data.roleId || null,
            messageTemplate: data.messageTemplate || "🎉 **Happy Birthday {user.mention}!** 🎂 They are now {age} years old!",
            messageEmbed: data.messageEmbed || null,
            hourOfDay: data.hourOfDay ?? 9,
            showAge: data.showAge ?? true,
            mentionRoleId: data.mentionRoleId || null,
            autoRemoveRole: data.autoRemoveRole ?? true,
        }).onConflictDoUpdate({
            target: birthdayConfig.guildId,
            set: {
                enabled: data.enabled ?? false,
                channelId: data.channelId || null,
                roleId: data.roleId || null,
                messageTemplate: data.messageTemplate || "🎉 **Happy Birthday {user.mention}!** 🎂 They are now {age} years old!",
                messageEmbed: data.messageEmbed || null,
                hourOfDay: data.hourOfDay ?? 9,
                showAge: data.showAge ?? true,
                mentionRoleId: data.mentionRoleId || null,
                autoRemoveRole: data.autoRemoveRole ?? true,
                updatedAt: new Date(),
            },
        });

        await emitDashboardSettingsChanged({
            guildId,
            userId: auth.userId,
            module: "birthdays",
            action: "update",
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("Error updating birthday config", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
