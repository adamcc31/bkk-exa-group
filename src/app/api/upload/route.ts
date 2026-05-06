import { NextResponse, type NextRequest } from "next/server";
import { uploadFile } from "@/shared/lib/storage/storage.service";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/**
 * S3-compatible File Upload API
 * POST /api/upload
 */
export async function POST(request: NextRequest) {
    // 1. Authenticated context from Middleware headers
    const userId = request.headers.get("x-user-id");
    const activeCompanyId = request.headers.get("x-active-company-id");

    if (!userId || !activeCompanyId) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    try {
        const formData = await request.formData();
        const files = formData.getAll("files") as File[];

        if (!files || files.length === 0) {
            return NextResponse.json(
                { error: "No files provided" },
                { status: 400 }
            );
        }

        const uploadedPaths: string[] = [];

        for (const file of files) {
            // Validation: Type
            if (!ALLOWED_TYPES.includes(file.type)) {
                console.warn(`File type not allowed: ${file.type}`);
                continue;
            }

            const timestamp = Date.now();
            const randomId = crypto.randomBytes(4).toString("hex");
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            
            // Path structure: company_id/timestamp_random_safename
            const path = `${activeCompanyId}/${timestamp}_${randomId}_${safeName}`;

            const buffer = Buffer.from(await file.arrayBuffer());

            try {
                const { key } = await uploadFile(path, buffer, file.type);
                uploadedPaths.push(key);
            } catch (err) {
                console.error(`Failed to upload ${file.name} to S3:`, err);
                // Continue with other files if one fails
            }
        }

        if (uploadedPaths.length === 0) {
            return NextResponse.json(
                { error: "Upload failed for all files" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: { 
                file_paths: uploadedPaths, 
                uploaded: uploadedPaths.length 
            },
        });
    } catch (error: any) {
        console.error("Upload Route Error:", error.message);
        return NextResponse.json(
            { error: "Internal server error during upload" },
            { status: 500 }
        );
    }
}
