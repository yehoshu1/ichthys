/**
 * API Versioning
 * 
 * Manages API versioning for backward compatibility
 */

// Current API version
export const CURRENT_API_VERSION = "1.0.0";

// Minimum supported version
export const MIN_SUPPORTED_VERSION = "1.0.0";

// API version history
export const API_VERSIONS = {
    "1.0.0": {
        released: "2025-02-10",
        changes: ["Initial API release"],
        deprecated: false,
    },
    "0.2.0": {
        released: "2026-02-10",
        changes: [
            "Added comprehensive tooltip system throughout dashboard",
            "Added user preference toggle for help tooltips",
            "Enhanced UX with examples and helper text on all pages",
            "Added interactive variable tooltips in MessageEditor",
        ],
        deprecated: false,
    },
};

/**
 * Parse version string to components
 */
export function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) return null;
    
    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
    };
}

/**
 * Compare two versions
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
    const p1 = parseVersion(v1);
    const p2 = parseVersion(v2);
    
    if (!p1 || !p2) return 0;
    
    if (p1.major !== p2.major) return p1.major > p2.major ? 1 : -1;
    if (p1.minor !== p2.minor) return p1.minor > p2.minor ? 1 : -1;
    if (p1.patch !== p2.patch) return p1.patch > p2.patch ? 1 : -1;
    
    return 0;
}

/**
 * Check if version is supported
 */
export function isVersionSupported(version: string): boolean {
    return compareVersions(version, MIN_SUPPORTED_VERSION) >= 0 &&
           compareVersions(version, CURRENT_API_VERSION) <= 0;
}

/**
 * Get version info for response headers
 */
export function getVersionHeaders(): Record<string, string> {
    return {
        "X-API-Version": CURRENT_API_VERSION,
        "X-API-Deprecated": "false",
    };
}

/**
 * Create version info response
 */
export function getVersionInfo() {
    return {
        current: CURRENT_API_VERSION,
        minimum: MIN_SUPPORTED_VERSION,
        versions: API_VERSIONS,
    };
}

/**
 * Middleware to check API version from header
 * Returns null if valid, error response if invalid
 */
export function validateApiVersion(requestVersion?: string | null): { valid: true } | { valid: false; error: string } {
    if (!requestVersion) {
        // No version specified, assume current version
        return { valid: true };
    }
    
    if (!parseVersion(requestVersion)) {
        return { valid: false, error: "Invalid version format. Expected: x.y.z" };
    }
    
    if (!isVersionSupported(requestVersion)) {
        return {
            valid: false,
            error: `API version ${requestVersion} is not supported. Minimum supported: ${MIN_SUPPORTED_VERSION}`,
        };
    }
    
    return { valid: true };
}
