import { NextResponse } from "next/server";
import { getVersionInfo, CURRENT_API_VERSION } from "@/lib/api-version";

/**
 * GET /api/version
 * Get API version information
 */
export async function GET(): Promise<NextResponse> {
    const versionInfo = getVersionInfo();
    
    return NextResponse.json({
        success: true,
        data: versionInfo,
    }, {
        headers: {
            "X-API-Version": CURRENT_API_VERSION,
        },
    });
}
