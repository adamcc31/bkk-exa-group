// ============================================
// AI Parse → Save to Transaction (Post-Supabase)
// POST /api/ai-parse/save-to-transaction
// ============================================

import { NextResponse, type NextRequest } from "next/server";
import { withDbContext } from "@/shared/lib/db/client";
import type { StandardizedBkkData } from "@/shared/types";
import { getAuthSession } from "@/features/auth";

export const dynamic = "force-dynamic";

const IGNORE_WORDS = new Set(["PT", "PT.", "CV", "CV.", "TBKK", "TBK", "INC", "LLC", "LTD"]);

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
    return bestMatch ? bestMatch.id : null;
}

export async function POST(request: NextRequest) {
    const session = await getAuthSession();

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const activeCompanyId = session.activeCompanyId;
    const ownCompanyId = session.user.company_id;
    const userRole = session.role;

    try {
        const { job_ids } = (await request.json()) as { job_ids: string[] };

        if (!job_ids || !Array.isArray(job_ids) || job_ids.length === 0) {
            return NextResponse.json({ error: "job_ids required" }, { status: 400 });
        }

        const createdIds: string[] = [];
        const errors: Array<{ job_id: string; message: string }> = [];

        // Use withDbContext to ensure RLS is enforced during the whole process
        await withDbContext(userId, activeCompanyId, userRole, ownCompanyId, async (client) => {
            // 1. Fetch current user and all companies (pre-loop)
            // Note: withDbContext already handles BEGIN/COMMIT for the callback,
            // but since we are doing manual transactions inside the loop, we must be careful.
            // Actually, it's better to let withDbContext wrap the outer scope.
            
            const userRes = await client.query("SELECT full_name FROM users WHERE id = $1", [userId]);
            const userName = userRes.rows[0]?.full_name ?? "Unknown";

            const companiesRes = await client.query(
                "SELECT id, name FROM companies WHERE is_active = true"
            );
            const allCompanies = companiesRes.rows;

            for (const jobId of job_ids) {
                try {
                    // Manual sub-transaction using SAVEPOINT if needed, 
                    // but here we just execute within the same transaction for simplicity.
                    // If one fails, we want to know, but we don't necessarily want to rollback everything.
                    // However, withDbContext wraps the whole callback in BEGIN/COMMIT.
                    // To handle individual job failure, we'll use a nested transaction pattern.

                    await client.query(`SAVEPOINT job_${jobId.replace(/-/g, '_')}`);

                    // 2. Fetch the completed job
                    const jobRes = await client.query(
                        "SELECT * FROM ai_processing_jobs WHERE id = $1 AND status = $2",
                        [jobId, "completed"]
                    );

                    if (jobRes.rowCount === 0) {
                        throw new Error("Job tidak ditemukan atau belum selesai");
                    }

                    const job = jobRes.rows[0];
                    const std = job.standardized_data as StandardizedBkkData;

                    // 3. Match Company
                    const aiCompanyName = std.header.company_name || "";
                    const matchedCompanyId = findMatchingCompanyId(aiCompanyName, allCompanies);
                    const targetCompanyId = matchedCompanyId || activeCompanyId;

                    // 4. Generate BKK Number
                    const numRes = await client.query(
                        "SELECT generate_bkk_number($1, $2) as bkk_number",
                        [targetCompanyId, std.header.transaction_type || "BKK"]
                    );
                    const bkkNumber = numRes.rows[0].bkk_number;

                    // 5. Insert Transaction
                    const txRes = await client.query(
                        `INSERT INTO transactions (
                            company_id, created_by, type, payment_type, transaction_date, 
                            total_amount, purpose, division, department, paid_to_name, 
                            bkk_number, received_by, paid_by, approved_by, note, status
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                        RETURNING id`,
                        [
                            targetCompanyId,
                            userId,
                            std.header.transaction_type || "BKK",
                            std.header.payment_type || "BANK",
                            std.header.transaction_date,
                            std.info.total_amount,
                            std.info.purpose,
                            std.info.division || "FINANCE",
                            std.info.department || "GENERAL",
                            userName,
                            bkkNumber,
                            userName,
                            std.signatories.paid_by || "BU NURUL",
                            std.signatories.approved_by || "PAK NOVI",
                            `Auto-generated from AI Parser (Job: ${jobId})`,
                            "draft",
                        ]
                    );
                    const transactionId = txRes.rows[0].id;

                    // 6. Insert Items
                    if (std.rows && std.rows.length > 0) {
                        for (const row of std.rows) {
                            await client.query(
                                `INSERT INTO transaction_items (transaction_id, item_order, description, account_code, amount)
                                 VALUES ($1, $2, $3, $4, $5)`,
                                [transactionId, row.no, row.description, row.account_code || "", row.amount]
                            );
                        }
                    }

                    // 7. Mark job as exported
                    await client.query(
                        "UPDATE ai_processing_jobs SET status = $1, updated_at = now() WHERE id = $2",
                        ["exported", jobId]
                    );

                    await client.query(`RELEASE SAVEPOINT job_${jobId.replace(/-/g, '_')}`);
                    createdIds.push(transactionId);
                } catch (innerError: any) {
                    await client.query(`ROLLBACK TO SAVEPOINT job_${jobId.replace(/-/g, '_')}`);
                    errors.push({ job_id: jobId, message: innerError.message });
                }
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                created_transaction_ids: createdIds,
                total_created: createdIds.length,
                errors: errors.length > 0 ? errors : undefined,
            },
        });
    } catch (error: any) {
        console.error("Save to Transaction Error:", error.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
