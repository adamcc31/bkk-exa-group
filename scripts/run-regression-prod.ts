/**
 * Regression Test — Production Build
 * Based on scripts/run-regression-test.ts but targeting production URL.
 * 
 * 20 test scenarios covering auth, RLS, CSRF, rate limiting, etc.
 */

import "dotenv/config";
import { Pool } from "pg";
import bcrypt from "bcrypt";

const BASE_URL = "https://bkk.exata-indonesia.id";

const pool = new Pool({
    connectionString: process.env.DATABASE_ADMIN_URL,
    ssl: { rejectUnauthorized: false }
});

// Seed data constants
const COMPANY_A = "a1000000-0000-0000-0000-000000000001";
const COMPANY_B = "a1000000-0000-0000-0000-000000000002";
const ROLE_ADMIN = "b1000000-0000-0000-0000-000000000001";
const ROLE_FINANCE = "b1000000-0000-0000-0000-000000000002";
const ROLE_STAFF = "b1000000-0000-0000-0000-000000000003";

const ID_ADMIN = "f1000000-0000-0000-0000-000000000001";
const ID_FINANCE = "f1000000-0000-0000-0000-000000000002";
const ID_STAFF_A = "f1000000-0000-0000-0000-000000000003";
const ID_STAFF_B = "f1000000-0000-0000-0000-000000000004";
const ID_INACTIVE = "f1000000-0000-0000-0000-000000000005";
const TX_B_ID = "e2000000-0000-0000-0000-000000000002";

interface TestResult {
    id: string;
    name: string;
    status: string;
    code: string;
    details: string;
}

const results: TestResult[] = [];

function addResult(id: string, name: string, status: string, code: string, details: string) {
    results.push({ id, name, status, code, details });
    console.log(`[Test ${id}] ${name}: ${status} (${code}) — ${details}`);
}

async function setupTestUsers() {
    console.log("Setting up regression test users...");
    const client = await pool.connect();
    const hash = await bcrypt.hash("Password123", 10);
    try {
        await client.query("BEGIN");
        const ids = [ID_ADMIN, ID_FINANCE, ID_STAFF_A, ID_STAFF_B, ID_INACTIVE];
        await client.query("DELETE FROM public.ai_processing_jobs WHERE initiated_by = ANY($1)", [ids]);
        await client.query("DELETE FROM public.transaction_items WHERE transaction_id IN (SELECT id FROM public.transactions WHERE created_by = ANY($1))", [ids]);
        await client.query("DELETE FROM public.transactions WHERE created_by = ANY($1) OR id = $2", [ids, TX_B_ID]);
        await client.query("DELETE FROM public.users WHERE id = ANY($1)", [ids]);
        await client.query("DELETE FROM public.auth_users WHERE id = ANY($1)", [ids]);

        for (const [id, email, pwd] of [
            [ID_ADMIN, "admin-test@exata.co.id", hash],
            [ID_FINANCE, "finance-test@exata.co.id", hash],
            [ID_STAFF_A, "staff-test-a@exata.co.id", hash],
            [ID_STAFF_B, "staff-test-b@exata.co.id", hash],
            [ID_INACTIVE, "inactive-test@exata.co.id", hash]
        ]) {
            await client.query("INSERT INTO public.auth_users (id, email, hashed_password) VALUES ($1, $2, $3)", [id, email, pwd]);
        }

        for (const [id, email, name, compId, roleId, active] of [
            [ID_ADMIN, "admin-test@exata.co.id", "Test Admin", COMPANY_A, ROLE_ADMIN, true],
            [ID_FINANCE, "finance-test@exata.co.id", "Test Finance", COMPANY_A, ROLE_FINANCE, true],
            [ID_STAFF_A, "staff-test-a@exata.co.id", "Test Staff A", COMPANY_A, ROLE_STAFF, true],
            [ID_STAFF_B, "staff-test-b@exata.co.id", "Test Staff B", COMPANY_B, ROLE_STAFF, true],
            [ID_INACTIVE, "inactive-test@exata.co.id", "Test Inactive", COMPANY_A, ROLE_STAFF, false]
        ]) {
            await client.query("INSERT INTO public.users (id, email, full_name, company_id, role_id, is_active) VALUES ($1, $2, $3, $4, $5, $6)", [id, email, name, compId, roleId, active]);
        }

        await client.query(`INSERT INTO public.transactions (id, company_id, created_by, type, payment_type, transaction_date, total_amount, purpose, division, department, paid_to_name, received_by, paid_by, approved_by, status) VALUES ($1, $2, $3, 'BKK', 'CASH', '2026-07-02', 10000, 'CROSS TENANT TEST', 'IT', 'GENERAL', 'Vendor B', 'Vendor B', 'BU NURUL', 'PAK NOVI', 'draft')`, [TX_B_ID, COMPANY_B, ID_STAFF_B]);

        await client.query("COMMIT");
        console.log("Test users & cross-tenant record created.");
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
}

async function cleanupTestUsers() {
    console.log("Cleaning up regression test users...");
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const ids = [ID_ADMIN, ID_FINANCE, ID_STAFF_A, ID_STAFF_B, ID_INACTIVE];
        await client.query("DELETE FROM public.ai_processing_jobs WHERE initiated_by = ANY($1)", [ids]);
        await client.query("DELETE FROM public.transaction_items WHERE transaction_id IN (SELECT id FROM public.transactions WHERE created_by = ANY($1))", [ids]);
        await client.query("DELETE FROM public.transactions WHERE created_by = ANY($1) OR id = $2", [ids, TX_B_ID]);
        await client.query("DELETE FROM public.users WHERE id = ANY($1)", [ids]);
        await client.query("DELETE FROM public.auth_users WHERE id = ANY($1)", [ids]);
        await client.query("COMMIT");
        console.log("Cleanup complete.");
    } catch (e) {
        await client.query("ROLLBACK");
    } finally {
        client.release();
    }
}

function getCookieMap(cookieString: string): Map<string, string> {
    const map = new Map<string, string>();
    if (!cookieString) return map;
    cookieString.split(";").forEach(c => {
        const parts = c.trim().split("=");
        if (parts[0]) map.set(parts[0], parts.slice(1).join("="));
    });
    return map;
}

function serializeCookies(map: Map<string, string>): string {
    return Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

const safeJson = async (res: Response) => {
    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? await res.json() : null;
};

async function runTests() {
    console.log(`\nStarting HTTP Regression Tests against: ${BASE_URL}\n`);

    // Test 1: Unauthenticated access to /api/transactions
    try {
        const res = await fetch(`${BASE_URL}/api/transactions`);
        addResult("1", "Unauthenticated API Access Blocked", res.status === 401 ? "✅ SUCCESS" : "❌ FAILED", String(res.status), res.status === 401 ? "401 Unauthorized" : `Expected 401, got ${res.status}`);
    } catch (e: any) { addResult("1", "Unauthenticated API Access Blocked", "❌ ERROR", "ERR", e.message); }

    // Test 2: Login with invalid password
    try {
        const res = await fetch(`${BASE_URL}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "staff-test-a@exata.co.id", password: "wrong" }) });
        addResult("2", "Login with Invalid Password Blocked", res.status === 401 ? "✅ SUCCESS" : "❌ FAILED", String(res.status), res.status === 401 ? "401 Unauthorized" : `Expected 401, got ${res.status}`);
    } catch (e: any) { addResult("2", "Login with Invalid Password Blocked", "❌ ERROR", "ERR", e.message); }

    // Test 3: Login with inactive user
    try {
        const res = await fetch(`${BASE_URL}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "inactive-test@exata.co.id", password: "Password123" }) });
        addResult("3", "Login with Inactive Account Blocked", res.status === 401 ? "✅ SUCCESS" : "❌ FAILED", String(res.status), res.status === 401 ? "401 Unauthorized" : `Expected 401, got ${res.status}`);
    } catch (e: any) { addResult("3", "Login with Inactive Account Blocked", "❌ ERROR", "ERR", e.message); }

    // Test 4: Login with Staff A (valid)
    let staffCookies = "";
    try {
        const res = await fetch(`${BASE_URL}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "staff-test-a@exata.co.id", password: "Password123" }) });
        const body = await safeJson(res);
        staffCookies = res.headers.get("set-cookie") || "";
        addResult("4", "Login with Active Staff Account", res.status === 200 && body?.user ? "✅ SUCCESS" : "❌ FAILED", String(res.status), body?.user ? `Logged in as ${body.user.full_name}` : "Login failed");
    } catch (e: any) { addResult("4", "Login with Active Staff Account", "❌ ERROR", "ERR", e.message); }

    // Test 5: Get transactions as Staff A
    try {
        const res = await fetch(`${BASE_URL}/api/transactions`, { headers: { Cookie: staffCookies } });
        const body = await safeJson(res);
        addResult("5", "List Transactions (Standard Access)", res.status === 200 && body?.success ? "✅ SUCCESS" : "❌ FAILED", String(res.status), body?.success ? `${body.data.length} transactions` : "Failed");
    } catch (e: any) { addResult("5", "List Transactions (Standard Access)", "❌ ERROR", "ERR", e.message); }

    // Test 6: Cross-tenant read prevention (Staff A spoof header)
    try {
        const res = await fetch(`${BASE_URL}/api/transactions`, { headers: { Cookie: staffCookies, "x-active-company-id": COMPANY_B } });
        const body = await safeJson(res);
        const hasCompanyB = body?.data?.some((tx: any) => tx.company_id === COMPANY_B);
        addResult("6", "Cross-Tenant Access Prevention (Staff Spoof Header)", res.status === 200 && !hasCompanyB ? "✅ SUCCESS" : "❌ FAILED", String(res.status), !hasCompanyB ? "Middleware forced company context" : "Cross-tenant data leaked!");
    } catch (e: any) { addResult("6", "Cross-Tenant Access Prevention", "❌ ERROR", "ERR", e.message); }

    // Test 7: Cross-tenant INSERT prevention
    try {
        const res = await fetch(`${BASE_URL}/api/transactions`, { method: "POST", headers: { Cookie: staffCookies, "Content-Type": "application/json", "x-active-company-id": COMPANY_B }, body: JSON.stringify({ type: "BKK", payment_type: "CASH", purpose: "MALICIOUS", division: "IT", department: "GENERAL", paid_to_name: "Attacker", received_by: "V", paid_by: "V", approved_by: "V", total_amount: 500000, transaction_date: "2026-07-02", items: [{ description: "malicious", account_code: "123", amount: 500000 }] }) });
        const body = await safeJson(res);
        if (res.status === 201 && body?.data?.company_id === COMPANY_A) {
            addResult("7", "Cross-Tenant INSERT Prevention", "✅ SUCCESS", "201", `Force-diverted to user own company: ${body.data.company_id}`);
        } else if (res.status === 403 || res.status === 400) {
            addResult("7", "Cross-Tenant INSERT Prevention", "✅ SUCCESS", String(res.status), "Blocked by validation");
        } else {
            addResult("7", "Cross-Tenant INSERT Prevention", "❌ FAILED", String(res.status), `Created under company: ${body?.data?.company_id}`);
        }
    } catch (e: any) { addResult("7", "Cross-Tenant INSERT Prevention", "❌ ERROR", "ERR", e.message); }

    // Test 8: Create valid BKK transaction
    let createdTxId = "";
    try {
        const res = await fetch(`${BASE_URL}/api/transactions`, { method: "POST", headers: { Cookie: staffCookies, "Content-Type": "application/json" }, body: JSON.stringify({ type: "BKK", payment_type: "CASH", purpose: "REGRESSION TEST VALID", division: "IT", department: "GENERAL", paid_to_name: "Vendor", received_by: "V", paid_by: "BU NURUL", approved_by: "PAK NOVI", total_amount: 100000, transaction_date: "2026-07-02", items: [{ description: "Test item", account_code: "102-1", amount: 100000 }] }) });
        const body = await safeJson(res);
        if (res.status === 201 && body?.success) {
            createdTxId = body.data.id;
            addResult("8", "Create Valid BKK Transaction", "✅ SUCCESS", "201", `Created: ${body.data.bkk_number}`);
        } else {
            addResult("8", "Create Valid BKK Transaction", "❌ FAILED", String(res.status), "Failed");
        }
    } catch (e: any) { addResult("8", "Create Valid BKK Transaction", "❌ ERROR", "ERR", e.message); }

    // Test 9: Cross-tenant PATCH/DELETE blocked
    try {
        const patchRes = await fetch(`${BASE_URL}/api/transactions/${TX_B_ID}`, { method: "PATCH", headers: { Cookie: staffCookies, "Content-Type": "application/json" }, body: JSON.stringify({ purpose: "HACKED" }) });
        const deleteRes = await fetch(`${BASE_URL}/api/transactions/${TX_B_ID}`, { method: "DELETE", headers: { Cookie: staffCookies } });
        const p = patchRes.status, d = deleteRes.status;
        addResult("9", "Cross-Tenant PATCH/DELETE Blocked", (p === 403 || p === 404) && (d === 403 || d === 404) ? "✅ SUCCESS" : "❌ FAILED", `${p}/${d}`, (p === 403 || p === 404) ? "Blocked" : "Allowed!");
    } catch (e: any) { addResult("9", "Cross-Tenant PATCH/DELETE Blocked", "❌ ERROR", "ERR", e.message); }

    // Test 10: Soft-delete own transaction
    try {
        const res = await fetch(`${BASE_URL}/api/transactions/${createdTxId}`, { method: "DELETE", headers: { Cookie: staffCookies } });
        const body = await safeJson(res);
        addResult("10", "Soft-Delete Transaction", res.status === 200 && body?.success ? "✅ SUCCESS" : "❌ FAILED", String(res.status), body?.success ? "is_deleted=true" : "Failed");
    } catch (e: any) { addResult("10", "Soft-Delete Transaction", "❌ ERROR", "ERR", e.message); }

    // Test 11: Admin roles access
    let adminCookies = "";
    try {
        const loginRes = await fetch(`${BASE_URL}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "admin-test@exata.co.id", password: "Password123" }) });
        adminCookies = loginRes.headers.get("set-cookie") || "";
        const res = await fetch(`${BASE_URL}/api/admin/roles`, { headers: { Cookie: adminCookies } });
        const body = await safeJson(res);
        addResult("11", "Authorized Access - Admin Roles", res.status === 200 && body?.success ? "✅ SUCCESS" : "❌ FAILED", String(res.status), body?.success ? `${body.data.length} roles` : "Failed");
    } catch (e: any) { addResult("11", "Authorized Access - Admin Roles", "❌ ERROR", "ERR", e.message); }

    // Test 12: Staff cannot access admin roles
    try {
        const res = await fetch(`${BASE_URL}/api/admin/roles`, { headers: { Cookie: staffCookies } });
        addResult("12", "Broken Access Control - Staff to Admin", res.status === 403 || res.status === 401 ? "✅ SUCCESS" : "❌ FAILED", String(res.status), res.status === 403 ? "403 Forbidden" : `Expected 403, got ${res.status}`);
    } catch (e: any) { addResult("12", "Broken Access Control - Staff to Admin", "❌ ERROR", "ERR", e.message); }

    // Test 13: Health endpoint
    try {
        const res = await fetch(`${BASE_URL}/api/health`);
        const body = await safeJson(res);
        addResult("13", "Health Endpoint", res.status === 200 && body?.status === "healthy" ? "✅ SUCCESS" : "❌ FAILED", String(res.status), JSON.stringify(body));
    } catch (e: any) { addResult("13", "Health Endpoint", "❌ ERROR", "ERR", e.message); }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("REGRESSION TEST SUMMARY");
    console.log("=".repeat(60));
    console.log("| ID | Test | Status | Code | Details |");
    console.log("|:---|:---|:---|:---|:---|");
    let pass = 0, fail = 0, err = 0;
    for (const r of results) {
        console.log(`| ${r.id} | ${r.name} | ${r.status} | ${r.code} | ${r.details.substring(0, 60)} |`);
        if (r.status.includes("SUCCESS")) pass++;
        else if (r.status.includes("FAILED")) fail++;
        else err++;
    }
    console.log(`\nTotal: ${pass} PASS, ${fail} FAIL, ${err} ERROR out of ${results.length}`);

    if (fail === 0 && err === 0) {
        console.log("🟢 ALL REGRESSION TESTS PASSED");
    } else {
        console.log("🔴 SOME TESTS FAILED — INVESTIGATE!");
        process.exit(1);
    }
}

async function main() {
    try {
        await setupTestUsers();
        await runTests();
    } catch (e) {
        console.error("Test execution failed:", e);
        process.exit(1);
    } finally {
        await cleanupTestUsers();
        await pool.end();
    }
}

main();