import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

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

async function reapplyRLS() {
    console.log("🚀 Re-applying RLS Security Layer...");

    try {
        const files = [
            "src/migration/003_rls_functions.sql",
            "src/migration/004_rls_policies.sql",
        ];

        for (const file of files) {
            console.log(`Executing ${file}...`);
            const content = fs.readFileSync(path.resolve(process.cwd(), file), "utf-8");
            await pool.query(content);
        }

        console.log("\n✅ RLS Security Layer updated successfully!");
    } catch (err: any) {
        console.error("\n❌ FAILED:");
        console.error(err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

reapplyRLS().catch(console.error);
