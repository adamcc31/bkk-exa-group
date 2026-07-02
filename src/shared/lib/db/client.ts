import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

/**
 * DATABASE POOLS CONFIGURATION
 */

// 1. Standard Pool — App Runtime (RLS Active)
// Used for all business logic queries after user is authenticated.
const connectionString = process.env.DATABASE_APP_URL || process.env.DATABASE_URL;

if (!process.env.DATABASE_APP_URL && process.env.NODE_ENV === "production") {
    console.warn(
        "⚠️ DATABASE_APP_URL tidak ditemukan. Fallback ke DATABASE_URL — RLS mungkin tidak aktif jika ini superuser!"
    );
}

export const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

/**
 * ⚠️ adminPool — SYSTEM USE ONLY (RLS Bypassed)
 * Gunakan HANYA untuk: login, register, token refresh.
 * DILARANG untuk query data bisnis (transactions, dll) karena akan menyebabkan kebocoran data.
 */
export const adminPool = new Pool({
    connectionString: process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    max: 5, // Keep system pool small
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

/**
 * Executes a query without user context using the admin pool (Bypasses RLS).
 * Used for system operations like session validation, registration, or initial lookups.
 * ⚠️ NEVER use this for fetching tenant-specific business data.
 */
export async function query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
): Promise<QueryResult<T>> {
    return adminPool.query<T>(text, params);
}

/**
 * Database Context Wrapper with RLS Support.
 * Encapsulates a transaction and sets the necessary session variables 
 * for Row Level Security policies.
 */
/**
 * Verifies that the database connection is NOT using a superuser role.
 * This is a safety check to ensure RLS is being enforced.
 */
export async function verifyDatabaseRole(): Promise<void> {
    const client = await pool.connect();
    const connectionSource = process.env.DATABASE_APP_URL
        ? "DATABASE_APP_URL"
        : "DATABASE_URL (fallback)";

    try {
        const result = await client.query(`
            SELECT current_user, rolsuper, rolbypassrls 
            FROM pg_roles 
            WHERE rolname = current_user
        `);

        const { current_user, rolsuper, rolbypassrls } = result.rows[0];

        if (rolsuper || rolbypassrls) {
            const message = `⚠️ DATABASE SECURITY WARNING: Connected via ${connectionSource} as ${current_user} which has SUPERUSER=${rolsuper} or BYPASSRLS=${rolbypassrls}. RLS policies will be bypassed!`;

            if (process.env.NODE_ENV === "production") {
                console.error(`[Security] CRITICAL ERROR: ${message}`);
                throw new Error(message);
            } else {
                console.warn(`[Security] ${message}`);
            }
        } else {
            console.log(
                `✅ [Security] Database connected via ${connectionSource} as ${current_user} (non-superuser, RLS active)`
            );
        }
    } catch (error) {
        console.error("[Security] Database role verification failed:", error);
        if (process.env.NODE_ENV === "production") throw error;
    } finally {
        client.release();
    }
}

export async function withDbContext<T>(
    userId: string,
    activeCompanyId: string | null,
    userRole: string | null,
    ownCompanyId: string | null,
    callback: (client: PoolClient) => Promise<T>
): Promise<T> {
    console.log("[DB] withDbContext called with:", {
        userId,
        activeCompanyId,
        hasAppUrl: !!process.env.DATABASE_APP_URL,
    });

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Set session variables for RLS using set_config (supports parameters)
        // Third parameter 'true' makes it local to the transaction (SET LOCAL)
        
        // Debug Log & Safety Checks
        if (!userId) {
            console.warn("[Database] ⚠️ WARNING: withDbContext called without userId. RLS will deny all access.");
        }
        
        console.log(`[Database] >>> Context: uid=${userId || "NONE"} | role=${userRole || "anon"} | active=${activeCompanyId || "NONE"} | own=${ownCompanyId || "NONE"}`);

        // Set all context variables for RLS
        // Third parameter 'true' makes it LOCAL to the current transaction
        await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId || ""]);
        await client.query("SELECT set_config('app.user_role', $1, true)", [userRole || "anon"]);
        await client.query("SELECT set_config('app.active_company_id', $1, true)", [activeCompanyId || ""]);
        await client.query("SELECT set_config('app.own_company_id', $1, true)", [ownCompanyId || ""]);

        // Optional: Check if we are running as superuser (for development warning)
        if (process.env.NODE_ENV !== "production") {
            const roleRes = await client.query("SELECT current_user, session_user, is_superuser FROM (SELECT current_user, session_user, current_setting('is_superuser') = 'on' as is_superuser) s");
            if (roleRes.rows[0].is_superuser) {
                console.warn(`[Database] ❌ CRITICAL: Running as SUPERUSER (${roleRes.rows[0].current_user}). RLS WILL BE BYPASSED!`);
            }
        }

        // [TEMP-DIAG-POIN3] Verifikasi app.current_user_id PERSIS sebelum callback query dijalankan
        // Ini membuktikan bahwa SET LOCAL sudah ter-set dalam blok BEGIN...COMMIT yang sama.
        // AKAN DIHAPUS setelah verifikasi Bug B selesai.
        const diagSettingRes = await client.query(
            "SELECT current_setting('app.current_user_id', true) AS uid_in_tx, "
            + "current_setting('app.user_role', true) AS role_in_tx, "
            + "is_authenticated() AS is_auth_in_tx"
        );
        console.log(`[DB-DIAG-POIN3] BEFORE_CALLBACK uid=${diagSettingRes.rows[0].uid_in_tx || 'KOSONG'} role=${diagSettingRes.rows[0].role_in_tx || 'KOSONG'} is_auth=${diagSettingRes.rows[0].is_auth_in_tx}`);

        const result = await callback(client);

        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Database Transaction Error:", error);
        throw error;
    } finally {
        client.release();
    }
}

export default pool;
