import * as jose from "jose";
import { JWTPayload } from "@/features/auth/services/auth.service";

if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is not set");
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

/**
 * Verifies an Access Token (JWT) and returns its payload.
 * Throws an error if the token is invalid or expired.
 */
export async function verifyAccessToken(token: string): Promise<JWTPayload> {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    return payload as JWTPayload;
}

/**
 * Silently extracts the JWT payload from an Access Token.
 * Returns null if the token is invalid or expired instead of throwing.
 */
export async function getJWTPayload(token: string): Promise<JWTPayload | null> {
    try {
        return await verifyAccessToken(token);
    } catch (error) {
        return null;
    }
}
