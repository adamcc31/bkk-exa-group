import * as jose from "jose";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { adminPool } from "@/shared/lib/db/client";

if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is not set");
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

export interface JWTPayload extends jose.JWTPayload {
    sub: string;
    email: string;
    role: string;
    company_id: string;
    active_company_id: string;
}

export interface AuthUser {
    id: string;
    email: string;
    full_name: string;
    company_id: string;
    role: string;
    active_company_id: string;
}

/**
 * SYSTEM CONTEXT OPERATIONS
 * The auth service operations (login, register, refresh) occur before a 
 * Row Level Security (RLS) context is established. These queries run 
 * with elevated privileges to identify and authenticate users.
 */

/**
 * Signs a new Access Token (JWT)
 */
async function signAccessToken(user: AuthUser): Promise<string> {
    const payload: JWTPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        company_id: user.company_id,
        active_company_id: user.active_company_id,
    };

    return await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(ACCESS_TOKEN_EXPIRY)
        .sign(JWT_SECRET);
}

/**
 * Creates a random refresh token and its hash
 */
async function generateRefreshTokenData(): Promise<{ token: string; hash: string; expiresAt: Date }> {
    const token = crypto.randomBytes(40).toString("hex");
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
    return { token, hash, expiresAt };
}

/**
 * Register a new user
 */
export async function register(
    email: string,
    password: string,
    fullName: string,
    companyId: string,
    roleId: string
) {
    const hashedPassword = await bcrypt.hash(password, 12);
    const { token: refreshToken, hash: tokenHash, expiresAt } = await generateRefreshTokenData();
    
    const client = await adminPool.connect();

    try {
        await client.query("BEGIN");

        // 1. Insert into auth_users
        const authRes = await client.query(
            "INSERT INTO public.auth_users (email, hashed_password) VALUES ($1, $2) RETURNING id",
            [email, hashedPassword]
        );
        const userId = authRes.rows[0].id;

        // 2. Insert into public.users (profile)
        await client.query(
            "INSERT INTO public.users (id, email, full_name, company_id, role_id) VALUES ($1, $2, $3, $4, $5)",
            [userId, email, fullName, companyId, roleId]
        );

        // 3. Fetch role name for JWT
        const roleRes = await client.query("SELECT name FROM public.roles WHERE id = $1", [roleId]);
        const roleName = roleRes.rows[0].name;

        // 4. Cleanup expired tokens for this user
        await client.query(
            "DELETE FROM public.refresh_tokens WHERE user_id = $1 AND expires_at < now()",
            [userId]
        );

        // 5. Insert refresh token
        await client.query(
            "INSERT INTO public.refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
            [userId, tokenHash, expiresAt]
        );

        await client.query("COMMIT");

        const user: AuthUser = {
            id: userId,
            email,
            full_name: fullName,
            company_id: companyId,
            role: roleName,
            active_company_id: companyId,
        };

        const accessToken = await signAccessToken(user);

        return { user, accessToken, refreshToken };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Login user
 * NOTE: Uses systemQuery because RLS context is not yet established.
 */
export async function login(email: string, password: string) {
    console.log(`[AuthService] Attempting login for email: ${email}`);
    
    // 1. Find user in auth_users
    const authRes = await adminPool.query(
        "SELECT id, hashed_password FROM public.auth_users WHERE email = $1",
        [email]
    );

    console.log(`[AuthService] User lookup result: ${authRes.rowCount} rows found`);

    if (authRes.rowCount === 0) {
        throw new Error("Invalid credentials");
    }

    const { id: userId, hashed_password: hashedPassword } = authRes.rows[0];

    // 2. Verify password
    const isValid = await bcrypt.compare(password, hashedPassword);
    if (!isValid) {
        throw new Error("Invalid credentials");
    }

    // 3. Get profile, role, and company
    const userRes = await adminPool.query(
        `SELECT u.id, u.email, u.full_name, u.company_id, r.name as role 
         FROM public.users u 
         JOIN public.roles r ON u.role_id = r.id 
         WHERE u.id = $1`,
        [userId]
    );

    const profile = userRes.rows[0];
    const user: AuthUser = {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        company_id: profile.company_id,
        role: profile.role,
        active_company_id: profile.company_id, // default to assigned company
    };

    const accessToken = await signAccessToken(user);
    
    // Create and store refresh token
    const { token: refreshToken, hash: tokenHash, expiresAt } = await generateRefreshTokenData();
    
    // Cleanup and insert
    await adminPool.query("DELETE FROM public.refresh_tokens WHERE user_id = $1 AND expires_at < now()", [
        userId,
    ]);
    await adminPool.query(
        "INSERT INTO public.refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
        [userId, tokenHash, expiresAt]
    );

    return { user, accessToken, refreshToken };
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(refreshToken: string) {
    // Lookup langsung by hash — O(1) dengan index
    const hash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    const res = await adminPool.query(
        `SELECT rt.user_id 
     FROM public.refresh_tokens rt
     WHERE rt.token_hash = $1 AND rt.expires_at > now()`,
        [hash]
    );

    if (res.rowCount === 0) {
        throw new Error("Invalid or expired refresh token");
    }

    const userId = res.rows[0].user_id;

    // Get fresh user data dari DB (bukan dari token)
    const userRes = await adminPool.query(
        `SELECT u.id, u.email, u.full_name, u.company_id, r.name as role 
         FROM public.users u 
         JOIN public.roles r ON u.role_id = r.id 
         WHERE u.id = $1`,
        [userId]
    );

    if (userRes.rowCount === 0) {
        throw new Error("User not found");
    }

    const profile = userRes.rows[0];
    const user: AuthUser = {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        company_id: profile.company_id,
        role: profile.role,
        active_company_id: profile.company_id,
    };

    const accessToken = await signAccessToken(user);
    return { accessToken };
}

/**
 * Switch active company (Admin only)
 */
export async function switchActiveCompany(userId: string, newCompanyId: string) {
    // 1. Verify user is admin
    const userRes = await adminPool.query(
        `SELECT u.id, u.email, u.full_name, u.company_id, r.name as role 
         FROM public.users u 
         JOIN public.roles r ON u.role_id = r.id 
         WHERE u.id = $1`,
        [userId]
    );

    const profile = userRes.rows[0];
    if (profile.role !== "admin") {
        throw new Error("Unauthorized: Only admins can switch companies");
    }

    // 2. Validate company exists
    const companyCheck = await adminPool.query("SELECT id FROM public.companies WHERE id = $1", [
        newCompanyId,
    ]);
    if (companyCheck.rowCount === 0) {
        throw new Error("Company not found");
    }

    // 3. Issue new token with updated active_company_id
    const user: AuthUser = {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        company_id: profile.company_id,
        role: profile.role,
        active_company_id: newCompanyId,
    };

    const accessToken = await signAccessToken(user);
    return { accessToken };
}
