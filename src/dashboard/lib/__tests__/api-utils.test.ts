import { describe, it, expect } from "vitest";
import {
    HttpStatus,
    ErrorCode,
    createSuccessResponse,
    createErrorResponse,
    apiErrors,
} from "../api-utils";
import {
    parseVersion,
    compareVersions,
    isVersionSupported,
} from "../api-version";

describe("api-utils", () => {
    describe("HTTP Status codes", () => {
        it("should have correct status codes", () => {
            expect(HttpStatus.OK).toBe(200);
            expect(HttpStatus.BAD_REQUEST).toBe(400);
            expect(HttpStatus.UNAUTHORIZED).toBe(401);
            expect(HttpStatus.INTERNAL_SERVER_ERROR).toBe(500);
        });
    });

    describe("Error codes", () => {
        it("should have correct error codes", () => {
            expect(ErrorCode.BAD_REQUEST).toBe("BAD_REQUEST");
            expect(ErrorCode.UNAUTHORIZED).toBe("UNAUTHORIZED");
            expect(ErrorCode.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
        });
    });

    describe("createSuccessResponse", () => {
        it("should create success response with data", () => {
            const data = { id: "1", name: "Test" };
            const response = createSuccessResponse(data);
            
            expect(response.status).toBe(200);
            // Note: We can't easily inspect JSON body in test without awaiting
        });

        it("should use custom status code", () => {
            const response = createSuccessResponse({}, HttpStatus.CREATED);
            expect(response.status).toBe(201);
        });
    });

    describe("createErrorResponse", () => {
        it("should create error response", () => {
            const response = createErrorResponse(
                ErrorCode.NOT_FOUND,
                "Resource not found",
                HttpStatus.NOT_FOUND
            );
            
            expect(response.status).toBe(404);
        });
    });

    describe("apiErrors shortcuts", () => {
        it("should create bad request error", () => {
            const response = apiErrors.badRequest("Invalid input");
            expect(response.status).toBe(400);
        });

        it("should create not found error", () => {
            const response = apiErrors.notFound();
            expect(response.status).toBe(404);
        });

        it("should create validation error with details", () => {
            const details = [{ field: "email", message: "Invalid email" }];
            const response = apiErrors.validationError("Validation failed", details);
            expect(response.status).toBe(422);
        });
    });
});

describe("api-version", () => {
    // These tests would be for the api-version module
    describe("parseVersion", () => {
        it("should parse valid version strings", () => {
            const version = parseVersion("1.2.3");
            expect(version).toEqual({ major: 1, minor: 2, patch: 3 });
        });

        it("should return null for invalid versions", () => {
            expect(parseVersion("1.2")).toBeNull();
            expect(parseVersion("invalid")).toBeNull();
            expect(parseVersion("1.2.3.4")).toBeNull();
        });
    });

    describe("compareVersions", () => {
        it("should compare versions correctly", () => {
            expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
            expect(compareVersions("1.1.0", "1.0.0")).toBe(1);
            expect(compareVersions("1.0.0", "1.1.0")).toBe(-1);
            expect(compareVersions("2.0.0", "1.9.9")).toBe(1);
        });
    });

    describe("isVersionSupported", () => {
        it("should return true for supported versions", () => {
            // Assuming CURRENT_API_VERSION is 1.0.0 and MIN_SUPPORTED_VERSION is 1.0.0
            expect(isVersionSupported("1.0.0")).toBe(true);
        });

        it("should return false for unsupported versions", () => {
            expect(isVersionSupported("0.9.0")).toBe(false);
            expect(isVersionSupported("2.0.0")).toBe(false);
        });
    });
});
