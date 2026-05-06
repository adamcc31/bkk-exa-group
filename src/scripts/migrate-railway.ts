import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import * as bcrypt from "bcrypt";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf-8");
    envConfig.split("\n").forEach((line) => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || "";
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
            }
            process.env[key] = value;
        }
    });
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function runMigration() {
    console.log("🚀 Starting Railway Migration...");

    try {
        // --- Phase 1: Core Extensions ---
        console.log("Phase 1: Core Extensions");
        await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        await pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");

        // --- Phase 2: Original Tables (Modified) ---
        console.log("Phase 2: Original Tables");
        const originalMigrations = [
            "src/database/migrations/001_initial_schema.sql",
            "src/database/migrations/002_add_printed_status.sql",
            "src/database/migrations/002_update_document_type_check.sql",
            "src/database/migrations/004_add_user_search_index.sql",
            "src/database/migrations/005_add_company_prij.sql",
        ];

        for (const file of originalMigrations) {
            console.log(`Executing ${file}...`);
            let content = fs.readFileSync(path.resolve(process.cwd(), file), "utf-8");
            
            // Apply manual fix for Phase 2: Remove references to auth.users
            if (file.includes("001_initial_schema.sql")) {
                content = content.replace(/REFERENCES auth\.users\(id\) ON DELETE CASCADE/g, "");
            }
            
            await pool.query(content);
        }

        // --- Phase 3: Infrastructure Adaptation ---
        console.log("Phase 3: Infrastructure Adaptation");
        const railwayMigrations = [
            "src/migration/001_auth_users.sql",
            "src/migration/002_update_schema.sql",
            "src/migration/005_refresh_tokens.sql",
        ];

        for (const file of railwayMigrations) {
            console.log(`Executing ${file}...`);
            const content = fs.readFileSync(path.resolve(process.cwd(), file), "utf-8");
            await pool.query(content);
        }

        // --- Phase 4: Business Logic & RPC ---
        console.log("Phase 4: Business Logic & RPC");
        const rpcMigrations = [
            "src/database/migrations/003_auto_bkk_number.sql",
            "src/database/migrations/006_dashboard_stats_rpc.sql",
        ];

        for (const file of rpcMigrations) {
            console.log(`Executing ${file}...`);
            const content = fs.readFileSync(path.resolve(process.cwd(), file), "utf-8");
            await pool.query(content);
        }

        // --- Phase 5: Security Layer (RLS) ---
        console.log("Phase 5: Security Layer (RLS)");
        const securityMigrations = [
            "src/migration/003_rls_functions.sql",
            "src/migration/004_rls_policies.sql",
        ];

        for (const file of securityMigrations) {
            console.log(`Executing ${file}...`);
            const content = fs.readFileSync(path.resolve(process.cwd(), file), "utf-8");
            await pool.query(content);
        }

        // --- Phase 6: Seed Data ---
        console.log("Phase 6: Seed Data");
        let seedContent = fs.readFileSync(path.resolve(process.cwd(), "src/database/seed.sql"), "utf-8");
        
        // Remove Supabase-specific trigger code
        seedContent = seedContent.replace(/CREATE TRIGGER on_auth_user_created[\s\S]*?EXECUTE FUNCTION public\.handle_new_user\(\);/g, "");
        seedContent = seedContent.replace(/CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)[\s\S]*?LANGUAGE plpgsql SECURITY DEFINER;/g, "");
        
        await pool.query(seedContent);

        // --- Final Step: Admin Account Creation ---
        console.log("Final Step: Admin Account Creation");
        const adminEmail = "admin@super.com";
        const adminPassword = "ONCA1sxcij1SDla65812%6127";
        const hashedPassword = await bcrypt.hash(adminPassword, 12);

        // Check if admin already exists
        const existing = await pool.query("SELECT id FROM auth_users WHERE email = $1", [adminEmail]);
        if (existing.rowCount === 0) {
            const authRes = await pool.query(
                "INSERT INTO auth_users (email, hashed_password) VALUES ($1, $2) RETURNING id",
                [adminEmail, hashedPassword]
            );
            const adminId = authRes.rows[0].id;

            // Link to public.users (admin role is b1...001, company srei is a1...001)
            await pool.query(
                `INSERT INTO users (id, email, full_name, company_id, role_id, is_active) 
                 VALUES ($1, $2, $3, $4, $5, true)
                 ON CONFLICT (id) DO NOTHING`,
                [
                    adminId,
                    adminEmail,
                    "Super Admin",
                    "a1000000-0000-0000-0000-000000000001",
                    "b1000000-0000-0000-0000-000000000001"
                ]
            );
            console.log("✅ Admin account seeded!");
        } else {
            console.log("ℹ️ Admin account already exists.");
        }

        console.log("\n✨ MIGRATION SUCCESSFUL! Railway is ready.");

    } catch (err: any) {
        console.error("\n❌ MIGRATION FAILED:");
        console.error(err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration().catch(console.error);
