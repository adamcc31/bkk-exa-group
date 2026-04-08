// ============================================
// AI Parse → Save to Transaction
// POST /api/ai-parse/save-to-transaction
// Converts completed AI job into a real transaction
// Auto-detects company from AI-extracted nama_pt
// ============================================

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/features/auth";
import { PERMISSIONS } from "@/shared/lib/constants";
import { createClient } from "@supabase/supabase-js";
import type { StandardizedBkkData } from "@/shared/types";

// Service-role client bypasses RLS — needed for cross-company inserts
function getServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export const dynamic = "force-dynamic";

// Words to ignore when matching company names
const IGNORE_WORDS = new Set(["PT", "PT.", "CV", "CV.", "TBKK", "TBK", "INC", "LLC", "LTD"]);

/**
 * Fuzzy-match an AI-extracted company name against DB companies.
 * Extracts meaningful keywords from both strings and checks overlap.
 */
function findMatchingCompanyId(
    aiName: string,
    companies: Array<{ id: string; name: string }>
): string | null {
    if (!aiName) return null;

    const normalizeAndTokenize = (str: string): string[] =>
        str
            .toUpperCase()
            .replace(/[^A-Z0-9\s]/g, "")
            .split(/\s+/)
            .filter((w) => w.length > 2 && !IGNORE_WORDS.has(w));

    const aiTokens = normalizeAndTokenize(aiName);
    if (aiTokens.length === 0) return null;

    let bestMatch: { id: string; score: number } | null = null;

    for (const company of companies) {
        const dbTokens = normalizeAndTokenize(company.name);

        // Count how many AI tokens match DB tokens (substring match)
        let matchCount = 0;
        for (const aiToken of aiTokens) {
            for (const dbToken of dbTokens) {
                if (dbToken.includes(aiToken) || aiToken.includes(dbToken)) {
                    matchCount++;
                    break;
                }
            }
        }

        if (matchCount > 0) {
            const score = matchCount / Math.max(aiTokens.length, dbTokens.length);
            if (!bestMatch || score > bestMatch.score) {
                bestMatch = { id: company.id, score };
            }
        }
    }

    // Require at least 1 keyword match
    return bestMatch ? bestMatch.id : null;
}

export async function POST(request: NextRequest) {
    const { session, error } = await requireAuth(PERMISSIONS.AI_PARSE_UPLOAD);
    if (error) return error;

    const body = await request.json();
    const { job_ids } = body as { job_ids: string[] };

    if (!job_ids || !Array.isArray(job_ids) || job_ids.length === 0) {
        return NextResponse.json(
            {
                success: false,
                error: { code: "VALIDATION_ERROR", message: "job_ids required" },
            },
            { status: 400 }
        );
    }

    const supabase = getServiceClient();
    const createdIds: string[] = [];
    const errors: Array<{ job_id: string; message: string }> = [];

    // Fetch logged-in user's full_name
    const { data: currentUser } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", session.user.id)
        .single();
    const userName = currentUser?.full_name ?? "";

    // Fetch all companies for matching
    const { data: allCompanies } = await supabase
        .from("companies")
        .select("id, name")
        .eq("is_active", true);

    for (const jobId of job_ids) {
        // 1. Fetch the completed job
        const { data: job, error: fetchErr } = await supabase
            .from("ai_processing_jobs")
            .select("*")
            .eq("id", jobId)
            .eq("status", "completed")
            .single();

        if (fetchErr || !job) {
            errors.push({ job_id: jobId, message: "Job tidak ditemukan atau belum selesai" });
            continue;
        }

        const std = job.standardized_data as StandardizedBkkData | null;
        if (!std) {
            errors.push({ job_id: jobId, message: "Data standar tidak tersedia" });
            continue;
        }

        // 2. Auto-detect company from AI-extracted company name
        const aiCompanyName = std.header.company_name || "";
        const matchedCompanyId = allCompanies
            ? findMatchingCompanyId(aiCompanyName, allCompanies)
            : null;
        const targetCompanyId = matchedCompanyId || session.activeCompanyId;

        // 3. Generate BKK number for the target company
        const { data: bkkNumber, error: numErr } = await supabase.rpc(
            "generate_bkk_number",
            {
                p_company_id: targetCompanyId,
                p_type: std.header.transaction_type || "BKK",
            }
        );

        if (numErr) {
            errors.push({ job_id: jobId, message: `Gagal generate nomor: ${numErr.message}` });
            continue;
        }

        // 4. Insert transaction — paid_to and received_by from logged-in user
        const { data: transaction, error: txErr } = await supabase
            .from("transactions")
            .insert({
                company_id: targetCompanyId,
                created_by: session.user.id,
                type: std.header.transaction_type || "BKK",
                payment_type: std.header.payment_type || "BANK",
                transaction_date: std.header.transaction_date,
                total_amount: std.info.total_amount,
                purpose: std.info.purpose,
                division: std.info.division || "FINANCE",
                department: std.info.department || "GENERAL",
                paid_to_name: userName,
                bkk_number: bkkNumber as string,
                received_by: userName,
                paid_by: std.signatories.paid_by || "BU NURUL",
                approved_by: std.signatories.approved_by || "PAK NOVI",
                note: `Auto-generated from AI Parser (Job: ${jobId})`,
                status: "draft",
            })
            .select("id")
            .single();

        if (txErr || !transaction) {
            errors.push({ job_id: jobId, message: `Gagal simpan transaksi: ${txErr?.message}` });
            continue;
        }

        // 5. Insert transaction items
        if (std.rows.length > 0) {
            const { error: itemsErr } = await supabase
                .from("transaction_items")
                .insert(
                    std.rows.map((row) => ({
                        transaction_id: transaction.id,
                        item_order: row.no,
                        description: row.description,
                        account_code: row.account_code || "",
                        amount: row.amount,
                    }))
                );

            if (itemsErr) {
                errors.push({ job_id: jobId, message: `Items gagal: ${itemsErr.message}` });
                continue;
            }
        }

        // 6. Mark AI job as exported
        await supabase
            .from("ai_processing_jobs")
            .update({ status: "exported" as string })
            .eq("id", jobId);

        createdIds.push(transaction.id);
    }

    return NextResponse.json({
        success: true,
        data: {
            created_transaction_ids: createdIds,
            total_created: createdIds.length,
            errors: errors.length > 0 ? errors : undefined,
        },
    });
}
