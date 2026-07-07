/**
 * Dry-Run Test: app_runtime Role Connection Verification
 * 
 * Script ini menguji koneksi REAL menggunakan role app_runtime
 * (bukan SET ROLE dalam sesi superuser).
 * 
 * Setiap test case dijalankan dalam transaksi terisolasi sendiri
 * agar satu test negatif (RLS violation) tidak meng-abort test lain.
 * 
 * Test cases:
 *   A: SELECT isolasi (staff hanya lihat data sendiri)
 *   B: INSERT valid (company sendiri)
 *   C: INSERT cross-tenant (harus ditolak 42501)
 *   D: UPDATE milik sendiri (sukses)
 *   E: UPDATE milik tenant lain (diblokir)
 *   F: DELETE (soft-delete) milik sendiri (sukses)
 *   G: get_dashboard_stats (sukses tanpa error permission)
 */

import "dotenv/config";
import { Pool } from "pg";

// ====== CONFIG ======
const ADMIN_URL = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
const APP_URL = process.env.DATABASE_APP_URL;

if (!APP_URL) {
    console.error("❌ FATAL: DATABASE_APP_URL tidak di-set! Tidak bisa menjalankan dry-run.");
    process.exit(1);
}

if (!ADMIN_URL) {
    console.error("❌ FATAL: DATABASE_ADMIN_URL tidak di-set!");
    process.exit(1);
}

const adminPool = new Pool({ connectionString: ADMIN_URL, ssl: { rejectUnauthorized: false } });
const appPool = new Pool({ connectionString: APP_URL, ssl: { rejectUnauthorized: false } });

// Test UUIDs
const TEST_USER_ID = "d0000000-0000-0000-0000-000000000099";
const TEST_COMPANY_ID = "d0000000-0000-0000-0000-000000000001";
const OTHER_COMPANY_ID = "d0000000-0000-0000-0000-000000000002";

// Track test results
interface TestResult {
    id: string;
    name: string;
    status: "✅ PASS" | "❌ FAIL" | "❌ ERROR";
    details: string;
}

const results: TestResult[] = [];

function addResult(id: string, name: string, status: TestResult["status"], details: string) {
    results.push({ id, name, status, details });
    console.log(`[Test ${id}] ${name}: ${status} — ${details}`);
}

// ====== SETUP: Create test data using admin (bypass RLS) ======
async function setupTestData(adminClient: any) {
    console.log("\n🔧 SETUP: Creating test data via admin pool...");

    // Create test companies (idempotent)
    await adminClient.query(`
        INSERT INTO companies (id, name, short_code, is_active)
        VALUES ($1, 'DRYRUN_COMPANY_A', 'DCA', true)
        ON CONFLICT (id) DO NOTHING
    `, [TEST_COMPANY_ID]);

    await adminClient.query(`
        INSERT INTO companies (id, name, short_code, is_active)
        VALUES ($1, 'DRYRUN_COMPANY_B', 'DCB', true)
        ON CONFLICT (id) DO NOTHING
    `, [OTHER_COMPANY_ID]);

    // Create test user in auth_users (idempotent)
    await adminClient.query(`
        INSERT INTO auth_users (id, email, hashed_password)
        VALUES ($1, 'dryrun-test@exata.co.id', '$2b$10$dummyhash')
        ON CONFLICT (id) DO NOTHING
    `, [TEST_USER_ID]);

    // Create test user profile (idempotent)
    await adminClient.query(`
        INSERT INTO users (id, email, full_name, company_id, role_id, is_active)
        VALUES ($1, 'dryrun-test@exata.co.id', 'Dry Run Test User', $2, 
                (SELECT id FROM roles WHERE name = 'staff' LIMIT 1), true)
        ON CONFLICT (id) DO UPDATE SET company_id = $2, is_active = true
    `, [TEST_USER_ID, TEST_COMPANY_ID]);

    // Create a transaction belonging to OTHER_COMPANY (for test E)
    // Use a known UUID so we can reference it in test E
    const otherTxId = "d0000000-0000-0000-0000-000000000088";
    await adminClient.query(`
        INSERT INTO transactions (id, company_id, created_by, type, payment_type, 
            transaction_date, total_amount, purpose, division, department, paid_to_name, status)
        VALUES ($1, $2, $3, 'BKK', 'CASH', CURRENT_DATE, 999000, 
                'DRYRUN_OTHER_COMPANY_TX', 'IT', 'GENERAL', 'Other Vendor', 'draft')
        ON CONFLICT (id) DO NOTHING
    `, [otherTxId, OTHER_COMPANY_ID, TEST_USER_ID]);

    console.log("✅ SETUP: Test data created.\n");
    return otherTxId;
}

// ====== HELPER: Set RLS context for app_runtime ======
async function setAppContext(client: any, userId: string, role: string, ownCompanyId: string, activeCompanyId: string) {
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
    await client.query("SELECT set_config('app.user_role', $1, true)", [role]);
    await client.query("SELECT set_config('app.own_company_id', $1, true)", [ownCompanyId]);
    await client.query("SELECT set_config('app.active_company_id', $1, true)", [activeCompanyId]);
}

// ====== CLEANUP ======
async function cleanupTestData(adminClient: any) {
    console.log("\n🧹 CLEANUP: Removing test data...");
    try {
        await adminClient.query("DELETE FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE purpose = 'DRYRUN_OTHER_COMPANY_TX' OR purpose = 'DRYRUN_VALID_INSERT' OR purpose = 'DRYRUN_UPDATE_TEST' OR purpose = 'DRYRUN_DELETE_TEST')");
        await adminClient.query("DELETE FROM transactions WHERE purpose IN ('DRYRUN_OTHER_COMPANY_TX', 'DRYRUN_VALID_INSERT', 'DRYRUN_UPDATE_TEST', 'DRYRUN_DELETE_TEST')");
        await adminClient.query("DELETE FROM users WHERE id = $1", [TEST_USER_ID]);
        await adminClient.query("DELETE FROM auth_users WHERE id = $1", [TEST_USER_ID]);
        await adminClient.query("DELETE FROM companies WHERE id IN ($1, $2)", [TEST_COMPANY_ID, OTHER_COMPANY_ID]);
        console.log("✅ CLEANUP: Done.");
    } catch (e: any) {
        console.warn("⚠️ CLEANUP: Some items could not be cleaned:", e.message);
    }
}

// ====== TEST A: SELECT Isolation ======
async function testA(): Promise<void> {
    const client = await appPool.connect();
    try {
        await client.query("BEGIN");
        await setAppContext(client, TEST_USER_ID, "staff", TEST_COMPANY_ID, TEST_COMPANY_ID);

        // Insert a row as admin first for assertion (we'll check it's NOT visible)
        // Actually, we already have DRYRUN_OTHER_COMPANY_TX in OTHER_COMPANY
        // Staff with COMPANY_ID = TEST_COMPANY_ID should NOT see OTHER_COMPANY transactions
        const res = await client.query(
            `SELECT * FROM transactions WHERE company_id = $1 AND purpose LIKE 'DRYRUN_%'`,
            [TEST_COMPANY_ID]
        );
        // Should return 0 rows (no DRYRUN data in our own company yet)
        const ownRows = res.rows.length;

        const resOther = await client.query(
            `SELECT * FROM transactions WHERE purpose = 'DRYRUN_OTHER_COMPANY_TX'`
        );
        const crossTenantRows = resOther.rows.length;

        if (crossTenantRows === 0) {
            addResult("A", "SELECT Isolation (Staff tidak lihat data company lain)", "✅ PASS",
                `Own company rows: ${ownRows}, Cross-tenant rows: ${crossTenantRows} (correctly hidden)`);
        } else {
            addResult("A", "SELECT Isolation (Staff tidak lihat data company lain)", "❌ FAIL",
                `Staff melihat ${crossTenantRows} baris milik company lain! Data bocor.`);
        }

        await client.query("ROLLBACK");
    } catch (e: any) {
        addResult("A", "SELECT Isolation", "❌ ERROR", e.message);
        await client.query("ROLLBACK").catch(() => {});
    } finally {
        client.release();
    }
}

// ====== TEST B: INSERT Valid (Own Company) ======
async function testB(): Promise<string | null> {
    const client = await appPool.connect();
    let txId: string | null = null;
    try {
        await client.query("BEGIN");
        await setAppContext(client, TEST_USER_ID, "staff", TEST_COMPANY_ID, TEST_COMPANY_ID);

        const res = await client.query(`
            INSERT INTO transactions (company_id, created_by, type, payment_type, 
                transaction_date, total_amount, purpose, division, department, paid_to_name, status)
            VALUES ($1, $2, 'BKK', 'CASH', CURRENT_DATE, 50000, 
                    'DRYRUN_VALID_INSERT', 'IT', 'GENERAL', 'Test Vendor', 'draft')
            RETURNING id
        `, [TEST_COMPANY_ID, TEST_USER_ID]);

        txId = res.rows[0]?.id;
        if (txId) {
            addResult("B", "INSERT Valid (Own Company)", "✅ PASS",
                `Berhasil insert transaksi dengan id=${txId}`);
        } else {
            addResult("B", "INSERT Valid (Own Company)", "❌ FAIL",
                "INSERT berhasil tapi tidak mengembalikan id");
        }

        await client.query("COMMIT");
    } catch (e: any) {
        addResult("B", "INSERT Valid (Own Company)", "❌ ERROR", e.message);
        await client.query("ROLLBACK").catch(() => {});
        txId = null;
    } finally {
        client.release();
    }
    return txId;
}

// ====== TEST C: INSERT Cross-Tenant (Harus Ditolak 42501) ======
async function testC(): Promise<void> {
    const client = await appPool.connect();
    try {
        await client.query("BEGIN");
        await setAppContext(client, TEST_USER_ID, "staff", TEST_COMPANY_ID, TEST_COMPANY_ID);

        await client.query(`
            INSERT INTO transactions (company_id, created_by, type, payment_type, 
                transaction_date, total_amount, purpose, division, department, paid_to_name, status)
            VALUES ($1, $2, 'BKK', 'CASH', CURRENT_DATE, 50000, 
                    'DRYRUN_MALICIOUS_INSERT', 'IT', 'GENERAL', 'Attacker', 'draft')
        `, [OTHER_COMPANY_ID, TEST_USER_ID]);

        // Jika sampai sini, berarti RLS GAGAL memblokir
        addResult("C", "INSERT Cross-Tenant (Harus Ditolak)", "❌ FAIL",
            "INSERT cross-tenant BERHASIL — RLS WITH CHECK tidak bekerja!");
        await client.query("ROLLBACK");
    } catch (e: any) {
        // Cek apakah error code 42501 (insufficient_privilege) atau check_violation
        if (e.code === "42501" || e.code === "23514" || 
            e.message?.includes("row-level security policy") ||
            e.message?.includes("new row violates row-level security")) {
            addResult("C", "INSERT Cross-Tenant (Harus Ditolak)", "✅ PASS",
                `Berhasil diblokir. Error code: ${e.code}, Message: ${e.message.substring(0, 120)}`);
        } else {
            addResult("C", "INSERT Cross-Tenant (Harus Ditolak)", "❌ ERROR",
                `Error tidak terduga. Code: ${e.code}, Message: ${e.message}`);
        }
        await client.query("ROLLBACK").catch(() => {});
    } finally {
        client.release();
    }
}

// ====== TEST D: UPDATE Milik Sendiri ======
async function testD(ownTxId: string | null): Promise<void> {
    if (!ownTxId) {
        addResult("D", "UPDATE Milik Sendiri", "❌ ERROR", "Tidak ada transaksi untuk di-update (Test B gagal)");
        return;
    }

    const client = await appPool.connect();
    try {
        await client.query("BEGIN");
        await setAppContext(client, TEST_USER_ID, "staff", TEST_COMPANY_ID, TEST_COMPANY_ID);

        const res = await client.query(`
            UPDATE transactions SET purpose = 'DRYRUN_VALID_INSERT_UPDATED', updated_at = now()
            WHERE id = $1
        `, [ownTxId]);

        if (res.rowCount === 1) {
            addResult("D", "UPDATE Milik Sendiri", "✅ PASS",
                `Berhasil update transaksi ${ownTxId}. Rows affected: ${res.rowCount}`);
        } else {
            addResult("D", "UPDATE Milik Sendiri", "❌ FAIL",
                `Rows affected: ${res.rowCount} (expected 1). Kemungkinan RLS USING memblokir.`);
        }

        await client.query("COMMIT");
    } catch (e: any) {
        addResult("D", "UPDATE Milik Sendiri", "❌ ERROR", e.message);
        await client.query("ROLLBACK").catch(() => {});
    } finally {
        client.release();
    }
}

// ====== TEST E: UPDATE Milik Tenant Lain ======
async function testE(otherTxId: string): Promise<void> {
    const client = await appPool.connect();
    try {
        await client.query("BEGIN");
        await setAppContext(client, TEST_USER_ID, "staff", TEST_COMPANY_ID, TEST_COMPANY_ID);

        const res = await client.query(`
            UPDATE transactions SET purpose = 'DRYRUN_HACKED', updated_at = now()
            WHERE id = $1
        `, [otherTxId]);

        if (res.rowCount === 0) {
            addResult("E", "UPDATE Milik Tenant Lain (Diblokir)", "✅ PASS",
                `Rows affected: 0. Transaksi tenant lain tidak bisa di-update.`);
        } else {
            addResult("E", "UPDATE Milik Tenant Lain (Diblokir)", "❌ FAIL",
                `Rows affected: ${res.rowCount}. RLS USING gagal memblokir update cross-tenant!`);
        }

        await client.query("COMMIT");
    } catch (e: any) {
        // Error juga acceptable (RLS might throw instead of returning 0 rows)
        if (e.code === "42501" || e.message?.includes("row-level security")) {
            addResult("E", "UPDATE Milik Tenant Lain (Diblokir)", "✅ PASS",
                `Diblokir oleh RLS. Error: ${e.code} - ${e.message.substring(0, 100)}`);
        } else {
            addResult("E", "UPDATE Milik Tenant Lain (Diblokir)", "❌ ERROR",
                `Error tidak terduga: ${e.code} - ${e.message}`);
        }
        await client.query("ROLLBACK").catch(() => {});
    } finally {
        client.release();
    }
}

// ====== TEST F: DELETE (Soft-Delete) Milik Sendiri ======
async function testF(ownTxId: string | null): Promise<void> {
    if (!ownTxId) {
        addResult("F", "Soft-Delete Milik Sendiri", "❌ ERROR", "Tidak ada transaksi untuk di-delete (Test B gagal)");
        return;
    }

    const client = await appPool.connect();
    try {
        await client.query("BEGIN");
        await setAppContext(client, TEST_USER_ID, "staff", TEST_COMPANY_ID, TEST_COMPANY_ID);

        const res = await client.query(`
            UPDATE transactions SET is_deleted = true, updated_at = now()
            WHERE id = $1
        `, [ownTxId]);

        if (res.rowCount === 1) {
            addResult("F", "Soft-Delete Milik Sendiri", "✅ PASS",
                `Berhasil soft-delete transaksi ${ownTxId}. Rows affected: ${res.rowCount}`);
        } else {
            addResult("F", "Soft-Delete Milik Sendiri", "❌ FAIL",
                `Rows affected: ${res.rowCount} (expected 1).`);
        }

        await client.query("COMMIT");
    } catch (e: any) {
        addResult("F", "Soft-Delete Milik Sendiri", "❌ ERROR", e.message);
        await client.query("ROLLBACK").catch(() => {});
    } finally {
        client.release();
    }
}

// ====== TEST G: get_dashboard_stats ======
async function testG(): Promise<void> {
    const client = await appPool.connect();
    try {
        await client.query("BEGIN");
        await setAppContext(client, TEST_USER_ID, "staff", TEST_COMPANY_ID, TEST_COMPANY_ID);

        const res = await client.query(`SELECT * FROM get_dashboard_stats($1, NULL, NULL)`, [TEST_COMPANY_ID]);

        if (res.rows.length > 0) {
            const row = res.rows[0];
            addResult("G", "get_dashboard_stats (Security Invoker)", "✅ PASS",
                `Berhasil. total_bkm=${row.total_bkm}, total_bkk=${row.total_bkk}, total_transactions=${row.total_transactions}`);
        } else {
            addResult("G", "get_dashboard_stats (Security Invoker)", "❌ FAIL",
                "Query berhasil tapi mengembalikan 0 baris.");
        }

        await client.query("COMMIT");
    } catch (e: any) {
        addResult("G", "get_dashboard_stats (Security Invoker)", "❌ ERROR",
            `Error: code=${e.code}, message=${e.message.substring(0, 150)}`);
        await client.query("ROLLBACK").catch(() => {});
    } finally {
        client.release();
    }
}

// ====== MAIN ======
async function main() {
    console.log("=" .repeat(60));
    console.log("DRY-RUN TEST: app_runtime Role Verification");
    console.log(`Connecting as: ${APP_URL.replace(/:[^@]+@/, ':***@')}`);
    console.log("=" .repeat(60));

    // 1. Verify we are NOT superuser via app_runtime connection
    const verifyClient = await appPool.connect();
    try {
        const roleRes = await verifyClient.query(
            "SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"
        );
        const { current_user, rolsuper, rolbypassrls } = roleRes.rows[0];
        console.log(`\n🔒 Connection verified: user=${current_user}, superuser=${rolsuper}, bypassrls=${rolbypassrls}`);
        
        if (rolsuper || rolbypassrls) {
            console.error("❌ FATAL: app_runtime koneksi masih memiliki SUPERUSER atau BYPASSRLS! Aborting.");
            process.exit(1);
        }
        console.log("✅ Role verification PASSED: non-superuser, no bypassrls.\n");
    } finally {
        verifyClient.release();
    }

    // 2. Setup test data via admin pool
    const adminClient = await adminPool.connect();
    let otherTxId: string;
    try {
        otherTxId = await setupTestData(adminClient);
    } finally {
        adminClient.release();
    }

    // 3. Run tests A-G (each in isolated transaction)
    await testA();
    const ownTxId = await testB();
    await testC();
    await testD(ownTxId);
    await testE(otherTxId);
    await testF(ownTxId);
    await testG();

    // 4. Cleanup
    const cleanupClient = await adminPool.connect();
    try {
        await cleanupTestData(cleanupClient);
    } finally {
        cleanupClient.release();
    }

    // 5. Print summary
    console.log("\n" + "=".repeat(60));
    console.log("HASIL DRY-RUN TEST");
    console.log("=".repeat(60));
    console.log("| Test | Skenario | Hasil | Detail |");
    console.log("|:---|:---|:---|:---|");

    let passCount = 0;
    for (const r of results) {
        console.log(`| ${r.id} | ${r.name} | ${r.status} | ${r.details.substring(0, 80)} |`);
        if (r.status === "✅ PASS") passCount++;
    }

    console.log(`\nTotal: ${passCount}/${results.length} PASS`);
    
    const allPassed = results.every(r => r.status === "✅ PASS");
    if (allPassed) {
        console.log("🟢 SEMUA TEST DRY-RUN PASS — app_runtime siap digunakan di production.");
    } else {
        console.log("🔴 ADA TEST YANG GAGAL — investigasi sebelum lanjut ke Step 8!");
        process.exit(1);
    }

    await adminPool.end();
    await appPool.end();
}

main().catch((e) => {
    console.error("❌ FATAL ERROR:", e);
    process.exit(1);
});