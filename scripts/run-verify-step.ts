import "dotenv/config";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
});

async function main() {
    const step = process.argv[2];
    const client = await pool.connect();

    try {
        if (step === "2") {
            const res = await client.query("SELECT rolname FROM pg_roles WHERE rolname = 'app_runtime'");
            console.log("VERIFICATION STEP 2: rolname =", JSON.stringify(res.rows));
        } else if (step === "3") {
            const res = await client.query("SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'transactions'::regclass ORDER BY polname");
            console.log("VERIFICATION STEP 3: policies =", JSON.stringify(res.rows, null, 2));
        } else if (step === "4") {
            // view check
            const res = await client.query(`
                SELECT relname 
                FROM pg_class c
                JOIN pg_namespace n ON c.relnamespace = n.oid
                WHERE c.relkind = 'v' AND n.nspname = 'public'
                LIMIT 5
            `);
            console.log("VERIFICATION STEP 4: views =", JSON.stringify(res.rows));
        } else if (step === "5") {
            const res = await client.query("SELECT proname, prosecdef FROM pg_proc WHERE proname = 'get_dashboard_stats'");
            console.log("VERIFICATION STEP 5: get_dashboard_stats prosecdef =", res.rows[0]?.prosecdef);
        } else if (step === "6") {
            const res = await client.query("SELECT pg_get_functiondef('public.generate_bkk_number'::regproc) LIKE '%active_company_id%' AS has_guard");
            console.log("VERIFICATION STEP 6: generate_bkk_number has_guard =", res.rows[0]?.has_guard);
        } else {
            console.error("Unknown verification step.");
        }
    } catch (e: any) {
        console.error("Verification failed:", e.message);
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(console.error);
