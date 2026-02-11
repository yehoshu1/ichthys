import { NextRequest, NextResponse } from "next/server";
import { db, reactionRoleMessage } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import { snowflake, parseJsonBody } from "@/lib/validation";
import logger from "@/lib/logger";
import { getBotClient } from "@/lib/bot-client";

// Validation schema for reaction role message
const messageSchema = z.object({
    id: z.string().uuid().optional(),
    channelId: snowflake,
    title: z.string().max(200).nullable().optional(),
    content: z.string().max(2000).nullable().optional(),
    embed: z.record(z.string(), z.any()).nullable().optional(),
    color: z.number().min(0).max(0xFFFFFF).nullable().optional(),
    enabled: z.boolean().default(true),
}).strict();

// Schema for sending message to Discord
const sendSchema = z.object({
    messageId: z.string().uuid(),
}).strict();

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const messages = await db.select()
            .from(reactionRoleMessage)
            .where(eq(reactionRoleMessage.guildId, guildId))
            .orderBy(reactionRoleMessage.createdAt);
        return NextResponse.json(messages);
    } catch (error) {
        logger.error("Error fetching reaction role messages", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsed = await parseJsonBody(req, messageSchema);
    if (!parsed.success) return parsed.response;

    try {
        const body = parsed.data;

        if (body.id) {
            // Update existing
            const updated = await db.update(reactionRoleMessage)
                .set({
                    channelId: body.channelId,
                    title: body.title || null,
                    content: body.content || null,
                    embed: body.embed || null,
                    color: body.color ?? null,
                    enabled: body.enabled ?? true,
                    updatedAt: new Date(),
                })
                .where(and(eq(reactionRoleMessage.id, body.id), eq(reactionRoleMessage.guildId, guildId)))
                .returning();
            
            if (updated.length === 0) {
                return NextResponse.json({ error: "Message not found" }, { status: 404 });
            }
            return NextResponse.json(updated[0]);
        }

        // Create new
        const inserted = await db.insert(reactionRoleMessage).values({
            guildId,
            channelId: body.channelId,
            title: body.title || null,
            content: body.content || null,
            embed: body.embed || null,
            color: body.color ?? null,
            enabled: body.enabled ?? true,
        }).returning();

        return NextResponse.json(inserted[0], { status: 201 });
    } catch (error) {
        logger.error("Error saving reaction role message", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "ID required" }, { status: 400 });
        }

        // Get the message first to check if it exists
        const message = await db.query.reactionRoleMessage.findFirst({
            where: and(eq(reactionRoleMessage.id, id), eq(reactionRoleMessage.guildId, guildId))
        });

        if (!message) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 });
        }

        // Try to delete the Discord message if it exists
        const botClient = getBotClient();
        if (message.messageId && botClient) {
            try {
                const guild = await botClient.guilds.fetch(guildId).catch((error: Error) => { logger.warn(`Failed to fetch guild ${guildId} for reaction role message deletion:`, error); return null; });
                if (guild) {
                    const channel = await guild.channels.fetch(message.channelId).catch((error: Error) => { logger.warn(`Failed to fetch channel ${message.channelId} for reaction role message deletion:`, error); return null; });
                    if (channel?.isTextBased()) {
                        const textChannel = channel as any;
                        const discordMessage = await textChannel.messages.fetch(message.messageId).catch((error: Error) => { logger.warn(`Failed to fetch message ${message.messageId} for reaction role deletion:`, error); return null; });
                        if (discordMessage) {
                            await discordMessage.delete();
                        }
                    }
                }
            } catch (err) {
                logger.warn("Failed to delete Discord message, proceeding with DB deletion", { error: err });
            }
        }

        await db.delete(reactionRoleMessage)
            .where(and(eq(reactionRoleMessage.id, id), eq(reactionRoleMessage.guildId, guildId)));

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("Error deleting reaction role message", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// POST /send - Send the message to Discord
export async function PATCH(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsed = await parseJsonBody(req, sendSchema);
    if (!parsed.success) return parsed.response;

    try {
        const { messageId } = parsed.data;

        // Get the message from DB
        const message = await db.query.reactionRoleMessage.findFirst({
            where: and(eq(reactionRoleMessage.id, messageId), eq(reactionRoleMessage.guildId, guildId))
        });

        if (!message) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 });
        }

        const botClient = getBotClient();
        if (!botClient) {
            return NextResponse.json({ error: "Bot is not connected" }, { status: 503 });
        }

        // Get guild and channel
        const guild = await botClient.guilds.fetch(guildId).catch((error) => { logger.warn(`Failed to fetch guild ${guildId} for sending reaction role message:`, error); return null; });
        if (!guild) {
            return NextResponse.json({ error: "Guild not found" }, { status: 404 });
        }

        const channel = await guild.channels.fetch(message.channelId).catch((error) => { logger.warn(`Failed to fetch channel ${message.channelId} for sending reaction role message:`, error); return null; });
        if (!channel || !channel.isTextBased()) {
            return NextResponse.json({ error: "Channel not found or not a text channel" }, { status: 404 });
        }

        // Build embed data
        const embeds: any[] = [];
        if (message.embed) {
            const embedData = message.embed as any;
            const discordEmbed: any = {};
            
            if (embedData.title) discordEmbed.title = embedData.title;
            if (embedData.description) discordEmbed.description = embedData.description;
            if (message.color) discordEmbed.color = message.color;
            if (embedData.fields) discordEmbed.fields = embedData.fields;
            if (embedData.footer?.text) discordEmbed.footer = embedData.footer;
            if (embedData.image?.url) discordEmbed.image = embedData.image;
            if (embedData.thumbnail?.url) discordEmbed.thumbnail = embedData.thumbnail;
            
            embeds.push(discordEmbed);
        }

        // Send or edit message
        let discordMessage;
        const textChannel = channel as any; // Type cast for send/edit methods
        
        if (message.messageId) {
            // Edit existing message
            try {
                const existingMsg = await textChannel.messages.fetch(message.messageId);
                discordMessage = await existingMsg.edit({
                    content: message.content || undefined,
                    embeds: embeds,
                });
            } catch {
                // Message was deleted, send new one
                discordMessage = await textChannel.send({
                    content: message.content || undefined,
                    embeds: embeds,
                });
            }
        } else {
            // Send new message
            discordMessage = await textChannel.send({
                content: message.content || undefined,
                embeds: embeds,
            });
        }

        // Update message ID in database
        const updated = await db.update(reactionRoleMessage)
            .set({
                messageId: discordMessage.id,
                updatedAt: new Date(),
            })
            .where(eq(reactionRoleMessage.id, messageId))
            .returning();

        return NextResponse.json({
            success: true,
            message: updated[0],
            discordMessageId: discordMessage.id,
        });
    } catch (error) {
        logger.error("Error sending reaction role message", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }
}
