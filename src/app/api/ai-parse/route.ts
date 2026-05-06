// ============================================
// AI Parse API — Upload & Trigger (Post-Supabase)
// POST /api/ai-parse  → create jobs, trigger Inngest
// ============================================

import { NextResponse, type NextRequest } from "next/server";
import { withDbContext } from "@/shared/lib/db/client";
import { inngest } from "@/shared/lib/inngest";
import { generateTraceId } from "@/shared/lib/format";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    // 1. Get session info from middleware headers
    const userId = request.headers.get("x-user-id");
    const activeCompanyId = request.headers.get("x-active-company-id");
    const ownCompanyId = request.headers.get("x-own-company-id");
    const role = request.headers.get("x-user-role");

    if (!userId || !activeCompanyId || !role || !ownCompanyId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { file_paths } = body as { file_paths: string[] };

        if (!file_paths || !Array.isArray(file_paths) || file_paths.length === 0) {
            return NextResponse.json(
                { error: "file_paths required" },
                { status: 400 }
            );
        }

        if (file_paths.length > 20) {
            return NextResponse.json(
                { error: "Maximum 20 files per batch" },
                { status: 400 }
            );
        }

        const jobIds: string[] = [];

        // Use database context for atomic job creation
        await withDbContext(userId, activeCompanyId, role, ownCompanyId, async (client) => {
            for (const filePath of file_paths) {
                const traceId = generateTraceId();
                const filename = filePath.split("/").pop() ?? "unknown";

                // Insert job record
                const res = await client.query(
                    `INSERT INTO ai_processing_jobs (
                        company_id, initiated_by, status, 
                        original_filename, file_path, trace_id, queued_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, now())
                    RETURNING id`,
                    [activeCompanyId, userId, "queued", filename, filePath, traceId]
                );

                const jobId = res.rows[0].id;
                jobIds.push(jobId);

                // Trigger background worker
                await inngest.send({
                    name: "ai/parse.requested",
                    data: {
                        job_id: jobId,
                        file_path: filePath,
                        company_id: activeCompanyId,
                        initiated_by: userId,
                        original_filename: filename,
                    },
                });
            }
        });

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
    } catch (error: any) {
        console.error("AI Parse Route Error:", error.message);
        return NextResponse.json(
            { error: "Failed to initiate AI processing batch" },
            { status: 500 }
        );
    }
}
