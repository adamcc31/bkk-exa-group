// ============================================
// Admin Users Service — CRUD Operations (Post-Supabase)
// ============================================

import { withDbContext, query as systemQuery } from "@/shared/lib/db/client";
import { createQueryBuilder } from "@/shared/lib/db/query-builder";
import * as authService from "@/features/auth/services/auth.service";
import type { AuthSession, User, ApiResponse } from "@/shared/types";

interface CreateUserInput {
    email: string;
    full_name: string;
    company_id: string;
    role_id: string;
    password: string;
}

interface UpdateUserInput {
    full_name?: string;
    company_id?: string;
    role_id?: string;
    is_active?: boolean;
}

/**
 * Lists all users with their role and company details
 */
export async function listUsers(
    session: AuthSession,
    query: { page?: number; pageSize?: number; company_id?: string; search?: string }
): Promise<ApiResponse<User[]>> {
    return await withDbContext(session.user.id, session.activeCompanyId, session.role, session.user.company_id, async (client) => {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;
        const offset = (page - 1) * pageSize;

        const qb = createQueryBuilder();

        if (query.company_id) {
            qb.where("u.company_id = $", query.company_id);
        }

        if (query.search && query.search.trim().length > 0) {
            qb.where("u.full_name ILIKE $", `%${query.search.trim()}%`);
        }

        const { whereClause, params, nextParamIndex } = qb.build();

        // 1. Get total count
        const countRes = await client.query(
            `SELECT COUNT(*)::INT as total FROM users u ${whereClause}`,
            params
        );
        const total = countRes.rows[0].total;

        // 2. Get paginated data
        const dataRes = await client.query(
            `SELECT u.*, 
                row_to_json(r.*) as role,
                row_to_json(c.*) as company
             FROM users u
             JOIN roles r ON u.role_id = r.id
             JOIN companies c ON u.company_id = c.id
             ${whereClause}
             ORDER BY u.full_name ASC
             LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}`,
            [...params, pageSize, offset]
        );

        return {
            success: true,
            data: dataRes.rows as unknown as User[],
            meta: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    });
}

/**
 * Creates a new user (Auth + Profile)
 * Uses the existing authService.register logic for atomicity
 */
export async function createUser(
    session: AuthSession,
    input: CreateUserInput
): Promise<ApiResponse<User>> {
    try {
        // Reuse register logic which is already atomic and handles both tables
        const { user: newUser } = await authService.register(
            input.email,
            input.password,
            input.full_name,
            input.company_id,
            input.role_id
        );

        // Fetch complete user object with relations for the UI
        const finalRes = await systemQuery(
            `SELECT u.*, row_to_json(r.*) as role, row_to_json(c.*) as company
             FROM users u
             JOIN roles r ON u.role_id = r.id
             JOIN companies c ON u.company_id = c.id
             WHERE u.id = $1`,
            [newUser.id]
        );

        return { success: true, data: finalRes.rows[0] as unknown as User };
    } catch (error: any) {
        console.error("Create User Error:", error.message);
        
        const isDuplicate = error.message.includes("unique constraint") || error.message.includes("already exists");
        
        return {
            success: false,
            error: {
                code: isDuplicate ? "DUPLICATE_EMAIL" : "CREATE_FAILED",
                message: isDuplicate 
                    ? "Email sudah terdaftar. Gunakan email lain." 
                    : "Gagal membuat user baru.",
            },
        };
    }
}

/**
 * Updates an existing user profile
 */
export async function updateUser(
    session: AuthSession,
    id: string,
    input: UpdateUserInput
): Promise<ApiResponse<User>> {
    return await withDbContext(session.user.id, session.activeCompanyId, session.role, session.user.company_id, async (client) => {
        const UPDATABLE_FIELDS: (keyof UpdateUserInput)[] = [
            "full_name",
            "company_id",
            "role_id",
            "is_active",
        ];

        const fields: string[] = [];
        const values: any[] = [];
        let i = 1;

        for (const field of UPDATABLE_FIELDS) {
            if (input[field] !== undefined) {
                fields.push(`${field} = $${i++}`);
                values.push(input[field]);
            }
        }

        if (fields.length === 0) {
            throw new Error("No fields to update");
        }

        values.push(id);
        await client.query(
            `UPDATE users SET ${fields.join(", ")}, updated_at = now() WHERE id = $${i}`,
            values
        );

        const finalRes = await client.query(
            `SELECT u.*, row_to_json(r.*) as role, row_to_json(c.*) as company
             FROM users u
             JOIN roles r ON u.role_id = r.id
             JOIN companies c ON u.company_id = c.id
             WHERE u.id = $1`,
            [id]
        );

        return { success: true, data: finalRes.rows[0] as unknown as User };
    });
}

/**
 * Toggles user active status
 */
export async function deactivateUser(
    session: AuthSession,
    id: string
): Promise<ApiResponse<{ deactivated: boolean }>> {
    return await withDbContext(session.user.id, session.activeCompanyId, session.role, session.user.company_id, async (client) => {
        // 1. Mark user as inactive
        const res = await client.query(
            "UPDATE users SET is_active = false, updated_at = now() WHERE id = $1",
            [id]
        );

        if (res.rowCount === 0) {
            return {
                success: false,
                error: { code: "NOT_FOUND", message: "User not found" },
            };
        }

        // 2. Immediate logout: Force clear all refresh tokens for this user
        await client.query("DELETE FROM public.refresh_tokens WHERE user_id = $1", [id]);

        return { success: true, data: { deactivated: true } };
    });
}
