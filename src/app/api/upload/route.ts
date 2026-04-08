// ============================================
// File Upload API — Server-side upload to Supabase Storage
// POST /api/upload — bypasses RLS by using service role
// ============================================

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/features/auth";
import { PERMISSIONS } from "@/shared/lib/constants";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Service-role client for storage upload (bypasses RLS)
function getServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function POST(request: NextRequest) {
    const { session, error } = await requireAuth(PERMISSIONS.AI_PARSE_UPLOAD);
    if (error) return error;

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
        return NextResponse.json(
            { success: false, error: { code: "NO_FILES", message: "No files provided" } },
            { status: 400 }
        );
    }

    const supabase = getServiceClient();
    const filePaths: string[] = [];

    for (const file of files) {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${session.activeCompanyId}/${timestamp}_${safeName}`;

        const buffer = Buffer.from(await file.arrayBuffer());

        const { error: uploadError } = await supabase.storage
            .from("uploads")
            .upload(path, buffer, {
                contentType: file.type || "image/jpeg",
                upsert: false,
            });

        if (uploadError) {
            console.error(`Upload failed for ${file.name}:`, uploadError.message);
            continue;
        }

        filePaths.push(path);
    }

    return NextResponse.json({
        success: true,
        data: { file_paths: filePaths, uploaded: filePaths.length },
    });
}
