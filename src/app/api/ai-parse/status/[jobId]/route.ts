// ============================================
// AI Job Status API — Polling Endpoint
// GET /api/ai-parse/status/[jobId]
// ============================================

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/features/auth";
import { PERMISSIONS } from "@/shared/lib/constants";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
    const { error } = await requireAuth(PERMISSIONS.AI_PARSE_VIEW_JOBS);
    if (error) return error;

    const { jobId } = await context.params;
    const supabase = await createSupabaseServerClient();

    const { data: job, error: dbError } = await supabase
        .from("ai_processing_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

    if (dbError || !job) {
        return NextResponse.json(
            {
                success: false,
                error: { code: "NOT_FOUND", message: "Job not found" },
            },
            { status: 404 }
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
}
