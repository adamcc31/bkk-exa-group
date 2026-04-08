// ============================================
// Inngest Orchestrator — AI Parse Worker
// Unified single-call extraction pipeline
// ============================================

import { inngest } from "@/shared/lib/inngest";
import { createClient } from "@supabase/supabase-js";
import { extractWithGemini } from "./gemini-extractor";
import { mapUnifiedToBkk } from "./data-mapper";
import { unifiedExtractionSchema } from "../types";
import type { StandardizedBkkData, DocumentType } from "@/shared/types";

// Service-role client for background worker (bypasses RLS)
function getServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export const parseDocument = inngest.createFunction(
    {
        id: "ai-parse-document",
        concurrency: { limit: 3 },
        retries: 2,
    },
    { event: "ai/parse.requested" },
    async ({ event, step }) => {
        const { job_id, file_path, company_id } = event.data;
        const supabase = getServiceClient();

        // Step 1: Update status to processing
        await step.run("update-status-processing", async () => {
            await supabase
                .from("ai_processing_jobs")
                .update({
                    status: "processing",
                    started_at: new Date().toISOString(),
                })
                .eq("id", job_id);
        });

        // Step 2: Download image from storage
        const imageData = await step.run("download-image", async () => {
            const { data, error } = await supabase.storage
                .from("uploads")
                .download(file_path);

            if (error || !data) {
                throw new Error(`Failed to download file: ${error?.message}`);
            }

            const buffer = Buffer.from(await data.arrayBuffer());
            const base64 = buffer.toString("base64");
            const mimeType = file_path.endsWith(".png")
                ? "image/png"
                : "image/jpeg";

            return { base64, mimeType };
        });

        // Step 3: Extract with unified prompt (single API call)
        const extraction = await step.run("extract-unified", async () => {
            let documentType: DocumentType = "TIDAK_DIKENALI";
            let standardizedData: StandardizedBkkData | null = null;
            let rawOutput: Record<string, unknown> | null = null;

            try {
                // Single unified Gemini call — AI classifies + extracts
                const rawResult = await extractWithGemini(
                    imageData.base64,
                    imageData.mimeType
                );
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
                await supabase
                    .from("ai_processing_jobs")
                    .update({
                        status: "completed",
                        document_type: extraction.documentType,
                        standardized_data: extraction.standardizedData,
                        total_amount: extraction.standardizedData.info.total_amount,
                        raw_ai_output: extraction.rawOutput,
                        completed_at: new Date().toISOString(),
                    })
                    .eq("id", job_id);
            } else {
                await supabase
                    .from("ai_processing_jobs")
                    .update({
                        status: "failed",
                        document_type: "TIDAK_DIKENALI",
                        error_message:
                            "Dokumen tidak dikenali. Tidak cocok dengan format BPN maupun Bukti Transfer Bank.",
                        raw_ai_output: extraction.rawOutput,
                        completed_at: new Date().toISOString(),
                    })
                    .eq("id", job_id);
            }
        });

        return {
            job_id,
            document_type: extraction.documentType,
            success: !!extraction.standardizedData,
        };
    }
);
