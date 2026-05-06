import "dotenv/config";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

async function runMigrations() {
    console.log("🚀 Starting RLS Migration Deployment...");
    
    const dbUrl = process.env.DATABASE_ADMIN_URL;
    if (!dbUrl) {
        console.error("❌ ERROR: DATABASE_ADMIN_URL not set");
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
    });

    try {
        const client = await pool.connect();
        
        // 1. Identity Check
        const roleRes = await client.query("SELECT current_user");
        const currentUser = roleRes.rows[0].current_user;
        console.log(`Running as: ${currentUser}`);

        if (currentUser !== "postgres") {
            console.error(`❌ ERROR: Harus dijalankan dengan superuser postgres, bukan ${currentUser}`);
            process.exit(1);
        }

        const migrations = [
            "src/migration/010_create_app_runtime_role.sql",
            "src/migration/011_fix_rls_policies_with_check.sql",
            "src/migration/012_fix_views_security_invoker.sql"
        ];

        for (const file of migrations) {
            console.log(`\nStep: Executing ${file}...`);
            const filePath = path.resolve(process.cwd(), file);
            const sql = fs.readFileSync(filePath, "utf-8");
            
            await client.query(sql);
            console.log(`✅ ${path.basename(file)} complete`);
        }

        console.log("\n============================================");
        console.log("✅ ALL MIGRATIONS COMPLETE");
        console.log("\nLANGKAH SELANJUTNYA (manual di Railway dashboard):");
        console.log("Ganti DATABASE_URL dari:");
        console.log("  postgresql://postgres:...@host:port/railway");
        console.log("Menjadi:");
        console.log("  postgresql://app_runtime:ChangeMeInProduction123!@host:port/railway");
        console.log("\nSetelah mengganti DATABASE_URL, redeploy aplikasi.");
        console.log("============================================");

        client.release();

    } catch (err: any) {
        console.error("\n❌ MIGRATION FAILED:");
        console.error(err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigrations();
