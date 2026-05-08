import "dotenv/config";
import { adminPool } from "../src/shared/lib/db/client";
import bcrypt from "bcrypt";

async function resetPassword() {
    const email = process.argv[2] || "admin@super.com";
    const newPassword = process.argv[3] || "ONCA1sxcij1SDla65812%6127";

    console.log(`🚀 Resetting password for: ${email}`);

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        
        const res = await adminPool.query(
            "UPDATE public.auth_users SET hashed_password = $1 WHERE email = $2 RETURNING id",
            [hashedPassword, email]
        );

        if (res.rowCount === 0) {
            console.error(`❌ ERROR: User with email ${email} not found.`);
        } else {
            console.log(`✅ SUCCESS: Password for ${email} has been reset to: ${newPassword}`);
        }

    } catch (error: any) {
        console.error("❌ FAILED:", error.message);
    } finally {
        await adminPool.end();
    }
}

resetPassword();
