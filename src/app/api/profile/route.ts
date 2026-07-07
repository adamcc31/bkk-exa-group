// ============================================
// Profile API — Get profile & change password
// GET   /api/profile  → current user's full profile
// PATCH /api/profile  → change password (all roles)
//                         or update email/name (admin only)
// ============================================

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/features/auth";
import * as authService from "@/features/auth/services/auth.service";
import { adminPool } from "@/shared/lib/db/client";

export const dynamic = "force-dynamic";

// GET /api/profile — return full profile
export async function GET() {
    const { session, error } = await requireAuth();
    if (error) return error;

    try {
        const res = await adminPool.query(
            `SELECT u.id, u.email, u.full_name, u.company_id, u.is_active, u.created_at,
                    r.name as role, c.name as company_name
             FROM public.users u
             JOIN public.roles r ON u.role_id = r.id
             JOIN public.companies c ON u.company_id = c.id
             WHERE u.id = $1`,
            [session.user.id]
        );

        if (res.rowCount === 0) {
            return NextResponse.json(
                { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: res.rows[0] });
    } catch (err: unknown) {
        return NextResponse.json(
            { success: false, error: { code: "DB_ERROR", message: (err as Error).message } },
            { status: 500 }
        );
    }
}

// PATCH /api/profile — change password or update profile
export async function PATCH(request: NextRequest) {
    const { session, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const { action } = body;

    // Action: change_password (all roles)
    if (action === "change_password") {
        const { current_password, new_password } = body;

        if (!current_password || !new_password) {
            return NextResponse.json(
                { success: false, error: { code: "VALIDATION_ERROR", message: "Password lama dan baru wajib diisi" } },
                { status: 400 }
            );
        }

        if (new_password.length < 8) {
            return NextResponse.json(
                { success: false, error: { code: "VALIDATION_ERROR", message: "Password baru minimal 8 karakter" } },
                { status: 400 }
            );
        }

        const result = await authService.changePassword(
            session.user.id,
            current_password,
            new_password
        );

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: { code: "INVALID_PASSWORD", message: result.error! } },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true, data: { message: "Password berhasil diubah. Silakan login kembali." } });
    }

    // Action: update_profile (admin only — email & full_name)
    if (action === "update_profile") {
        if (session.role !== "admin") {
            return NextResponse.json(
                { success: false, error: { code: "FORBIDDEN", message: "Hanya admin yang dapat mengubah email dan nama" } },
                { status: 403 }
            );
        }

        const { email, full_name, target_user_id } = body;
        const userId = target_user_id || session.user.id;

        if (!email && !full_name) {
            return NextResponse.json(
                { success: false, error: { code: "VALIDATION_ERROR", message: "Email atau nama lengkap wajib diisi" } },
                { status: 400 }
            );
        }

        try {
            const fields: string[] = [];
            const values: unknown[] = [];
            let i = 1;

            if (email) {
                // Check email uniqueness
                const emailCheck = await adminPool.query(
                    "SELECT id FROM public.users WHERE email = $1 AND id != $2",
                    [email, userId]
                );
                if (emailCheck.rowCount && emailCheck.rowCount > 0) {
                    return NextResponse.json(
                        { success: false, error: { code: "DUPLICATE", message: "Email sudah digunakan" } },
                        { status: 409 }
                    );
                }
                fields.push(`email = $${i++}`);
                values.push(email);
                // Also update auth_users email
                await adminPool.query(
                    "UPDATE public.auth_users SET email = $1 WHERE id = $2",
                    [email, userId]
                );
            }

            if (full_name) {
                fields.push(`full_name = $${i++}`);
                values.push(full_name);
            }

            if (fields.length > 0) {
                values.push(userId);
                await adminPool.query(
                    `UPDATE public.users SET ${fields.join(", ")}, updated_at = now() WHERE id = $${i}`,
                    values
                );
            }

            return NextResponse.json({ success: true, data: { message: "Profil berhasil diperbarui" } });
        } catch (err: unknown) {
            return NextResponse.json(
                { success: false, error: { code: "DB_ERROR", message: (err as Error).message } },
                { status: 500 }
            );
        }
    }

    return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Action tidak valid" } },
        { status: 400 }
    );
}
