// ============================================
// AI Job Status API — Polling Endpoint (Post-Supabase)
// GET /api/ai-parse/status/[jobId]
// ============================================

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/features/auth";
import { PERMISSIONS } from "@/shared/lib/constants";
import { withDbContext } from "@/shared/lib/db/client";

export const dynamic = "force-dynamic";

type RouteContext = { params: { jobId: string } };

export async function GET(request: NextRequest, context: RouteContext) {
    const { session, error } = await requireAuth(PERMISSIONS.AI_PARSE_VIEW_JOBS);
    if (error) return error;

    const { jobId } = await context.params;

    // Helper UUID validation
    const isValidUUID = (str: string) => 
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    try {
        const job = await withDbContext(
            session.user.id,
            session.activeCompanyId,
            session.role,
            session.user.company_id,
            async (client) => {
                let res;
                if (jobId === "latest") {
                    // Query most recent job for this company
                    res = await client.query(
                        `SELECT * FROM ai_processing_jobs 
                         WHERE company_id = $1 
                         ORDER BY queued_at DESC 
                         LIMIT 1`,
                        [session.activeCompanyId]
                    );
                } else if (isValidUUID(jobId)) {
                    res = await client.query(
                        "SELECT * FROM ai_processing_jobs WHERE id = $1",
                        [jobId]
                    );
                } else {
                    return null; // Will trigger 404/400 below
                }
                return res.rows[0];
            }
        );

        if (!job) {
            const isInvalid = jobId !== "latest" && !isValidUUID(jobId);
            return NextResponse.json(
                {
                    success: false,
                    error: { 
                        code: isInvalid ? "INVALID_ID" : "NOT_FOUND", 
                        message: isInvalid ? "Invalid job ID format" : "Job not found" 
                    },
                },
                { status: isInvalid ? 400 : 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                id: job.id,
                status: job.status,
                document_type: job.document_type,
                original_filename: job.original_filename,
                standardized_data: job.standardized_data,
                total_amount: job.total_amount,
                error_message: job.error_message,
                queued_at: job.queued_at,
                started_at: job.started_at,
                completed_at: job.completed_at,
            },
        });
    } catch (dbError: any) {
        console.error("AI Status Error:", dbError.message);
        return NextResponse.json(
            { success: false, error: { code: "DB_ERROR", message: "Failed to fetch job status" } },
            { status: 500 }
        );
    }
}
