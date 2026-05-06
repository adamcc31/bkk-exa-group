import { Pool } from "pg";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";

/**
 * Simple script to verify DB and S3 connections
 */
async function testConnections() {
    console.log("--- STARTING CONNECTION TESTS ---");

    // 1. Manually load .env.local for this script
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
        console.log("Loading .env.local...");
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

    // 2. Test PostgreSQL
    console.log("\nTesting PostgreSQL Connection...");
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        const res = await pool.query("SELECT NOW() as now, version()");
        console.log("✅ DB Success!");
        console.log("Current Time from DB:", res.rows[0].now);
        console.log("DB Version:", res.rows[0].version.split(",")[0]);
    } catch (err: any) {
        console.error("❌ DB Failed:", err.message);
    } finally {
        await pool.end();
    }

    // 3. Test S3
    console.log("\nTesting S3 Connection...");
    const s3 = new S3Client({
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION || "auto",
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
        },
        forcePathStyle: true,
    });

    try {
        await s3.send(
            new ListObjectsV2Command({
                Bucket: process.env.S3_BUCKET_NAME,
                MaxKeys: 1,
            })
        );
        console.log("✅ S3 Success!");
        console.log("Bucket Name:", process.env.S3_BUCKET_NAME);
    } catch (err: any) {
        console.error("❌ S3 Failed:", err.message);
    }

    console.log("\n--- TESTS COMPLETED ---");
}

testConnections().catch(console.error);
