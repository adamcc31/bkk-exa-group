import "dotenv/config";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

async function runPreflight() {
    console.log("🔍 Running Pre-flight Check...");
    
    const dbUrl = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
    
    if (!dbUrl) {
        console.error("❌ ERROR: DATABASE_ADMIN_URL or DATABASE_URL not set");
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
    });

    try {
        const client = await pool.connect();
        
        console.log("\n--- ENVIRONMENT CHECK ---");

        // 1. Superuser Check
        const roleRes = await client.query(`
            SELECT current_user, rolsuper, rolbypassrls 
            FROM pg_roles 
            WHERE rolname = current_user
        `);
        const role = roleRes.rows[0];
        console.log(`Role: ${role.current_user}`);
        console.log(`${role.rolsuper ? "✅" : "❌"} Superuser Status`);
        console.log(`${role.rolbypassrls ? "⚠️ BYPASSRLS is ACTIVE" : "✅ NOBYPASSRLS"}`);

        // 2. Version Check
        const verRes = await client.query("SELECT version(), current_setting('server_version_num')::int as ver_num");
        const ver = verRes.rows[0];
        console.log(`\nPostgreSQL Version: ${ver.version}`);
        if (ver.ver_num >= 150000) {
            console.log("✅ PG 15+ (security_invoker supported)");
        } else if (ver.ver_num >= 120000) {
            console.log("⚠️ PG 12-14 (Workaround needed for security_invoker on views)");
        } else {
            console.log("❌ PG Version too old!");
        }

        // 3. Role existence
        const existRes = await client.query("SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime'");
        console.log(`\nRole 'app_runtime': ${(existRes.rowCount || 0) > 0 ? "⚠️ ALREADY EXISTS" : "✅ Available to create"}`);

        // 4. DB Size
        const dbRes = await client.query("SELECT current_database(), pg_size_pretty(pg_database_size(current_database())) as size");
        console.log(`\nDatabase: ${dbRes.rows[0].current_database} (${dbRes.rows[0].size})`);

        // 5. Table status
        const tableRes = await client.query(`
            SELECT 
                relname as tablename, 
                relrowsecurity as rowsecurity, 
                relforcerowsecurity as forcerowsecurity 
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND relname IN ('transactions', 'users')
        `);
        console.log("\n--- TABLE STATUS ---");
        tableRes.rows.forEach(t => {
            console.log(`${t.tablename}: RLS=${t.rowsecurity ? "✅" : "⚠️ OFF"}, FORCE=${t.forcerowsecurity ? "✅" : "⚠️ OFF"}`);
        });

        client.release();
        console.log("\n✨ Pre-flight complete.");

    } catch (err: any) {
        console.error("\n❌ Pre-flight FAILED:");
        console.error(err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runPreflight();
