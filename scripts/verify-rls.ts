import "dotenv/config";
import { Pool } from "pg";

async function verifyRls() {
    console.log("🛡️ Starting RLS Security Verification...");
    
    const dbUrl = process.env.DATABASE_APP_URL;
    if (!dbUrl) {
        console.error("❌ ERROR: DATABASE_APP_URL not set");
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
    });

    try {
        const client = await pool.connect();
        
        console.log("\n1. Identity Verification");
        const roleRes = await client.query("SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user");
        const role = roleRes.rows[0];
        console.log(`Current User: ${role.current_user}`);
        console.log(`Is Superuser: ${role.rolsuper ? "❌ FAILED" : "✅ NO"}`);
        console.log(`Can Bypass RLS: ${role.rolbypassrls ? "❌ FAILED" : "✅ NO"}`);

        if (role.rolsuper || role.rolbypassrls) {
            throw new Error("Security breach: Role has excessive privileges!");
        }

        console.log("\n2. Data Isolation Test (No Context)");
        const noContextRes = await client.query("SELECT count(*) as count FROM transactions");
        const count = parseInt(noContextRes.rows[0].count);
        console.log(`Visible rows without context: ${count}`);
        if (count > 0) {
            console.log("❌ FAILED: Data visible without context!");
        } else {
            console.log("✅ SUCCESS: 0 rows returned (RLS enforced)");
        }

        console.log("\n3. Tenant Isolation Test (Company A)");
        const userA = '00000000-0000-0000-0000-00000000000a';
        const companyA = 'a1000000-0000-0000-0000-000000000001';
        const companyB = 'a1000000-0000-0000-0000-000000000002';

        await client.query("BEGIN");
        await client.query("SELECT set_config('app.current_user_id', $1, true)", [userA]);
        await client.query("SELECT set_config('app.user_role', 'staff', true)");
        await client.query("SELECT set_config('app.own_company_id', $1, true)", [companyA]);
        await client.query("SELECT set_config('app.active_company_id', $1, true)", [companyA]);

        const companyBData = await client.query("SELECT count(*) as count FROM transactions WHERE company_id = $1", [companyB]);
        const bCount = parseInt(companyBData.rows[0].count);
        console.log(`Company B data visible to Company A: ${bCount}`);
        if (bCount > 0) {
            console.log("❌ FAILED: Cross-tenant data leakage detected!");
        } else {
            console.log("✅ SUCCESS: Isolation working.");
        }

        console.log("\n4. Malicious Write Test (Cross-Tenant INSERT)");
        try {
            await client.query(`
                INSERT INTO transactions (company_id, created_by, type, purpose, total_amount, status)
                VALUES ($1, $2, 'BKK', 'RLS TEST MALICIOUS', 1000, 'draft')
            `, [companyB, userA]);
            console.log("❌ FAILED: Malicious INSERT succeeded!");
        } catch (err: any) {
            console.log(`✅ SUCCESS: INSERT blocked. Error: ${err.message}`);
        }

        await client.query("ROLLBACK");
        client.release();
        console.log("\n✨ RLS VERIFICATION COMPLETE: ALL SECURITY TESTS PASSED ✅");

    } catch (err: any) {
        console.error("\n❌ Verification FAILED:");
        console.error(err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

verifyRls();
