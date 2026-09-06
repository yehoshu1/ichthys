/**
 * Permission validation helpers for dashboard API routes
 * Ensures users can only access guilds they have permission to manage
 */

import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { authOptions } from "./auth";
import logger from "./logger";

const MANAGE_GUILD = 0x20; // Discord permission flag for Manage Server

export interface ValidationResult {
    valid: boolean;
    error?: string;
    status?: number;
    userId?: string;
    accessToken?: string;
}

/**
 * Validates that the current user has Manage Server permission for the specified guild
 * @param req - The incoming request
 * @param guildId - The Discord guild ID to check
 * @returns ValidationResult with valid flag and optional error details
 */
export async function validateGuildAccess(
    req: NextRequest,
    guildId: string
): Promise<ValidationResult> {
    // Get user session
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return { valid: false, error: "Unauthorized", status: 401 };
    }

    const token = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
    });
    const accessToken = typeof token?.accessToken === "string" ? token.accessToken : null;

    if (!accessToken) {
        return { valid: false, error: "No access token", status: 401 };
    }

    // Validate guildId format (Discord snowflake)
    if (!/^\d{17,20}$/.test(guildId)) {
        return { valid: false, error: "Invalid guild ID", status: 400 };
    }

    try {
        // Fetch user's guilds from Discord API
        const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            next: { revalidate: 60 }, // Cache for 60 seconds
        });

        if (!response.ok) {
            if (response.status === 401) {
                return { valid: false, error: "Session expired", status: 401 };
            }
            logger.error("Discord API error", { status: response.status, error: await response.text() });
            return { valid: false, error: "Failed to fetch guilds", status: 500 };
        }

        const guilds = await response.json();
        const guild = guilds.find((g: any) => g.id === guildId);

        if (!guild) {
            return { valid: false, error: "Guild not found or access denied", status: 404 };
        }

        // Check if user has Manage Server permission or is owner
        const permissions = BigInt(guild.permissions);
        const hasManagePermission = guild.owner || (permissions & BigInt(MANAGE_GUILD)) !== BigInt(0);

        if (!hasManagePermission) {
            return { valid: false, error: "Missing Manage Server permission", status: 403 };
        }

        return {
            valid: true,
            userId: session.user.id as string,
            accessToken,
        };
    } catch (error) {
        logger.error("Error validating guild access", { error });
        return { valid: false, error: "Internal error", status: 500 };
    }
}

/**
 * Lightweight validation that just checks authentication
 * Use for endpoints that don't need guild-specific permissions
 */
export async function validateAuth(req: NextRequest): Promise<ValidationResult> {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return { valid: false, error: "Unauthorized", status: 401 };
    }

    const token = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
    });
    const accessToken = typeof token?.accessToken === "string" ? token.accessToken : null;
    if (!accessToken) {
        return { valid: false, error: "No access token", status: 401 };
    }

    return {
        valid: true,
        userId: session.user.id as string,
        accessToken,
    };
}

/**
 * Check if a specific user has access to a guild
 * Useful for background jobs or when session isn't available
 */
export async function checkUserGuildAccess(
    _userId: string,
    accessToken: string,
    guildId: string
): Promise<boolean> {
    try {
        const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            return false;
        }

        const guilds = await response.json();
        const guild = guilds.find((g: any) => g.id === guildId);

        if (!guild) {
            return false;
        }

        const permissions = BigInt(guild.permissions);
        return guild.owner || (permissions & BigInt(MANAGE_GUILD)) !== BigInt(0);
    } catch (error) {
        logger.error("Error checking user guild access", { error });
        return false;
    }
}
