import { NextResponse } from "next/server";
import { verifyDatabaseRole } from "@/shared/lib/db/client";

export const dynamic = "force-dynamic";

/**
 * Health Check API
 * Triggers database role verification on each call to ensure security.
 */
export async function GET() {
    try {
        await verifyDatabaseRole();
        
        return NextResponse.json({
            status: "healthy",
            timestamp: new Date().toISOString(),
            security: "verified"
        });
    } catch (error: any) {
        return NextResponse.json({
            status: "unhealthy",
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
