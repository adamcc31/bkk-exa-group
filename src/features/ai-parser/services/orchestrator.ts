// ============================================
// Inngest Orchestrator — AI Parse Worker (Post-Supabase)
// Unified single-call extraction pipeline
// ============================================

import { inngest } from "@/shared/lib/inngest";
import { query as systemQuery } from "@/shared/lib/db/client";
import { s3Client, BUCKET_NAME } from "@/shared/lib/storage/s3-client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { extractWithGemini } from "./gemini-extractor";
import { mapUnifiedToBkk } from "./data-mapper";
import { unifiedExtractionSchema } from "../types";
import type { StandardizedBkkData, DocumentType } from "@/shared/types";

/**
 * Inngest Function: parseDocument
 * Standardized for Inngest v3.54+ (2 arguments: config and trigger/handler object)
 */
export const parseDocument = inngest.createFunction(
    {
        id: "ai-parse-document",
        concurrency: { limit: 3 },
        retries: 2,
    },
    {
        event: "ai/parse.requested",
    },
    async ({ event, step }) => {
        const { job_id, file_path } = event.data;

        // Step 1: Update status to processing
        await step.run("update-status-processing", async () => {
            await systemQuery(
                "UPDATE ai_processing_jobs SET status = $1, started_at = $2, updated_at = now() WHERE id = $3",
                ["processing", new Date().toISOString(), job_id]
            );
        });

        // Step 2: Download image from storage (S3)
        const imageData = await step.run("download-image", async () => {
            try {
                const s3Res = await s3Client.send(
                    new GetObjectCommand({
                        Bucket: BUCKET_NAME,
                        Key: file_path,
                    })
                );

                if (!s3Res.Body) {
                    throw new Error("Empty body from S3");
                }

                // Convert stream to buffer
                const buffer = Buffer.from(await s3Res.Body.transformToByteArray());
                const base64 = buffer.toString("base64");
                const mimeType = file_path.endsWith(".png") ? "image/png" : "image/jpeg";

                return { base64, mimeType };
            } catch (error: any) {
                console.error("S3 Download Error:", error.message);
                throw new Error(`Failed to download file from S3: ${error.message}`);
            }
        });

        // Step 3: Extract with unified prompt (single API call)
        const extraction = await step.run("extract-unified", async () => {
            let documentType: DocumentType = "TIDAK_DIKENALI";
            let standardizedData: StandardizedBkkData | null = null;
            let rawOutput: Record<string, unknown> | null = null;

            try {
                // Single unified Gemini call — AI classifies + extracts
                const rawResult = await extractWithGemini(imageData.base64, imageData.mimeType);
                rawOutput = rawResult;

                // Validate against unified schema
                const parsed = unifiedExtractionSchema.safeParse(rawResult);

                if (parsed.success) {
                    documentType = parsed.data.jenis_dokumen;

                    if (documentType !== "TIDAK_DIKENALI" && parsed.data.jumlah_uang_total > 0) {
                        // Use AI-extracted nama_pt as company_name for downstream matching
                        standardizedData = mapUnifiedToBkk(parsed.data, parsed.data.nama_pt || "");
                    }
                }
            } catch (err) {
                console.error("AI extraction failed:", err);
            }

            return { documentType, standardizedData, rawOutput };
        });

        // Step 4: Persist results
        await step.run("persist-results", async () => {
            if (extraction.standardizedData) {
                await systemQuery(
                    `UPDATE ai_processing_jobs 
                     SET status = $1, 
                         document_type = $2, 
                         standardized_data = $3, 
                         total_amount = $4, 
                         raw_ai_output = $5, 
                         completed_at = now(),
                         updated_at = now()
                     WHERE id = $6`,
                    [
                        "completed",
                        extraction.documentType,
                        extraction.standardizedData,
                        extraction.standardizedData.info.total_amount,
                        extraction.rawOutput,
                        job_id,
                    ]
                );
            } else {
                await systemQuery(
                    `UPDATE ai_processing_jobs 
                     SET status = $1, 
                         document_type = $2, 
                         error_message = $3, 
                         raw_ai_output = $4, 
                         completed_at = now(),
                         updated_at = now()
                     WHERE id = $5`,
                    [
                        "failed",
                        "TIDAK_DIKENALI",
                        "Dokumen tidak dikenali. Tidak cocok dengan format BPN maupun Bukti Transfer Bank.",
                        extraction.rawOutput,
                        job_id,
                    ]
                );
            }
        });

        return {
            job_id,
            document_type: extraction.documentType,
            success: !!extraction.standardizedData,
        };
    }
);
