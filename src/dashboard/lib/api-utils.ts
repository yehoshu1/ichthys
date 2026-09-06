/**
 * API Utilities
 * 
 * Standardized API response helpers and error handling
 */

import { NextResponse } from "next/server";
import logger from "./logger";

// Standard HTTP status codes
export const HttpStatus = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
} as const;

// Standard error codes
export const ErrorCode = {
    BAD_REQUEST: "BAD_REQUEST",
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    NOT_FOUND: "NOT_FOUND",
    CONFLICT: "CONFLICT",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    RATE_LIMITED: "RATE_LIMITED",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

interface ApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
    requestId?: string;
}

interface ApiSuccessResponse<T> {
    success: true;
    data: T;
    meta?: {
        timestamp: string;
        requestId?: string;
    };
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
    data: T,
    status: number = HttpStatus.OK,
    requestId?: string
): NextResponse<ApiSuccessResponse<T>> {
    const body: ApiSuccessResponse<T> = {
        success: true,
        data,
        meta: {
            timestamp: new Date().toISOString(),
            requestId,
        },
    };

    return NextResponse.json(body, { status });
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
    code: string,
    message: string,
    status: number,
    details?: unknown,
    requestId?: string
): NextResponse<ApiErrorResponse> {
    const errorObj: { code: string; message: string; details?: unknown } = {
        code,
        message,
    };
    
    if (details !== undefined) {
        errorObj.details = details;
    }
    
    const body: ApiErrorResponse = {
        success: false,
        error: errorObj,
        requestId,
    };

    return NextResponse.json(body, { status });
}

// Predefined error responses
export const apiErrors = {
    badRequest: (message = "Bad Request", details?: unknown) =>
        createErrorResponse(ErrorCode.BAD_REQUEST, message, HttpStatus.BAD_REQUEST, details),
    
    unauthorized: (message = "Unauthorized") =>
        createErrorResponse(ErrorCode.UNAUTHORIZED, message, HttpStatus.UNAUTHORIZED),
    
    forbidden: (message = "Forbidden") =>
        createErrorResponse(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN),
    
    notFound: (message = "Not Found") =>
        createErrorResponse(ErrorCode.NOT_FOUND, message, HttpStatus.NOT_FOUND),
    
    conflict: (message = "Conflict") =>
        createErrorResponse(ErrorCode.CONFLICT, message, HttpStatus.CONFLICT),
    
    validationError: (message = "Validation Error", details?: unknown) =>
        createErrorResponse(ErrorCode.VALIDATION_ERROR, message, HttpStatus.UNPROCESSABLE_ENTITY, details),
    
    rateLimited: (message = "Too Many Requests", retryAfter?: number) =>
        createErrorResponse(ErrorCode.RATE_LIMITED, message, HttpStatus.TOO_MANY_REQUESTS, { retryAfter }),
    
    internalError: (message = "Internal Server Error") =>
        createErrorResponse(ErrorCode.INTERNAL_ERROR, message, HttpStatus.INTERNAL_SERVER_ERROR),
    
    serviceUnavailable: (message = "Service Unavailable") =>
        createErrorResponse(ErrorCode.SERVICE_UNAVAILABLE, message, HttpStatus.SERVICE_UNAVAILABLE),
};

/**
 * Handle API errors with standardized logging
 */
export function handleApiError(
    error: unknown,
    context: {
        route: string;
        guildId?: string;
        userId?: string;
        operation: string;
    }
): NextResponse {
    const { route, guildId, userId, operation } = context;
    
    if (error instanceof Error) {
        // Log structured error
        logger.error(`API Error: ${operation}`, {
            error: error.message,
            stack: error.stack,
            route,
            guildId,
            userId,
        });

        // Don't expose internal error details in production
        const isDev = process.env.NODE_ENV === "development";
        const message = isDev ? error.message : "Internal Server Error";
        
        return apiErrors.internalError(message);
    }

    // Unknown error type
    logger.error(`API Error: ${operation}`, {
        error: String(error),
        route,
        guildId,
        userId,
    });

    return apiErrors.internalError();
}

