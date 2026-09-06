/**
 * Centralized error handler for API routes
 * Provides consistent error handling and prevents information disclosure
 */

import { NextResponse } from "next/server";
import logger from "./logger";

export interface ApiErrorContext {
    route: string;
    guildId?: string;
    userId?: string;
    operation: string;
}

/**
 * Generic API error handler that prevents information disclosure
 */
export class ApiErrorHandler {
    /**
     * Handle errors consistently across API routes
     */
    static handle(error: unknown, context: ApiErrorContext): NextResponse {
        const { route, guildId, userId, operation } = context;

        // Log the actual error for debugging (internal only)
        if (error instanceof Error) {
            logger.error(`API Error in ${operation}`, {
                error: error.message,
                stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
                route,
                guildId,
                userId,
            });
        } else {
            logger.error(`API Error in ${operation}`, {
                error: String(error),
                route,
                guildId,
                userId,
            });
        }

        // Return generic error response to prevent information disclosure
        const isDevelopment = process.env.NODE_ENV === "development";
        const errorMessage = isDevelopment 
            ? (error instanceof Error ? error.message : "An unknown error occurred")
            : "Internal server error";

        return NextResponse.json(
            { 
                error: "An error occurred while processing your request",
                ...(isDevelopment && { details: errorMessage }) // Only include details in development
            },
            { status: 500 }
        );
    }

    /**
     * Create a safe error response without exposing internal details
     */
    static createSafeErrorResponse(status: number, message: string): NextResponse {
        return NextResponse.json(
            { error: message },
            { status }
        );
    }

    /**
     * Handle validation errors specifically
     */
    static handleValidationError(errors: any, context: ApiErrorContext): NextResponse {
        logger.warn(`Validation error in ${context.operation}`, {
            errors,
            route: context.route,
            guildId: context.guildId,
            userId: context.userId,
        });

        return NextResponse.json(
            { 
                error: "Invalid input provided",
                details: process.env.NODE_ENV === "development" ? errors : undefined
            },
            { status: 400 }
        );
    }
}