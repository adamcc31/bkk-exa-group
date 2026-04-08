// ============================================
// AI Parse API — Upload & Trigger
// POST /api/ai-parse  → upload files, create jobs, trigger Inngest
// ============================================

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/features/auth";
import { PERMISSIONS } from "@/shared/lib/constants";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { inngest } from "@/shared/lib/inngest";
import { generateTraceId } from "@/shared/lib/format";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    const { session, error } = await requireAuth(PERMISSIONS.AI_PARSE_UPLOAD);
    if (error) return error;

    const body = await request.json();
    const { file_paths } = body as { file_paths: string[] };

    if (!file_paths || !Array.isArray(file_paths) || file_paths.length === 0) {
        return NextResponse.json(
            {
                success: false,
                error: { code: "VALIDATION_ERROR", message: "file_paths required" },
            },
            { status: 400 }
        );
    }

    if (file_paths.length > 20) {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Maximum 20 files per batch",
                },
            },
            { status: 400 }
        );
    }

    const supabase = await createSupabaseServerClient();
    const jobIds: string[] = [];

    // Create job records and trigger Inngest for each file
    for (const filePath of file_paths) {
        const traceId = generateTraceId();
        const filename = filePath.split("/").pop() ?? "unknown";

        // Insert job record
        const { data: job, error: insertError } = await supabase
            .from("ai_processing_jobs")
            .insert({
                company_id: session.activeCompanyId,
                initiated_by: session.user.id,
                status: "queued",
                original_filename: filename,
                file_path: filePath,
                trace_id: traceId,
                queued_at: new Date().toISOString(),
            })
            .select("id")
            .single();

        if (insertError || !job) {
            continue; // Skip failed inserts, others continue
        }

        jobIds.push(job.id);

        // Trigger background worker
        await inngest.send({
            name: "ai/parse.requested",
            data: {
                job_id: job.id,
                file_path: filePath,
                company_id: session.activeCompanyId,
                initiated_by: session.user.id,
                original_filename: filename,
            },
        });
    }

    return NextResponse.json(
        {
            success: true,
            data: {
                job_ids: jobIds,
                total_queued: jobIds.length,
            },
        },
        { status: 202 }
    );
}
