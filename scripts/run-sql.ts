import "dotenv/config";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

// Membaca file SQL migrasi dan menjalankannya secara atomik dalam satu transaksi
async function main() {
    const fileArg = process.argv[2];
    if (!fileArg) {
        console.error("❌ ERROR: Wajib menyertakan path file SQL migrasi. Contoh: npx tsx scripts/run-sql.ts src/migration/010_create_app_runtime_role.sql");
        process.exit(1);
    }

    const filePath = path.resolve(process.cwd(), fileArg);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ ERROR: File tidak ditemukan di path: ${filePath}`);
        process.exit(1);
    }

    console.log(`🚀 Memulai migrasi atomik untuk file: ${path.basename(fileArg)}`);

    const connectionString = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
    const pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
    });

    const client = await pool.connect();
    try {
        let sql = fs.readFileSync(filePath, "utf-8");

        // Ganti password runtime jika file-nya adalah 010_create_app_runtime_role.sql
        if (fileArg.endsWith("010_create_app_runtime_role.sql")) {
            const appRuntimePassword = process.env.APP_RUNTIME_PASSWORD || "ChangeMeInProduction123!";
            sql = sql.replace(/\$\{APP_RUNTIME_PASSWORD\}/g, appRuntimePassword);
        }

        // Jalankan seluruh isi file migrasi secara ATOMIK dalam satu transaksi
        console.log(`[DB] Memulai transaksi (BEGIN) untuk: ${path.basename(fileArg)}...`);
        await client.query("BEGIN");

        // Jalankan SQL query
        await client.query(sql);

        // Commit transaksi jika sukses
        await client.query("COMMIT");
        console.log(`🟢 SUKSES: File ${path.basename(fileArg)} selesai dieksekusi secara atomik (COMMIT).`);

    } catch (error: any) {
        // Rollback penuh jika ada statement yang gagal
        await client.query("ROLLBACK").catch(() => {});
        console.error(`❌ GAGAL: Eksekusi migrasi gagal, rollback dilakukan penuh.`);
        console.error(`Detail Error: ${error.message}`);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(console.error);
